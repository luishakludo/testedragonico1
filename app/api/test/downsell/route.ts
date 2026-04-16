import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// ---------------------------------------------------------------------------
// SUPABASE DIRETO - SEM DEPENDER DE NADA EXTERNO
// ---------------------------------------------------------------------------
const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dnVsb2puZnZnc2JtaHl2cXRuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI1OTQ1MywiZXhwIjoyMDg4ODM1NDUzfQ.piDbcvfzUQd8orOFUn7vE1cZ5RXMBFXTd8vKqJRA-Hg"

function getDb() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

// ---------------------------------------------------------------------------
// TIPOS
// ---------------------------------------------------------------------------
interface DownsellSequence {
  id: string
  message: string
  medias?: string[]
  sendDelayValue?: number
  sendDelayUnit?: string
  plans?: Array<{ id: string; buttonText: string; price: number }>
}

interface DownsellConfig {
  enabled?: boolean
  sequences?: DownsellSequence[]
}

interface FlowConfig {
  downsell?: DownsellConfig
  [key: string]: unknown
}

interface Bot {
  id: string
  name: string
  token: string | null
}

interface Flow {
  id: string
  name: string
  status: string
  bot_id: string | null
  config: FlowConfig | null
}

interface ScheduledMessage {
  id: string
  telegram_user_id: string
  telegram_chat_id: string
  sequence_id: string
  sequence_index: number
  scheduled_for: string
  status: string
  metadata: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// TELEGRAM HELPERS
// ---------------------------------------------------------------------------
async function telegramSend(token: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.json()
}

// ---------------------------------------------------------------------------
// GET /api/test/downsell
// 
// ENTRA E JA MOSTRA TUDO - SEM PREENCHER NADA
// 
// 1. Puxa todos os bots do banco
// 2. Puxa todos os fluxos
// 3. Analisa cada fluxo - ve se tem downsell configurado
// 4. Simula o que vai acontecer quando usuario der start
// 5. Mostra mensagens pendentes e se os timers estao certos
// ---------------------------------------------------------------------------
export async function GET() {
  const db = getDb()
  const agora = new Date()
  const agoraBR = agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })

  try {
    // =========================================================================
    // PASSO 1: PUXAR TUDO DO BANCO
    // =========================================================================
    const [botsRes, flowsRes, pendentesRes, flowBotsRes] = await Promise.all([
      db.from("bots").select("*"),
      db.from("flows").select("*"),
      db.from("scheduled_messages").select("*").eq("status", "pending").eq("message_type", "downsell"),
      db.from("flow_bots").select("*")
    ])

    const bots: Bot[] = (botsRes.data || []) as Bot[]
    const flows: Flow[] = (flowsRes.data || []) as Flow[]
    const pendentes: ScheduledMessage[] = (pendentesRes.data || []) as ScheduledMessage[]
    const flowBots = flowBotsRes.data || []

    // =========================================================================
    // PASSO 2: ANALISAR CADA FLUXO
    // =========================================================================
    const analiseFluxos: Array<{
      fluxo: string
      fluxo_id: string
      status: string
      bot_nome: string | null
      bot_id: string | null
      bot_token: string
      downsell_ativo: boolean
      total_sequencias: number
      sequencias: Array<{
        index: number
        id: string
        mensagem_preview: string
        delay_config: string
        delay_minutos: number
        enviaria_em_simulacao: string
        tem_midia: boolean
        qtd_midias: number
        tem_planos: boolean
        qtd_planos: number
        planos: Array<{ texto: string; preco: string }>
      }>
      problemas: string[]
      pronto_pra_usar: boolean
    }> = []

    for (const flow of flows) {
      const config = (flow.config || {}) as FlowConfig
      const downsell = config.downsell

      // Encontrar bot vinculado
      let botId = flow.bot_id
      if (!botId) {
        const fb = flowBots.find((fb: { flow_id: string; bot_id: string }) => fb.flow_id === flow.id)
        if (fb) botId = fb.bot_id
      }
      const bot = bots.find(b => b.id === botId)

      // Detectar problemas
      const problemas: string[] = []
      if (!botId) problemas.push("FLUXO SEM BOT VINCULADO")
      else if (!bot) problemas.push("BOT NAO EXISTE NO BANCO")
      else if (!bot.token) problemas.push("BOT SEM TOKEN CONFIGURADO")
      
      if (!downsell?.enabled) problemas.push("DOWNSELL DESATIVADO")
      if (!downsell?.sequences?.length) problemas.push("NENHUMA SEQUENCIA DE DOWNSELL")

      // Analisar sequencias
      const sequenciasAnalise: Array<{
        index: number
        id: string
        mensagem_preview: string
        delay_config: string
        delay_minutos: number
        enviaria_em_simulacao: string
        tem_midia: boolean
        qtd_midias: number
        tem_planos: boolean
        qtd_planos: number
        planos: Array<{ texto: string; preco: string }>
      }> = []

      if (downsell?.sequences) {
        for (let i = 0; i < downsell.sequences.length; i++) {
          const seq = downsell.sequences[i]
          
          // Calcular delay em minutos
          let delayMin = seq.sendDelayValue || 1
          const unit = seq.sendDelayUnit || "min"
          if (unit === "hours" || unit === "hour") delayMin *= 60
          if (unit === "days" || unit === "day") delayMin *= 1440

          // Simular quando enviaria
          const enviariaEm = new Date(agora.getTime() + delayMin * 60000)
          const enviariaEmBR = enviariaEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })

          sequenciasAnalise.push({
            index: i,
            id: seq.id,
            mensagem_preview: seq.message?.substring(0, 80) + (seq.message?.length > 80 ? "..." : "") || "(SEM MENSAGEM)",
            delay_config: `${seq.sendDelayValue || 1} ${unit}`,
            delay_minutos: delayMin,
            enviaria_em_simulacao: enviariaEmBR,
            tem_midia: (seq.medias?.length || 0) > 0,
            qtd_midias: seq.medias?.length || 0,
            tem_planos: (seq.plans?.length || 0) > 0,
            qtd_planos: seq.plans?.length || 0,
            planos: (seq.plans || []).map(p => ({
              texto: p.buttonText,
              preco: `R$ ${p.price?.toFixed(2).replace(".", ",") || "0,00"}`
            }))
          })
        }
      }

      analiseFluxos.push({
        fluxo: flow.name,
        fluxo_id: flow.id,
        status: flow.status,
        bot_nome: bot?.name || null,
        bot_id: botId,
        bot_token: bot?.token ? "CONFIGURADO" : "FALTANDO",
        downsell_ativo: downsell?.enabled || false,
        total_sequencias: sequenciasAnalise.length,
        sequencias: sequenciasAnalise,
        problemas,
        pronto_pra_usar: problemas.length === 0
      })
    }

    // =========================================================================
    // PASSO 3: ANALISAR MENSAGENS PENDENTES
    // =========================================================================
    const mensagensPendentes = pendentes.map(p => {
      const scheduledFor = new Date(p.scheduled_for)
      const jaPassou = scheduledFor < agora
      const diffMs = scheduledFor.getTime() - agora.getTime()
      const diffMin = Math.round(diffMs / 60000)

      return {
        id: p.id,
        usuario_telegram: p.telegram_user_id,
        chat_id: p.telegram_chat_id,
        sequencia_id: p.sequence_id,
        sequencia_index: p.sequence_index,
        agendado_para: scheduledFor.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        status: p.status,
        ja_passou_horario: jaPassou,
        tempo_restante: jaPassou ? "JA PASSOU - DEVERIA TER ENVIADO" : `${diffMin} minutos`,
        metadata: p.metadata
      }
    })

    // =========================================================================
    // PASSO 4: SIMULACAO COMPLETA
    // =========================================================================
    const fluxosProntos = analiseFluxos.filter(f => f.pronto_pra_usar)
    const fluxosComProblema = analiseFluxos.filter(f => !f.pronto_pra_usar)

    // Pegar primeiro fluxo pronto para simulacao detalhada
    let simulacao = null
    if (fluxosProntos.length > 0) {
      const fluxoSimular = fluxosProntos[0]
      const bot = bots.find(b => b.id === fluxoSimular.bot_id)
      
      simulacao = {
        titulo: "SIMULACAO: O QUE ACONTECE QUANDO USUARIO DA START",
        fluxo_usado: fluxoSimular.fluxo,
        bot_usado: fluxoSimular.bot_nome,
        passos: [
          {
            passo: 1,
            acao: "Usuario envia /start no bot",
            resultado: "Bot processa comando e inicia fluxo"
          },
          {
            passo: 2,
            acao: "Sistema agenda sequencias de downsell",
            resultado: `${fluxoSimular.total_sequencias} sequencia(s) serao agendadas`
          },
          ...fluxoSimular.sequencias.map((seq, i) => ({
            passo: 3 + i,
            acao: `Sequencia ${i + 1} dispara apos ${seq.delay_config}`,
            resultado: `Mensagem: "${seq.mensagem_preview}" | Midias: ${seq.qtd_midias} | Planos: ${seq.qtd_planos}`,
            enviaria_em: seq.enviaria_em_simulacao
          }))
        ],
        nota: "Os horarios de envio sao baseados em AGORA como referencia de /start"
      }
    }

    // =========================================================================
    // RESPOSTA FINAL
    // =========================================================================
    return NextResponse.json({
      // Header
      teste: "DOWNSELL_AUTOMATICO",
      hora_atual: agoraBR,
      
      // Resumo geral
      resumo: {
        total_bots: bots.length,
        total_fluxos: flows.length,
        fluxos_prontos: fluxosProntos.length,
        fluxos_com_problema: fluxosComProblema.length,
        mensagens_pendentes: pendentes.length
      },

      // Bots
      bots: bots.map(b => ({
        id: b.id,
        nome: b.name,
        token: b.token ? "OK" : "FALTA"
      })),

      // Fluxos prontos
      fluxos_prontos: fluxosProntos,

      // Fluxos com problema
      fluxos_com_problema: fluxosComProblema,

      // Mensagens pendentes
      mensagens_pendentes: mensagensPendentes.length > 0 ? mensagensPendentes : "NENHUMA MENSAGEM PENDENTE",

      // Simulacao
      simulacao: simulacao || "NENHUM FLUXO PRONTO PARA SIMULAR - CORRIJA OS PROBLEMAS ACIMA",

      // Instrucoes
      instrucoes: {
        como_testar_envio_real: "Use POST /api/test/downsell/enviar para disparar uma sequencia de teste no Telegram",
        nota: "Este GET apenas ANALISA e SIMULA - nao envia nada de verdade"
      }
    })

  } catch (err) {
    return NextResponse.json({
      erro: err instanceof Error ? err.message : "Erro desconhecido",
      stack: err instanceof Error ? err.stack : null
    }, { status: 500 })
  }
}

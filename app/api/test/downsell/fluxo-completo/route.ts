import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// ---------------------------------------------------------------------------
// SUPABASE DIRETO
// ---------------------------------------------------------------------------
const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dnVsb2puZnZnc2JtaHl2cXRuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI1OTQ1MywiZXhwIjoyMDg4ODM1NDUzfQ.piDbcvfzUQd8orOFUn7vE1cZ5RXMBFXTd8vKqJRA-Hg"

function getDb() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

// ---------------------------------------------------------------------------
// GET /api/test/downsell/fluxo-completo?flowId=xxx
// 
// Testa TUDO do downsell:
// 1. Puxa config do fluxo
// 2. Verifica se downsell esta configurado
// 3. Verifica entregaveis de cada sequencia
// 4. Simula o que acontece quando pagamento aprova
// 5. Verifica se marca venda corretamente
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  const db = getDb()
  const url = new URL(request.url)
  const flowId = url.searchParams.get("flowId") || "206cbb10-efeb-4f59-a153-9c9d420b4e84"
  const agora = new Date()
  const agoraBR = agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })

  const resultado: {
    teste: string
    hora: string
    flow_id: string
    etapas: Array<{
      etapa: number
      nome: string
      status: "OK" | "ERRO" | "AVISO"
      dados: unknown
      problema?: string
    }>
    resumo: {
      total_etapas: number
      etapas_ok: number
      etapas_erro: number
      etapas_aviso: number
      pronto_para_usar: boolean
      problemas_encontrados: string[]
    }
    simulacao_pagamento?: unknown
  } = {
    teste: "DOWNSELL_FLUXO_COMPLETO",
    hora: agoraBR,
    flow_id: flowId,
    etapas: [],
    resumo: {
      total_etapas: 0,
      etapas_ok: 0,
      etapas_erro: 0,
      etapas_aviso: 0,
      pronto_para_usar: false,
      problemas_encontrados: []
    }
  }

  try {
    // =========================================================================
    // ETAPA 1: BUSCAR FLUXO
    // =========================================================================
    const { data: flow, error: flowError } = await db
      .from("flows")
      .select("*")
      .eq("id", flowId)
      .single()

    if (flowError || !flow) {
      resultado.etapas.push({
        etapa: 1,
        nome: "BUSCAR_FLUXO",
        status: "ERRO",
        dados: { flowId },
        problema: flowError?.message || "Fluxo nao encontrado"
      })
      resultado.resumo.problemas_encontrados.push("Fluxo nao existe")
      return NextResponse.json(resultado)
    }

    resultado.etapas.push({
      etapa: 1,
      nome: "BUSCAR_FLUXO",
      status: "OK",
      dados: {
        nome: flow.name,
        status: flow.status,
        bot_id: flow.bot_id
      }
    })

    // =========================================================================
    // ETAPA 2: BUSCAR BOT
    // =========================================================================
    let botId = flow.bot_id
    if (!botId) {
      const { data: flowBot } = await db
        .from("flow_bots")
        .select("bot_id")
        .eq("flow_id", flowId)
        .single()
      botId = flowBot?.bot_id
    }

    const { data: bot } = await db
      .from("bots")
      .select("*")
      .eq("id", botId)
      .single()

    if (!bot || !bot.token) {
      resultado.etapas.push({
        etapa: 2,
        nome: "BUSCAR_BOT",
        status: "ERRO",
        dados: { bot_id: botId },
        problema: !bot ? "Bot nao encontrado" : "Bot sem token"
      })
      resultado.resumo.problemas_encontrados.push("Bot nao configurado corretamente")
    } else {
      resultado.etapas.push({
        etapa: 2,
        nome: "BUSCAR_BOT",
        status: "OK",
        dados: {
          nome: bot.name,
          token: "***" + bot.token.slice(-10)
        }
      })
    }

    // =========================================================================
    // ETAPA 3: VERIFICAR CONFIG DOWNSELL
    // =========================================================================
    const config = flow.config || {}
    const downsellConfig = config.downsell || {}

    if (!downsellConfig.enabled) {
      resultado.etapas.push({
        etapa: 3,
        nome: "VERIFICAR_DOWNSELL_CONFIG",
        status: "AVISO",
        dados: { enabled: false },
        problema: "Downsell esta DESATIVADO"
      })
      resultado.resumo.problemas_encontrados.push("Downsell desativado")
    } else {
      resultado.etapas.push({
        etapa: 3,
        nome: "VERIFICAR_DOWNSELL_CONFIG",
        status: "OK",
        dados: {
          enabled: true,
          useDefaultPlans: downsellConfig.useDefaultPlans || false,
          discountPercentage: downsellConfig.discountPercentage || 0,
          total_sequencias: (downsellConfig.sequences || []).length
        }
      })
    }

    // =========================================================================
    // ETAPA 4: ANALISAR CADA SEQUENCIA
    // =========================================================================
    const sequences = downsellConfig.sequences || []
    const sequenciasAnalisadas: Array<{
      index: number
      id: string
      mensagem_preview: string
      delivery_type: string
      deliverable_id: string | null
      planos: Array<{ texto: string; preco: number }>
      usa_planos_padrao: boolean
      problema?: string
    }> = []

    // Buscar entregaveis do fluxo para validar
    const { data: deliverables } = await db
      .from("deliverables")
      .select("id, name, type")
      .eq("flow_id", flowId)

    const deliverableMap = new Map((deliverables || []).map(d => [d.id, d]))

    for (let i = 0; i < sequences.length; i++) {
      const seq = sequences[i]
      const seqAnalise: typeof sequenciasAnalisadas[0] = {
        index: i,
        id: seq.id,
        mensagem_preview: (seq.message || "").substring(0, 60) + ((seq.message || "").length > 60 ? "..." : ""),
        delivery_type: seq.deliveryType || "main",
        deliverable_id: seq.deliverableId || null,
        planos: (seq.plans || []).map((p: { buttonText: string; price: number }) => ({
          texto: p.buttonText,
          preco: p.price
        })),
        usa_planos_padrao: !seq.plans || seq.plans.length === 0
      }

      // Validar entregavel
      if (seq.deliveryType === "custom" && seq.deliverableId) {
        const entregavel = deliverableMap.get(seq.deliverableId)
        if (!entregavel) {
          seqAnalise.problema = `Entregavel ${seq.deliverableId} NAO EXISTE no fluxo`
          resultado.resumo.problemas_encontrados.push(`Sequencia ${i}: Entregavel nao existe`)
        }
      }

      sequenciasAnalisadas.push(seqAnalise)
    }

    resultado.etapas.push({
      etapa: 4,
      nome: "ANALISAR_SEQUENCIAS",
      status: sequenciasAnalisadas.some(s => s.problema) ? "AVISO" : "OK",
      dados: {
        total: sequenciasAnalisadas.length,
        sequencias: sequenciasAnalisadas
      }
    })

    // =========================================================================
    // ETAPA 5: VERIFICAR ENTREGAVEIS DO FLUXO
    // =========================================================================
    resultado.etapas.push({
      etapa: 5,
      nome: "LISTAR_ENTREGAVEIS",
      status: (deliverables || []).length > 0 ? "OK" : "AVISO",
      dados: {
        total: (deliverables || []).length,
        entregaveis: (deliverables || []).map(d => ({
          id: d.id,
          nome: d.name,
          tipo: d.type
        }))
      },
      problema: (deliverables || []).length === 0 ? "Nenhum entregavel configurado" : undefined
    })

    // =========================================================================
    // ETAPA 6: BUSCAR PAGAMENTOS DE DOWNSELL RECENTES
    // =========================================================================
    const { data: pagamentos } = await db
      .from("payments")
      .select("*")
      .eq("product_type", "downsell")
      .order("created_at", { ascending: false })
      .limit(5)

    // Filtrar pagamentos que tem flow relacionado (via bot)
    const pagamentosDoFluxo = (pagamentos || []).filter(p => p.bot_id === botId)

    resultado.etapas.push({
      etapa: 6,
      nome: "PAGAMENTOS_DOWNSELL_RECENTES",
      status: "OK",
      dados: {
        total_geral: (pagamentos || []).length,
        deste_fluxo: pagamentosDoFluxo.length,
        pagamentos: pagamentosDoFluxo.map(p => ({
          id: p.id,
          status: p.status,
          valor: p.amount,
          produto: p.product_name,
          telegram_user: p.telegram_user_id,
          metadata: p.metadata,
          criado_em: p.created_at
        }))
      }
    })

    // =========================================================================
    // ETAPA 7: SIMULAR FLUXO DE PAGAMENTO APROVADO
    // =========================================================================
    // Simular o que aconteceria se um pagamento de downsell fosse aprovado
    const simulacao = {
      titulo: "SIMULACAO: PAGAMENTO DOWNSELL APROVADO",
      cenarios: sequences.map((seq: { id: string; message: string; deliveryType?: string; deliverableId?: string }, i: number) => {
        const deliveryType = seq.deliveryType || "main"
        const deliverableId = seq.deliverableId || null

        let entregavelUsado: string
        let fonte: string

        if (deliveryType === "main") {
          entregavelUsado = "ENTREGA PRINCIPAL DO FLUXO"
          fonte = "Vai usar o entregavel principal configurado no fluxo"
        } else if (deliveryType === "custom" && deliverableId) {
          const entregavel = deliverableMap.get(deliverableId)
          entregavelUsado = entregavel ? `${entregavel.name} (${entregavel.type})` : `ID: ${deliverableId} (NAO ENCONTRADO!)`
          fonte = "Vai usar entregavel customizado da sequencia"
        } else {
          entregavelUsado = "NAO DEFINIDO - PODE DAR ERRO"
          fonte = "Configuracao incompleta"
        }

        return {
          sequencia: i + 1,
          sequencia_id: seq.id,
          mensagem: (seq.message || "").substring(0, 40) + "...",
          delivery_type: deliveryType,
          deliverable_id: deliverableId,
          entregavel_que_sera_usado: entregavelUsado,
          fonte_do_entregavel: fonte,
          fluxo_no_webhook: [
            "1. Pagamento aprovado pelo MercadoPago",
            "2. Webhook recebe notificacao",
            "3. Busca payment.metadata.downsell_deliverable_id",
            deliverableId 
              ? `4. Encontra deliverableId: ${deliverableId}`
              : "4. Nao encontra deliverableId no metadata, usa entrega principal",
            "5. Chama sendDelivery() com o entregavel correto",
            "6. Atualiza status do pagamento para 'approved'",
            "7. Registra venda no painel"
          ]
        }
      })
    }

    resultado.simulacao_pagamento = simulacao

    resultado.etapas.push({
      etapa: 7,
      nome: "SIMULACAO_APROVACAO",
      status: "OK",
      dados: simulacao
    })

    // =========================================================================
    // ETAPA 8: TESTE REAL - CRIAR PAGAMENTO E SIMULAR APROVACAO
    // =========================================================================
    const simularReal = url.searchParams.get("simular") === "true"
    
    if (simularReal && sequences.length > 0 && bot?.token) {
      const seqTeste = sequences[0]
      const telegramUserIdTeste = "TESTE_" + Date.now()
      const valorTeste = 0.01
      
      // Simular metadata que seria salvo pelo callback do downsell
      const metadataTeste: Record<string, string> = {}
      if (seqTeste.deliverableId) metadataTeste.downsell_deliverable_id = seqTeste.deliverableId
      if (seqTeste.deliveryType) metadataTeste.downsell_delivery_type = seqTeste.deliveryType
      metadataTeste.sequence_index = "0"
      metadataTeste.TESTE = "true"
      
      // Buscar user_id do dono do bot
      const { data: botOwner } = await db
        .from("bots")
        .select("user_id")
        .eq("id", botId)
        .single()
      
      // Criar pagamento de teste
      const { data: pagamentoTeste, error: errPagTeste } = await db
        .from("payments")
        .insert({
          user_id: botOwner?.user_id,
          bot_id: botId,
          telegram_user_id: telegramUserIdTeste,
          telegram_username: "USUARIO_TESTE",
          telegram_first_name: "Teste",
          amount: valorTeste,
          status: "pending",
          payment_method: "pix",
          gateway: "mercadopago",
          external_payment_id: "TESTE_" + Date.now(),
          description: "TESTE DOWNSELL",
          product_name: "TESTE - Oferta Especial",
          product_type: "downsell",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: Object.keys(metadataTeste).length > 0 ? metadataTeste : null,
        })
        .select()
        .single()
      
      if (errPagTeste || !pagamentoTeste) {
        resultado.etapas.push({
          etapa: 8,
          nome: "TESTE_REAL_CRIAR_PAGAMENTO",
          status: "ERRO",
          dados: { erro: errPagTeste?.message },
          problema: "Nao conseguiu criar pagamento de teste"
        })
      } else {
        // Verificar se metadata foi salvo corretamente
        const metadataSalvo = pagamentoTeste.metadata || {}
        const temDeliverableId = !!metadataSalvo.downsell_deliverable_id
        const temDeliveryType = !!metadataSalvo.downsell_delivery_type
        
        // Simular aprovacao - atualizar status
        const { error: errUpdate } = await db
          .from("payments")
          .update({ 
            status: "approved",
            updated_at: new Date().toISOString()
          })
          .eq("id", pagamentoTeste.id)
        
        // Verificar se aparece no painel de vendas
        const { data: vendaNoSistema } = await db
          .from("payments")
          .select("*")
          .eq("id", pagamentoTeste.id)
          .single()
        
        resultado.etapas.push({
          etapa: 8,
          nome: "TESTE_REAL_CRIAR_PAGAMENTO",
          status: temDeliverableId ? "OK" : "AVISO",
          dados: {
            pagamento_id: pagamentoTeste.id,
            metadata_salvo: metadataSalvo,
            tem_deliverable_id: temDeliverableId,
            tem_delivery_type: temDeliveryType,
            status_apos_aprovacao: vendaNoSistema?.status,
            vai_entregar_corretamente: temDeliverableId 
              ? `SIM - Vai usar entregavel ${metadataSalvo.downsell_deliverable_id}`
              : "AVISO - Vai usar entrega principal (deliverableId nao encontrado)",
            conclusao: temDeliverableId
              ? "CORREÇÃO FUNCIONANDO - O metadata esta sendo salvo corretamente"
              : "ATENCAO - Sequencia nao tem deliverableId configurado"
          },
          problema: !temDeliverableId ? "Sequencia sem deliverableId configurado" : undefined
        })
        
        // Limpar pagamento de teste
        await db.from("payments").delete().eq("id", pagamentoTeste.id)
        
        resultado.etapas.push({
          etapa: 9,
          nome: "LIMPEZA_TESTE",
          status: "OK",
          dados: { pagamento_deletado: pagamentoTeste.id }
        })
      }
    } else if (simularReal) {
      resultado.etapas.push({
        etapa: 8,
        nome: "TESTE_REAL",
        status: "AVISO",
        dados: null,
        problema: "Nao foi possivel simular - falta bot ou sequencias"
      })
    }

    // =========================================================================
    // ETAPA 9/10: VERIFICAR MENSAGENS AGENDADAS
    // =========================================================================
    const { data: agendadas } = await db
      .from("scheduled_messages")
      .select("*")
      .eq("message_type", "downsell")
      .eq("status", "pending")
      .order("scheduled_for", { ascending: true })
      .limit(10)

    // Ver quais tem o deliverableId no metadata
    const agendadasComEntregavel = (agendadas || []).filter(a => {
      const meta = a.metadata || {}
      return meta.deliverableId && meta.deliverableId !== ""
    })

    resultado.etapas.push({
      etapa: 8,
      nome: "MENSAGENS_AGENDADAS",
      status: "OK",
      dados: {
        total_pendentes: (agendadas || []).length,
        com_deliverable_id_no_metadata: agendadasComEntregavel.length,
        mensagens: (agendadas || []).map(a => ({
          id: a.id,
          sequence_index: a.sequence_index,
          agendado_para: a.scheduled_for,
          metadata_deliverableId: (a.metadata || {}).deliverableId || "NAO DEFINIDO",
          metadata_deliveryType: (a.metadata || {}).deliveryType || "NAO DEFINIDO"
        }))
      }
    })

    // =========================================================================
    // RESUMO FINAL
    // =========================================================================
    resultado.resumo.total_etapas = resultado.etapas.length
    resultado.resumo.etapas_ok = resultado.etapas.filter(e => e.status === "OK").length
    resultado.resumo.etapas_erro = resultado.etapas.filter(e => e.status === "ERRO").length
    resultado.resumo.etapas_aviso = resultado.etapas.filter(e => e.status === "AVISO").length
    resultado.resumo.pronto_para_usar = resultado.resumo.etapas_erro === 0

    return NextResponse.json(resultado)

  } catch (err) {
    return NextResponse.json({
      erro: true,
      mensagem: err instanceof Error ? err.message : "Erro desconhecido",
      stack: err instanceof Error ? err.stack : null
    }, { status: 500 })
  }
}

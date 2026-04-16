import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import MercadoPagoConfig, { Payment } from "mercadopago"

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
// TELEGRAM
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
// GET /api/test/downsell/enviar?chat=SEU_CHAT_ID
// 
// FAZ TUDO AUTOMATICO:
// 1. Busca fluxo com downsell
// 2. Envia a mensagem de downsell
// 3. SIMULA O CLIQUE NO BOTAO
// 4. Busca gateway de pagamento
// 5. Gera o PIX
// 6. Envia o PIX no Telegram
// 7. Mostra todos os logs do que aconteceu
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const db = getDb()
  const logs: string[] = []
  const log = (msg: string) => { logs.push(`[${new Date().toLocaleTimeString("pt-BR")}] ${msg}`) }

  const chatIdParam = request.nextUrl.searchParams.get("chat")

  if (!chatIdParam) {
    return NextResponse.json({
      erro: "Passe seu chat_id na URL",
      como_descobrir: "Mande qualquer mensagem pro @userinfobot no Telegram - ele responde com seu ID",
      exemplo: "/api/test/downsell/enviar?chat=5099610171"
    }, { status: 400 })
  }

  try {
    log("Iniciando teste completo de downsell...")
    log(`Chat destino: ${chatIdParam}`)

    // =========================================================================
    // PASSO 1: BUSCAR DADOS DO BANCO
    // =========================================================================
    log("Buscando bots, fluxos e flow_bots...")
    const [botsRes, flowsRes, flowBotsRes] = await Promise.all([
      db.from("bots").select("*"),
      db.from("flows").select("*"),
      db.from("flow_bots").select("*")
    ])

    const bots = botsRes.data || []
    const flows = flowsRes.data || []
    const flowBots = flowBotsRes.data || []

    log(`Encontrados: ${bots.length} bots, ${flows.length} fluxos, ${flowBots.length} vinculos`)

    // =========================================================================
    // PASSO 2: ENCONTRAR FLUXO COM DOWNSELL ATIVO
    // =========================================================================
    log("Procurando fluxo com downsell ativo...")
    
    let fluxoAlvo: { id: string; name: string; bot_id: string | null; config: Record<string, unknown> } | null = null
    let botAlvo: { id: string; name: string; token: string; user_id: string } | null = null
    let sequenciaAlvo: {
      id: string
      message: string
      medias?: string[]
      plans?: Array<{ id: string; buttonText: string; price: number }>
    } | null = null

    for (const flow of flows) {
      const config = (flow.config || {}) as Record<string, unknown>
      const downsell = config.downsell as { 
        enabled?: boolean
        sequences?: Array<{
          id: string
          message: string
          medias?: string[]
          plans?: Array<{ id: string; buttonText: string; price: number }>
        }> 
      }

      if (!downsell?.enabled) {
        log(`Fluxo "${flow.name}": downsell desabilitado`)
        continue
      }
      
      if (!downsell?.sequences?.length) {
        log(`Fluxo "${flow.name}": sem sequencias`)
        continue
      }

      // Encontrar bot vinculado
      let botId = flow.bot_id
      if (!botId) {
        const fb = flowBots.find((fb: { flow_id: string; bot_id: string }) => fb.flow_id === flow.id)
        if (fb) botId = fb.bot_id
      }

      if (!botId) {
        log(`Fluxo "${flow.name}": sem bot vinculado`)
        continue
      }

      const bot = bots.find((b: { id: string }) => b.id === botId)
      if (!bot?.token) {
        log(`Fluxo "${flow.name}": bot sem token`)
        continue
      }

      // Pegar primeira sequencia com planos
      const seq = downsell.sequences.find(s => s.plans && s.plans.length > 0)
      if (!seq) {
        log(`Fluxo "${flow.name}": sequencias sem planos`)
        continue
      }

      // Encontrou tudo!
      fluxoAlvo = flow
      botAlvo = bot
      sequenciaAlvo = seq
      log(`Fluxo "${flow.name}": OK! Bot: ${bot.name}`)
      break
    }

    if (!fluxoAlvo || !botAlvo || !sequenciaAlvo) {
      return NextResponse.json({
        erro: "Nenhum fluxo com downsell pronto encontrado",
        logs
      }, { status: 400 })
    }

    // =========================================================================
    // PASSO 3: VALIDAR TOKEN DO BOT
    // =========================================================================
    log("Validando token do bot...")
    const botInfo = await telegramSend(botAlvo.token, "getMe", {})
    if (!botInfo.ok) {
      return NextResponse.json({
        erro: "Token do bot invalido",
        bot: botAlvo.name,
        telegram_response: botInfo,
        logs
      }, { status: 400 })
    }
    log(`Bot validado: @${botInfo.result.username}`)

    // =========================================================================
    // PASSO 4: ENVIAR MENSAGEM DE DOWNSELL
    // =========================================================================
    log("Enviando mensagem de downsell...")
    
    const mensagem = sequenciaAlvo.message || "Oferta especial para voce!"
    const midias = sequenciaAlvo.medias || []
    const planos = sequenciaAlvo.plans || []

    // Enviar midia se tiver
    if (midias.length > 0) {
      log(`Enviando ${midias.length} midia(s)...`)
      const primeiraMedia = midias[0]
      
      if (primeiraMedia.includes("video") || primeiraMedia.includes("mp4")) {
        await telegramSend(botAlvo.token, "sendVideo", {
          chat_id: chatIdParam,
          video: primeiraMedia,
          caption: mensagem,
          parse_mode: "HTML"
        })
      } else {
        await telegramSend(botAlvo.token, "sendPhoto", {
          chat_id: chatIdParam,
          photo: primeiraMedia,
          caption: mensagem,
          parse_mode: "HTML"
        })
      }
      log("Midia enviada!")
    } else {
      // So texto
      await telegramSend(botAlvo.token, "sendMessage", {
        chat_id: chatIdParam,
        text: mensagem,
        parse_mode: "HTML"
      })
      log("Mensagem enviada!")
    }

    // Enviar botoes dos planos
    // USAR O MESMO CALLBACK DOS PLANOS NORMAIS: plan_${planId}
    // Criar plano temporario na tabela flow_plans (IGUAL aos planos de boas vindas)
    if (planos.length > 0) {
      log(`Criando ${planos.length} plano(s) na tabela flow_plans...`)
      
      const planButtons: Array<Array<{ text: string; callback_data: string }>> = []
      
      for (const plan of planos) {
        // Criar plano na flow_plans com o preco do downsell
        const tempPlanId = `ds_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
        
        const { error: insertError } = await db.from("flow_plans").insert({
          id: tempPlanId,
          flow_id: fluxoAlvo!.id,
          name: plan.buttonText,
          price: plan.price,
          is_active: true,
          position: 999,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        
        if (!insertError) {
          // Usar callback IGUAL aos planos normais: plan_${planId}
          planButtons.push([{
            text: plan.buttonText,
            callback_data: `plan_${tempPlanId}`
          }])
          log(`Plano criado: ${tempPlanId}`)
        } else {
          log(`Erro ao criar plano: ${insertError.message}`)
        }
      }
      
      if (planButtons.length > 0) {
        await telegramSend(botAlvo.token, "sendMessage", {
          chat_id: chatIdParam,
          text: "Clique abaixo para aproveitar:",
          reply_markup: { inline_keyboard: planButtons }
        })
        log("Botoes enviados com callback plan_!")
      }
    }

    // =========================================================================
    // PASSO 5: SIMULAR CLIQUE NO BOTAO (GERAR PIX)
    // =========================================================================
    log("=== SIMULANDO CLIQUE NO BOTAO ===")
    
    const planoSelecionado = planos[0]
    if (!planoSelecionado) {
      return NextResponse.json({
        erro: "Nenhum plano configurado na sequencia de downsell",
        sequencia: sequenciaAlvo,
        logs
      }, { status: 400 })
    }

    log(`Plano selecionado: ${planoSelecionado.buttonText} - R$ ${planoSelecionado.price}`)

    // =========================================================================
    // PASSO 6: BUSCAR GATEWAY DE PAGAMENTO
    // =========================================================================
    log("Buscando gateway de pagamento...")
    log(`user_id do bot: ${botAlvo.user_id}`)

    // Primeiro tenta user_gateways (igual os planos normais)
    const { data: gateway, error: gatewayError } = await db
      .from("user_gateways")
      .select("*")
      .eq("user_id", botAlvo.user_id)
      .eq("is_active", true)
      .limit(1)
      .single()

    let accessToken: string | null = null
    let gatewayNome = ""

    if (gateway?.access_token) {
      accessToken = gateway.access_token
      gatewayNome = `user_gateways (${gateway.gateway_name})`
      log(`Gateway encontrado em user_gateways: ${gateway.gateway_name}`)
    } else {
      log(`user_gateways: nao encontrado (${gatewayError?.message || "sem erro"})`)
      
      // Tenta payment_gateways como fallback
      log("Tentando payment_gateways...")
      const { data: gatewayAlt, error: gatewayAltError } = await db
        .from("payment_gateways")
        .select("*")
        .eq("bot_id", botAlvo.id)
        .eq("is_active", true)
        .limit(1)
        .single()

      if (gatewayAlt) {
        accessToken = gatewayAlt.credentials?.access_token || gatewayAlt.access_token
        gatewayNome = `payment_gateways (${gatewayAlt.gateway_name})`
        log(`Gateway encontrado em payment_gateways: ${gatewayAlt.gateway_name}`)
      } else {
        log(`payment_gateways: nao encontrado (${gatewayAltError?.message || "sem erro"})`)
      }
    }

    if (!accessToken) {
      return NextResponse.json({
        erro: "GATEWAY NAO ENCONTRADO",
        detalhes: "Nenhum gateway de pagamento configurado",
        user_id: botAlvo.user_id,
        bot_id: botAlvo.id,
        tabelas_verificadas: ["user_gateways", "payment_gateways"],
        logs
      }, { status: 400 })
    }

    // =========================================================================
    // PASSO 7: GERAR PIX
    // =========================================================================
    log("Gerando PIX via MercadoPago...")
    
    try {
      const client = new MercadoPagoConfig({ accessToken })
      const payment = new Payment(client)
      
      const pixResult = await payment.create({
        body: {
          transaction_amount: planoSelecionado.price,
          description: `Downsell - ${planoSelecionado.buttonText}`,
          payment_method_id: "pix",
          payer: {
            email: "teste@teste.com"
          }
        }
      })

      log(`PIX gerado com sucesso! ID: ${pixResult.id}`)

      const qrCodeBase64 = pixResult.point_of_interaction?.transaction_data?.qr_code_base64
      const copyPaste = pixResult.point_of_interaction?.transaction_data?.qr_code

      // =========================================================================
      // PASSO 8: ENVIAR PIX NO TELEGRAM
      // =========================================================================
      log("Enviando PIX no Telegram...")

      // Enviar QR Code como imagem
      if (qrCodeBase64) {
        log("Enviando QR Code...")
        await telegramSend(botAlvo.token, "sendPhoto", {
          chat_id: chatIdParam,
          photo: `data:image/png;base64,${qrCodeBase64}`,
          caption: `Pague R$ ${planoSelecionado.price.toFixed(2).replace(".", ",")} via PIX`
        })
      }

      // Enviar codigo copia e cola
      if (copyPaste) {
        log("Enviando codigo copia e cola...")
        await telegramSend(botAlvo.token, "sendMessage", {
          chat_id: chatIdParam,
          text: `<b>Copie o codigo PIX abaixo:</b>\n\n<code>${copyPaste}</code>`,
          parse_mode: "HTML"
        })
      }

      log("=== TESTE COMPLETO! ===")

      return NextResponse.json({
        sucesso: true,
        teste: "DOWNSELL_COMPLETO",
        resumo: {
          fluxo: fluxoAlvo.name,
          bot: `@${botInfo.result.username}`,
          plano: planoSelecionado.buttonText,
          valor: `R$ ${planoSelecionado.price}`,
          gateway: gatewayNome,
          payment_id: pixResult.id
        },
        pix: {
          tem_qrcode: !!qrCodeBase64,
          tem_copypaste: !!copyPaste
        },
        logs
      })

    } catch (pixError) {
      const errorMsg = pixError instanceof Error ? pixError.message : String(pixError)
      log(`ERRO ao gerar PIX: ${errorMsg}`)
      
      return NextResponse.json({
        erro: "Erro ao gerar PIX",
        mensagem: errorMsg,
        gateway_usado: gatewayNome,
        logs
      }, { status: 400 })
    }

  } catch (err) {
    return NextResponse.json({
      erro: err instanceof Error ? err.message : "Erro desconhecido",
      logs
    }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// ---------------------------------------------------------------------------
// SUPABASE DIRETO (mesmo do fluxo-completo)
// ---------------------------------------------------------------------------
const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dnVsb2puZnZnc2JtaHl2cXRuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI1OTQ1MywiZXhwIjoyMDg4ODM1NDUzfQ.piDbcvfzUQd8orOFUn7vE1cZ5RXMBFXTd8vKqJRA-Hg"

function getDb() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

const TELEGRAM_API = "https://api.telegram.org/bot"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendTelegramMessage(token: string, chatId: number, text: string, replyMarkup?: any) {
  const response = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: replyMarkup
    })
  })
  return response.json()
}

async function createVipInviteLink(botToken: string, groupId: string): Promise<string | null> {
  try {
    const response = await fetch(`${TELEGRAM_API}${botToken}/createChatInviteLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: groupId,
        member_limit: 1,
        creates_join_request: false
      })
    })
    const data = await response.json()
    if (data.ok && data.result?.invite_link) {
      return data.result.invite_link
    }
    console.log("[TEST] Erro ao criar link VIP:", data)
    return null
  } catch (error) {
    console.error("[TEST] Erro ao criar link VIP:", error)
    return null
  }
}

interface Deliverable {
  id: string
  name: string
  type: "link" | "vip_group" | "file" | "text"
  content?: string
  vipGroupId?: string
  vipGroupName?: string
  buttonText?: string
  message?: string
}

async function sendDeliverable(
  botToken: string,
  chatId: number,
  deliverable: Deliverable
) {
  console.log(`[TEST] Enviando entregavel: ${deliverable.name} (${deliverable.type})`)

  switch (deliverable.type) {
    case "link": {
      const buttonText = deliverable.buttonText || "Acessar Conteudo"
      const message = deliverable.message || "Obrigado pela compra! Seu acesso foi liberado."
      const keyboard = {
        inline_keyboard: [
          [{ text: buttonText, url: deliverable.content }]
        ]
      }
      await sendTelegramMessage(botToken, chatId, message, keyboard)
      break
    }

    case "vip_group": {
      const inviteLink = await createVipInviteLink(botToken, deliverable.vipGroupId!)
      if (inviteLink) {
        const groupName = deliverable.vipGroupName || "Grupo VIP"
        const message = deliverable.message || `Obrigado pela compra! Seu acesso ao <b>${groupName}</b> foi liberado.`
        const keyboard = {
          inline_keyboard: [
            [{ text: `Entrar no ${groupName}`, url: inviteLink }]
          ]
        }
        await sendTelegramMessage(botToken, chatId, message, keyboard)
      } else {
        await sendTelegramMessage(
          botToken,
          chatId,
          "Obrigado pela compra! Houve um problema ao gerar seu acesso. Entre em contato com o suporte."
        )
      }
      break
    }

    case "file": {
      const message = deliverable.message || "Obrigado pela compra! Aqui esta seu arquivo:"
      await sendTelegramMessage(botToken, chatId, message)
      // Enviar arquivo
      if (deliverable.content) {
        await fetch(`${TELEGRAM_API}${botToken}/sendDocument`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            document: deliverable.content
          })
        })
      }
      break
    }

    case "text": {
      const message = deliverable.message || deliverable.content || "Obrigado pela compra!"
      await sendTelegramMessage(botToken, chatId, message)
      break
    }

    default:
      await sendTelegramMessage(botToken, chatId, "Obrigado pela compra! Seu acesso foi liberado.")
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const flowId = searchParams.get("flowId")
  const chatId = searchParams.get("chatId") || "5099610171" // Seu chat ID padrao

  if (!flowId) {
    return NextResponse.json({ error: "flowId obrigatorio" }, { status: 400 })
  }

  const supabase = getDb()

  const resultado: {
    sucesso: boolean
    etapas: Array<{ nome: string; status: string; dados?: unknown }>
    erro?: string
  } = {
    sucesso: false,
    etapas: []
  }

  try {
    // 1. Buscar o fluxo
    const { data: flow, error: flowError } = await supabase
      .from("flows")
      .select("id, name, config, bot_id")
      .eq("id", flowId)
      .single()

    if (flowError || !flow) {
      return NextResponse.json({ error: "Fluxo nao encontrado", flowError }, { status: 404 })
    }

    resultado.etapas.push({
      nome: "BUSCAR_FLUXO",
      status: "OK",
      dados: { flow_id: flow.id, flow_name: flow.name }
    })

    const config = flow.config as Record<string, unknown>
    const deliverables = (config.deliverables || []) as Deliverable[]
    const downsellConfig = config.downsell as { enabled?: boolean; sequences?: Array<{ id: string; deliveryType?: string; deliverableId?: string }> } | undefined

    // 2. Buscar o bot (via flow_bots ou direto)
    let botId = flow.bot_id
    let botToken = ""
    
    // Se nao tem bot_id direto, buscar via flow_bots
    if (!botId) {
      const { data: flowBot } = await supabase
        .from("flow_bots")
        .select("bot_id")
        .eq("flow_id", flowId)
        .limit(1)
        .single()
      
      if (flowBot?.bot_id) {
        botId = flowBot.bot_id
      }
    }
    
    if (!botId) {
      return NextResponse.json({ error: "Bot nao encontrado - flow nao tem bot vinculado" }, { status: 404 })
    }
    
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("id, token")
      .eq("id", botId)
      .single()

    if (botError || !bot) {
      return NextResponse.json({ error: "Bot nao encontrado na tabela bots", botError }, { status: 404 })
    }
    
    botToken = bot.token

    resultado.etapas.push({
      nome: "BUSCAR_BOT",
      status: "OK",
      dados: { bot_id: bot.id }
    })

    // 3. Determinar qual entregavel usar (simulando o fallback final do callback)
    let deliverableIdFinal = ""
    let deliveryTypeFinal = ""
    let metodoUsado = ""

    const sequences = downsellConfig?.sequences || []
    
    if (sequences.length === 1 && sequences[0].deliverableId) {
      deliverableIdFinal = sequences[0].deliverableId
      deliveryTypeFinal = sequences[0].deliveryType || "custom"
      metodoUsado = "UNICA_SEQUENCIA"
    } else if (sequences.length > 1) {
      const firstWithDeliverable = sequences.find(s => s.deliveryType === "custom" && s.deliverableId)
      if (firstWithDeliverable) {
        deliverableIdFinal = firstWithDeliverable.deliverableId!
        deliveryTypeFinal = firstWithDeliverable.deliveryType!
        metodoUsado = "PRIMEIRA_COM_ENTREGAVEL_CUSTOMIZADO"
      }
    }

    // Fallback para main se nao encontrou
    if (!deliverableIdFinal) {
      deliveryTypeFinal = "main"
      metodoUsado = "FALLBACK_MAIN"
    }

    const entregavelEscolhido = deliverables.find(d => d.id === deliverableIdFinal)

    resultado.etapas.push({
      nome: "DETERMINAR_ENTREGAVEL",
      status: entregavelEscolhido ? "OK" : (deliveryTypeFinal === "main" ? "AVISO" : "ERRO"),
      dados: {
        metodo_usado: metodoUsado,
        deliverable_id: deliverableIdFinal || "NENHUM",
        delivery_type: deliveryTypeFinal,
        entregavel_encontrado: entregavelEscolhido ? {
          id: entregavelEscolhido.id,
          nome: entregavelEscolhido.name,
          tipo: entregavelEscolhido.type,
          conteudo: entregavelEscolhido.type === "link" ? entregavelEscolhido.content : "(nao mostrado)"
        } : null,
        total_sequencias: sequences.length,
        total_deliverables: deliverables.length
      }
    })

    // 4. Enviar a entrega real para o Telegram
    const chatIdNum = parseInt(chatId, 10)
    
    // Primeiro, enviar uma mensagem de teste para verificar se o bot funciona
    const testeMsg = await sendTelegramMessage(botToken, chatIdNum, "[TESTE] Simulando pagamento de downsell aprovado...")
    
    resultado.etapas.push({
      nome: "TESTE_CONEXAO_TELEGRAM",
      status: testeMsg.ok ? "OK" : "ERRO",
      dados: {
        chat_id: chatIdNum,
        bot_token_inicio: botToken.substring(0, 10) + "...",
        resposta_telegram: testeMsg
      }
    })
    
    if (entregavelEscolhido) {
      const envioResult = await sendDeliverableWithResult(botToken, chatIdNum, entregavelEscolhido)
      
      resultado.etapas.push({
        nome: "ENVIAR_ENTREGAVEL",
        status: envioResult.ok ? "ENVIADO" : "ERRO",
        dados: {
          chat_id: chatIdNum,
          entregavel_enviado: entregavelEscolhido.name,
          tipo: entregavelEscolhido.type,
          resposta_telegram: envioResult
        }
      })
      
      resultado.sucesso = true
    } else if (deliveryTypeFinal === "main") {
      // Usar entregavel principal
      const mainDeliverableId = config.mainDeliverableId as string | undefined
      const mainDeliverable = mainDeliverableId ? deliverables.find(d => d.id === mainDeliverableId) : null
      
      if (mainDeliverable) {
        await sendDeliverable(botToken, chatIdNum, mainDeliverable)
        
        resultado.etapas.push({
          nome: "ENVIAR_ENTREGAVEL_PRINCIPAL",
          status: "ENVIADO",
          dados: {
            chat_id: chatIdNum,
            entregavel_enviado: mainDeliverable.name,
            tipo: mainDeliverable.type,
            aviso: "Usou entregavel PRINCIPAL porque nao encontrou customizado"
          }
        })
        
        resultado.sucesso = true
      } else {
        // Mensagem generica
        await sendTelegramMessage(botToken, chatIdNum, "Obrigado pela compra! Seu acesso foi liberado.")
        
        resultado.etapas.push({
          nome: "ENVIAR_MENSAGEM_GENERICA",
          status: "AVISO",
          dados: {
            chat_id: chatIdNum,
            mensagem: "Mensagem generica enviada - sem entregavel configurado"
          }
        })
        
        resultado.sucesso = true
      }
    } else {
      resultado.etapas.push({
        nome: "ENVIAR_ENTREGAVEL",
        status: "ERRO",
        dados: {
          erro: "Nenhum entregavel encontrado para enviar"
        }
      })
    }

    return NextResponse.json(resultado)

  } catch (error) {
    resultado.erro = error instanceof Error ? error.message : "Erro desconhecido"
    return NextResponse.json(resultado, { status: 500 })
  }
}

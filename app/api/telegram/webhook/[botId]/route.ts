import { NextRequest } from "next/server"
import { getSupabase, getSupabaseAdmin } from "@/lib/supabase"
import { createPixPayment } from "@/lib/payments/gateways/mercadopago"

// ---------------------------------------------------------------------------
// Helper: Gerar PIX com gateway da tabela user_gateways
// ---------------------------------------------------------------------------
interface GatewayData {
  id: string
  gateway: string
  access_token: string
  credentials?: Record<string, unknown>
}

interface GeneratePixResult {
  success: boolean
  qrCode: string
  qrCodeBase64?: string
  paymentId?: string
  pixCode?: string
  transactionId?: string
  error?: string
}

async function generatePixPayment(params: {
  gateway: GatewayData
  amount: number
  description: string
  externalReference?: string
  customerEmail?: string
}): Promise<GeneratePixResult> {
  const { gateway, amount, description, customerEmail } = params
  
  console.log("[v0] generatePixPayment - gateway:", gateway.gateway, "amount:", amount)
  
  if (!gateway.access_token) {
    console.error("[v0] generatePixPayment - No access_token in gateway")
    return { success: false, qrCode: "", error: "Gateway sem access_token configurado" }
  }
  
  try {
    const result = await createPixPayment({
      accessToken: gateway.access_token,
      amount,
      description,
      payerEmail: customerEmail || "cliente@email.com"
    })
    
    console.log("[v0] generatePixPayment - result:", result.success, "paymentId:", result.paymentId)
    
    if (!result.success || !result.qrCode) {
      return { 
        success: false, 
        qrCode: "", 
        error: result.error || "Falha ao gerar PIX" 
      }
    }
    
    return {
      success: true,
      qrCode: result.qrCode,
      qrCodeBase64: undefined, // MP não retorna base64, usamos URL externa
      paymentId: result.paymentId,
      pixCode: result.copyPaste || result.qrCode,
      transactionId: result.paymentId
    }
  } catch (err) {
    console.error("[v0] generatePixPayment - Exception:", err)
    return { 
      success: false, 
      qrCode: "", 
      error: err instanceof Error ? err.message : "Erro ao gerar PIX" 
    }
  }
}

// ---------------------------------------------------------------------------
// Interface para configurações de pagamento do flow
// ---------------------------------------------------------------------------
interface PaymentMessagesConfig {
  pixMessage?: string
  showPlanBeforePix?: boolean
  qrCodeDisplay?: string // "image" | "none"
  pixCodeFormat?: string // "monospace" | "normal"
  showCopyButton?: boolean
  messageBeforeCode?: string
  verifyStatusButtonText?: string
  approvedMessage?: string
  approvedMedias?: string[]
  rejectedMessage?: string
  expiredMessage?: string
  showVerifyStatusButton?: boolean
}

// ---------------------------------------------------------------------------
// Helper: Enviar mensagens de PIX de forma centralizada
// ---------------------------------------------------------------------------
async function sendPixPaymentMessages(params: {
  botToken: string
  chatId: number
  pixCode: string
  qrCodeUrl?: string
  amount: number
  productName: string
  paymentId?: string
  config?: PaymentMessagesConfig
  userName?: string
}): Promise<void> {
  const { 
    botToken, 
    chatId, 
    pixCode, 
    qrCodeUrl, 
    amount, 
    productName, 
    paymentId,
    config,
    userName 
  } = params
  
  // Configurações padrão
  const pixMessage = config?.pixMessage || `<b>Como realizar o pagamento:</b>

1. Abra o aplicativo do seu banco.
2. Selecione a opcao "Pagar" ou "PIX".
3. Escolha "PIX Copia e Cola".
4. Cole a chave que esta abaixo e finalize o pagamento com seguranca.`
  
  const qrCodeDisplay = config?.qrCodeDisplay || "image"
  const showCopyButton = config?.showCopyButton !== false
  const messageBeforeCode = config?.messageBeforeCode || "Copie o codigo abaixo:"
  const verifyStatusButtonText = config?.verifyStatusButtonText || "Verificar Status"
  const showVerifyStatusButton = config?.showVerifyStatusButton !== false
  
  // Substituir variáveis na mensagem
  const formattedMessage = pixMessage
    .replace(/\{nome\}/g, userName || "Cliente")
    .replace(/\{valor\}/g, `R$ ${amount.toFixed(2).replace(".", ",")}`)
    .replace(/\{produto\}/g, productName)
  
  // 1. Enviar mensagem de instruções
  await sendTelegramMessage(botToken, chatId, formattedMessage)
  
  // 2. Enviar QR Code (se habilitado)
  if (qrCodeDisplay === "image" && qrCodeUrl) {
    await sendTelegramPhoto(
      botToken,
      chatId,
      qrCodeUrl,
      `Valor: R$ ${amount.toFixed(2).replace(".", ",")}\nProduto: ${productName}`
    )
  } else if (qrCodeDisplay === "image" && pixCode) {
    // Gerar QR Code via API externa se não tiver URL
    const generatedQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixCode)}`
    await sendTelegramPhoto(
      botToken,
      chatId,
      generatedQrUrl,
      `Valor: R$ ${amount.toFixed(2).replace(".", ",")}\nProduto: ${productName}`
    )
  }
  
  // 3. Enviar código PIX Copia e Cola
  const codeMessage = `${messageBeforeCode}\n\n<code>${pixCode}</code>`
  
  // Montar botões inline
  const inlineKeyboard: { text: string; callback_data?: string; copy_text?: { text: string } }[][] = []
  
  // Botão de copiar código (usando callback que envia o código)
  if (showCopyButton) {
    inlineKeyboard.push([
      { text: "📋 Copiar Código PIX", callback_data: `copy_pix_${paymentId || "code"}` }
    ])
  }
  
  // Botão de verificar status
  if (showVerifyStatusButton && paymentId) {
    inlineKeyboard.push([
      { text: `🔄 ${verifyStatusButtonText}`, callback_data: `check_payment_${paymentId}` }
    ])
  }
  
  // Enviar mensagem com botões
  if (inlineKeyboard.length > 0) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: codeMessage,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: inlineKeyboard }
      })
    })
  } else {
    await sendTelegramMessage(botToken, chatId, codeMessage)
  }
}

// ---------------------------------------------------------------------------
// Helper: Busca flow ativo para um bot via flow_bots (relacao many-to-many)
// ---------------------------------------------------------------------------
async function getActiveFlowForBot(supabase: ReturnType<typeof getSupabase>, botUuid: string) {
  console.log("[v0] getActiveFlowForBot - Buscando flow para bot:", botUuid)
  
  // Primeiro tenta via flow_bots (correta)
  const { data: flowBot, error: flowBotError } = await supabase
    .from("flow_bots")
    .select(`
      flow_id,
      flows:flow_id (
        id,
        name,
        config,
        status
      )
    `)
    .eq("bot_id", botUuid)
    .limit(1)
    .single()
  
  console.log("[v0] getActiveFlowForBot - flow_bots result:", flowBot, "error:", flowBotError)
  
  if (flowBot?.flows) {
    const flow = flowBot.flows as { id: string; name: string; config: Record<string, unknown>; status: string }
    console.log("[v0] getActiveFlowForBot - Flow encontrado via flow_bots:", flow.id, "status:", flow.status)
    // Aceitar qualquer status ativo (ativo, active, ou undefined)
    if (flow.status === "ativo" || flow.status === "active" || !flow.status) {
      return flow
    }
  }
  
  // Fallback: busca via flow_bots sem join (para evitar problemas de RLS)
  const { data: flowBotSimple } = await supabase
    .from("flow_bots")
    .select("flow_id")
    .eq("bot_id", botUuid)
    .limit(1)
    .single()
  
  if (flowBotSimple?.flow_id) {
    console.log("[v0] getActiveFlowForBot - Buscando flow diretamente por ID:", flowBotSimple.flow_id)
    const { data: flowById } = await supabase
      .from("flows")
      .select("id, name, config, status")
      .eq("id", flowBotSimple.flow_id)
      .single()
    
    if (flowById) {
      console.log("[v0] getActiveFlowForBot - Flow encontrado diretamente:", flowById.id, "status:", flowById.status)
      return flowById
    }
  }
  
  // Fallback final: busca direto na tabela flows pelo bot_id (compatibilidade)
  const { data: directFlow } = await supabase
    .from("flows")
    .select("id, name, config, status")
    .eq("bot_id", botUuid)
    .limit(1)
    .single()
  
  console.log("[v0] getActiveFlowForBot - Flow direto encontrado:", directFlow?.id || "NENHUM")
  
  return directFlow
}

// ---------------------------------------------------------------------------
// Telegram helpers
// ---------------------------------------------------------------------------

async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
  replyMarkup?: object,
  ): Promise<number | null> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`
  const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: "HTML" }
  if (replyMarkup) body.reply_markup = replyMarkup
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return data?.result?.message_id || null
  } catch {
    return null
  }
}

async function editTelegramMessage(
  botToken: string,
  chatId: number,
  messageId: number,
  text: string,
  replyMarkup?: object,
): Promise<{ ok: boolean; error?: string; errorCode?: number }> {
  const url = `https://api.telegram.org/bot${botToken}/editMessageText`
  const body: Record<string, unknown> = { 
    chat_id: chatId, 
    message_id: messageId,
    text, 
    parse_mode: "HTML" 
  }
  if (replyMarkup) body.reply_markup = replyMarkup
  try {
    console.log("[v0] editTelegramMessage - CHAMANDO API")
    console.log("[v0] editTelegramMessage - chatId:", chatId)
    console.log("[v0] editTelegramMessage - messageId:", messageId)
    console.log("[v0] editTelegramMessage - text:", text)
    console.log("[v0] editTelegramMessage - replyMarkup:", JSON.stringify(replyMarkup))
    
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    
    console.log("[v0] editTelegramMessage - RESPOSTA COMPLETA:", JSON.stringify(data))
    
    if (!data?.ok) {
      console.log("[v0] editTelegramMessage - ERRO:", data?.description, "error_code:", data?.error_code)
      return { ok: false, error: data?.description, errorCode: data?.error_code }
    }
    
    console.log("[v0] editTelegramMessage - SUCESSO")
    return { ok: true }
  } catch (err) {
    console.log("[v0] editTelegramMessage - EXCEPTION:", err)
    return { ok: false, error: String(err) }
  }
}

async function sendTelegramPhoto(
  botToken: string,
  chatId: number,
  photoUrl: string,
  caption?: string,
) {
  const url = `https://api.telegram.org/bot${botToken}/sendPhoto`
  const body: Record<string, unknown> = {
    chat_id: chatId,
    photo: photoUrl,
    parse_mode: "HTML",
  }
  if (caption) body.caption = caption
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function sendTelegramVideo(
  botToken: string,
  chatId: number,
  videoUrl: string,
  caption?: string,
) {
  const url = `https://api.telegram.org/bot${botToken}/sendVideo`
  const body: Record<string, unknown> = {
    chat_id: chatId,
    video: videoUrl,
    parse_mode: "HTML",
  }
  if (caption) body.caption = caption
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function answerCallback(
  botToken: string,
  callbackQueryId: string,
  text?: string,
) {
  const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`
  const body: Record<string, unknown> = {
    callback_query_id: callbackQueryId,
  }
  if (text) body.text = text
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

// Send multiple medias as album (grouped)
async function sendMediaGroup(
  botToken: string,
  chatId: number,
  mediaUrls: string[],
  caption?: string,
) {
  const url = `https://api.telegram.org/bot${botToken}/sendMediaGroup`
  
  const media = mediaUrls.map((mediaUrl, index) => {
    const isVideo = mediaUrl.includes(".mp4") || mediaUrl.includes("video")
    const item: Record<string, unknown> = {
      type: isVideo ? "video" : "photo",
      media: mediaUrl,
    }
    // Caption only on first item
    if (index === 0 && caption) {
      item.caption = caption
      item.parse_mode = "HTML"
    }
    return item
  })
  
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, media }),
  })
}

// ---------------------------------------------------------------------------
// Process message in background (non-blocking)
// ---------------------------------------------------------------------------

async function processUpdate(botId: string, update: Record<string, unknown>) {
  const supabase = getSupabase()

  try {
    // 1. Get bot from database
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("*")
      .like("token", `${botId}:%`)
      .single()

    if (botError || !bot) {
      console.error("[webhook] Bot not found:", botId)
      return
    }

    const botUuid = bot.id
    const botToken = bot.token
    if (!botToken) return

    // 2. Extract message data
    const message = update.message || (update.callback_query as Record<string, unknown>)?.message
    if (!message || typeof message !== "object") return

    const msg = message as Record<string, unknown>
    const chat = msg.chat as Record<string, unknown>
    // Para callback_query, o from do USUARIO que clicou vem de callback_query.from, nao de message.from
    const callbackFrom = (update.callback_query as Record<string, unknown>)?.from as Record<string, unknown> | undefined
    const from = callbackFrom || (msg.from as Record<string, unknown>)
    
    const chatId = chat?.id as number
    const text = (msg.text as string) || ""
    const telegramUserId = from?.id
    const userFirstName = from?.first_name as string
    const userLastName = from?.last_name as string
    const userUsername = from?.username as string

    if (!chatId) return

    // Salvar mensagem recebida no historico (exceto callbacks que nao sao mensagens reais)
    if (text && !update.callback_query) {
      await supabase.from("bot_messages").insert({
        bot_id: botUuid,
        telegram_user_id: String(telegramUserId),
        telegram_chat_id: String(chatId),
        direction: "incoming",
        message_type: "text",
        content: text,
        user_first_name: userFirstName,
        user_last_name: userLastName,
        user_username: userUsername,
        telegram_message_id: msg.message_id as number,
      }).then(() => {}).catch(e => console.error("Erro ao salvar mensagem:", e))
    }

    // 3. Check if callback query (button click)
    const callbackQuery = update.callback_query as Record<string, unknown> | null
    const callbackData = callbackQuery?.data as string | null
    const callbackQueryId = callbackQuery?.id as string | null
    
// 3.1 Handle callback queries
  if (callbackQuery && callbackData && callbackQueryId) {
  console.log("[v0] Callback recebido:", callbackData, "- isOrderBump:", callbackData.startsWith("ob_"))
  
  // ========== ACCESS DELIVERABLE CALLBACK ==========
  if (callbackData === "access_deliverable") {
    console.log("[v0] Access Deliverable Callback - chatId:", chatId, "botUuid:", botUuid)
    
    // Confirmar callback
    await answerCallback(botToken, callbackQueryId, "Liberando acesso...")
    
    // Buscar flow para pegar o entregavel
    const flowForDelivery = await getActiveFlowForBot(supabase, botUuid)
    
    if (flowForDelivery) {
      const flowConfig = (flowForDelivery.config as Record<string, unknown>) || {}
      console.log("[v0] Sending delivery from access_deliverable callback")
      
      // Buscar nome do usuario
      let userName = "Cliente"
      try {
        const { data: userData } = await supabase
          .from("bot_users")
          .select("first_name")
          .eq("bot_id", botUuid)
          .eq("telegram_user_id", String(telegramUserId))
          .single()
        if (userData?.first_name) {
          userName = userData.first_name
        }
      } catch { /* ignore */ }
      
      // Enviar mensagem antes da entrega
      await sendTelegramMessage(
        botToken,
        chatId,
        `${userName}, aqui esta seu acesso:`
      )
      
      // Usar funcao de entrega existente (definida no webhook do mercadopago - precisamos importar/chamar inline)
      // Verificar se tem mainDeliverableId configurado
      const mainDeliverableId = flowConfig.mainDeliverableId as string | undefined
      const deliverables = flowConfig.deliverables as Array<{
        id: string
        name: string
        type: "media" | "vip_group" | "link"
        medias?: string[]
        link?: string
        linkText?: string
        vipGroupChatId?: string
        vipGroupName?: string
      }> | undefined
      
      let deliverableSent = false
      
      // Se tiver mainDeliverableId, usar esse entregavel
      if (mainDeliverableId && deliverables) {
        const mainDeliverable = deliverables.find(d => d.id === mainDeliverableId)
        if (mainDeliverable) {
          console.log("[v0] Sending main deliverable:", mainDeliverable.name, mainDeliverable.type)
          
          if (mainDeliverable.type === "media" && mainDeliverable.medias && mainDeliverable.medias.length > 0) {
            for (const mediaUrl of mainDeliverable.medias) {
              if (mediaUrl.includes(".mp4") || mediaUrl.includes("video")) {
                await sendTelegramVideo(botToken, chatId, mediaUrl, "")
              } else {
                await sendTelegramPhoto(botToken, chatId, mediaUrl, "")
              }
            }
            await sendTelegramMessage(botToken, chatId, "Obrigado pela compra! Seu conteudo foi liberado acima.")
            deliverableSent = true
          } else if (mainDeliverable.type === "link" && mainDeliverable.link) {
            const buttonText = mainDeliverable.linkText || "Acessar conteudo"
            const keyboard = {
              inline_keyboard: [[{ text: buttonText, url: mainDeliverable.link }]]
            }
            await sendTelegramMessage(botToken, chatId, "Clique no botao abaixo para acessar:", keyboard)
            deliverableSent = true
          } else if (mainDeliverable.type === "vip_group" && mainDeliverable.vipGroupChatId) {
            // Criar link de convite
            try {
              const inviteRes = await fetch(`https://api.telegram.org/bot${botToken}/createChatInviteLink`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: mainDeliverable.vipGroupChatId,
                  member_limit: 1,
                  name: `VIP Access - ${Date.now()}`,
                }),
              })
              const inviteData = await inviteRes.json()
              if (inviteData.ok && inviteData.result?.invite_link) {
                const groupName = mainDeliverable.vipGroupName || "Grupo VIP"
                const keyboard = {
                  inline_keyboard: [[{ text: `Entrar no ${groupName}`, url: inviteData.result.invite_link }]]
                }
                await sendTelegramMessage(
                  botToken,
                  chatId,
                  `Seu acesso ao <b>${groupName}</b> foi liberado.\n\n<i>Este link e unico e pode ser usado apenas uma vez.</i>`,
                  keyboard
                )
                deliverableSent = true
              }
            } catch (inviteError) {
              console.error("[v0] Error creating invite link:", inviteError)
            }
          }
        }
      }
      
      // Fallback para delivery antigo se nao conseguiu enviar
      if (!deliverableSent) {
        const delivery = flowConfig.delivery as {
          type?: string
          medias?: string[]
          link?: string
          linkText?: string
          vipGroupId?: string
          vipGroupName?: string
        } | undefined
        
        if (delivery) {
          if (delivery.medias && delivery.medias.length > 0) {
            for (const mediaUrl of delivery.medias) {
              if (mediaUrl.includes(".mp4") || mediaUrl.includes("video")) {
                await sendTelegramVideo(botToken, chatId, mediaUrl, "")
              } else {
                await sendTelegramPhoto(botToken, chatId, mediaUrl, "")
              }
            }
          }
          
          if (delivery.link) {
            const buttonText = delivery.linkText || "Acessar conteudo"
            const keyboard = {
              inline_keyboard: [[{ text: buttonText, url: delivery.link }]]
            }
            await sendTelegramMessage(botToken, chatId, "Clique no botao abaixo:", keyboard)
          } else if (!delivery.medias || delivery.medias.length === 0) {
            await sendTelegramMessage(botToken, chatId, "Seu acesso foi liberado!")
          }
        } else {
          await sendTelegramMessage(botToken, chatId, "Seu acesso foi liberado! Obrigado pela compra.")
        }
      }
    } else {
      await sendTelegramMessage(botToken, chatId, "Seu acesso foi liberado!")
    }
    
    return
  }
  // ========== FIM ACCESS DELIVERABLE ==========
  
  // ========== COPY PIX CODE CALLBACK ==========
  if (callbackData.startsWith("copy_pix_")) {
    const paymentIdOrCode = callbackData.replace("copy_pix_", "")
    
    // Buscar pagamento - tentar varias estrategias
    let pixCode: string | null = null
    
    // Estrategia 1: Buscar pelo ID exato (se for UUID) ou external_payment_id
    const { data: paymentData1 } = await supabase
      .from("payments")
      .select("pix_code, copy_paste")
      .or(`id.eq.${paymentIdOrCode},external_payment_id.eq.${paymentIdOrCode},external_id.eq.${paymentIdOrCode}`)
      .limit(1)
      .single()
    
    if (paymentData1) {
      pixCode = paymentData1.pix_code || paymentData1.copy_paste
    }
    
    // Estrategia 2: Se nao encontrou, buscar pagamento mais recente do usuario neste bot
    if (!pixCode) {
      const { data: paymentData2 } = await supabase
        .from("payments")
        .select("pix_code, copy_paste")
        .eq("bot_id", botUuid)
        .eq("telegram_user_id", String(telegramUserId))
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .single()
      
      if (paymentData2) {
        pixCode = paymentData2.pix_code || paymentData2.copy_paste
      }
    }
    
    // Estrategia 3: Buscar qualquer pagamento recente do usuario
    if (!pixCode) {
      const { data: paymentData3 } = await supabase
        .from("payments")
        .select("pix_code, copy_paste")
        .eq("telegram_user_id", String(telegramUserId))
        .order("created_at", { ascending: false })
        .limit(1)
        .single()
      
      if (paymentData3) {
        pixCode = paymentData3.pix_code || paymentData3.copy_paste
      }
    }
    
    if (pixCode) {
      // Responder callback
      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          callback_query_id: callbackQueryId,
          text: "Codigo PIX enviado! Toque nele para copiar.",
          show_alert: false
        })
      })
      
      // Enviar novamente o codigo para facilitar copia
      await sendTelegramMessage(
        botToken, 
        chatId, 
        `<b>Codigo PIX Copia e Cola:</b>\n\n<code>${pixCode}</code>\n\n<i>Toque no codigo acima para copiar</i>`
      )
    } else {
      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          callback_query_id: callbackQueryId,
          text: "Codigo PIX nao encontrado. Tente selecionar o plano novamente.",
          show_alert: true
        })
      })
    }
    
    return
  }
  // ========== FIM COPY PIX CODE ==========
  
  // ========== CHECK PAYMENT STATUS CALLBACK ==========
  if (callbackData.startsWith("check_payment_")) {
    console.log("[v0] Check Payment Status Callback recebido:", callbackData)
    
    const paymentId = callbackData.replace("check_payment_", "")
    
    // Buscar pagamento no banco
    const { data: paymentData } = await supabase
      .from("payments")
      .select("*")
      .or(`id.eq.${paymentId},external_payment_id.eq.${paymentId}`)
      .limit(1)
      .single()
    
    if (!paymentData) {
      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          callback_query_id: callbackQueryId,
          text: "Pagamento não encontrado",
          show_alert: true
        })
      })
      return
    }
    
    // Verificar status no Mercado Pago
    const { data: gateway } = await supabase
      .from("user_gateways")
      .select("access_token")
      .eq("user_id", paymentData.user_id)
      .eq("gateway", "mercadopago")
      .single()
    
    let currentStatus = paymentData.status
    
    if (gateway?.access_token && paymentData.external_payment_id) {
      try {
        const mpResponse = await fetch(
          `https://api.mercadopago.com/v1/payments/${paymentData.external_payment_id}`,
          {
            headers: { Authorization: `Bearer ${gateway.access_token}` }
          }
        )
        const mpData = await mpResponse.json()
        
        if (mpData.status) {
          currentStatus = mpData.status
          
          // Atualizar no banco se mudou
          if (currentStatus !== paymentData.status) {
            await supabase
              .from("payments")
              .update({ status: currentStatus, updated_at: new Date().toISOString() })
              .eq("id", paymentData.id)
          }
        }
      } catch (err) {
        console.error("[v0] Erro ao verificar status no MP:", err)
      }
    }
    
    // Responder com o status
    const statusMessages: Record<string, string> = {
      approved: "✅ Pagamento APROVADO! Seu acesso será liberado.",
      pending: "⏳ Pagamento ainda PENDENTE. Aguardando confirmação.",
      rejected: "❌ Pagamento REJEITADO. Tente novamente.",
      cancelled: "🚫 Pagamento CANCELADO.",
      in_process: "⏳ Pagamento em PROCESSAMENTO.",
      refunded: "↩️ Pagamento ESTORNADO."
    }
    
    const statusText = statusMessages[currentStatus] || `Status: ${currentStatus}`
    
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        callback_query_id: callbackQueryId,
        text: statusText,
        show_alert: true
      })
    })
    
    // Se aprovado, processar o pagamento
    if (currentStatus === "approved" && paymentData.status !== "approved") {
      await sendTelegramMessage(botToken, chatId, "✅ <b>Pagamento Confirmado!</b>\n\nSeu acesso está sendo liberado...")
      
      // Buscar flow para config de mensagem aprovada
      const flow = await getActiveFlowForBot(supabase, botUuid)
      const config = flow?.config as Record<string, unknown> | undefined
      const paymentMessages = config?.paymentMessages as PaymentMessagesConfig | undefined
      
      if (paymentMessages?.approvedMessage) {
        await sendTelegramMessage(botToken, chatId, paymentMessages.approvedMessage)
      }
      
      // Enviar mídias de aprovação se configuradas
      if (paymentMessages?.approvedMedias && paymentMessages.approvedMedias.length > 0) {
        for (const mediaUrl of paymentMessages.approvedMedias) {
          if (mediaUrl.includes(".mp4") || mediaUrl.includes("video")) {
            await sendTelegramVideo(botToken, chatId, mediaUrl, "")
          } else {
            await sendTelegramPhoto(botToken, chatId, mediaUrl, "")
          }
        }
      }
    }
    
    return
  }
  // ========== FIM CHECK PAYMENT STATUS ==========
  
  // Handle "ver_planos" - show plans as buttons
  if (callbackData === "ver_planos") {
        // Answer callback
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: callbackQueryId })
        })
        // Find flow for this bot
        const { data: directFlow } = await supabase
          .from("flows")
          .select("*")
          .eq("bot_id", botUuid)
          .eq("status", "ativo")
          .limit(1)
          .single()
        
        let flowId = directFlow?.id
        let flowForConfig = directFlow
        
        if (!flowId) {
          const { data: flowBot } = await supabase
            .from("flow_bots")
            .select("flow_id")
            .eq("bot_id", botUuid)
            .limit(1)
            .single()
          flowId = flowBot?.flow_id
          
          // Fetch full flow to get config
          if (flowId) {
            const { data: fullFlow } = await supabase
              .from("flows")
              .select("*")
              .eq("id", flowId)
              .single()
            flowForConfig = fullFlow
          }
        }
        
        if (flowId && flowForConfig) {
          // Get plans from flow_plans table first
          const { data: plans } = await supabase
            .from("flow_plans")
            .select("*")
            .eq("flow_id", flowId)
            .eq("is_active", true)
            .order("position", { ascending: true })
          
          // Verificar se Packs esta habilitado
          const flowConfig = (flowForConfig.config as Record<string, unknown>) || {}
          const packsConfig = flowConfig.packs as { enabled?: boolean; buttonText?: string; list?: Array<{ id: string; name: string; price: number; active?: boolean }> } | undefined
          const packsEnabled = packsConfig?.enabled && packsConfig?.list && packsConfig.list.filter(p => p.active !== false).length > 0
          const packsButtonText = packsConfig?.buttonText || "Packs Disponiveis"
          
          if (plans && plans.length > 0) {
            // Build buttons for each plan (only name, no price)
            const planButtons: Array<Array<{ text: string; callback_data: string }>> = plans.map(plan => [{
              text: plan.name,
              callback_data: `plan_${plan.id}`
            }])
            
            await sendTelegramMessage(
              botToken, 
              chatId, 
              "Escolha seu plano:",
              { inline_keyboard: planButtons }
            )
          } else {
            // Fallback: get plans from flow config JSON
            const configPlans = (flowConfig.plans as Array<{ id: string; name: string; price: number }>) || []
            
            if (configPlans.length > 0) {
              const planButtons: Array<Array<{ text: string; callback_data: string }>> = configPlans.map(plan => [{
                text: plan.name,
                callback_data: `plan_${plan.id}`
              }])
              
              await sendTelegramMessage(
                botToken, 
                chatId, 
                "Escolha seu plano:",
                { inline_keyboard: planButtons }
              )
            } else if (packsEnabled) {
              // Apenas packs, sem planos
              await sendTelegramMessage(
                botToken, 
                chatId, 
                "Confira nossas opcoes:",
                { inline_keyboard: [[{ text: packsButtonText, callback_data: "show_packs" }]] }
              )
            } else {
              await sendTelegramMessage(botToken, chatId, "Nenhum plano disponivel no momento.")
            }
          }
        } else {
          await sendTelegramMessage(botToken, chatId, "Fluxo nao encontrado.")
        }
        return
      }
      
      // ========== SHOW PACKS CALLBACK ==========
      if (callbackData === "show_packs") {
        console.log("[v0] Show Packs Callback recebido - botUuid:", botUuid)
        
        // Confirmar recebimento
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: callbackQueryId })
        })
        
        // Buscar flow config com packs via flow_bots
        const flowForPacks = await getActiveFlowForBot(supabase, botUuid)
        
        console.log("[v0] flowForPacks encontrado:", !!flowForPacks)
        
        if (flowForPacks) {
          const flowConfig = (flowForPacks.config as Record<string, unknown>) || {}
          console.log("[v0] flowConfig.packs:", JSON.stringify(flowConfig.packs).substring(0, 500))
          
          const packsConfig = flowConfig.packs as { enabled?: boolean; list?: Array<{ id: string; name: string; emoji?: string; price: number; description?: string; previewMedias?: string[]; buttonText?: string; active?: boolean }> } | undefined
          const packsList = packsConfig?.list?.filter(p => p.active !== false) || []
          
          console.log("[v0] packsList.length:", packsList.length)
          
          if (packsList.length > 0) {
            // Enviar cada pack diretamente com foto, descricao e botao de compra
            for (const pack of packsList) {
              const packMessage = `${pack.emoji || "📦"} *${pack.name}*\n\n${pack.description || ""}\n\n💰 *R$ ${pack.price.toFixed(2).replace(".", ",")}*`
              const packButton = [[{
                text: pack.buttonText || `Comprar ${pack.name}`,
                callback_data: `buy_pack_${pack.id}_${pack.price}`
              }]]
              
              // Se tiver imagem de preview, enviar com foto
              if (pack.previewMedias && pack.previewMedias.length > 0) {
                try {
                  await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      photo: pack.previewMedias[0],
                      caption: packMessage,
                      parse_mode: "Markdown",
                      reply_markup: { inline_keyboard: packButton }
                    })
                  })
                } catch {
                  // Se falhar enviar foto, envia so texto
                  await sendTelegramMessage(botToken, chatId, packMessage, { inline_keyboard: packButton })
                }
              } else {
                await sendTelegramMessage(botToken, chatId, packMessage, { inline_keyboard: packButton })
              }
            }
            
            // Botao de voltar aos planos
            await sendTelegramMessage(
              botToken,
              chatId,
              "👆 Escolha um pack acima ou volte aos planos:",
              { inline_keyboard: [[{ text: "⬅️ Voltar aos Planos", callback_data: "back_to_plans" }]] }
            )
          } else {
            console.log("[v0] Nenhum pack ativo encontrado")
            await sendTelegramMessage(botToken, chatId, "Nenhum pack disponivel no momento.")
          }
        } else {
          console.log("[v0] Flow nao encontrado para mostrar packs")
          await sendTelegramMessage(botToken, chatId, "Erro ao carregar packs. Tente novamente.")
        }
        
        return
      }
      
      // ========== BACK TO PLANS CALLBACK ==========
      if (callbackData === "back_to_plans") {
        // Confirmar recebimento
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: callbackQueryId })
        })
        
        // Reenviar os planos via flow_bots
        const flowForPlans = await getActiveFlowForBot(supabase, botUuid)
        
        if (flowForPlans) {
          const { data: plans } = await supabase
            .from("flow_plans")
            .select("*")
            .eq("flow_id", flowForPlans.id)
            .eq("is_active", true)
            .order("position", { ascending: true })
          
          if (plans && plans.length > 0) {
            const planButtons: Array<Array<{ text: string; callback_data: string }>> = plans.map(plan => [{
              text: plan.name,
              callback_data: `plan_${plan.id}`
            }])
            
            await sendTelegramMessage(botToken, chatId, "Escolha seu plano:", { inline_keyboard: planButtons })
          }
        }
        
        return
      }
      
      // ========== PACK SELECTION CALLBACK ==========
      if (callbackData.startsWith("pack_")) {
        const packId = callbackData.replace("pack_", "")
        console.log("[v0] Pack Selection Callback:", packId)
        
        // Confirmar recebimento
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: callbackQueryId, text: "Carregando pack..." })
        })
        
        // Buscar flow config com packs via flow_bots
        const flowForPack = await getActiveFlowForBot(supabase, botUuid)
        
        if (flowForPack) {
          const flowConfig = (flowForPack.config as Record<string, unknown>) || {}
          const packsConfig = flowConfig.packs as { list?: Array<{ id: string; name: string; emoji?: string; price: number; description?: string; previewMedias?: string[]; buttonText?: string }> } | undefined
          const pack = packsConfig?.list?.find(p => p.id === packId)
          
          if (pack) {
            // Enviar midias de preview se existirem
            if (pack.previewMedias && pack.previewMedias.length > 0) {
              const validMedias = pack.previewMedias.filter(m => m && m.startsWith("http"))
              if (validMedias.length > 0) {
                await sendMediaGroup(botToken, chatId, validMedias, "")
              }
            }
            
            // Enviar descricao com botao de compra
            const description = pack.description || `Pack ${pack.name}`
            const priceText = `R$ ${pack.price.toFixed(2).replace(".", ",")}`
            const buttonText = pack.buttonText || "Comprar Pack"
            
            await sendTelegramMessage(
              botToken,
              chatId,
              `${pack.emoji || "📦"} <b>${pack.name}</b>\n\n${description}\n\n<b>Valor:</b> ${priceText}`,
              { 
                inline_keyboard: [
                  [{ text: buttonText, callback_data: `buy_pack_${pack.id}_${pack.price}` }],
                  [{ text: "Voltar aos Packs", callback_data: "show_packs" }]
                ] 
              }
            )
          }
        }
        
        return
      }
      
      // ========== BUY PACK CALLBACK ==========
      if (callbackData.startsWith("buy_pack_")) {
        const parts = callbackData.replace("buy_pack_", "").split("_")
        const packId = parts[0]
        const packPrice = parseFloat(parts[1]) || 0
        
        console.log("[v0] ========== BUY PACK CALLBACK INICIO ==========")
        console.log("[v0] Buy Pack Callback - packId:", packId, "packPrice:", packPrice, "botUuid:", botUuid)
        
        // Confirmar recebimento
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: callbackQueryId, text: "Processando..." })
        })
        
        // Buscar flow para ver order bump de packs
        console.log("[v0] Buscando flow para order bump...")
        const flowForPack = await getActiveFlowForBot(supabase, botUuid)
        console.log("[v0] flowForPack encontrado:", flowForPack ? "SIM" : "NAO", "- id:", flowForPack?.id, "- name:", flowForPack?.name)
        
        const flowConfig = (flowForPack?.config as Record<string, unknown>) || {}
        console.log("[v0] flowConfig keys:", Object.keys(flowConfig))
        console.log("[v0] flowConfig.orderBump RAW:", JSON.stringify(flowConfig.orderBump))
        
        const orderBumpConfig = flowConfig.orderBump as { enabled?: boolean; packs?: { enabled?: boolean; name?: string; price?: number; description?: string; acceptText?: string; rejectText?: string; medias?: string[] } } | undefined
        const orderBumpPacks = orderBumpConfig?.packs
        
        console.log("[v0] Pack Order Bump Check - flowId:", flowForPack?.id)
        console.log("[v0] orderBumpConfig:", JSON.stringify(orderBumpConfig))
        console.log("[v0] orderBumpPacks:", JSON.stringify(orderBumpPacks))
        console.log("[v0] CONDICOES PARA ORDER BUMP:")
        console.log("[v0]   - orderBumpPacks?.enabled =", orderBumpPacks?.enabled)
        console.log("[v0]   - orderBumpPacks?.price =", orderBumpPacks?.price)
        console.log("[v0]   - RESULTADO FINAL =", !!(orderBumpPacks?.enabled && orderBumpPacks?.price && orderBumpPacks.price > 0))
        
        // Se order bump de packs estiver habilitado, enviar oferta
        // NOTA: Cada tipo de order bump (inicial, upsell, downsell, packs) tem seu proprio enabled
        // Nao depende do orderBumpConfig.enabled geral
        if (orderBumpPacks?.enabled && orderBumpPacks.price && orderBumpPacks.price > 0) {
          console.log("[v0] ====== ORDER BUMP SERA MOSTRADO! ======")
          console.log("[v0] Enviando Order Bump para Pack - name:", orderBumpPacks.name, "price:", orderBumpPacks.price)
          
          // Salvar estado
          await supabase.from("user_flow_state").upsert({
            bot_id: botUuid,
            telegram_user_id: String(telegramUserId),
            flow_id: flowForPack?.id,
            status: "waiting_order_bump",
            metadata: {
              type: "pack",
              pack_id: packId,
              main_amount: packPrice,
              order_bump_name: orderBumpPacks.name || "Oferta Especial",
              order_bump_price: orderBumpPacks.price,
              main_description: `Pack`
            },
            updated_at: new Date().toISOString()
          }, { onConflict: "bot_id,telegram_user_id" })
          
          // Enviar midias do order bump se houver
          if (orderBumpPacks.medias && orderBumpPacks.medias.length > 0) {
            await sendMediaGroup(botToken, chatId, orderBumpPacks.medias, "")
          }
          
          // Enviar mensagem do order bump
          const obMessage = `*${orderBumpPacks.name || "Oferta Especial"}*\n\n${orderBumpPacks.description || ""}\n\n💰 Por apenas *R$ ${orderBumpPacks.price.toFixed(2).replace(".", ",")}*`
          
          await sendTelegramMessage(botToken, chatId, obMessage, {
            inline_keyboard: [
[{ text: orderBumpPacks.acceptText || "QUERO", callback_data: `ob_accept_${Math.round(packPrice * 100)}_${Math.round(orderBumpPacks.price * 100)}` }],
                [{ text: orderBumpPacks.rejectText || "NAO QUERO", callback_data: `ob_decline_${Math.round(packPrice * 100)}_0` }]
            ]
          })
          
          return
        }
        
        // Sem order bump - gerar PIX direto
        console.log("[v0] ====== ORDER BUMP NAO SERA MOSTRADO - Gerando PIX direto ======")
        // Buscar dados do bot para pegar user_id
        const { data: botDataPack } = await supabase
          .from("bots")
          .select("user_id")
          .eq("id", botUuid)
          .single()
        
        if (!botDataPack?.user_id) {
          await sendTelegramMessage(botToken, chatId, "Erro: Bot nao configurado.")
          return
        }
        
        // Buscar gateway de pagamento do usuario
        const { data: gatewayPack } = await supabase
          .from("user_gateways")
          .select("*")
          .eq("user_id", botDataPack.user_id)
          .eq("is_active", true)
          .limit(1)
          .single()
        
        if (!gatewayPack?.access_token) {
          await sendTelegramMessage(botToken, chatId, "Erro: Gateway de pagamento nao configurado.")
          return
        }
        
        if (packPrice > 0) {
          try {
            const packsConfig = flowConfig.packs as { list?: Array<{ id: string; name: string }> } | undefined
            const pack = packsConfig?.list?.find(p => p.id === packId)
            const packName = pack?.name || "Pack"
            
            // Gerar PIX chamando a API do Mercado Pago diretamente (igual ao fluxo inicial)
            const pixResponse = await fetch("https://api.mercadopago.com/v1/payments", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${gatewayPack.access_token}`,
                "X-Idempotency-Key": `pack_${packId}_${telegramUserId}_${Date.now()}`,
              },
              body: JSON.stringify({
                transaction_amount: packPrice,
                description: `Pack - ${packName}`,
                payment_method_id: "pix",
                payer: {
                  email: `user${telegramUserId}@telegram.bot`,
                  first_name: (from?.first_name as string) || "Cliente",
                },
                notification_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://dragonteste.onrender.com"}/api/payments/webhook/mercadopago`,
              }),
            })
            
            const pixData = await pixResponse.json()
            
            if (pixData.id && pixData.point_of_interaction?.transaction_data) {
              const txData = pixData.point_of_interaction.transaction_data
              const qrCodeUrl = txData.ticket_url
              const copyPaste = txData.qr_code
              
              // Salvar pagamento primeiro para ter o ID
              console.log("[v0] Saving pack payment - user_id:", botDataPack.user_id, "bot_id:", botUuid, "amount:", packPrice)
              const { data: savedPayment, error: saveError } = await supabase.from("payments").insert({
                user_id: botDataPack.user_id,
                bot_id: botUuid,
                telegram_user_id: String(telegramUserId),
                telegram_username: userUsername || null,
                telegram_first_name: userFirstName || null,
                telegram_last_name: userLastName || null,
                amount: packPrice,
                status: "pending",
                payment_method: "pix",
                gateway: "mercadopago",
                external_payment_id: String(pixData.id),
                description: `Pagamento - ${packName}`,
                product_name: packName,
                product_type: "pack",
                qr_code_url: qrCodeUrl,
                copy_paste: copyPaste,
                pix_code: copyPaste,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }).select().single()
              
              if (saveError) {
                console.error("[v0] Error saving pack payment:", saveError)
              } else {
                console.log("[v0] Pack payment saved:", savedPayment?.id)
              }
              
              // Buscar config de mensagens de pagamento do flow
              const paymentMessages = (flowConfig.paymentMessages as PaymentMessagesConfig) || {}
              
              // Enviar mensagens de PIX de forma centralizada
              await sendPixPaymentMessages({
                botToken,
                chatId,
                pixCode: copyPaste,
                qrCodeUrl,
                amount: packPrice,
                productName: packName,
                paymentId: String(pixData.id),
                config: paymentMessages,
                userName: userFirstName || "Cliente"
              })
            } else {
              console.error("[v0] Erro PIX Pack:", pixData)
              await sendTelegramMessage(botToken, chatId, "Erro ao gerar pagamento. Tente novamente.")
            }
          } catch (err) {
            console.error("[v0] Erro ao gerar PIX do pack:", err)
            await sendTelegramMessage(botToken, chatId, "Erro ao processar pagamento.")
          }
        } else {
          await sendTelegramMessage(botToken, chatId, "Preco invalido.")
        }
        
        return
      }
      

      
      // ========== ORDER BUMP CALLBACKS ==========
      if (callbackData.startsWith("ob_accept_") || callbackData.startsWith("ob_decline_")) {
        console.log("[v0] Order Bump Callback recebido:", callbackData, "botUuid:", botUuid, "telegramUserId:", telegramUserId)
        
        // Answer callback query imediatamente
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: callbackQueryId })
        })
        
        const isAccept = callbackData.startsWith("ob_accept_")
        const parts = callbackData.replace("ob_accept_", "").replace("ob_decline_", "").split("_")
        console.log("[v0] Order Bump parts:", parts, "isAccept:", isAccept)
        
        // Buscar metadata do order bump salvo no estado - PRIMEIRO SEM filtro de status
        let userState = null
        let stateError = null
        
        // Tenta primeiro com status waiting_order_bump
        const { data: stateWithStatus, error: errWithStatus } = await supabase
          .from("user_flow_state")
          .select("metadata, flow_id")
          .eq("bot_id", botUuid)
          .eq("telegram_user_id", String(telegramUserId))
          .eq("status", "waiting_order_bump")
          .order("updated_at", { ascending: false })
          .limit(1)
          .single()
        
        if (stateWithStatus) {
          userState = stateWithStatus
          stateError = errWithStatus
        } else {
          // Fallback: buscar qualquer estado recente do usuario (pode ter sido sobrescrito)
          const { data: stateAny, error: errAny } = await supabase
            .from("user_flow_state")
            .select("metadata, flow_id")
            .eq("bot_id", botUuid)
            .eq("telegram_user_id", String(telegramUserId))
            .order("updated_at", { ascending: false })
            .limit(1)
            .single()
          
          userState = stateAny
          stateError = errAny
          console.log("[v0] Order Bump - Using fallback state (no status filter)")
        }
        
        console.log("[v0] Order Bump userState:", userState, "error:", stateError)
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const metadata = userState?.metadata as Record<string, any> | null
        const orderBumpName = metadata?.order_bump_name || "Order Bump"
        const mainDescription = metadata?.main_description || "Produto Principal"
        
        let totalAmount = 0
        let description = mainDescription
        
        if (isAccept) {
          // Valores vem em centavos, converter para reais
          const mainAmountCents = parseInt(parts[0]) || 0
          const bumpAmountCents = parseInt(parts[1]) || 0
          const mainAmount = mainAmountCents / 100
          const bumpAmount = bumpAmountCents / 100
          totalAmount = mainAmount + bumpAmount
          description = `${mainDescription} + ${orderBumpName}`
          console.log("[v0] Order Bump ACEITO - main:", mainAmount, "bump:", bumpAmount, "TOTAL:", totalAmount)
        } else {
          // Valor vem em centavos
          const mainAmountCents = parseInt(parts[0]) || 0
          totalAmount = mainAmountCents / 100
          description = mainDescription
          console.log("[v0] Order Bump RECUSADO - Total:", totalAmount)
        }
        
        console.log("[v0] Order Bump - totalAmount calculado:", totalAmount)
        if (totalAmount <= 0) {
          console.log("[v0] Order Bump ERRO - totalAmount <= 0, retornando")
          await sendTelegramMessage(botToken, chatId, "Erro ao processar. Tente novamente.")
          return
        }
        
        // Atualizar estado
        await supabase
          .from("user_flow_state")
          .update({ status: "payment_pending", updated_at: new Date().toISOString() })
          .eq("bot_id", botUuid)
          .eq("telegram_user_id", String(telegramUserId))
        
        // Enviar mensagem de processamento
        await sendTelegramMessage(
          botToken,
          chatId,
          `${isAccept ? "Otimo! " : ""}Gerando pagamento PIX...\n\nValor: R$ ${totalAmount.toFixed(2).replace(".", ",")}`,
          undefined
        )
        
        // Get user_id - IMPORTANTE: Buscar do FLOW primeiro, pois o bot pode nao ter user_id
        // O flow sempre tem user_id atraves da relacao flow -> bot -> user
        let ownerUserId: string | null = null
        
        // Primeiro tenta buscar do bot atual
        const { data: botDataOB } = await supabase
          .from("bots")
          .select("user_id")
          .eq("id", botUuid)
          .single()
        
        if (botDataOB?.user_id) {
          ownerUserId = botDataOB.user_id
          console.log("[v0] Order Bump - user_id from bot:", ownerUserId)
        } else {
          // Bot nao tem user_id, buscar do flow
          // O userState.flow_id vem do estado salvo quando o order bump foi oferecido
          const flowIdFromState = userState?.flow_id
          console.log("[v0] Order Bump - bot sem user_id, buscando do flow:", flowIdFromState)
          
          if (flowIdFromState) {
            // Buscar o flow e seu bot associado para pegar o user_id
            const { data: flowData } = await supabase
              .from("flows")
              .select("bot_id, user_id")
              .eq("id", flowIdFromState)
              .single()
            
            if (flowData?.user_id) {
              ownerUserId = flowData.user_id
              console.log("[v0] Order Bump - user_id from flow.user_id:", ownerUserId)
            } else if (flowData?.bot_id) {
              // Flow tem bot_id, buscar user_id desse bot
              const { data: flowBotData } = await supabase
                .from("bots")
                .select("user_id")
                .eq("id", flowData.bot_id)
                .single()
              
              if (flowBotData?.user_id) {
                ownerUserId = flowBotData.user_id
                console.log("[v0] Order Bump - user_id from flow's bot:", ownerUserId)
              }
            }
          }
          
          // Ultimo fallback: buscar qualquer flow ativo deste bot
          if (!ownerUserId) {
            const activeFlow = await getActiveFlowForBot(supabase, botUuid)
            if (activeFlow) {
              // Tentar user_id do flow
              const flowWithUser = activeFlow as { user_id?: string; bot_id?: string }
              if (flowWithUser.user_id) {
                ownerUserId = flowWithUser.user_id
                console.log("[v0] Order Bump - user_id from active flow:", ownerUserId)
              } else if (flowWithUser.bot_id) {
                const { data: activeBotData } = await supabase
                  .from("bots")
                  .select("user_id")
                  .eq("id", flowWithUser.bot_id)
                  .single()
                if (activeBotData?.user_id) {
                  ownerUserId = activeBotData.user_id
                  console.log("[v0] Order Bump - user_id from active flow's bot:", ownerUserId)
                }
              }
            }
          }
        }
        
        if (!ownerUserId) {
          console.error("[v0] Order Bump - NAO CONSEGUIU ENCONTRAR user_id! botUuid:", botUuid, "flow_id:", userState?.flow_id)
          await sendTelegramMessage(botToken, chatId, "Erro: Configuracao do bot incompleta.", undefined)
          return
        }
        
        // Get gateway usando o ownerUserId encontrado
        const { data: gatewayOB } = await supabase
          .from("user_gateways")
          .select("*")
          .eq("user_id", ownerUserId)
          .eq("is_active", true)
          .limit(1)
          .single()
        
        if (!gatewayOB || !gatewayOB.access_token) {
          await sendTelegramMessage(botToken, chatId, "Gateway de pagamento nao configurado.", undefined)
          return
        }
        
        // Generate PIX
        try {
          const pixResultOB = await createPixPayment({
            accessToken: gatewayOB.access_token,
            amount: totalAmount,
            description: `Pagamento - ${description}`,
            payerEmail: "cliente@email.com",
          })
          
          if (!pixResultOB.success) {
            await sendTelegramMessage(botToken, chatId, `Erro ao gerar PIX: ${pixResultOB.error || "Tente novamente"}`, undefined)
            return
          }
          
          // Buscar config de mensagens de pagamento do flow
          const flowOB = await getActiveFlowForBot(supabase, botUuid)
          const flowConfigOB = (flowOB?.config as Record<string, unknown>) || {}
          const paymentMessagesOB = (flowConfigOB.paymentMessages as PaymentMessagesConfig) || {}
          
          // Enviar mensagens de PIX de forma centralizada
          await sendPixPaymentMessages({
            botToken,
            chatId,
            pixCode: pixResultOB.copyPaste || pixResultOB.qrCode || "",
            qrCodeUrl: pixResultOB.qrCodeUrl,
            amount: totalAmount,
            productName: description,
            paymentId: String(pixResultOB.paymentId),
            config: paymentMessagesOB,
            userName: userFirstName || "Cliente"
          })
          
          // Determinar product_type baseado no tipo de compra (pack ou plan)
          const sourceType = metadata?.type === "pack" ? "pack" : "plan"
          const productType = isAccept ? `${sourceType}_order_bump` : sourceType
          
          // Buscar flow_id se nao veio do state
          let flowIdForPayment = userState?.flow_id
          if (!flowIdForPayment) {
            const flowForPayment = await getActiveFlowForBot(supabase, botUuid)
            flowIdForPayment = flowForPayment?.id
            console.log("[v0] Order Bump - flow_id from fallback:", flowIdForPayment)
          }
          
          // Save payment - IMPORTANTE: usar ownerUserId que foi encontrado corretamente
          console.log("[v0] Saving OB payment - user_id:", ownerUserId, "bot_id:", botUuid, "amount:", totalAmount, "productType:", productType, "telegram_user_id:", telegramUserId, "telegram_username:", userUsername)
          const { error: obPaymentError } = await supabase.from("payments").insert({
            bot_id: botUuid,
            user_id: ownerUserId,
            telegram_user_id: String(telegramUserId),
            telegram_username: userUsername || null,
            telegram_first_name: userFirstName || null,
            telegram_last_name: userLastName || null,
            amount: totalAmount,
            status: "pending",
            payment_method: "pix",
            gateway: "mercadopago",
            external_payment_id: String(pixResultOB.paymentId),
            product_type: productType
          })
          if (obPaymentError) {
            console.error("[v0] Error saving OB payment:", obPaymentError)
            console.error("[v0] OB payment error details:", JSON.stringify(obPaymentError))
          } else {
            console.log("[v0] OB payment saved successfully - bot_id:", botUuid, "user_id:", ownerUserId, "amount:", totalAmount, "product_type:", productType)
          }
          
        } catch (pixError) {
          console.error("[v0] Erro ao gerar PIX para Order Bump:", pixError)
          await sendTelegramMessage(botToken, chatId, "Erro ao gerar pagamento. Tente novamente.", undefined)
        }
        
        return
      }
      // ========== FIM ORDER BUMP CALLBACKS ==========

      // ========== UPSELL CALLBACKS ==========
      // Suporta: up_accept_, up_decline_, up_plan_ (novo formato com multiplos planos)
      if (callbackData.startsWith("up_accept_") || callbackData.startsWith("up_decline_") || callbackData.startsWith("up_plan_")) {
        console.log("[v0] Upsell Callback recebido:", callbackData)
        
        const isAccept = callbackData.startsWith("up_accept_")
        const isPlan = callbackData.startsWith("up_plan_")
        const isDecline = callbackData.startsWith("up_decline_")
        
        // Buscar estado atual do usuario
        const { data: userState } = await supabase
          .from("user_flow_state")
          .select("metadata, flow_id")
          .eq("bot_id", botUuid)
          .eq("telegram_user_id", String(telegramUserId))
          .eq("status", "waiting_upsell")
          .order("updated_at", { ascending: false })
          .limit(1)
          .single()
        
        if (!userState) {
          console.log("[v0] Estado de upsell nao encontrado")
          await answerCallback(botToken, callbackQueryId, "Sessao expirada")
          return
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const metadata = userState.metadata as Record<string, any> | null
        const currentUpsellIndex = metadata?.upsell_index || 0
        let upsellPrice = metadata?.upsell_price || 0
        let upsellName = metadata?.upsell_name || "Upsell"
        let selectedPlanId = ""

        // Se for callback de plano especifico (up_plan_{upsellIndex}_{planId}_{priceInCents})
        if (isPlan) {
          const planParts = callbackData.replace("up_plan_", "").split("_")
          // planParts = [upsellIndex, planId, priceInCents]
          selectedPlanId = planParts[1] || ""
          const priceInCents = parseInt(planParts[2]) || 0
          upsellPrice = priceInCents / 100
          
          // Buscar nome do plano no metadata
          const plans = metadata?.plans || []
          const selectedPlan = plans.find((p: { id: string; name: string }) => p.id === selectedPlanId)
          if (selectedPlan) {
            upsellName = selectedPlan.name
          }
          console.log(`[v0] Plano selecionado: ${selectedPlanId}, preco: R$ ${upsellPrice}`)
        }

        // Buscar config do fluxo
        const { data: flowData } = await supabase
          .from("flows")
          .select("config")
          .eq("id", userState.flow_id)
          .single()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const flowConfig = flowData?.config as Record<string, any> | null
        const upsellSequences = flowConfig?.upsell?.sequences || []

        if (isAccept || isPlan) {
          // Usuario aceitou o upsell (ou selecionou um plano) - gerar pagamento
          console.log(`[v0] Usuario ${telegramUserId} aceitou upsell ${currentUpsellIndex} - R$ ${upsellPrice} (plano: ${selectedPlanId || "default"})`)
          
          await answerCallback(botToken, callbackQueryId, "Gerando pagamento...")

          // Buscar gateway de pagamento e user_id
          const { data: gateway } = await supabase
            .from("user_gateways")
            .select("*")
            .eq("bot_id", botUuid)
            .eq("is_active", true)
            .limit(1)
            .single()

          if (!gateway?.access_token) {
            await sendTelegramMessage(botToken, chatId, "Erro: Gateway de pagamento nao configurado. Entre em contato com o suporte.")
            return
          }

          // Buscar user_id do bot owner
          const { data: botOwner } = await supabase
            .from("bots")
            .select("user_id")
            .eq("id", botUuid)
            .single()

          // Gerar PIX para o upsell
          try {
            const pixResponse = await fetch("https://api.mercadopago.com/v1/payments", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${gateway.access_token}`,
                "X-Idempotency-Key": `upsell_${botUuid}_${telegramUserId}_${currentUpsellIndex}_${Date.now()}`,
              },
              body: JSON.stringify({
                transaction_amount: upsellPrice,
                description: upsellName,
                payment_method_id: "pix",
                payer: {
                  email: `user${telegramUserId}@telegram.bot`,
                  first_name: (from?.first_name as string) || "Cliente",
                },
                notification_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://dragonteste.onrender.com"}/api/payments/webhook/mercadopago`,
              }),
            })

            const pixData = await pixResponse.json()
            console.log("[v0] Upsell PIX Response:", JSON.stringify(pixData))

            if (pixData.id && pixData.point_of_interaction?.transaction_data?.qr_code) {
              const pixCopiaECola = pixData.point_of_interaction.transaction_data.qr_code
              const qrCodeBase64 = pixData.point_of_interaction.transaction_data.qr_code_base64
              
              // Salvar pagamento do upsell
              console.log("[v0] Saving upsell payment - user_id:", botOwner?.user_id, "bot_id:", botUuid, "amount:", upsellPrice)
              const { error: upsellPaymentError } = await supabase.from("payments").insert({
                user_id: botOwner?.user_id,
                bot_id: botUuid,
                telegram_user_id: String(telegramUserId),
                telegram_username: userUsername || null,
                telegram_first_name: userFirstName || null,
                telegram_last_name: userLastName || null,
                amount: upsellPrice,
                status: "pending",
                payment_method: "pix",
                gateway: "mercadopago",
                external_payment_id: String(pixData.id),
                description: `Pagamento - ${upsellName}`,
                product_name: upsellName,
                product_type: "upsell",
                pix_code: pixCopiaECola,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              if (upsellPaymentError) {
                console.error("[v0] Error saving upsell payment:", upsellPaymentError)
              } else {
                console.log("[v0] Upsell payment saved successfully")
              }

              // Atualizar estado
              await supabase
                .from("user_flow_state")
                .update({
                  status: "waiting_upsell_payment",
                  metadata: {
                    ...metadata,
                    upsell_payment_id: pixData.id,
                    selected_plan_id: selectedPlanId || null,
                    upsell_amount: upsellPrice,
                  },
                  updated_at: new Date().toISOString(),
                })
                .eq("bot_id", botUuid)
                .eq("telegram_user_id", String(telegramUserId))

              // Buscar config de mensagens de pagamento do flow
              const flowUpsell = await getActiveFlowForBot(supabase, botUuid)
              const flowConfigUpsell = (flowUpsell?.config as Record<string, unknown>) || {}
              const paymentMessagesUpsell = (flowConfigUpsell.paymentMessages as PaymentMessagesConfig) || {}
              
              // Determinar URL do QR Code
              const qrCodeUrlUpsell = qrCodeBase64 
                ? `data:image/png;base64,${qrCodeBase64}`
                : `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixCopiaECola)}`
              
              // Enviar mensagens de PIX de forma centralizada
              await sendPixPaymentMessages({
                botToken,
                chatId,
                pixCode: pixCopiaECola,
                qrCodeUrl: qrCodeUrlUpsell,
                amount: upsellPrice,
                productName: upsellName,
                paymentId: String(pixData.id),
                config: paymentMessagesUpsell,
                userName: userFirstName || "Cliente"
              })
            } else {
              console.error("[v0] Erro ao gerar PIX do upsell:", pixData)
              await sendTelegramMessage(botToken, chatId, "Erro ao gerar pagamento. Tente novamente.")
            }
          } catch (error) {
            console.error("[v0] Erro ao processar upsell:", error)
            await sendTelegramMessage(botToken, chatId, "Erro ao processar. Tente novamente.")
          }
        } else if (isDecline) {
          // Usuario recusou o upsell
          console.log(`[v0] Usuario ${telegramUserId} recusou upsell ${currentUpsellIndex}`)
          
          await answerCallback(botToken, callbackQueryId, "Entendido!")

          const nextIndex = currentUpsellIndex + 1

          if (nextIndex < upsellSequences.length) {
            // Tem mais upsell - verificar timing e enviar proximo
            const nextUpsell = upsellSequences[nextIndex]
            
            // Pegar os planos do proximo upsell
            const nextPlans = nextUpsell.plans || []
            const firstNextPlan = nextPlans[0]
            
            // Atualizar estado com proximo upsell
            await supabase
              .from("user_flow_state")
              .update({
                status: "waiting_upsell",
                metadata: {
                  upsell_index: nextIndex,
                  upsell_name: nextUpsell.name,
                  upsell_price: firstNextPlan?.price || nextUpsell.price,
                  upsell_sequence_id: nextUpsell.id,
                  plans: nextPlans.map((p: { id: string; name: string; price: number }) => ({ id: p.id, name: p.name, price: p.price })),
                },
                updated_at: new Date().toISOString(),
              })
              .eq("bot_id", botUuid)
              .eq("telegram_user_id", String(telegramUserId))

            // Enviar proximo upsell
            if (nextUpsell.sendTiming === "immediate") {
              // Enviar midias
              if (nextUpsell.medias && nextUpsell.medias.length > 0) {
                for (const mediaUrl of nextUpsell.medias) {
                  if (mediaUrl.includes(".mp4") || mediaUrl.includes("video")) {
                    await sendTelegramVideo(botToken, chatId, mediaUrl, "")
                  } else {
                    await sendTelegramPhoto(botToken, chatId, mediaUrl, "")
                  }
                  await new Promise(r => setTimeout(r, 500))
                }
              }

              // Montar botoes - suporte a multiplos planos
              const inlineKeyboard: { inline_keyboard: { text: string; callback_data: string }[][] } = {
                inline_keyboard: []
              }

              if (nextPlans.length > 0) {
                // Se tem planos, mostrar cada plano como botao
                const planButtons: { text: string; callback_data: string }[] = []
                for (const plan of nextPlans) {
                  const priceInCents = Math.round((plan.price || 0) * 100)
                  const buttonText = plan.buttonText || plan.name || `R$ ${(plan.price || 0).toFixed(2).replace(".", ",")}`
                  planButtons.push({
                    text: buttonText,
                    callback_data: `up_plan_${nextIndex}_${plan.id}_${priceInCents}`
                  })
                }
                // Colocar botoes lado a lado (max 2 por linha)
                for (let i = 0; i < planButtons.length; i += 2) {
                  const row = planButtons.slice(i, i + 2)
                  inlineKeyboard.inline_keyboard.push(row)
                }
              } else {
                // Fallback: botao unico de aceitar
                inlineKeyboard.inline_keyboard.push([
                  { text: nextUpsell.acceptButtonText || "Quero essa oferta!", callback_data: `up_accept_${nextUpsell.price}_${nextIndex}` }
                ])
              }

              // Botao de recusar
              if (!nextUpsell.hideRejectButton) {
                const rejectButton = { 
                  text: nextUpsell.rejectButtonText || "Nao tenho interesse", 
                  callback_data: `up_decline_${nextIndex}` 
                }
                const lastRow = inlineKeyboard.inline_keyboard[inlineKeyboard.inline_keyboard.length - 1]
                if (nextPlans.length > 0 && lastRow && lastRow.length === 1) {
                  lastRow.push(rejectButton)
                } else {
                  inlineKeyboard.inline_keyboard.push([rejectButton])
                }
              }

              const message = nextUpsell.message || `Oferta especial: ${nextUpsell.name}\n\nValor: R$ ${(nextUpsell.price || 0).toFixed(2).replace(".", ",")}`
              await sendTelegramMessage(botToken, chatId, message, inlineKeyboard)
            }
          } else {
            // Acabou os upsells - enviar entrega
            console.log(`[v0] Todos os upsells processados, enviando entrega`)
            
            // Atualizar estado
            await supabase
              .from("user_flow_state")
              .update({
                status: "completed",
                updated_at: new Date().toISOString(),
              })
              .eq("bot_id", botUuid)
              .eq("telegram_user_id", String(telegramUserId))

            // Enviar entrega
            const delivery = flowConfig?.delivery
            if (delivery) {
              if (delivery.medias && delivery.medias.length > 0) {
                for (const mediaUrl of delivery.medias) {
                  if (mediaUrl.includes(".mp4") || mediaUrl.includes("video")) {
                    await sendTelegramVideo(botToken, chatId, mediaUrl, "")
                  } else {
                    await sendTelegramPhoto(botToken, chatId, mediaUrl, "")
                  }
                  await new Promise(r => setTimeout(r, 500))
                }
              }

              if (delivery.link) {
                const buttonText = delivery.linkText || "Acessar conteudo"
                const keyboard = {
                  inline_keyboard: [
                    [{ text: buttonText, url: delivery.link }]
                  ]
                }
                await sendTelegramMessage(botToken, chatId, "Seu acesso foi liberado! Clique no botao abaixo:", keyboard)
              } else {
                await sendTelegramMessage(botToken, chatId, "Obrigado pela compra! Seu acesso foi liberado.")
              }
            } else {
              await sendTelegramMessage(botToken, chatId, "Obrigado pela compra! Seu acesso foi liberado.")
            }
          }
        }

        return
      }
      // ========== FIM UPSELL CALLBACKS ==========
      
      // ========== DOWNSELL CALLBACKS ==========
      // ========== DOWNSELL CALLBACKS ==========
      // Formato: ds_sequenceId_planId_price (sem o accept no nome)
      if (callbackData.startsWith("ds_") && !callbackData.startsWith("ds_test_")) {
        console.log("[v0] Downsell Callback recebido:", callbackData)
        
        // Confirmar recebimento do callback
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: callbackQueryId,
            text: "Gerando pagamento..."
          })
        })
        
        // ds_sequenceId_planId_price
        const parts = callbackData.replace("ds_", "").split("_")
        const sequenceId = parts[0]
        const planId = parts[1]
        const price = parseFloat(parts[2]) || 0
          
          if (price > 0) {
            // USAR MESMA ESTRUTURA DOS PLANOS NORMAIS
            // 1. Buscar user_id do bot
            const { data: botDataDS } = await supabase
              .from("bots")
              .select("user_id")
              .eq("id", botUuid)
              .single()
            
            if (!botDataDS?.user_id) {
              await sendTelegramMessage(botToken, chatId, "Erro: Bot nao encontrado.")
              return
            }
            
            // 2. Buscar gateway do usuario (IGUAL AOS PLANOS)
            const { data: gatewayDS } = await supabase
              .from("user_gateways")
              .select("*")
              .eq("user_id", botDataDS.user_id)
              .eq("is_active", true)
              .limit(1)
              .single()
            
            if (!gatewayDS || !gatewayDS.access_token) {
              await sendTelegramMessage(botToken, chatId, "Gateway de pagamento nao configurado. Entre em contato com o suporte.")
              return
            }
            
            try {
              // 3. Gerar PIX usando a MESMA funcao dos planos
              const pixResult = await createPixPayment({
                accessToken: gatewayDS.access_token,
                amount: price,
                description: `Downsell - Oferta Especial`,
                payerEmail: "luismarquesdevp@gmail.com",
              })
              
              if (!pixResult.success) {
                await sendTelegramMessage(botToken, chatId, `Erro ao gerar PIX: ${pixResult.error || "Tente novamente"}`)
                return
              }
              
              // 4. Salvar pagamento (IGUAL AOS PLANOS)
              console.log("[v0] Saving downsell payment - user_id:", botDataDS.user_id, "bot_id:", botUuid, "amount:", price)
              const { error: downsellPaymentError } = await supabase.from("payments").insert({
                user_id: botDataDS.user_id,
                bot_id: botUuid,
                telegram_user_id: String(telegramUserId),
                telegram_username: userUsername || null,
                telegram_first_name: userFirstName || null,
                telegram_last_name: userLastName || null,
                payment_method: "pix",
                gateway: gatewayDS.gateway_name || "mercadopago",
                external_payment_id: String(pixResult.paymentId),
                amount: price,
                description: `Downsell - Oferta Especial`,
                product_name: "Oferta Especial",
                product_type: "downsell",
                qr_code: pixResult.qrCode,
                qr_code_url: pixResult.qrCodeUrl,
                copy_paste: pixResult.copyPaste,
                pix_code: pixResult.copyPaste || pixResult.qrCode,
                status: "pending",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              
              if (downsellPaymentError) {
                console.error("[v0] Error saving downsell payment:", downsellPaymentError)
              } else {
                console.log("[v0] Downsell payment saved successfully")
              }
              
              // 5. Enviar PIX (IGUAL AOS PLANOS)
              const flowDS = await getActiveFlowForBot(supabase, botUuid)
              const flowConfigDS = (flowDS?.config as Record<string, unknown>) || {}
              const paymentMessagesDS = (flowConfigDS.paymentMessages as PaymentMessagesConfig) || {}
              
              await sendPixPaymentMessages({
                botToken,
                chatId,
                pixCode: pixResult.copyPaste || pixResult.qrCode || "",
                qrCodeUrl: pixResult.qrCodeUrl,
                amount: price,
                productName: "Oferta Especial",
                paymentId: String(pixResult.paymentId),
                config: paymentMessagesDS,
                userName: userFirstName || "Cliente"
              })
              
              // 6. Cancelar outros downsells pendentes
              await getSupabaseAdmin()
                .from("scheduled_messages")
                .update({ status: "cancelled" })
                .eq("bot_id", botUuid)
                .eq("telegram_user_id", String(telegramUserId))
                .eq("message_type", "downsell")
                .eq("status", "pending")
                
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : String(err)
              console.error("Erro ao gerar PIX do downsell:", errorMsg)
              await sendTelegramMessage(botToken, chatId, `Erro ao processar pagamento: ${errorMsg}`)
            }
          } else {
            await sendTelegramMessage(botToken, chatId, "Erro: Preco invalido no downsell.")
          }
        
        return
      }
      // ========== FIM DOWNSELL CALLBACKS ==========
      
      // Handle plan selection - generate PIX
      if (callbackData.startsWith("plan_")) {
        const planId = callbackData.replace("plan_", "")
        
        // First try to get plan from flow_plans table
        let planName = ""
        let planPrice = 0
        let flowIdForGateway = ""
        let planFromDb = false // Flag para saber se veio da tabela flow_plans
        
        const { data: dbPlan } = await supabase
          .from("flow_plans")
          .select("*, flows!inner(id, config, bot_id)")
          .eq("id", planId)
          .single()
        
        if (dbPlan) {
          planName = dbPlan.name
          planPrice = Number(dbPlan.price)
          flowIdForGateway = dbPlan.flows?.id || ""
          planFromDb = true
        } else {
          // Try to find plan in flow config - check direct flow first
          let flowWithPlan = null
          
          const directFlow = await getActiveFlowForBot(supabase, botUuid)
          
          if (directFlow) {
            flowWithPlan = directFlow
          } else {
            // Check via flow_bots table
            const { data: flowBot } = await supabase
              .from("flow_bots")
              .select("flow_id")
              .eq("bot_id", botUuid)
              .limit(1)
              .single()
            
            if (flowBot?.flow_id) {
              const { data: linkedFlow } = await supabase
                .from("flows")
                .select("id, config, bot_id")
                .eq("id", flowBot.flow_id)
                .single()
              flowWithPlan = linkedFlow
            }
          }
          
          if (flowWithPlan) {
            const flowConfig = (flowWithPlan.config as Record<string, unknown>) || {}
            const configPlans = (flowConfig.plans as Array<{ id: string; name: string; price: number }>) || []
            const foundPlan = configPlans.find(p => p.id === planId)
            
            if (foundPlan) {
              planName = foundPlan.name
              planPrice = Number(foundPlan.price)
              flowIdForGateway = flowWithPlan.id
            }
          }
        }
        
        if (!planName || planPrice <= 0) {
          await sendTelegramMessage(botToken, chatId, "Plano nao encontrado.")
          return
        }
        
        // ========== VERIFICAR ORDER BUMP ANTES DE GERAR PAGAMENTO ==========
        // Buscar o fluxo vinculado ao bot para verificar Order Bump
        let flowForOrderBump: { id: string; config: unknown } | null = null
        
        // Primeiro tenta pelo bot_id direto
        const { data: directFlowOB } = await supabase
          .from("flows")
          .select("id, config")
          .eq("bot_id", botUuid)
          .limit(1)
          .single()
        
        if (directFlowOB) {
          flowForOrderBump = directFlowOB
        } else {
          // Se nao encontrou, busca via flow_bots
          const { data: flowBotLink } = await supabase
            .from("flow_bots")
            .select("flow_id")
            .eq("bot_id", botUuid)
            .limit(1)
            .single()
          
          if (flowBotLink) {
            const { data: linkedFlow } = await supabase
              .from("flows")
              .select("id, config")
              .eq("id", flowBotLink.flow_id)
              .single()
            
            if (linkedFlow) {
              flowForOrderBump = linkedFlow
            }
          }
        }
        
        console.log("[v0] Order Bump - flowForOrderBump encontrado:", !!flowForOrderBump)
        
        if (flowForOrderBump) {
          const flowConfig = (flowForOrderBump.config as Record<string, unknown>) || {}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const orderBumpConfig = flowConfig.orderBump as Record<string, any> | undefined
          const orderBumpInicial = orderBumpConfig?.inicial
          
          // ========== VERIFICAR ORDER BUMPS ESPECIFICOS DO PLANO ==========
          // PRIORIDADE DE ORDER BUMPS:
          // 1. Se o plano veio do banco (flow_plans) e tem order_bumps -> usar dbPlan.order_bumps
          // 2. Se o plano esta no config JSON e tem order_bumps -> usar flowConfig.plans[].order_bumps
          // 3. Se nenhum dos acima -> usar order bump global (orderBumpConfig.inicial) SE estiver ativo
          // 
          // IMPORTANTE: Plan-level order bumps funcionam INDEPENDENTE de config.orderBump.enabled
          // O global "enabled" so controla o order bump global, nao os especificos do plano
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let planOrderBumps: Array<any> = []
          
          // PRIMEIRO: Verificar se dbPlan (da tabela flow_plans) tem order_bumps
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (planFromDb && dbPlan && (dbPlan as any).order_bumps && Array.isArray((dbPlan as any).order_bumps)) {
            planOrderBumps = (dbPlan as any).order_bumps
            console.log("[v0] Order Bump - Usando order_bumps do flow_plans (banco):", planOrderBumps.length, "bumps")
          } else {
            // SEGUNDO: Buscar no config JSON (flows.config.plans[])
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const configPlans = (flowConfig.plans as Array<Record<string, any>>) || []
            
            // Se o plano veio da tabela flow_plans, buscar pelo nome (pois o ID pode ser diferente)
            // Se veio da config JSON, buscar pelo ID
            let selectedPlanConfig = null
            if (planFromDb) {
              // Buscar pelo nome do plano (case insensitive e trim)
              selectedPlanConfig = configPlans.find(p => 
                p.name?.toLowerCase().trim() === planName.toLowerCase().trim()
              )
              console.log("[v0] Order Bump - Plano veio da tabela flow_plans, buscando por nome:", planName, "encontrado:", !!selectedPlanConfig)
            } else {
              // Buscar pelo ID exato
              selectedPlanConfig = configPlans.find(p => p.id === planId)
            }
            
            planOrderBumps = selectedPlanConfig?.order_bumps || []
            console.log("[v0] Order Bump - Usando order_bumps do config JSON:", planOrderBumps.length, "bumps")
          }
          
          // Filtrar apenas order bumps ativos e com preco > 0
          const activePlanOrderBumps = planOrderBumps.filter((ob: { enabled?: boolean; price?: number }) => 
            ob.enabled && ob.price && ob.price > 0
          )
          
          // PRIORIDADE: Se o order bump GLOBAL (fluxo inicial) estiver ativado, ele ANULA os order bumps do plano
          const globalOrderBumpEnabled = orderBumpInicial?.enabled && orderBumpInicial?.price > 0
          
          console.log("[v0] Order Bump Check - Plan specific bumps:", activePlanOrderBumps.length, "Global inicial ativo:", globalOrderBumpEnabled)
          
          // Se o plano tem order bumps especificos E o global NAO esta ativado, usar os do plano
          // Se o global esta ativado, ignora os do plano e usa o global (tratado mais abaixo)
          if (activePlanOrderBumps.length > 0 && !globalOrderBumpEnabled) {
            const mainPriceRounded = Math.round(planPrice * 100)
            const hasMultipleBumps = activePlanOrderBumps.length > 1
            
            console.log("[v0] Plan Order Bumps - total:", activePlanOrderBumps.length, "multiplos:", hasMultipleBumps)
            
            // Enviar mensagem do plano selecionado
            await sendTelegramMessage(
              botToken,
              chatId,
              `Voce selecionou: *${planName}*\n\nValor: R$ ${planPrice.toFixed(2).replace(".", ",")}`,
              undefined
            )
            
            // Mostrar CADA order bump
            for (let i = 0; i < activePlanOrderBumps.length; i++) {
              const planOrderBump = activePlanOrderBumps[i]
              const bumpPriceRounded = Math.round(planOrderBump.price * 100)
              
              const orderBumpDesc = planOrderBump.description || `Deseja adicionar ${planOrderBump.name || "este bonus"} por apenas R$ ${planOrderBump.price.toFixed(2).replace(".", ",")}?`
              const orderBumpAcceptText = planOrderBump.acceptText || "QUERO"
              
              // Callback para aceitar este order bump especifico
              const acceptCallback = `ob_accept_${mainPriceRounded}_${bumpPriceRounded}`
              
              console.log("[v0] Plan Order Bump", i + 1, "- callback:", acceptCallback)
              
              // Enviar midias do order bump se houver
              if (planOrderBump.medias && planOrderBump.medias.length > 0) {
                console.log("[v0] Enviando midias do Plan Order Bump", i + 1, ":", planOrderBump.medias.length)
                await sendMediaGroup(botToken, chatId, planOrderBump.medias, "")
              }
              
              // Se tem APENAS 1 order bump: mostra QUERO + NAO QUERO
              // Se tem MAIS DE 1: mostra so QUERO (o PROSSEGUIR vem no final)
              if (hasMultipleBumps) {
                // Multiplos bumps: so botao QUERO
                const bumpKeyboard = {
                  inline_keyboard: [
                    [{ text: orderBumpAcceptText, callback_data: acceptCallback }]
                  ]
                }
                await sendTelegramMessage(botToken, chatId, orderBumpDesc, bumpKeyboard)
              } else {
                // Apenas 1 bump: QUERO + NAO QUERO
                const declineCallback = `ob_decline_${mainPriceRounded}_0`
                const orderBumpDeclineText = planOrderBump.rejectText || "NAO QUERO"
                const bumpKeyboard = {
                  inline_keyboard: [
                    [{ text: orderBumpAcceptText, callback_data: acceptCallback }],
                    [{ text: orderBumpDeclineText, callback_data: declineCallback }]
                  ]
                }
                await sendTelegramMessage(botToken, chatId, orderBumpDesc, bumpKeyboard)
              }
            }
            
            // Se tem MAIS DE 1 order bump, adicionar botao PROSSEGUIR no final
            // Esse botao usa ob_decline_ para gerar PIX sem nenhum bump
            if (hasMultipleBumps) {
              const declineCallback = `ob_decline_${mainPriceRounded}_0`
              const prosseguirKeyboard = {
                inline_keyboard: [
                  [{ text: `PROSSEGUIR - R$ ${planPrice.toFixed(2).replace(".", ",")}`, callback_data: declineCallback }]
                ]
              }
              await sendTelegramMessage(
                botToken,
                chatId,
                "Escolha um dos produtos acima ou continue sem adicionar nada:",
                prosseguirKeyboard
              )
            }
            
            // Salvar estado USANDO MESMO STATUS DO ORDER BUMP GLOBAL (waiting_order_bump)
            console.log("[v0] Salvando estado Plan Order Bump - bot_id:", botUuid, "telegram_user_id:", String(telegramUserId))
            const { error: stateUpsertError } = await supabase.from("user_flow_state").upsert({
              bot_id: botUuid,
              telegram_user_id: String(telegramUserId),
              flow_id: flowForOrderBump.id,
              status: "waiting_order_bump", // MESMO STATUS DO ORDER BUMP GLOBAL
              current_node_position: 0,
              metadata: {
                type: "plan",
                order_bump_name: activePlanOrderBumps[0].name || "Order Bump",
                order_bump_price: activePlanOrderBumps[0].price,
                main_amount: planPrice,
                main_description: planName,
                order_bump_source: "plan_specific"
              },
              updated_at: new Date().toISOString()
            }, {
              onConflict: "bot_id,telegram_user_id"
            })
            
            if (stateUpsertError) {
              console.error("[v0] Erro ao salvar estado Plan Order Bump:", stateUpsertError)
            } else {
              console.log("[v0] Estado Plan Order Bump salvo com sucesso")
            }
            
            return // STOP - aguardar decisao do Order Bump
          }
          // ========== FIM ORDER BUMPS ESPECIFICOS DO PLANO ==========
          
          // Se nao tem order bump especifico, usar o global (Fluxo Inicial)
          console.log("[v0] Order Bump Check - config:", !!orderBumpConfig, "inicial:", !!orderBumpInicial, "enabled:", orderBumpInicial?.enabled, "price:", orderBumpInicial?.price)
          
          if (orderBumpInicial?.enabled && orderBumpInicial?.price > 0) {
            console.log("[v0] Order Bump GLOBAL ATIVADO! Enviando oferta ao usuario...")
            
            const orderBumpDesc = orderBumpInicial.description || `Deseja adicionar ${orderBumpInicial.name || "este bonus"} por apenas R$ ${orderBumpInicial.price}?`
            const orderBumpAcceptText = orderBumpInicial.acceptText || "QUERO"
            const orderBumpDeclineText = orderBumpInicial.rejectText || "NAO QUERO"
            
            // Formato: ob_accept_{mainAmount}_{bumpAmount} ou ob_decline_{mainAmount}
            // Arredondar precos para evitar problemas com decimais no callback
            const mainPriceRounded = Math.round(planPrice * 100)
            const bumpPriceRounded = Math.round(orderBumpInicial.price * 100)
            const acceptCallback = `ob_accept_${mainPriceRounded}_${bumpPriceRounded}`
            const declineCallback = `ob_decline_${mainPriceRounded}_0`
            console.log("[v0] Order Bump callbacks:", acceptCallback, declineCallback)
            
            const orderBumpKeyboard = {
              inline_keyboard: [
                [{ text: orderBumpAcceptText, callback_data: acceptCallback }],
                [{ text: orderBumpDeclineText, callback_data: declineCallback }]
              ]
            }
            
            // Enviar mensagem do plano selecionado
            await sendTelegramMessage(
              botToken,
              chatId,
              `Voce selecionou: *${planName}*\n\nValor: R$ ${planPrice.toFixed(2).replace(".", ",")}`,
              undefined
            )
            
            // Enviar midias do order bump se houver
            if (orderBumpInicial.medias && orderBumpInicial.medias.length > 0) {
              console.log("[v0] Enviando midias do Order Bump:", orderBumpInicial.medias.length)
              await sendMediaGroup(botToken, chatId, orderBumpInicial.medias, "")
            }
            
            // Enviar oferta do Order Bump
            await sendTelegramMessage(botToken, chatId, orderBumpDesc, orderBumpKeyboard)
            
            // Salvar estado para quando usuario responder
            console.log("[v0] Salvando estado Order Bump - bot_id:", botUuid, "telegram_user_id:", String(telegramUserId))
            const { error: stateUpsertError } = await supabase.from("user_flow_state").upsert({
              bot_id: botUuid,
              telegram_user_id: String(telegramUserId),
              flow_id: flowForOrderBump.id,
              status: "waiting_order_bump",
              current_node_position: 0,
              metadata: {
                type: "plan",
                order_bump_name: orderBumpInicial.name || "Order Bump",
                order_bump_price: orderBumpInicial.price,
                main_amount: planPrice,
                main_description: planName,
                order_bump_source: "global_inicial"
              },
              updated_at: new Date().toISOString()
            }, {
              onConflict: "bot_id,telegram_user_id"
            })
            if (stateUpsertError) {
              console.error("[v0] Erro ao salvar estado Order Bump:", stateUpsertError)
            } else {
              console.log("[v0] Estado Order Bump salvo com sucesso")
            }
            
            return // STOP - aguardar decisao do Order Bump
          }
        }
        // ========== FIM ORDER BUMP ==========
        
        // Send processing message
        await sendTelegramMessage(
          botToken,
          chatId,
          `Voce selecionou: *${planName}*\n\nValor: R$ ${planPrice.toFixed(2).replace(".", ",")}\n\nGerando pagamento PIX...`,
          undefined
        )
        
        // Get user_id from bot to find gateway (gateway is per user, not per bot)
        const { data: botData } = await supabase
          .from("bots")
          .select("user_id")
          .eq("id", botUuid)
          .single()
        
        if (!botData?.user_id) {
          await sendTelegramMessage(botToken, chatId, "Erro: Bot nao encontrado.", undefined)
          return
        }
        
        // Get gateway for this user (all bots use the same gateway)
        const { data: gateway, error: gwError } = await supabase
          .from("user_gateways")
          .select("*")
          .eq("user_id", botData.user_id)
          .eq("is_active", true)
          .limit(1)
          .single()
        
        console.log("[v0] Gateway lookup - user_id:", botData.user_id, "found:", !!gateway, "has_token:", !!gateway?.access_token, "error:", gwError?.message)
        
        if (!gateway || !gateway.access_token) {
          await sendTelegramMessage(
            botToken,
            chatId,
            "Gateway de pagamento nao configurado. Entre em contato com o suporte.",
            undefined
          )
          return
        }
        
        // Generate PIX using existing payment gateway
        try {
          const pixResult = await createPixPayment({
            accessToken: gateway.access_token,
            amount: planPrice,
            description: `Pagamento - ${planName}`,
            payerEmail: "luismarquesdevp@gmail.com",
          })
          
          if (!pixResult.success) {
            await sendTelegramMessage(
              botToken,
              chatId,
              `Erro ao gerar PIX: ${pixResult.error || "Tente novamente"}`,
              undefined
            )
            return
          }
          
          // Get user_id from bot
          const { data: botData } = await supabase
            .from("bots")
            .select("user_id")
            .eq("id", botUuid)
            .single()
          
          // Save payment record with correct fields including Telegram user info
          console.log("[v0] Saving plan payment - user_id:", botData?.user_id, "bot_id:", botUuid, "amount:", planPrice)
          const { data: savedPlanPayment, error: savePlanError } = await supabase.from("payments").insert({
            user_id: botData?.user_id,
            bot_id: botUuid,
            telegram_user_id: String(telegramUserId),
            telegram_username: userUsername || null,
            telegram_first_name: userFirstName || null,
            telegram_last_name: userLastName || null,
            payment_method: "pix",
            gateway: gateway.gateway_name || "mercadopago",
            external_payment_id: String(pixResult.paymentId),
            amount: planPrice,
            description: `Pagamento - ${planName}`,
            product_name: planName,
            product_type: "plan",
            qr_code: pixResult.qrCode,
            qr_code_url: pixResult.qrCodeUrl,
            copy_paste: pixResult.copyPaste,
            pix_code: pixResult.copyPaste || pixResult.qrCode,
            status: "pending",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).select().single()
          
          if (savePlanError) {
            console.error("[v0] Error saving plan payment:", savePlanError)
          } else {
            console.log("[v0] Plan payment saved:", savedPlanPayment?.id)
          }
          
          // Buscar config de mensagens de pagamento do flow
          const flowPlan = await getActiveFlowForBot(supabase, botUuid)
          const flowConfigPlan = (flowPlan?.config as Record<string, unknown>) || {}
          const paymentMessagesPlan = (flowConfigPlan.paymentMessages as PaymentMessagesConfig) || {}
          
          // Enviar mensagens de PIX de forma centralizada
          await sendPixPaymentMessages({
            botToken,
            chatId,
            pixCode: pixResult.copyPaste || pixResult.qrCode || "",
            qrCodeUrl: pixResult.qrCodeUrl,
            amount: planPrice,
            productName: planName,
            paymentId: String(pixResult.paymentId),
            config: paymentMessagesPlan,
            userName: userFirstName || "Cliente"
          })
          
          // DOWNSELLS DO TIPO "PIX" (para quem gerou pix mas nao pagou)
          // Buscar flow para pegar config de downsell
          // Downsell agora e processado apenas no /start (nao mais no pix gerado)
          
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err)
          console.error("PIX generation error:", errorMsg)
          await sendTelegramMessage(
            botToken,
            chatId,
            `Erro ao processar pagamento: ${errorMsg}`,
            undefined
          )
        }
        
        return
      }
    }
    // 4. Check if /start command
    const isStart = text.toLowerCase().startsWith("/start")

    // 5. Get or create lead AND bot_user
    if (telegramUserId && isStart) {
      // 5.1 Insert/Update bot_users (for Clientes page)
      const { data: existingBotUser } = await supabase
        .from("bot_users")
        .select("id")
        .eq("bot_id", botUuid)
        .eq("telegram_user_id", telegramUserId)
        .limit(1)
        .single()

      if (existingBotUser) {
        // Update existing user
        await supabase
          .from("bot_users")
          .update({
            first_name: (from.first_name as string) || null,
            last_name: (from.last_name as string) || null,
            username: (from.username as string) || null,
            last_activity: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("bot_id", botUuid)
          .eq("telegram_user_id", telegramUserId)
      } else {
        // Insert new user
        const { error: botUserError } = await supabase.from("bot_users").insert({
          bot_id: botUuid,
          telegram_user_id: telegramUserId,
          chat_id: chatId,
          first_name: (from.first_name as string) || null,
          last_name: (from.last_name as string) || null,
          username: (from.username as string) || null,
          funnel_step: 1,
          is_subscriber: false,
          last_activity: new Date().toISOString(),
        })
        
        if (botUserError) {
          console.error("[webhook] Erro ao inserir bot_user:", botUserError.message, botUserError.code)
        }
      }

      // 5.2 Insert lead (legacy support)
      const { data: existingLead } = await supabase
        .from("leads")
        .select("id")
        .eq("bot_id", botUuid)
        .eq("telegram_id", String(telegramUserId))
        .single()

      if (!existingLead) {
        const { error: leadError } = await supabase.from("leads").insert({
          bot_id: botUuid,
          telegram_id: String(telegramUserId),
          chat_id: String(chatId),
          first_name: (from.first_name as string) || "",
          last_name: (from.last_name as string) || "",
          username: (from.username as string) || "",
          status: "active",
          source: "telegram"
        })
        
        if (leadError) {
          console.error("[webhook] Erro ao inserir lead:", leadError.message, leadError.code)
        }
      }
    }

    // 6. Process /start - execute welcome flow
    if (isStart) {
      // Find flow for this bot
      let startFlow = null

      // Strategy 1: Check flows.bot_id (direct link)
      const { data: directFlow } = await supabase
        .from("flows")
        .select("*")
        .eq("bot_id", botUuid)
        .eq("status", "ativo")
        .order("is_primary", { ascending: false })
        .limit(1)
        .single()

      if (directFlow) {
        startFlow = directFlow
      } else {
        // Strategy 2: Check flow_bots table (many-to-many link from /fluxos page)
        const { data: flowBotLink } = await supabase
          .from("flow_bots")
          .select("flow_id")
          .eq("bot_id", botUuid)
          .limit(1)
          .single()

        if (flowBotLink) {
          const { data: linkedFlow } = await supabase
            .from("flows")
            .select("*")
            .eq("id", flowBotLink.flow_id)
            .single()

          if (linkedFlow) {
            startFlow = linkedFlow
          }
        }
      }

      // Strategy 3: Any flow from user (last resort)
      if (!startFlow) {
        const { data: anyUserFlow } = await supabase
          .from("flows")
          .select("*")
          .eq("user_id", bot.user_id)
          .eq("status", "ativo")
          .order("created_at", { ascending: false })
          .limit(1)
          .single()

        startFlow = anyUserFlow
      }

      if (startFlow) {
        // Get flow config (contains all settings from /fluxos/[id] page)
        const flowConfig = (startFlow.config as Record<string, unknown>) || {}
        
        // Helper to replace variables
        const replaceVars = (text: string) => {
          if (!text) return ""
          return text
            .replace(/\{nome\}/gi, (from?.first_name as string) || "")
            .replace(/\{username\}/gi, (from?.username as string) ? `@${from.username}` : "")
            .replace(/\{bot\.username\}/gi, bot.username ? `@${bot.username}` : bot.name || "")
        }
        
        // Get welcome message - try config first, then table field
        const welcomeMsg = (flowConfig.welcomeMessage as string) || (startFlow.welcome_message as string) || ""
        
        // Get medias - filter out base64 (Telegram only accepts URLs)
        const allMedias = (flowConfig.welcomeMedias as string[]) || []
        const welcomeMedias = allMedias.filter(m => m && !m.startsWith("data:") && (m.startsWith("http") || m.startsWith("/")))
        
        const ctaButtonText = (flowConfig.ctaButtonText as string) || "Ver Planos"
        const redirectButton = flowConfig.redirectButton as { enabled?: boolean; text?: string; url?: string } || {}
        const secondaryMsg = flowConfig.secondaryMessage as { enabled?: boolean; message?: string } || {}
        
        // Verificar se Packs esta habilitado
        const packsConfig = flowConfig.packs as { enabled?: boolean; buttonText?: string; list?: Array<{ id: string; active?: boolean }> } | undefined
        const packsEnabled = packsConfig?.enabled && packsConfig?.list && packsConfig.list.filter(p => p.active !== false).length > 0
        const packsButtonText = packsConfig?.buttonText || "Packs Disponiveis"
        
        // Always send welcome flow (we have at least a default message)
        const finalMsg = replaceVars(welcomeMsg) || `Ola! Bem-vindo ao ${bot.name || "bot"}.`
        
        // Build inline keyboard with buttons
        const inlineKeyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = []
        
        // CTA Button (Ver Planos) - callback button
        inlineKeyboard.push([{ text: ctaButtonText, callback_data: "ver_planos" }])
        
        // Packs Button - se habilitado, adiciona na mensagem de boas-vindas
        if (packsEnabled) {
          inlineKeyboard.push([{ text: packsButtonText, callback_data: "show_packs" }])
        }
        
        // Redirect Button - URL button (if enabled)
        if (redirectButton.enabled && redirectButton.text && redirectButton.url) {
          inlineKeyboard.push([{ text: redirectButton.text, url: redirectButton.url }])
        }
        
        const replyMarkup = { inline_keyboard: inlineKeyboard }
        
        // STEP 1: Send medias (if any valid URLs) - grouped as album
        if (welcomeMedias.length > 0) {
          try {
            // Send all medias together as album with welcome message as caption
            await sendMediaGroup(botToken, chatId, welcomeMedias, finalMsg)
            // Send buttons separately after the album
            await sendTelegramMessage(botToken, chatId, "Escolha uma opcao:", replyMarkup)
          } catch {
            // If media group fails, send message with buttons normally
            await sendTelegramMessage(botToken, chatId, finalMsg, replyMarkup)
          }
        } else {
          // STEP 2: No medias - send welcome message with buttons
          await sendTelegramMessage(botToken, chatId, finalMsg, replyMarkup)
        }
        
        // STEP 3: Send secondary message (if enabled)
        if (secondaryMsg.enabled && secondaryMsg.message) {
          await new Promise(resolve => setTimeout(resolve, 500))
          await sendTelegramMessage(botToken, chatId, replaceVars(secondaryMsg.message))
        }
        
        // STEP 4: Send/Schedule downsell sequences (enviadas para quem NAO pagou)
        const downsellConfig = flowConfig.downsell as { enabled?: boolean; sequences?: Array<{ 
          id: string; message: string; medias?: string[]; sendTiming?: string; sendDelayValue?: number; sendDelayUnit?: string; 
          plans?: Array<{ id: string; buttonText: string; price: number }>; deliveryType?: string; deliverableId?: string; customDelivery?: string
        }> } | undefined
        
        if (downsellConfig?.enabled && downsellConfig.sequences && downsellConfig.sequences.length > 0) {
          const now = new Date()
          const supabaseAdmin = getSupabaseAdmin() // Usar admin pra bypassar RLS
          
          // Cancelar agendamentos anteriores deste usuario
          await supabaseAdmin
            .from("scheduled_messages")
            .update({ status: "cancelled" })
            .eq("bot_id", botUuid)
            .eq("telegram_user_id", String(telegramUserId))
            .eq("status", "pending")
          
          // Processar todas as sequencias de downsell
          for (const seq of downsellConfig.sequences) {
            // Calcular delay em minutos
            let delayMinutes = seq.sendDelayValue || 1
            if (seq.sendDelayUnit === "hours") delayMinutes = (seq.sendDelayValue || 1) * 60
            else if (seq.sendDelayUnit === "days") delayMinutes = (seq.sendDelayValue || 1) * 60 * 24
            
            // Calcular horario exato para envio
            const scheduledFor = new Date(now.getTime() + delayMinutes * 60 * 1000)
            
            // Salvar no banco para o cron processar
            console.log(`[DOWNSELL] Agendando downsell para ${scheduledFor.toISOString()} (delay: ${delayMinutes} min)`)
            
            const { error: insertError } = await supabaseAdmin.from("scheduled_messages").insert({
              bot_id: botUuid,
              flow_id: startFlow.id,
              telegram_user_id: String(telegramUserId),
              telegram_chat_id: String(chatId),
              message_type: "downsell",
              sequence_id: seq.id,
              sequence_index: downsellConfig.sequences.indexOf(seq),
              scheduled_for: scheduledFor.toISOString(),
              status: "pending",
              metadata: {
                message: seq.message,
                medias: seq.medias || [],
                plans: seq.plans || [],
                deliveryType: seq.deliveryType,
                deliverableId: seq.deliverableId,
                customDelivery: seq.customDelivery,
                botToken: botToken,
              }
            })
            
            if (insertError) {
              console.error(`[DOWNSELL] ERRO ao agendar: ${insertError.message}`)
            } else {
              console.log(`[DOWNSELL] Agendado com sucesso para user ${telegramUserId}`)
            }
          }
          
          console.log(`[DOWNSELL] Total: ${downsellConfig.sequences.length} downsell(s) agendados para user ${telegramUserId}`)
        }
        
        return

        // Fallback: Get flow nodes
        const { data: nodes } = await supabase
          .from("flow_nodes")
          .select("*")
          .eq("flow_id", startFlow.id)
          .order("position", { ascending: true })

        if (nodes && nodes.length > 0) {
          for (const node of nodes) {
            await executeNode(botToken, chatId, node, from as Record<string, unknown>)
            await new Promise(resolve => setTimeout(resolve, 300))
          }
        } else {
          await sendTelegramMessage(botToken, chatId, `Ola! Bem-vindo ao ${bot.name || "bot"}.`)
        }
      } else {
        await sendTelegramMessage(botToken, chatId, `Ola! Bem-vindo ao ${bot.name || "bot"}.`)
      }
    }
  } catch (error) {
    console.error("[webhook] Error processing:", error)
  }
}

// ---------------------------------------------------------------------------
// Execute a flow node
// ---------------------------------------------------------------------------

async function executeNode(botToken: string, chatId: number, node: Record<string, unknown>, from?: Record<string, unknown>) {
  const nodeType = node.type as string
  const config = (node.config as Record<string, unknown>) || {}
  const subVariant = (config.subVariant as string) || ""

  // Helper to replace variables
  const replaceVars = (text: string) => {
    return text
      .replace(/\{nome\}/gi, (from?.first_name as string) || "")
      .replace(/\{username\}/gi, (from?.username as string) ? `@${from.username}` : "")
  }

  switch (nodeType) {
    case "trigger":
      break

    case "text":
    case "message": {
      let text = (config.text as string) || (config.content as string) || ""
      text = replaceVars(text)
      const mediaUrl = (config.media_url as string) || ""
      const mediaType = (config.media_type as string) || ""
      
      let buttons: Array<{ text: string; url: string }> = []
      const buttonsRaw = config.buttons
      if (buttonsRaw) {
        try {
          buttons = typeof buttonsRaw === "string" ? JSON.parse(buttonsRaw) : (Array.isArray(buttonsRaw) ? buttonsRaw : [])
        } catch { buttons = [] }
      }

      let replyMarkup = undefined
      if (buttons.length > 0) {
        const validButtons = buttons.filter(b => b.text && b.url)
        if (validButtons.length > 0) {
          replyMarkup = { inline_keyboard: validButtons.map(b => [{ text: b.text, url: b.url }]) }
        }
      }

      if (mediaUrl && mediaType && mediaType !== "none") {
        if (mediaType === "photo") {
          await sendTelegramPhoto(botToken, chatId, mediaUrl, text || undefined)
          return
        } else if (mediaType === "video") {
          await sendTelegramVideo(botToken, chatId, mediaUrl, text || undefined)
          return
        }
      }

      if (text) {
        await sendTelegramMessage(botToken, chatId, text, replyMarkup)
      }
      break
    }

    case "image": {
      const imageUrl = (config.url as string) || (config.media_url as string) || ""
      const caption = (config.caption as string) || (config.text as string) || ""
      if (imageUrl) await sendTelegramPhoto(botToken, chatId, imageUrl, caption || undefined)
      break
    }

    case "video": {
      const videoUrl = (config.url as string) || (config.media_url as string) || ""
      const videoCaption = (config.caption as string) || (config.text as string) || ""
      if (videoUrl) await sendTelegramVideo(botToken, chatId, videoUrl, videoCaption || undefined)
      break
    }

    case "delay": {
      const seconds = parseInt(String(config.seconds)) || 1
      await new Promise(resolve => setTimeout(resolve, seconds * 1000))
      break
    }

    case "action": {
      if (subVariant === "add_group") {
        const groupLink = config.action_name as string
        if (groupLink) {
          await sendTelegramMessage(botToken, chatId, `Entre no grupo:`, {
            inline_keyboard: [[{ text: "Entrar no Grupo", url: groupLink }]]
          })
        }
      }
      break
    }

    case "payment": {
      const paymentButtonsRaw = config.payment_buttons as string
      if (paymentButtonsRaw) {
        try {
          const paymentButtons = JSON.parse(paymentButtonsRaw)
          if (paymentButtons.length > 0) {
            const firstBtn = paymentButtons[0]
            await sendTelegramMessage(botToken, chatId, `${firstBtn.text}\nValor: R$ ${firstBtn.amount}`, {
              inline_keyboard: [[{ text: `Pagar R$ ${firstBtn.amount}`, callback_data: `pay_${firstBtn.id}` }]]
            })
          }
        } catch { /* ignore */ }
      }
      break
    }
  }
}

// ---------------------------------------------------------------------------
// POST /api/telegram/webhook/[botId]
// RESPONDE IMEDIATAMENTE - Processa em background
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  // Parse body ANTES de responder
  let update: Record<string, unknown> = {}
  try {
    update = await req.json()
  } catch {
    return new Response("ok")
  }

  // Log para debug - ver todas as requisicoes
  const callbackData = (update.callback_query as Record<string, unknown>)?.data as string | null
  console.log("[v0] WEBHOOK RECEBIDO - botId:", botId, "callback:", callbackData || "nenhum", "hasMessage:", !!update.message)

  // Processar em background (NAO bloqueia resposta)
  processUpdate(botId, update).catch(console.error)

  // RESPONDER IMEDIATAMENTE
  return new Response("ok")
}

// ---------------------------------------------------------------------------
// GET - For webhook verification
// ---------------------------------------------------------------------------

export async function GET() {
  return new Response("Webhook active")
}

import { NextRequest } from "next/server"
import { getSupabase, getSupabaseAdmin } from "@/lib/supabase"
import { createPixPayment } from "@/lib/payments/gateways/mercadopago"

// ---------------------------------------------------------------------------
// Helper: Sanitizar HTML para Telegram
// Remove tags vazias e corrige formatacao quebrada que causa erro na API
// ---------------------------------------------------------------------------
function sanitizeTelegramHTML(text: string): string {
  if (!text) return ""

  let result = text

  // PRIMEIRO: Converter sintaxe [LINK: text | url] para HTML <a href="url">text</a>
  // Isso garante que links configurados no RichTextEditor funcionem no Telegram
  // Captura o texto e a URL, removendo espacos extras da URL
  result = result.replace(/\[LINK:\s*([^|]+?)\s*\|\s*([^\]]+?)\s*\]/gi, (_, linkText, linkUrl) => {
    const cleanUrl = linkUrl.trim()
    const cleanText = linkText.trim()
    return `<a href="${cleanUrl}">${cleanText}</a>`
  })

  // Remove tags vazias que quebram o Telegram (ex: <b></b>, <i></i>)
  // Isso inclui tags com apenas espacos dentro
  result = result.replace(/<(b|i|u|s|code|pre|a|blockquote)>\s*<\/\1>/gi, "")

  // Remove tags aninhadas vazias (ex: <b><i></i></b>)
  // Repetir algumas vezes para pegar aninhamentos profundos
  for (let i = 0; i < 3; i++) {
    result = result.replace(/<(b|i|u|s|code|pre|a|blockquote)>\s*<\/\1>/gi, "")
  }

  // Corrige tags <a> sem href (Telegram exige href)
  result = result.replace(/<a>([^<]*)<\/a>/gi, "$1")
  result = result.replace(/<a\s+>([^<]*)<\/a>/gi, "$1")

  // Remove tags <a> com href vazio
  result = result.replace(/<a\s+href=["']?\s*["']?\s*>([^<]*)<\/a>/gi, "$1")

  // Corrige tags nao fechadas - adiciona fechamento se necessario
  // Para cada tag de abertura sem fechamento correspondente, remove a tag
  const tags = ["b", "i", "u", "s", "code", "pre", "blockquote"]
  for (const tag of tags) {
    const openRegex = new RegExp(`<${tag}>`, "gi")
    const closeRegex = new RegExp(`</${tag}>`, "gi")
    const openCount = (result.match(openRegex) || []).length
    const closeCount = (result.match(closeRegex) || []).length

    // Se tem mais aberturas que fechamentos, remove as aberturas extras
    if (openCount > closeCount) {
      // Remove a ultima tag de abertura sem par
      for (let i = 0; i < openCount - closeCount; i++) {
        result = result.replace(new RegExp(`<${tag}>(?!.*<${tag}>)`, "i"), "")
      }
    }
    // Se tem mais fechamentos que aberturas, remove os fechamentos extras
    else if (closeCount > openCount) {
      for (let i = 0; i < closeCount - openCount; i++) {
        result = result.replace(new RegExp(`</${tag}>`, "i"), "")
      }
    }
  }

  // Remove tags <a> mal formadas (sem href valido ou sem http/https)
  // Preserva links que comecam com http:// ou https://
  result = result.replace(/<a\s+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi, (match, url, text) => {
    // Se a URL comeca com http ou https, manter o link
    if (url.trim().startsWith("http://") || url.trim().startsWith("https://")) {
      return `<a href="${url.trim()}">${text}</a>`
    }
    // Caso contrario, remover a tag e manter so o texto
    return text
  })

  // Remove multiplos espacos em branco consecutivos (exceto quebras de linha)
  result = result.replace(/[ \t]+/g, " ")

  // Remove linhas vazias excessivas (mais de 2 consecutivas)
  result = result.replace(/\n{4,}/g, "\n\n\n")

  // Trim final
  result = result.trim()

  return result
}

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
  pixGeneratedMessage?: string // Nome usado no fluxo
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

  // Configurações padrão - pixGeneratedMessage é o nome usado no fluxo, pixMessage é legado
  const pixMessage = config?.pixGeneratedMessage || config?.pixMessage || `<b>Como realizar o pagamento:</b>

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

  // Sanitizar HTML para evitar erros do Telegram
  const sanitizedText = sanitizeTelegramHTML(text)

  // Se apos sanitizacao o texto ficou vazio, nao enviar
  if (!sanitizedText || sanitizedText.trim() === "") {
    console.log("[v0] sendTelegramMessage - texto vazio apos sanitizacao, pulando envio")
    return null
  }

  const body: Record<string, unknown> = { chat_id: chatId, text: sanitizedText, parse_mode: "HTML" }
  if (replyMarkup) body.reply_markup = replyMarkup
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()

    // Se falhou por erro de HTML, tenta sem parse_mode
    if (!data.ok && data.description?.includes("can't parse")) {
      console.log("[v0] sendTelegramMessage - erro de parse HTML, tentando sem formatacao:", data.description)
      const fallbackBody: Record<string, unknown> = { chat_id: chatId, text: sanitizedText.replace(/<[^>]*>/g, "") }
      if (replyMarkup) fallbackBody.reply_markup = replyMarkup
      const fallbackRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fallbackBody),
      })
      const fallbackData = await fallbackRes.json()
      if (!fallbackData.ok) {
        console.error("[v0] sendTelegramMessage - erro mesmo sem HTML:", fallbackData.description)
      }
      return fallbackData?.result?.message_id || null
    }

    if (!data.ok) {
      console.error("[v0] sendTelegramMessage - erro:", data.description)
    }

    return data?.result?.message_id || null
  } catch (err) {
    console.error("[v0] sendTelegramMessage - exception:", err)
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

  // Sanitizar HTML
  const sanitizedText = sanitizeTelegramHTML(text)

  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text: sanitizedText,
    parse_mode: "HTML"
  }
  if (replyMarkup) body.reply_markup = replyMarkup
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()

    // Se falhou por erro de HTML, tenta sem parse_mode
    if (!data?.ok && data.description?.includes("can't parse")) {
      console.log("[v0] editTelegramMessage - erro de parse HTML, tentando sem formatacao")
      const fallbackBody: Record<string, unknown> = {
        chat_id: chatId,
        message_id: messageId,
        text: sanitizedText.replace(/<[^>]*>/g, "")
      }
      if (replyMarkup) fallbackBody.reply_markup = replyMarkup
      const fallbackRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fallbackBody),
      })
      const fallbackData = await fallbackRes.json()
      if (!fallbackData?.ok) {
        return { ok: false, error: fallbackData?.description, errorCode: fallbackData?.error_code }
      }
      return { ok: true }
    }

    if (!data?.ok) {
      console.log("[v0] editTelegramMessage - ERRO:", data?.description, "error_code:", data?.error_code)
      return { ok: false, error: data?.description, errorCode: data?.error_code }
    }

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
): Promise<{ ok: boolean; messageId?: number }> {
  const url = `https://api.telegram.org/bot${botToken}/sendPhoto`

  // Sanitizar caption
  const sanitizedCaption = caption ? sanitizeTelegramHTML(caption) : undefined

  const body: Record<string, unknown> = {
    chat_id: chatId,
    photo: photoUrl,
  }

  // Só adiciona parse_mode se tiver caption
  if (sanitizedCaption) {
    body.caption = sanitizedCaption
    body.parse_mode = "HTML"
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()

    // Se falhou por erro de HTML, tenta sem parse_mode
    if (!data.ok && data.description?.includes("can't parse")) {
      console.log("[v0] sendTelegramPhoto - erro de parse HTML, tentando sem formatacao:", data.description)
      const fallbackBody: Record<string, unknown> = {
        chat_id: chatId,
        photo: photoUrl,
      }
      if (sanitizedCaption) {
        fallbackBody.caption = sanitizedCaption.replace(/<[^>]*>/g, "")
      }
      const fallbackRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fallbackBody),
      })
      const fallbackData = await fallbackRes.json()
      if (!fallbackData.ok) {
        console.error("[v0] sendTelegramPhoto - erro mesmo sem HTML:", fallbackData.description)
      }
      return { ok: fallbackData.ok, messageId: fallbackData?.result?.message_id }
    }

    if (!data.ok) {
      console.error("[v0] sendTelegramPhoto - erro:", data.description)
    }

    return { ok: data.ok, messageId: data?.result?.message_id }
  } catch (err) {
    console.error("[v0] sendTelegramPhoto - exception:", err)
    return { ok: false }
  }
}

async function sendTelegramVideo(
  botToken: string,
  chatId: number,
  videoUrl: string,
  caption?: string,
): Promise<{ ok: boolean; messageId?: number }> {
  const url = `https://api.telegram.org/bot${botToken}/sendVideo`

  // Sanitizar caption
  const sanitizedCaption = caption ? sanitizeTelegramHTML(caption) : undefined

  const body: Record<string, unknown> = {
    chat_id: chatId,
    video: videoUrl,
  }

  // Só adiciona parse_mode se tiver caption
  if (sanitizedCaption) {
    body.caption = sanitizedCaption
    body.parse_mode = "HTML"
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()

    // Se falhou por erro de HTML, tenta sem parse_mode
    if (!data.ok && data.description?.includes("can't parse")) {
      console.log("[v0] sendTelegramVideo - erro de parse HTML, tentando sem formatacao:", data.description)
      const fallbackBody: Record<string, unknown> = {
        chat_id: chatId,
        video: videoUrl,
      }
      if (sanitizedCaption) {
        fallbackBody.caption = sanitizedCaption.replace(/<[^>]*>/g, "")
      }
      const fallbackRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fallbackBody),
      })
      const fallbackData = await fallbackRes.json()
      if (!fallbackData.ok) {
        console.error("[v0] sendTelegramVideo - erro mesmo sem HTML:", fallbackData.description)
      }
      return { ok: fallbackData.ok, messageId: fallbackData?.result?.message_id }
    }

    if (!data.ok) {
      console.error("[v0] sendTelegramVideo - erro:", data.description)
    }

    return { ok: data.ok, messageId: data?.result?.message_id }
  } catch (err) {
    console.error("[v0] sendTelegramVideo - exception:", err)
    return { ok: false }
  }
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
): Promise<{ ok: boolean; error?: string }> {
  if (!mediaUrls || mediaUrls.length === 0) return { ok: true }

  // Sanitizar caption
  const sanitizedCaption = caption ? sanitizeTelegramHTML(caption) : undefined

  // Se for apenas 1 midia, envia individualmente
  if (mediaUrls.length === 1) {
    const mediaUrl = mediaUrls[0]
    const isVideo = mediaUrl.includes("/videos/") || mediaUrl.match(/\.(mp4|webm|mov)($|\?)/i)
    if (isVideo) {
      const result = await sendTelegramVideo(botToken, chatId, mediaUrl, sanitizedCaption)
      return { ok: result.ok }
    } else {
      const result = await sendTelegramPhoto(botToken, chatId, mediaUrl, sanitizedCaption)
      return { ok: result.ok }
    }
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMediaGroup`

  const media = mediaUrls.map((mediaUrl, index) => {
    // Melhor deteccao de video (incluindo Supabase Storage paths)
    const isVideo = mediaUrl.includes("/videos/") || mediaUrl.match(/\.(mp4|webm|mov)($|\?)/i)
    const item: Record<string, unknown> = {
      type: isVideo ? "video" : "photo",
      media: mediaUrl,
    }
    // Caption only on first item (ja sanitizada)
    if (index === 0 && sanitizedCaption) {
      item.caption = sanitizedCaption
      item.parse_mode = "HTML"
    }
    return item
  })

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, media }),
    })

    const data = await res.json()

    // Se falhou por erro de HTML no caption, tenta sem formatacao
    if (!data.ok && data.description?.includes("can't parse")) {
      console.log("[v0] sendMediaGroup - erro de parse HTML, tentando sem formatacao:", data.description)

      const mediaWithoutHtml = mediaUrls.map((mediaUrl, index) => {
        const isVideo = mediaUrl.includes("/videos/") || mediaUrl.match(/\.(mp4|webm|mov)($|\?)/i)
        const item: Record<string, unknown> = {
          type: isVideo ? "video" : "photo",
          media: mediaUrl,
        }
        // Caption sem HTML
        if (index === 0 && sanitizedCaption) {
          item.caption = sanitizedCaption.replace(/<[^>]*>/g, "")
        }
        return item
      })

      const fallbackRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, media: mediaWithoutHtml }),
      })

      const fallbackData = await fallbackRes.json()
      if (!fallbackData.ok) {
        console.error("[v0] sendMediaGroup - erro mesmo sem HTML:", fallbackData.description)
        return { ok: false, error: fallbackData.description }
      }
      return { ok: true }
    }

    if (!data.ok) {
      console.error("[v0] sendMediaGroup error:", data.description)
      return { ok: false, error: data.description }
    }

    return { ok: true }
  } catch (err) {
    console.error("[v0] sendMediaGroup exception:", err)
    return { ok: false, error: String(err) }
  }
}

// Helper: Enviar Order Bump (mídias em grupo + mensagem com botões)
// Formato padrão: Título, Descrição, Por apenas R$ X,XX
async function sendOrderBumpOffer(params: {
  botToken: string
  chatId: number
  name: string
  description?: string
  price: number
  acceptText?: string
  rejectText?: string
  medias?: string[]
  mainAmountCents: number
  callbackPrefix?: string // Prefixo do callback (padrão: "ob")
  orderBumpIndex?: number // Índice do order bump (para identificar qual foi aceito)
  userFirstName?: string // Nome do usuario para substituir {nome}
  userUsername?: string // Username do usuario para substituir {username}
}) {
  const { botToken, chatId, name, description, price, acceptText, rejectText, medias, mainAmountCents, callbackPrefix = "ob", orderBumpIndex = 0, userFirstName = "", userUsername = "" } = params

  // Funcao para substituir variaveis {nome} e {username}
  const replaceVars = (text: string) => {
    if (!text) return ""
    return text
      .replace(/\{nome\}/gi, userFirstName || "")
      .replace(/\{username\}/gi, userUsername ? `@${userUsername}` : "")
  }

  const obPriceCents = Math.round(price * 100)
  // Mensagem padrão simples: Título, Descrição, Por apenas R$ X,XX
  // Aplicar substituicao de variaveis na descricao e no nome
  const obMessage = `<b>${replaceVars(name) || "Oferta Especial"}</b>\n\n${replaceVars(description || "")}\n\n💰 Por apenas <b>R$ ${price.toFixed(2).replace(".", ",")}</b>`

  // Incluir índice no callback para identificar qual order bump foi aceito
  const obButtons = {
    inline_keyboard: [
      [
        { text: acceptText || "QUERO", callback_data: `${callbackPrefix}_accept_${mainAmountCents}_${obPriceCents}_${orderBumpIndex}` },
        { text: rejectText || "NAO QUERO", callback_data: `${callbackPrefix}_decline_${mainAmountCents}_0` }
      ]
    ]
  }

  // Se tiver mídias, enviar TODAS em grupo primeiro, depois mensagem com botões
  if (medias && medias.length > 0) {
    try {
      // Enviar todas as mídias como grupo (sem caption, sem botões - Telegram não suporta)
      await sendMediaGroup(botToken, chatId, medias, "")
    } catch (e) {
      console.error("[v0] Erro ao enviar media group do Order Bump:", e)
    }
  }

  // Enviar mensagem com botões (sempre)
  await sendTelegramMessage(botToken, chatId, obMessage, obButtons)
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
      }).then(() => { }).catch(e => console.error("Erro ao salvar mensagem:", e))
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
        console.log("[v0] ACCESS_DELIVERABLE: ========== INICIO ==========")
        console.log("[v0] ACCESS_DELIVERABLE: chatId:", chatId, "botUuid:", botUuid)

        // Confirmar callback
        await answerCallback(botToken, callbackQueryId, "Liberando acesso...")

        // Buscar flow para pegar o entregavel
        const flowForDelivery = await getActiveFlowForBot(supabase, botUuid)
        console.log("[v0] ACCESS_DELIVERABLE: Flow encontrado?", !!flowForDelivery)

        if (flowForDelivery) {
          const flowConfig = (flowForDelivery.config as Record<string, unknown>) || {}
          console.log("[v0] ACCESS_DELIVERABLE: flowConfig keys:", Object.keys(flowConfig))
          console.log("[v0] ACCESS_DELIVERABLE: mainDeliverableId:", flowConfig.mainDeliverableId)
          console.log("[v0] ACCESS_DELIVERABLE: deliverables count:", (flowConfig.deliverables as unknown[])?.length || 0)

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
            console.log("[v0] ACCESS_DELIVERABLE: Buscando entregavel com ID:", mainDeliverableId)
            const mainDeliverable = deliverables.find(d => d.id === mainDeliverableId)
            if (mainDeliverable) {
              console.log("[v0] ACCESS_DELIVERABLE: Entregavel encontrado!")
              console.log("[v0] ACCESS_DELIVERABLE: Nome:", mainDeliverable.name)
              console.log("[v0] ACCESS_DELIVERABLE: Tipo:", mainDeliverable.type)
              console.log("[v0] ACCESS_DELIVERABLE: Dados:", JSON.stringify(mainDeliverable))

              if (mainDeliverable.type === "media" && mainDeliverable.medias && mainDeliverable.medias.length > 0) {
                console.log("[v0] ACCESS_DELIVERABLE: Enviando", mainDeliverable.medias.length, "midias...")
                for (const mediaUrl of mainDeliverable.medias) {
                  console.log("[v0] ACCESS_DELIVERABLE: Enviando midia:", mediaUrl.substring(0, 50))
                  if (mediaUrl.includes(".mp4") || mediaUrl.includes("video")) {
                    await sendTelegramVideo(botToken, chatId, mediaUrl, "")
                  } else {
                    await sendTelegramPhoto(botToken, chatId, mediaUrl, "")
                  }
                }
                await sendTelegramMessage(botToken, chatId, "Obrigado pela compra! Seu conteudo foi liberado acima.")
                deliverableSent = true
                console.log("[v0] ACCESS_DELIVERABLE: Midias enviadas com sucesso!")
              } else if (mainDeliverable.type === "link" && mainDeliverable.link) {
                console.log("[v0] ACCESS_DELIVERABLE: Tipo LINK")
                console.log("[v0] ACCESS_DELIVERABLE: link:", mainDeliverable.link)
                console.log("[v0] ACCESS_DELIVERABLE: linkText:", mainDeliverable.linkText)
                const buttonText = mainDeliverable.linkText || "Acessar conteudo"
                const keyboard = {
                  inline_keyboard: [[{ text: buttonText, url: mainDeliverable.link }]]
                }
                await sendTelegramMessage(botToken, chatId, "Clique no botao abaixo para acessar:", keyboard)
                deliverableSent = true
                console.log("[v0] ACCESS_DELIVERABLE: Link enviado com sucesso!")
              } else if (mainDeliverable.type === "vip_group" && mainDeliverable.vipGroupChatId) {
                // Criar link de convite
                console.log("[v0] ACCESS_DELIVERABLE: Tipo VIP_GROUP")
                console.log("[v0] ACCESS_DELIVERABLE: vipGroupChatId:", mainDeliverable.vipGroupChatId)
                console.log("[v0] ACCESS_DELIVERABLE: vipGroupName:", mainDeliverable.vipGroupName)
                try {
                  console.log("[v0] ACCESS_DELIVERABLE: Criando link de convite...")
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
                  console.log("[v0] ACCESS_DELIVERABLE: Resposta Telegram:", JSON.stringify(inviteData))
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
                    console.log("[v0] ACCESS_DELIVERABLE: Link VIP enviado com sucesso!")
                  } else {
                    console.log("[v0] ACCESS_DELIVERABLE: ERRO - Falha ao criar link!")
                    console.log("[v0] ACCESS_DELIVERABLE: error_code:", inviteData.error_code)
                    console.log("[v0] ACCESS_DELIVERABLE: description:", inviteData.description)
                  }
                } catch (inviteError) {
                  console.error("[v0] ACCESS_DELIVERABLE: EXCECAO ao criar link:", inviteError)
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

          // Verificar se deve mostrar preco no botao
          const showPriceInButton = flowConfig.showPriceInButton === true

          if (plans && plans.length > 0) {
            // Build buttons for each plan
            const planButtons: Array<Array<{ text: string; callback_data: string }>> = plans.map(plan => [{
              text: showPriceInButton && plan.price > 0
                ? `${plan.name} por R$ ${Number(plan.price).toFixed(2).replace(".", ",")}`
                : plan.name,
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
                text: showPriceInButton && plan.price > 0
                  ? `${plan.name} por R$ ${Number(plan.price).toFixed(2).replace(".", ",")}`
                  : plan.name,
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
          const flowConfig = (flowForPlans.config as Record<string, unknown>) || {}
          const showPriceInButton = flowConfig.showPriceInButton === true

          const { data: plans } = await supabase
            .from("flow_plans")
            .select("*")
            .eq("flow_id", flowForPlans.id)
            .eq("is_active", true)
            .order("position", { ascending: true })

          if (plans && plans.length > 0) {
            const planButtons: Array<Array<{ text: string; callback_data: string }>> = plans.map(plan => [{
              text: showPriceInButton && plan.price > 0
                ? `${plan.name} por R$ ${Number(plan.price).toFixed(2).replace(".", ",")}`
                : plan.name,
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
              order_bump_deliverable_id: orderBumpPacks.deliverableId || "",
              main_description: `Pack`
            },
            updated_at: new Date().toISOString()
          }, { onConflict: "bot_id,telegram_user_id" })

          // Enviar order bump no formato correto (imagem + caption + botões juntos)
          await sendOrderBumpOffer({
            botToken,
            chatId,
            name: orderBumpPacks.name || "Oferta Especial",
            description: orderBumpPacks.description,
            price: orderBumpPacks.price,
            acceptText: orderBumpPacks.acceptText,
            rejectText: orderBumpPacks.rejectText,
            medias: orderBumpPacks.medias,
            mainAmountCents: Math.round(packPrice * 100),
            userFirstName: userFirstName || "",
            userUsername: userUsername || ""
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
              console.log("[v0] Saving pack payment - user_id:", botDataPack.user_id, "bot_id:", botUuid, "flow_id:", flowForPack?.id, "amount:", packPrice)
              const { data: savedPayment, error: saveError } = await supabase.from("payments").insert({
                user_id: botDataPack.user_id,
                bot_id: botUuid,
                flow_id: flowForPack?.id || null, // IMPORTANTE: Incluir flow_id para cancelar downsells corretamente
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

              // ========== DOWNSELL PIX GERADO (PACK) ==========
              if (flowForPack?.id) {
                const supabaseAdminPack = getSupabaseAdmin()
                
                // 1. CANCELAR downsells normais
                const { data: cancelledNormalDownsellsPack } = await supabaseAdminPack
                  .from("scheduled_messages")
                  .update({ status: "cancelled" })
                  .eq("bot_id", botUuid)
                  .eq("telegram_user_id", String(telegramUserId))
                  .eq("flow_id", flowForPack.id)
                  .eq("message_type", "downsell")
                  .eq("status", "pending")
                  .select("id")
                
                console.log(`[DOWNSELL PIX PACK] Cancelled ${cancelledNormalDownsellsPack?.length || 0} normal downsells`)
                
                // 2. AGENDAR downsells de PIX gerado
                const downsellPixConfigPack = flowConfig.downsellPix as {
                  enabled?: boolean
                  sequences?: Array<{
                    id: string; message: string; medias?: string[]; sendDelayValue?: number; sendDelayUnit?: string;
                    plans?: Array<{ id: string; buttonText: string; price: number }>; useDefaultPlans?: boolean; discountPercent?: number; showPriceInButton?: boolean
                  }>
                } | undefined
                
                if (downsellPixConfigPack?.enabled && downsellPixConfigPack.sequences && downsellPixConfigPack.sequences.length > 0) {
                  const now = new Date()
                  
                  const { data: mainFlowPlansPack } = await supabase
                    .from("flow_plans").select("id, name, price").eq("flow_id", flowForPack.id).eq("is_active", true).order("position", { ascending: true })
                  
                  let defaultPlansPack = mainFlowPlansPack || []
                  if (defaultPlansPack.length === 0) {
                    const configPlansPack = (flowConfig.plans as Array<{ id: string; name: string; price: number; active?: boolean }>) || []
                    defaultPlansPack = configPlansPack.filter(p => p.active !== false).map(p => ({ id: p.id, name: p.name, price: p.price }))
                  }
                  
                  for (const seq of downsellPixConfigPack.sequences) {
                    let delayMinutes = seq.sendDelayValue || 1
                    if (seq.sendDelayUnit === "hours") delayMinutes = (seq.sendDelayValue || 1) * 60
                    else if (seq.sendDelayUnit === "days") delayMinutes = (seq.sendDelayValue || 1) * 60 * 24
                    
                    const scheduledFor = new Date(now.getTime() + delayMinutes * 60 * 1000)
                    
                    let plansToUsePack: Array<{ id: string; buttonText?: string; name?: string; price: number }> = []
                    const useDefaultPlans = seq.useDefaultPlans !== false
                    const discountPercent = seq.discountPercent || 20
                    
                    if (useDefaultPlans && defaultPlansPack.length > 0) {
                      plansToUsePack = defaultPlansPack.map(plan => ({
                        id: plan.id, buttonText: plan.name, name: plan.name, price: Math.round(plan.price * (1 - discountPercent / 100) * 100) / 100
                      }))
                    } else {
                      plansToUsePack = seq.plans || []
                    }
                    
                    await supabaseAdminPack.from("scheduled_messages").insert({
                      bot_id: botUuid, flow_id: flowForPack.id, telegram_user_id: String(telegramUserId), telegram_chat_id: String(chatId),
                      message_type: "downsell", sequence_id: seq.id, sequence_index: downsellPixConfigPack.sequences.indexOf(seq),
                      scheduled_for: scheduledFor.toISOString(), status: "pending",
                      metadata: {
                        message: seq.message, medias: seq.medias || [], plans: plansToUsePack, botToken: botToken,
                        showPriceInButton: seq.showPriceInButton === true, userFirstName: userFirstName || "", userUsername: userUsername || "",
                        source: "pix_generated",
                        deliverableId: (seq as { deliverableId?: string }).deliverableId || "",
                        deliveryType: (seq as { deliveryType?: string }).deliveryType || "main",
                        sequenceIndex: downsellPixConfigPack.sequences.indexOf(seq)
                      }
                    })
                    console.log(`[DOWNSELL PIX PACK] Agendado para ${scheduledFor.toISOString()} (seq ${downsellPixConfigPack.sequences.indexOf(seq)}, deliverableId: ${(seq as { deliverableId?: string }).deliverableId || "main"})`)
                  }
                }
              }
              // ========== FIM DOWNSELL PIX GERADO (PACK) ==========
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



      // ========== UPSELL ORDER BUMP CALLBACKS (uob_) ==========
      // Order bump mostrado DEPOIS do upsell ser pago - se recusado, nao gera novo PIX
      if (callbackData.startsWith("uob_accept_") || callbackData.startsWith("uob_decline_")) {
        console.log("[v0] Upsell Order Bump Callback recebido:", callbackData, "botUuid:", botUuid, "telegramUserId:", telegramUserId)

        // Answer callback query imediatamente
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: callbackQueryId })
        })

        const isAccept = callbackData.startsWith("uob_accept_")
        const parts = callbackData.replace("uob_accept_", "").replace("uob_decline_", "").split("_")

        // Buscar estado do usuario
        const { data: userState } = await supabase
          .from("user_flow_state")
          .select("metadata, flow_id")
          .eq("bot_id", botUuid)
          .eq("telegram_user_id", String(telegramUserId))
          .order("updated_at", { ascending: false })
          .limit(1)
          .single()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const metadata = userState?.metadata as Record<string, any> | null

        if (isAccept) {
          // Usuario ACEITOU o order bump do upsell - gerar PIX apenas do order bump
          const obPriceCents = parseInt(parts[1]) || 0
          const obPrice = obPriceCents / 100

          if (obPrice <= 0) {
            console.log("[v0] Upsell Order Bump ERRO - preco <= 0")
            await sendTelegramMessage(botToken, chatId, "Erro ao processar. Tente novamente.")
            return
          }

          // Buscar order bump info do metadata
          const orderBumpName = metadata?.order_bump_name || "Order Bump"

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
            `Otimo! Gerando pagamento PIX...\n\nValor: R$ ${obPrice.toFixed(2).replace(".", ",")}`,
            undefined
          )

          // Get user_id
          const { data: botDataUOB } = await supabase
            .from("bots")
            .select("user_id")
            .eq("id", botUuid)
            .single()

          let ownerUserId = botDataUOB?.user_id || null

          if (!ownerUserId && userState?.flow_id) {
            const { data: flowDataUOB } = await supabase
              .from("flows")
              .select("user_id")
              .eq("id", userState.flow_id)
              .single()
            ownerUserId = flowDataUOB?.user_id || null
          }

          if (!ownerUserId) {
            console.error("[v0] Upsell Order Bump - No user_id found")
            await sendTelegramMessage(botToken, chatId, "Erro interno. Tente novamente mais tarde.")
            return
          }

          // Buscar gateway
          const { data: gatewayUOB } = await supabase
            .from("payment_gateways")
            .select("*")
            .eq("user_id", ownerUserId)
            .eq("is_active", true)
            .single()

          if (!gatewayUOB) {
            console.error("[v0] Upsell Order Bump - No gateway found")
            await sendTelegramMessage(botToken, chatId, "Pagamento nao disponivel no momento.")
            return
          }

          // Gerar PIX apenas do order bump
          const pixResult = await generatePixPayment(gatewayUOB, obPrice, `Order Bump - ${orderBumpName}`)

          if (!pixResult.success) {
            console.error("[v0] Upsell Order Bump - PIX error:", pixResult.error)
            await sendTelegramMessage(botToken, chatId, `Erro ao gerar PIX: ${pixResult.error}`)
            return
          }

          // Salvar pagamento - produto tipo upsell_order_bump
          await supabase.from("payments").insert({
            user_id: ownerUserId,
            bot_id: botUuid,
            flow_id: userState?.flow_id || null,
            telegram_user_id: String(telegramUserId),
            telegram_username: userUsername || null,
            telegram_first_name: userFirstName || null,
            telegram_last_name: userLastName || null,
            amount: obPrice,
            status: "pending",
            payment_method: "pix",
            gateway: gatewayUOB.gateway_name || "mercadopago",
            external_payment_id: String(pixResult.paymentId),
            description: `Order Bump - ${orderBumpName}`,
            product_name: orderBumpName,
            product_type: "upsell_order_bump",
            qr_code: pixResult.qrCode,
            qr_code_url: pixResult.qrCodeUrl,
            copy_paste: pixResult.copyPaste,
            pix_code: pixResult.copyPaste || pixResult.qrCode,
            metadata: {
              upsell_index: metadata?.upsell_index,
              order_bump_deliverable_id: metadata?.order_bump_deliverable_id || "",
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })

          // Enviar QR Code
          const pixMessage = `
<b>PIX Gerado!</b>

Valor: <b>R$ ${obPrice.toFixed(2).replace(".", ",")}</b>
Produto: ${orderBumpName}

Escaneie o QR Code ou copie o codigo abaixo:

<code>${pixResult.copyPaste || pixResult.qrCode}</code>
      `.trim()

          if (pixResult.qrCodeUrl) {
            await sendTelegramPhoto(botToken, chatId, pixResult.qrCodeUrl, pixMessage)
          } else {
            await sendTelegramMessage(botToken, chatId, pixMessage)
          }

        } else {
          // Usuario RECUSOU o order bump do upsell
          // O upsell JA FOI PAGO E ENTREGUE - apenas continuar o fluxo
          console.log("[v0] Upsell Order Bump RECUSADO - continuando fluxo sem gerar novo PIX")

          await sendTelegramMessage(
            botToken,
            chatId,
            "Tudo certo! Seu produto ja foi liberado.",
            undefined
          )

          // Atualizar estado para completed
          await supabase
            .from("user_flow_state")
            .update({ status: "completed", updated_at: new Date().toISOString() })
            .eq("bot_id", botUuid)
            .eq("telegram_user_id", String(telegramUserId))
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
        // parts pode ser [mainCents, bumpCents] ou [mainCents, bumpCents, index]
        const orderBumpIndex = parts.length > 2 ? parseInt(parts[2]) : 0
        console.log("[v0] Order Bump parts:", parts, "isAccept:", isAccept, "orderBumpIndex:", orderBumpIndex)

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

        // Buscar order bump correto pelo índice (se tiver array de order bumps)
        const orderBumpsArray = metadata?.order_bumps as Array<{ name: string; price: number; deliverableId: string; deliveryType: string }> | undefined
        const selectedOrderBump = orderBumpsArray?.[orderBumpIndex]
        const orderBumpName = selectedOrderBump?.name || metadata?.order_bump_name || "Order Bump"
        let orderBumpDeliverableIdFromIndex = selectedOrderBump?.deliverableId || metadata?.order_bump_deliverable_id || ""
        const mainDescription = metadata?.main_description || "Produto Principal"

        // Buscar plan_deliverable_id do metadata (para entregar o produto principal corretamente)
        const planDeliverableIdFromState = metadata?.plan_deliverable_id || ""
        const planIdFromState = metadata?.plan_id || ""

        console.log("[v0] Order Bump - metadata completo:", JSON.stringify(metadata))
        console.log("[v0] Order Bump - selectedOrderBump:", JSON.stringify(selectedOrderBump))
        console.log("[v0] Order Bump - orderBumpDeliverableIdFromIndex:", orderBumpDeliverableIdFromIndex)
        console.log("[v0] Order Bump - planDeliverableId:", planDeliverableIdFromState, "planId:", planIdFromState)

        // FALLBACK: Se nao tem deliverableId do OB no metadata, buscar direto do flowConfig
        if (!orderBumpDeliverableIdFromIndex && isAccept) {
          console.log("[v0] Order Bump - FALLBACK: Buscando deliverableId do flowConfig...")
          const flowForFallback = await getActiveFlowForBot(supabase, botUuid)
          const flowConfigFallback = (flowForFallback?.config as Record<string, unknown>) || {}

          // Tentar buscar do order bump do plano primeiro
          const plansArrayFallback = (flowConfigFallback.plans as Array<Record<string, unknown>>) || []
          const planIdToFind = planIdFromState || metadata?.plan_id
          if (planIdToFind) {
            const planWithOB = plansArrayFallback.find(p => p.id === planIdToFind)
            const planOrderBumps = (planWithOB?.order_bumps as Array<Record<string, unknown>>) || []
            if (planOrderBumps.length > 0 && planOrderBumps[orderBumpIndex]?.deliverableId) {
              orderBumpDeliverableIdFromIndex = planOrderBumps[orderBumpIndex].deliverableId as string
              console.log("[v0] Order Bump - FALLBACK: Encontrou deliverableId do plano:", orderBumpDeliverableIdFromIndex)
            }
          }

          // Se ainda nao tem, buscar do order bump global
          if (!orderBumpDeliverableIdFromIndex) {
            const obConfigFallback = flowConfigFallback.orderBump as Record<string, unknown> | undefined
            const obInicialFallback = obConfigFallback?.inicial as Record<string, unknown> | undefined
            if (obInicialFallback?.deliverableId) {
              orderBumpDeliverableIdFromIndex = obInicialFallback.deliverableId as string
              console.log("[v0] Order Bump - FALLBACK: Encontrou deliverableId global:", orderBumpDeliverableIdFromIndex)
            }
          }
        }

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
          // Incluir deliverableId do order bump no metadata se aceito - usar o deliverableId correto baseado no índice
          // Tambem incluir plan_deliverable_id para entregar o produto principal corretamente
          const orderBumpDeliverableId = isAccept ? orderBumpDeliverableIdFromIndex : ""

          // Construir metadata do pagamento
          const paymentMetadataOB: Record<string, string> = {}
          if (planIdFromState) paymentMetadataOB.plan_id = planIdFromState
          if (planDeliverableIdFromState) paymentMetadataOB.plan_deliverable_id = planDeliverableIdFromState
          if (isAccept && orderBumpDeliverableId) paymentMetadataOB.order_bump_deliverable_id = orderBumpDeliverableId
          // Adicionar order_bump_id para que o webhook possa encontrar o order bump correto
          if (isAccept && selectedOrderBump) {
            // Se tem o order bump selecionado pelo índice, pegar o ID
            const orderBumpsFromMetadata = metadata?.order_bumps as Array<{ id?: string }> | undefined
            const selectedObId = orderBumpsFromMetadata?.[orderBumpIndex]?.id
            if (selectedObId) {
              paymentMetadataOB.order_bump_id = selectedObId
              console.log("[v0] Order Bump - Adicionando order_bump_id ao metadata:", selectedObId)
            }
          }

          const hasMetadata = Object.keys(paymentMetadataOB).length > 0

          console.log("[v0] Saving OB payment - user_id:", ownerUserId, "bot_id:", botUuid, "amount:", totalAmount, "productType:", productType, "telegram_user_id:", telegramUserId, "telegram_username:", userUsername, "metadata:", JSON.stringify(paymentMetadataOB))
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
            product_type: productType,
            metadata: hasMetadata ? paymentMetadataOB : null
          })
          if (obPaymentError) {
            console.error("[v0] Error saving OB payment:", obPaymentError)
            console.error("[v0] OB payment error details:", JSON.stringify(obPaymentError))
          } else {
            console.log("[v0] OB payment saved successfully - bot_id:", botUuid, "user_id:", ownerUserId, "amount:", totalAmount, "product_type:", productType)
          }

          // ========== DOWNSELL PIX GERADO (ORDER BUMP) ==========
          // Cancelar downsells normais e agendar downsells de PIX gerado
          if (flowIdForPayment) {
            const supabaseAdminOB = getSupabaseAdmin()
            
            // 1. CANCELAR downsells normais
            const { data: cancelledNormalDownsellsOB } = await supabaseAdminOB
              .from("scheduled_messages")
              .update({ status: "cancelled" })
              .eq("bot_id", botUuid)
              .eq("telegram_user_id", String(telegramUserId))
              .eq("flow_id", flowIdForPayment)
              .eq("message_type", "downsell")
              .eq("status", "pending")
              .select("id")
            
            console.log(`[DOWNSELL PIX OB] Cancelled ${cancelledNormalDownsellsOB?.length || 0} normal downsells`)
            
            // 2. AGENDAR downsells de PIX gerado
            const downsellPixConfigOB = flowConfigOB.downsellPix as {
              enabled?: boolean
              sequences?: Array<{
                id: string; message: string; medias?: string[]; sendDelayValue?: number; sendDelayUnit?: string;
                plans?: Array<{ id: string; buttonText: string; price: number }>; useDefaultPlans?: boolean; discountPercent?: number; showPriceInButton?: boolean
              }>
            } | undefined
            
            if (downsellPixConfigOB?.enabled && downsellPixConfigOB.sequences && downsellPixConfigOB.sequences.length > 0) {
              const now = new Date()
              
              const { data: mainFlowPlansOB } = await supabase
                .from("flow_plans").select("id, name, price").eq("flow_id", flowIdForPayment).eq("is_active", true).order("position", { ascending: true })
              
              let defaultPlansOB = mainFlowPlansOB || []
              if (defaultPlansOB.length === 0) {
                const configPlansOB = (flowConfigOB.plans as Array<{ id: string; name: string; price: number; active?: boolean }>) || []
                defaultPlansOB = configPlansOB.filter(p => p.active !== false).map(p => ({ id: p.id, name: p.name, price: p.price }))
              }
              
              for (const seq of downsellPixConfigOB.sequences) {
                let delayMinutes = seq.sendDelayValue || 1
                if (seq.sendDelayUnit === "hours") delayMinutes = (seq.sendDelayValue || 1) * 60
                else if (seq.sendDelayUnit === "days") delayMinutes = (seq.sendDelayValue || 1) * 60 * 24
                
                const scheduledFor = new Date(now.getTime() + delayMinutes * 60 * 1000)
                
                let plansToUseOB: Array<{ id: string; buttonText?: string; name?: string; price: number }> = []
                const useDefaultPlans = seq.useDefaultPlans !== false
                const discountPercent = seq.discountPercent || 20
                
                if (useDefaultPlans && defaultPlansOB.length > 0) {
                  plansToUseOB = defaultPlansOB.map(plan => ({
                    id: plan.id, buttonText: plan.name, name: plan.name, price: Math.round(plan.price * (1 - discountPercent / 100) * 100) / 100
                  }))
                } else {
                  plansToUseOB = seq.plans || []
                }
                
                await supabaseAdminOB.from("scheduled_messages").insert({
                  bot_id: botUuid, flow_id: flowIdForPayment, telegram_user_id: String(telegramUserId), telegram_chat_id: String(chatId),
                  message_type: "downsell", sequence_id: seq.id, sequence_index: downsellPixConfigOB.sequences.indexOf(seq),
                  scheduled_for: scheduledFor.toISOString(), status: "pending",
                  metadata: {
                    message: seq.message, medias: seq.medias || [], plans: plansToUseOB, botToken: botToken,
                    showPriceInButton: seq.showPriceInButton === true, userFirstName: userFirstName || "", userUsername: userUsername || "",
                    source: "pix_generated",
                    deliverableId: (seq as { deliverableId?: string }).deliverableId || "",
                    deliveryType: (seq as { deliveryType?: string }).deliveryType || "main",
                    sequenceIndex: downsellPixConfigOB.sequences.indexOf(seq)
                  }
                })
                console.log(`[DOWNSELL PIX OB] Agendado para ${scheduledFor.toISOString()} (seq ${downsellPixConfigOB.sequences.indexOf(seq)}, deliverableId: ${(seq as { deliverableId?: string }).deliverableId || "main"})`)
              }
            }
          }
          // ========== FIM DOWNSELL PIX GERADO (ORDER BUMP) ==========

        } catch (pixError) {
          console.error("[v0] Erro ao gerar PIX para Order Bump:", pixError)
          await sendTelegramMessage(botToken, chatId, "Erro ao gerar pagamento. Tente novamente.", undefined)
        }

        return
      }
      // ========== FIM ORDER BUMP CALLBACKS ==========

        // ========== ORDER BUMP DO DOWNSELL CALLBACKS ==========
        // dsob_accept_{mainPriceCents}_{obPriceCents} ou dsob_decline_{mainPriceCents}_0
      if (callbackData.startsWith("dsob_")) {
        console.log("[v0] Order Bump Downsell Callback recebido:", callbackData)

        await answerCallback(botToken, callbackQueryId, "Gerando pagamento...")

        const isAccept = callbackData.startsWith("dsob_accept_")
        const obParts = callbackData.replace("dsob_accept_", "").replace("dsob_decline_", "").split("_")
        const mainPriceCents = parseInt(obParts[0]) || 0
        const obPriceCents = parseInt(obParts[1]) || 0
        const mainPrice = mainPriceCents / 100
        const obPrice = obPriceCents / 100
        const totalPrice = isAccept ? mainPrice + obPrice : mainPrice

        console.log(`[v0] Order Bump Downsell - accept: ${isAccept}, mainPrice: ${mainPrice}, obPrice: ${obPrice}, total: ${totalPrice}`)

        // Buscar estado para pegar os nomes
        const { data: userState } = await supabase
          .from("user_flow_state")
          .select("*")
          .eq("bot_id", botUuid)
          .eq("telegram_user_id", String(telegramUserId))
          .single()

        const stateMetadata = userState?.metadata as Record<string, unknown> | null
        const mainPlanName = (stateMetadata?.main_plan_name as string) || "Oferta Especial"
        const obName = (stateMetadata?.order_bump_name as string) || "Adicional"
        const productName = isAccept ? `${mainPlanName} + ${obName}` : mainPlanName

        // Buscar user_id do bot owner
        const { data: botOwnerDsOb } = await supabase
          .from("bots")
          .select("user_id")
          .eq("id", botUuid)
          .single()

        if (!botOwnerDsOb?.user_id) {
          await sendTelegramMessage(botToken, chatId, "Erro: Bot nao encontrado.")
          return
        }

        // Buscar gateway pelo user_id
        const { data: gatewayDsOb } = await supabase
          .from("user_gateways")
          .select("*")
          .eq("user_id", botOwnerDsOb.user_id)
          .eq("is_active", true)
          .limit(1)
          .single()

        if (!gatewayDsOb?.access_token) {
          await sendTelegramMessage(botToken, chatId, "Gateway de pagamento nao configurado. Entre em contato com o suporte.")
          return
        }

        // Enviar mensagem de processando
        const msgText = isAccept
          ? `Otima escolha! Voce adicionou *${obName}*\n\nValor total: R$ ${totalPrice.toFixed(2).replace(".", ",")}\n\nGerando pagamento PIX...`
          : `Voce selecionou: *${mainPlanName}*\n\nValor: R$ ${totalPrice.toFixed(2).replace(".", ",")}\n\nGerando pagamento PIX...`

        await sendTelegramMessage(botToken, chatId, msgText, undefined)

        // Gerar PIX
        try {
          const pixResultDsOb = await createPixPayment({
            accessToken: gatewayDsOb.access_token,
            amount: totalPrice,
            description: `Pagamento - ${productName}`,
            payerEmail: "luismarquesdevp@gmail.com",
          })

          if (!pixResultDsOb.success) {
            await sendTelegramMessage(botToken, chatId, `Erro ao gerar PIX: ${pixResultDsOb.error || "Tente novamente"}`, undefined)
            return
          }

          // Salvar pagamento
          const productType = isAccept ? "downsell_with_bump" : "downsell"
          console.log("[v0] Saving downsell+OB payment - user_id:", botOwnerDsOb.user_id, "amount:", totalPrice, "product_type:", productType)

          await supabase.from("payments").insert({
            user_id: botOwnerDsOb.user_id,
            bot_id: botUuid,
            telegram_user_id: String(telegramUserId),
            telegram_username: userUsername || null,
            telegram_first_name: userFirstName || null,
            telegram_last_name: userLastName || null,
            amount: totalPrice,
            status: "pending",
            payment_method: "pix",
            gateway: gatewayDsOb.gateway_name || "mercadopago",
            external_payment_id: String(pixResultDsOb.paymentId),
            description: `Pagamento - ${productName}`,
            product_name: productName,
            product_type: productType,
            qr_code: pixResultDsOb.qrCode,
            qr_code_url: pixResultDsOb.qrCodeUrl,
            copy_paste: pixResultDsOb.copyPaste,
            pix_code: pixResultDsOb.copyPaste || pixResultDsOb.qrCode,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })

          // Buscar config de mensagens de pagamento do flow
          const flowDsOb = await getActiveFlowForBot(supabase, botUuid)
          const flowConfigDsOb = (flowDsOb?.config as Record<string, unknown>) || {}
          const paymentMessagesDsOb = (flowConfigDsOb.paymentMessages as PaymentMessagesConfig) || {}

          // Enviar mensagens de PIX
          await sendPixPaymentMessages({
            botToken,
            chatId,
            pixCode: pixResultDsOb.copyPaste || pixResultDsOb.qrCode || "",
            qrCodeUrl: pixResultDsOb.qrCodeUrl,
            amount: totalPrice,
            productName: productName,
            paymentId: String(pixResultDsOb.paymentId),
            config: paymentMessagesDsOb,
            userName: userFirstName || "Cliente"
          })

        } catch (pixErrorDsOb) {
          const errorMsgDsOb = pixErrorDsOb instanceof Error ? pixErrorDsOb.message : String(pixErrorDsOb)
          console.error("[v0] Erro ao gerar PIX para Downsell+OB:", errorMsgDsOb)
          await sendTelegramMessage(botToken, chatId, `Erro ao processar pagamento: ${errorMsgDsOb}`, undefined)
        }

        return
      }
      // ========== FIM ORDER BUMP DOWNSELL CALLBACKS ==========

      // ========== DOWNSELL CALLBACKS ==========
      // Callback format: ds_{shortMsgId}_{planIndex}_{priceInCents}
      // Limite de 64 chars do Telegram
      if (callbackData.startsWith("ds_") && !callbackData.startsWith("ds_plan_")) {
        console.log("[v0] Downsell Callback recebido:", callbackData)

        // Parse callback: ds_{shortMsgId}_{planIndex}_{priceInCents}
        const parts = callbackData.replace("ds_", "").split("_")
        const shortMsgId = parts[0] || ""
        const planIndex = parseInt(parts[1]) || 0
        const priceInCents = parseInt(parts[2]) || 0
        const price = priceInCents / 100

        console.log(`[v0] Downsell: shortMsgId=${shortMsgId}, planIndex=${planIndex}, price=${price}`)

        // Buscar a mensagem original pelo shortMsgId (ultimos 8 chars do id)
        const { data: scheduledMsg, error: scheduledMsgError } = await supabase
          .from("scheduled_messages")
          .select("*")
          .like("id", `%${shortMsgId}`)
          .order("created_at", { ascending: false })
          .limit(1)
          .single()

        console.log("[v0] Downsell: scheduledMsg encontrado?", !!scheduledMsg)
        console.log("[v0] Downsell: scheduledMsg.id =", scheduledMsg?.id)
        console.log("[v0] Downsell: scheduledMsg.metadata =", JSON.stringify(scheduledMsg?.metadata))
        if (scheduledMsgError) {
          console.log("[v0] Downsell: Erro ao buscar scheduledMsg:", scheduledMsgError.message)
        }

        // Se nao encontrou a mensagem agendada, buscar o flow_id diretamente do bot
        let flowId = scheduledMsg?.flow_id || ""
        if (!flowId) {
          // Tentar buscar o flow vinculado ao bot
          const { data: botFlow } = await supabase
            .from("flows")
            .select("id")
            .eq("bot_id", botUuid)
            .limit(1)
            .single()

          if (botFlow?.id) {
            flowId = botFlow.id
          } else {
            // Tentar via flow_bots
            const { data: flowBot } = await supabase
              .from("flow_bots")
              .select("flow_id")
              .eq("bot_id", botUuid)
              .limit(1)
              .single()

            if (flowBot?.flow_id) {
              flowId = flowBot.flow_id
            }
          }
        }

        const msgMetadata = scheduledMsg?.metadata as Record<string, unknown> | null
        const plans = (msgMetadata?.plans as Array<{ id: string; buttonText: string; price: number }>) || []
        const selectedPlan = plans[planIndex]
        const planName = selectedPlan?.buttonText || "Oferta Especial"
        
        // IMPORTANTE: Log se a scheduledMsg nao foi encontrada
        if (!scheduledMsg) {
          console.log("[DOWNSELL-CALLBACK] ATENCAO: scheduledMsg NAO ENCONTRADA pelo shortMsgId! Vamos buscar do fluxo...")
        }
        
        // Obter deliverableId e deliveryType do metadata da sequencia de downsell
        let dsDeliverableIdFromMeta = (msgMetadata?.deliverableId as string) || ""
        let dsDeliveryTypeFromMeta = (msgMetadata?.deliveryType as string) || ""
        
        // FALLBACK: Se nao encontrou no metadata, buscar diretamente da sequencia no fluxo
        // Isso acontece quando a scheduled_message foi criada antes da correcao
        // IMPORTANTE: Tambem acionar fallback se deliveryType for "custom" mas deliverableId estiver vazio!
        const needsFallback = !dsDeliverableIdFromMeta || !dsDeliveryTypeFromMeta || 
          (dsDeliveryTypeFromMeta === "custom" && !dsDeliverableIdFromMeta)
        
        console.log("[DOWNSELL-CALLBACK] DIAGNOSTICO INICIAL:")
        console.log("[DOWNSELL-CALLBACK]   dsDeliverableIdFromMeta =", dsDeliverableIdFromMeta || "VAZIO")
        console.log("[DOWNSELL-CALLBACK]   dsDeliveryTypeFromMeta =", dsDeliveryTypeFromMeta || "VAZIO")
        console.log("[DOWNSELL-CALLBACK]   needsFallback =", needsFallback)
        
        if (needsFallback) {
          console.log("[DOWNSELL-CALLBACK] Acionando FALLBACK - buscando da sequencia no fluxo...")
          const seqId = scheduledMsg?.sequence_id || (msgMetadata?.sequenceId as string)
          const seqIndex = scheduledMsg?.sequence_index ?? (msgMetadata?.sequenceIndex as number | undefined)
          // Verificar se veio do PIX gerado para buscar na config correta
          const sourceFromMeta = (msgMetadata?.source as string) || ""
          const isFromPixGenerated = sourceFromMeta === "pix_generated"
          
          // Buscar o fluxo para pegar a config da sequencia
          const flowIdForSeq = scheduledMsg?.flow_id || ""
          console.log(`[DOWNSELL-CALLBACK] flowIdForSeq = ${flowIdForSeq || "VAZIO"}`)
          console.log(`[DOWNSELL-CALLBACK] seqId = ${seqId || "VAZIO"}, seqIndex = ${seqIndex ?? "UNDEFINED"}`)
          
          if (flowIdForSeq) {
              const { data: flowForSeq } = await supabase
                .from("flows")
                .select("config")
                .eq("id", flowIdForSeq)
                .single()
              
              if (flowForSeq?.config) {
                const flowConfigSeq = flowForSeq.config as Record<string, unknown>
                
                // IMPORTANTE: Buscar na config correta - downsellPix se veio de PIX gerado, senao downsell normal
                const downsellPixConfigSeq = flowConfigSeq.downsellPix as { sequences?: Array<{ id: string; deliveryType?: string; deliverableId?: string }> } | undefined
                const downsellConfigSeq = flowConfigSeq.downsell as { sequences?: Array<{ id: string; deliveryType?: string; deliverableId?: string }> } | undefined
                
                // IMPORTANTE: Tentar buscar em AMBAS as configs, priorizando a fonte certa
                const allSequences = [
                  ...(isFromPixGenerated 
                    ? [...(downsellPixConfigSeq?.sequences || []), ...(downsellConfigSeq?.sequences || [])]
                    : [...(downsellConfigSeq?.sequences || []), ...(downsellPixConfigSeq?.sequences || [])]
                  )
                ]
                
                console.log(`[DOWNSELL-CALLBACK] isFromPixGenerated=${isFromPixGenerated}`)
                console.log(`[DOWNSELL-CALLBACK] downsellConfigSeq?.sequences: ${(downsellConfigSeq?.sequences || []).length}`)
                console.log(`[DOWNSELL-CALLBACK] downsellPixConfigSeq?.sequences: ${(downsellPixConfigSeq?.sequences || []).length}`)
                console.log(`[DOWNSELL-CALLBACK] allSequences total: ${allSequences.length}`)
                console.log(`[DOWNSELL-CALLBACK] Buscando por seqId=${seqId || "N/A"} ou seqIndex=${seqIndex ?? "N/A"}`)
                
                // Buscar sequencia por ID primeiro, depois por index
                let foundSeq = seqId ? allSequences.find(s => s.id === seqId) : undefined
                
                if (!foundSeq && seqIndex !== undefined) {
                  // Tentar pelo index na config correta
                  const primarySequences = isFromPixGenerated 
                    ? (downsellPixConfigSeq?.sequences || [])
                    : (downsellConfigSeq?.sequences || [])
                  
                  if (primarySequences[seqIndex]) {
                    foundSeq = primarySequences[seqIndex]
                    console.log(`[DOWNSELL-CALLBACK] Encontrou pelo index ${seqIndex} na config primaria`)
                  } else {
                    // Fallback: tentar na outra config
                    const secondarySequences = isFromPixGenerated 
                      ? (downsellConfigSeq?.sequences || [])
                      : (downsellPixConfigSeq?.sequences || [])
                    
                    if (secondarySequences[seqIndex]) {
                      foundSeq = secondarySequences[seqIndex]
                      console.log(`[DOWNSELL-CALLBACK] Encontrou pelo index ${seqIndex} na config secundaria`)
                    }
                  }
                }
                
                if (foundSeq) {
                  console.log("[DOWNSELL-CALLBACK] ENCONTROU sequencia:", JSON.stringify({
                    id: foundSeq.id,
                    deliveryType: foundSeq.deliveryType,
                    deliverableId: foundSeq.deliverableId
                  }))
                  
                  // SEMPRE usar os valores da sequencia se existirem, mesmo se ja tiver valores do metadata
                  // Isso garante que a configuracao ATUAL da sequencia seja usada, nao a antiga do metadata
                  if (foundSeq.deliverableId) {
                    dsDeliverableIdFromMeta = foundSeq.deliverableId
                    console.log("[DOWNSELL-CALLBACK] Usando deliverableId da sequencia:", dsDeliverableIdFromMeta)
                  }
                  if (foundSeq.deliveryType) {
                    dsDeliveryTypeFromMeta = foundSeq.deliveryType
                    console.log("[DOWNSELL-CALLBACK] Usando deliveryType da sequencia:", dsDeliveryTypeFromMeta)
                  }
                } else {
                  console.log("[DOWNSELL-CALLBACK] NAO encontrou sequencia por ID/index! seqId=", seqId, "seqIndex=", seqIndex)
                  
                  // FALLBACK EXTRA: Se nao tem seqId nem seqIndex, e so tem 1 sequencia, usar essa
                  if (!seqId && seqIndex === undefined && allSequences.length === 1) {
                    const singleSeq = allSequences[0]
                    console.log("[DOWNSELL-CALLBACK] FALLBACK: Usando unica sequencia disponivel:", singleSeq.id)
                    if (singleSeq.deliverableId) {
                      dsDeliverableIdFromMeta = singleSeq.deliverableId
                      console.log("[DOWNSELL-CALLBACK] Usando deliverableId da unica sequencia:", dsDeliverableIdFromMeta)
                    }
                    if (singleSeq.deliveryType) {
                      dsDeliveryTypeFromMeta = singleSeq.deliveryType
                      console.log("[DOWNSELL-CALLBACK] Usando deliveryType da unica sequencia:", dsDeliveryTypeFromMeta)
                    }
                  } else if (!seqId && seqIndex === undefined && allSequences.length > 1) {
                    // Se tem mais de 1 sequencia e nao sabemos qual, tentar primeira que tem entregavel customizado
                    console.log("[DOWNSELL-CALLBACK] FALLBACK: Buscando primeira sequencia com entregavel customizado...")
                    const seqWithDeliverable = allSequences.find(s => s.deliveryType === "custom" && s.deliverableId)
                    if (seqWithDeliverable) {
                      console.log("[DOWNSELL-CALLBACK] Encontrou sequencia com entregavel:", seqWithDeliverable.id)
                      dsDeliverableIdFromMeta = seqWithDeliverable.deliverableId!
                      dsDeliveryTypeFromMeta = seqWithDeliverable.deliveryType!
                    }
                  }
                }
              }
            }
          }
        }
        
        // FALLBACK FINAL: Se ainda nao tem deliverableId, buscar do fluxo diretamente
        // Isso acontece principalmente quando a scheduledMsg nao foi encontrada pelo shortMsgId
        if (!dsDeliverableIdFromMeta) {
          // Garantir que temos um flowId para o fallback
          let flowIdForFinalFallback = flowId
          if (!flowIdForFinalFallback) {
            console.log("[DOWNSELL-CALLBACK] FALLBACK FINAL: flowId vazio, buscando do bot...")
            // Tentar buscar flow do bot
            const { data: botFlowFinal } = await supabase
              .from("flows")
              .select("id")
              .eq("bot_id", botUuid)
              .limit(1)
              .single()
            
            if (botFlowFinal?.id) {
              flowIdForFinalFallback = botFlowFinal.id
            } else {
              // Tentar via flow_bots
              const { data: flowBotFinal } = await supabase
                .from("flow_bots")
                .select("flow_id")
                .eq("bot_id", botUuid)
                .limit(1)
                .single()
              
              if (flowBotFinal?.flow_id) {
                flowIdForFinalFallback = flowBotFinal.flow_id
              }
            }
          }
          
          console.log("[DOWNSELL-CALLBACK] FALLBACK FINAL: Buscando sequencias do fluxo", flowIdForFinalFallback || "VAZIO!")
          
          if (flowIdForFinalFallback) {
            const { data: flowForFallback } = await supabase
              .from("flows")
              .select("config")
              .eq("id", flowIdForFinalFallback)
              .single()
          
            if (flowForFallback?.config) {
              const configFallback = flowForFallback.config as Record<string, unknown>
              const dsConfigFallback = configFallback.downsell as { sequences?: Array<{ id: string; deliveryType?: string; deliverableId?: string }> } | undefined
              const dsPixConfigFallback = configFallback.downsellPix as { sequences?: Array<{ id: string; deliveryType?: string; deliverableId?: string }> } | undefined
              
              const allSeqsFallback = [
                ...(dsConfigFallback?.sequences || []),
                ...(dsPixConfigFallback?.sequences || [])
              ]
              
              console.log("[DOWNSELL-CALLBACK] FALLBACK FINAL: Total sequencias encontradas:", allSeqsFallback.length)
              
              // Se tem apenas 1 sequencia, usar essa
              if (allSeqsFallback.length === 1 && allSeqsFallback[0].deliverableId) {
                dsDeliverableIdFromMeta = allSeqsFallback[0].deliverableId
                dsDeliveryTypeFromMeta = allSeqsFallback[0].deliveryType || "custom"
                console.log("[DOWNSELL-CALLBACK] FALLBACK FINAL: Usando unica sequencia:", dsDeliverableIdFromMeta)
              } else if (allSeqsFallback.length > 1) {
                // Se tem mais de 1, tentar encontrar pelo preco
                const matchByPrice = allSeqsFallback.find(seq => {
                  const seqAsAny = seq as { plans?: Array<{ price: number }> }
                  return seqAsAny.plans?.some(p => Math.abs(p.price - price) < 0.01)
                })
                if (matchByPrice?.deliverableId) {
                  dsDeliverableIdFromMeta = matchByPrice.deliverableId
                  dsDeliveryTypeFromMeta = matchByPrice.deliveryType || "custom"
                  console.log("[DOWNSELL-CALLBACK] FALLBACK FINAL: Encontrou por preco:", dsDeliverableIdFromMeta)
                } else {
                  // Ultima opcao: usar primeira com entregavel customizado
                  const firstWithDeliverable = allSeqsFallback.find(s => s.deliveryType === "custom" && s.deliverableId)
                  if (firstWithDeliverable) {
                    dsDeliverableIdFromMeta = firstWithDeliverable.deliverableId!
                    dsDeliveryTypeFromMeta = firstWithDeliverable.deliveryType!
                    console.log("[DOWNSELL-CALLBACK] FALLBACK FINAL: Usando primeira com entregavel:", dsDeliverableIdFromMeta)
                  }
                }
              }
            }
          }
        }
        
        // Se ainda nao tem deliveryType, usar "main" como fallback final
        if (!dsDeliveryTypeFromMeta) {
          dsDeliveryTypeFromMeta = "main"
        }
        
        // DEBUG: Log para verificar se os campos estao vindo do metadata
        console.log("[DOWNSELL-CALLBACK] scheduledMsg.id:", scheduledMsg?.id)
        console.log("[DOWNSELL-CALLBACK] msgMetadata keys:", Object.keys(msgMetadata || {}))
        console.log("[DOWNSELL-CALLBACK] msgMetadata.deliverableId:", msgMetadata?.deliverableId)
        console.log("[DOWNSELL-CALLBACK] msgMetadata.deliveryType:", msgMetadata?.deliveryType)
        console.log("[DOWNSELL-CALLBACK] dsDeliverableIdFromMeta (FINAL):", dsDeliverableIdFromMeta)
        console.log("[DOWNSELL-CALLBACK] dsDeliveryTypeFromMeta (FINAL):", dsDeliveryTypeFromMeta)

        // Buscar user_id do bot owner primeiro (igual ao plano normal)
        const { data: botOwner } = await supabase
          .from("bots")
          .select("user_id")
          .eq("id", botUuid)
          .single()

        if (!botOwner?.user_id) {
          await sendTelegramMessage(botToken, chatId, "Erro: Bot nao encontrado.")
          return
        }

        // ========== VERIFICAR ORDER BUMP DO DOWNSELL ==========
        const flowDs = await getActiveFlowForBot(supabase, botUuid)
        const flowConfigDs = (flowDs?.config as Record<string, unknown>) || {}
        const orderBumpConfigDs = flowConfigDs.orderBump as Record<string, unknown> | undefined
        const orderBumpDownsell = orderBumpConfigDs?.downsell as { enabled?: boolean; name?: string; price?: number; description?: string; acceptText?: string; rejectText?: string; medias?: string[] } | undefined

        console.log("[v0] Downsell Order Bump Check - enabled:", orderBumpDownsell?.enabled, "price:", orderBumpDownsell?.price)

        // Se Order Bump do Downsell esta ativado, mostrar ANTES de gerar pagamento
        if (orderBumpDownsell?.enabled && orderBumpDownsell?.price && orderBumpDownsell.price > 0) {
          console.log("[v0] Downsell tem Order Bump ativo - mostrando oferta")
          await answerCallback(botToken, callbackQueryId, "Preparando oferta especial...")

          // Salvar estado para saber que esta esperando resposta do order bump
          await supabase.from("user_flow_state").upsert({
            bot_id: botUuid,
            telegram_user_id: String(telegramUserId),
            flow_id: flowId || flowDs?.id,
            status: "waiting_order_bump_downsell",
            metadata: {
              main_price: price,
              main_plan_name: planName,
              order_bump_price: orderBumpDownsell.price,
              order_bump_name: orderBumpDownsell.name,
              order_bump_deliverable_id: (orderBumpDownsell as { deliverableId?: string })?.deliverableId || "",
            },
            updated_at: new Date().toISOString(),
          }, { onConflict: "bot_id,telegram_user_id" })

          // Calcular precos
          const mainPriceCents = Math.round(price * 100)

          // Enviar order bump no formato padrão (mídias em grupo + mensagem simples com botões)
          await sendOrderBumpOffer({
            botToken,
            chatId,
            name: orderBumpDownsell.name || "Oferta Especial",
            description: orderBumpDownsell.description,
            price: orderBumpDownsell.price,
            acceptText: orderBumpDownsell.acceptText,
            rejectText: orderBumpDownsell.rejectText,
            medias: orderBumpDownsell.medias,
            mainAmountCents: mainPriceCents,
            callbackPrefix: "dsob",
            userFirstName: userFirstName || "",
            userUsername: userUsername || ""
          })

          return // STOP - aguardar decisao do Order Bump
        }
        // ========== FIM ORDER BUMP DOWNSELL ==========

        await answerCallback(botToken, callbackQueryId, "Gerando pagamento...")

        // Buscar gateway pelo user_id (igual ao plano normal)
        const { data: gateway, error: gwError } = await supabase
          .from("user_gateways")
          .select("*")
          .eq("user_id", botOwner.user_id)
          .eq("is_active", true)
          .limit(1)
          .single()

        console.log("[v0] Downsell Gateway lookup - user_id:", botOwner.user_id, "found:", !!gateway, "has_token:", !!gateway?.access_token, "error:", gwError?.message)

        if (!gateway?.access_token) {
          await sendTelegramMessage(botToken, chatId, "Gateway de pagamento nao configurado. Entre em contato com o suporte.")
          return
        }

        // Enviar mensagem de processando
        await sendTelegramMessage(
          botToken,
          chatId,
          `Voce selecionou: *${planName}*\n\nValor: R$ ${price.toFixed(2).replace(".", ",")}\n\nGerando pagamento PIX...`,
          undefined
        )

        // Gerar PIX usando a funcao padrao (igual ao plano normal)
        try {
          const pixResult = await createPixPayment({
            accessToken: gateway.access_token,
            amount: price,
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

          // Salvar pagamento do downsell (igual ao plano normal - SEM flow_id para evitar problema de FK)
          // Incluir deliverableId e deliveryType no metadata para que o webhook de aprovacao use o entregavel correto
          const dsPaymentMetadata: Record<string, string> = {}
          if (dsDeliverableIdFromMeta) dsPaymentMetadata.downsell_deliverable_id = dsDeliverableIdFromMeta
          if (dsDeliveryTypeFromMeta) dsPaymentMetadata.downsell_delivery_type = dsDeliveryTypeFromMeta
          // Guardar o sequence_index para fallback
          if (msgMetadata?.sequenceIndex !== undefined) dsPaymentMetadata.sequence_index = String(msgMetadata.sequenceIndex)
          
          // LOG CRUCIAL: Verificar o que vai ser salvo no metadata
          console.log("==================================================")
          console.log("[DOWNSELL-PAYMENT] SALVANDO PAGAMENTO COM METADATA:")
          console.log("[DOWNSELL-PAYMENT] dsDeliverableIdFromMeta:", dsDeliverableIdFromMeta || "VAZIO!")
          console.log("[DOWNSELL-PAYMENT] dsDeliveryTypeFromMeta:", dsDeliveryTypeFromMeta || "VAZIO!")
          console.log("[DOWNSELL-PAYMENT] dsPaymentMetadata:", JSON.stringify(dsPaymentMetadata))
          console.log("==================================================")
          
          console.log("[v0] Saving downsell payment - user_id:", botOwner.user_id, "bot_id:", botUuid, "amount:", price, "product_type: downsell", "telegram_user_id:", telegramUserId, "telegram_username:", userUsername, "external_payment_id:", pixResult.paymentId, "metadata:", JSON.stringify(dsPaymentMetadata))
          const { data: savedDsPayment, error: dsPaymentError } = await supabase.from("payments").insert({
            user_id: botOwner.user_id,
            bot_id: botUuid,
            telegram_user_id: String(telegramUserId),
            telegram_username: userUsername || null,
            telegram_first_name: userFirstName || null,
            telegram_last_name: userLastName || null,
            amount: price,
            status: "pending",
            payment_method: "pix",
            gateway: gateway.gateway_name || "mercadopago",
            external_payment_id: String(pixResult.paymentId),
            description: `Pagamento - ${planName}`,
            product_name: planName,
            product_type: "downsell",
            qr_code: pixResult.qrCode,
            qr_code_url: pixResult.qrCodeUrl,
            copy_paste: pixResult.copyPaste,
            pix_code: pixResult.copyPaste || pixResult.qrCode,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            metadata: Object.keys(dsPaymentMetadata).length > 0 ? dsPaymentMetadata : null,
          }).select().single()

          if (dsPaymentError) {
            console.error("[v0] Error saving downsell payment:", dsPaymentError.message)
            console.error("[v0] Downsell payment error details:", JSON.stringify(dsPaymentError))
          } else {
            console.log("[v0] Downsell payment saved successfully - id:", savedDsPayment?.id, "user_id:", botOwner.user_id, "amount:", price, "product_type: downsell")
          }

          // Cancelar demais downsells agendados para este usuario neste fluxo
          await supabase
            .from("scheduled_messages")
            .update({ status: "cancelled" })
            .eq("bot_id", botUuid)
            .eq("telegram_user_id", String(telegramUserId))
            .eq("flow_id", flowId)
            .eq("message_type", "downsell")
            .eq("status", "pending")

          // Buscar config de mensagens de pagamento do flow
          const flowDs = await getActiveFlowForBot(supabase, botUuid)
          const flowConfigDs = (flowDs?.config as Record<string, unknown>) || {}
          const paymentMessagesDs = (flowConfigDs.paymentMessages as PaymentMessagesConfig) || {}

          // Enviar mensagens de PIX de forma centralizada (igual ao plano normal)
          await sendPixPaymentMessages({
            botToken,
            chatId,
            pixCode: pixResult.copyPaste || pixResult.qrCode || "",
            qrCodeUrl: pixResult.qrCodeUrl,
            amount: price,
            productName: planName,
            paymentId: String(pixResult.paymentId),
            config: paymentMessagesDs,
            userName: userFirstName || "Cliente"
          })

        } catch (pixError) {
          const errorMsg = pixError instanceof Error ? pixError.message : String(pixError)
          console.error("[v0] Erro ao gerar PIX para Downsell:", errorMsg)
          await sendTelegramMessage(botToken, chatId, `Erro ao processar pagamento: ${errorMsg}`, undefined)
        }

        return
      }
      // ========== FIM DOWNSELL CALLBACKS ==========

        // ========== ORDER BUMP DO UPSELL CALLBACKS ==========
        // upob_accept_{mainPriceCents}_{obPriceCents} ou upob_decline_{mainPriceCents}_0
      if (callbackData.startsWith("upob_")) {
        console.log("[v0] Order Bump Upsell Callback recebido:", callbackData)

        await answerCallback(botToken, callbackQueryId, "Gerando pagamento...")

        const isAccept = callbackData.startsWith("upob_accept_")
        const obParts = callbackData.replace("upob_accept_", "").replace("upob_decline_", "").split("_")
        const mainPriceCents = parseInt(obParts[0]) || 0
        const obPriceCents = parseInt(obParts[1]) || 0
        const mainPrice = mainPriceCents / 100
        const obPrice = obPriceCents / 100
        const totalPrice = isAccept ? mainPrice + obPrice : mainPrice

        console.log(`[v0] Order Bump Upsell - accept: ${isAccept}, mainPrice: ${mainPrice}, obPrice: ${obPrice}, total: ${totalPrice}`)

        // Buscar estado para pegar os nomes
        const { data: userState } = await supabase
          .from("user_flow_state")
          .select("*")
          .eq("bot_id", botUuid)
          .eq("telegram_user_id", String(telegramUserId))
          .single()

        const stateMetadata = userState?.metadata as Record<string, unknown> | null
        const mainPlanName = (stateMetadata?.main_plan_name as string) || "Oferta Especial"
        const obName = (stateMetadata?.order_bump_name as string) || "Adicional"
        const productName = isAccept ? `${mainPlanName} + ${obName}` : mainPlanName

        // Buscar user_id do bot owner
        const { data: botOwnerUpOb } = await supabase
          .from("bots")
          .select("user_id")
          .eq("id", botUuid)
          .single()

        if (!botOwnerUpOb?.user_id) {
          await sendTelegramMessage(botToken, chatId, "Erro: Bot nao encontrado.")
          return
        }

        // Buscar gateway pelo user_id
        const { data: gatewayUpOb } = await supabase
          .from("user_gateways")
          .select("*")
          .eq("user_id", botOwnerUpOb.user_id)
          .eq("is_active", true)
          .limit(1)
          .single()

        if (!gatewayUpOb?.access_token) {
          await sendTelegramMessage(botToken, chatId, "Gateway de pagamento nao configurado. Entre em contato com o suporte.")
          return
        }

        // Enviar mensagem de processando
        const msgText = isAccept
          ? `Otima escolha! Voce adicionou *${obName}*\n\nValor total: R$ ${totalPrice.toFixed(2).replace(".", ",")}\n\nGerando pagamento PIX...`
          : `Voce selecionou: *${mainPlanName}*\n\nValor: R$ ${totalPrice.toFixed(2).replace(".", ",")}\n\nGerando pagamento PIX...`

        await sendTelegramMessage(botToken, chatId, msgText, undefined)

        // Gerar PIX
        try {
          const pixResultUpOb = await createPixPayment({
            accessToken: gatewayUpOb.access_token,
            amount: totalPrice,
            description: `Pagamento - ${productName}`,
            payerEmail: "luismarquesdevp@gmail.com",
          })

          if (!pixResultUpOb.success) {
            await sendTelegramMessage(botToken, chatId, `Erro ao gerar PIX: ${pixResultUpOb.error || "Tente novamente"}`, undefined)
            return
          }

          // Salvar pagamento
          const productType = isAccept ? "upsell_with_bump" : "upsell"
          console.log("[v0] Saving upsell+OB payment - user_id:", botOwnerUpOb.user_id, "amount:", totalPrice, "product_type:", productType)

          await supabase.from("payments").insert({
            user_id: botOwnerUpOb.user_id,
            bot_id: botUuid,
            telegram_user_id: String(telegramUserId),
            telegram_username: userUsername || null,
            telegram_first_name: userFirstName || null,
            telegram_last_name: userLastName || null,
            amount: totalPrice,
            status: "pending",
            payment_method: "pix",
            gateway: gatewayUpOb.gateway_name || "mercadopago",
            external_payment_id: String(pixResultUpOb.paymentId),
            description: `Pagamento - ${productName}`,
            product_name: productName,
            product_type: productType,
            qr_code: pixResultUpOb.qrCode,
            qr_code_url: pixResultUpOb.qrCodeUrl,
            copy_paste: pixResultUpOb.copyPaste,
            pix_code: pixResultUpOb.copyPaste || pixResultUpOb.qrCode,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })

          // Buscar config de mensagens de pagamento do flow
          const flowUpOb = await getActiveFlowForBot(supabase, botUuid)
          const flowConfigUpOb = (flowUpOb?.config as Record<string, unknown>) || {}
          const paymentMessagesUpOb = (flowConfigUpOb.paymentMessages as PaymentMessagesConfig) || {}

          // Enviar mensagens de PIX
          await sendPixPaymentMessages({
            botToken,
            chatId,
            pixCode: pixResultUpOb.copyPaste || pixResultUpOb.qrCode || "",
            qrCodeUrl: pixResultUpOb.qrCodeUrl,
            amount: totalPrice,
            productName: productName,
            paymentId: String(pixResultUpOb.paymentId),
            config: paymentMessagesUpOb,
            userName: userFirstName || "Cliente"
          })

        } catch (pixErrorUpOb) {
          const errorMsgUpOb = pixErrorUpOb instanceof Error ? pixErrorUpOb.message : String(pixErrorUpOb)
          console.error("[v0] Erro ao gerar PIX para Upsell+OB:", errorMsgUpOb)
          await sendTelegramMessage(botToken, chatId, `Erro ao processar pagamento: ${errorMsgUpOb}`, undefined)
        }

        return
      }
      // ========== FIM ORDER BUMP UPSELL CALLBACKS ==========

      // ========== UPSELL CALLBACKS ==========
      // Formato: up_{msgId}_{planIndex}_{priceInCents} (igual downsell)
      if (callbackData.startsWith("up_")) {
        console.log("[v0] Upsell Callback recebido:", callbackData)

        // Parse callback: up_{shortMsgId}_{planIndex}_{priceInCents}
        const parts = callbackData.replace("up_", "").split("_")
        const shortMsgId = parts[0] || ""
        const planIndex = parseInt(parts[1]) || 0
        const priceInCents = parseInt(parts[2]) || 0
        const price = priceInCents / 100

        console.log(`[v0] Upsell: shortMsgId=${shortMsgId}, planIndex=${planIndex}, price=${price}`)

        // Buscar a mensagem original pelo shortMsgId (igual downsell)
        const { data: scheduledMsg } = await supabase
          .from("scheduled_messages")
          .select("*")
          .like("id", `%${shortMsgId}`)
          .order("created_at", { ascending: false })
          .limit(1)
          .single()

        // Se nao encontrou a mensagem agendada, buscar o flow_id diretamente do bot (igual downsell)
        let flowId = scheduledMsg?.flow_id || ""
        if (!flowId) {
          const { data: botFlow } = await supabase
            .from("flows")
            .select("id")
            .eq("bot_id", botUuid)
            .limit(1)
            .single()

          if (botFlow?.id) {
            flowId = botFlow.id
          } else {
            const { data: flowBot } = await supabase
              .from("flow_bots")
              .select("flow_id")
              .eq("bot_id", botUuid)
              .limit(1)
              .single()

            if (flowBot?.flow_id) {
              flowId = flowBot.flow_id
            }
          }
        }

        const msgMetadata = scheduledMsg?.metadata as Record<string, unknown> | null
        const plans = (msgMetadata?.plans as Array<{ id: string; buttonText: string; price: number }>) || []
        const selectedPlan = plans[planIndex]
        const planName = selectedPlan?.buttonText || "Oferta Especial"

        // Buscar user_id do bot owner primeiro (igual ao downsell)
        const { data: botOwner } = await supabase
          .from("bots")
          .select("user_id")
          .eq("id", botUuid)
          .single()

        if (!botOwner?.user_id) {
          await sendTelegramMessage(botToken, chatId, "Erro: Bot nao encontrado.")
          return
        }

        // ========== VERIFICAR ORDER BUMP DO UPSELL ==========
        const flowUp = await getActiveFlowForBot(supabase, botUuid)
        const flowConfigUp = (flowUp?.config as Record<string, unknown>) || {}
        const orderBumpConfigUp = flowConfigUp.orderBump as Record<string, unknown> | undefined
        const orderBumpUpsell = orderBumpConfigUp?.upsell as { enabled?: boolean; name?: string; price?: number; description?: string; acceptText?: string; rejectText?: string; medias?: string[] } | undefined

        console.log("[v0] Upsell Order Bump Check - enabled:", orderBumpUpsell?.enabled, "price:", orderBumpUpsell?.price)

        // Se Order Bump do Upsell esta ativado, mostrar ANTES de gerar pagamento
        if (orderBumpUpsell?.enabled && orderBumpUpsell?.price && orderBumpUpsell.price > 0) {
          console.log("[v0] Upsell tem Order Bump ativo - mostrando oferta")
          await answerCallback(botToken, callbackQueryId, "Preparando oferta especial...")

          // Salvar estado para saber que esta esperando resposta do order bump
          await supabase.from("user_flow_state").upsert({
            bot_id: botUuid,
            telegram_user_id: String(telegramUserId),
            flow_id: flowId || flowUp?.id,
            status: "waiting_order_bump_upsell",
            metadata: {
              main_price: price,
              main_plan_name: planName,
              order_bump_price: orderBumpUpsell.price,
              order_bump_name: orderBumpUpsell.name,
              order_bump_deliverable_id: (orderBumpUpsell as { deliverableId?: string })?.deliverableId || "",
            },
            updated_at: new Date().toISOString(),
          }, { onConflict: "bot_id,telegram_user_id" })

          // Calcular precos
          const mainPriceCents = Math.round(price * 100)

          // Enviar order bump no formato padrão (mídias em grupo + mensagem simples com botões)
          await sendOrderBumpOffer({
            botToken,
            chatId,
            name: orderBumpUpsell.name || "Oferta Especial",
            description: orderBumpUpsell.description,
            price: orderBumpUpsell.price,
            acceptText: orderBumpUpsell.acceptText,
            rejectText: orderBumpUpsell.rejectText,
            medias: orderBumpUpsell.medias,
            mainAmountCents: mainPriceCents,
            callbackPrefix: "upob",
            userFirstName: userFirstName || "",
            userUsername: userUsername || ""
          })

          return // STOP - aguardar decisao do Order Bump
        }
        // ========== FIM ORDER BUMP UPSELL ==========

        await answerCallback(botToken, callbackQueryId, "Gerando pagamento...")

        // Buscar gateway pelo user_id (igual ao downsell - NAO pelo bot_id!)
        const { data: gateway, error: gwError } = await supabase
          .from("user_gateways")
          .select("*")
          .eq("user_id", botOwner.user_id)
          .eq("is_active", true)
          .limit(1)
          .single()

        console.log("[v0] Upsell Gateway lookup - user_id:", botOwner.user_id, "found:", !!gateway, "has_token:", !!gateway?.access_token, "error:", gwError?.message)

        if (!gateway?.access_token) {
          await sendTelegramMessage(botToken, chatId, "Gateway de pagamento nao configurado. Entre em contato com o suporte.")
          return
        }

        // Enviar mensagem de processando
        await sendTelegramMessage(
          botToken,
          chatId,
          `Voce selecionou: *${planName}*\n\nValor: R$ ${price.toFixed(2).replace(".", ",")}\n\nGerando pagamento PIX...`,
          undefined
        )

        // Gerar PIX usando a funcao padrao (igual ao downsell)
        try {
          const pixResult = await createPixPayment({
            accessToken: gateway.access_token,
            amount: price,
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

          // Buscar o deliverableId do plano selecionado no metadata da mensagem ou na config do flow
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const upsellPlans = (msgMetadata?.plans as Array<Record<string, any>>) || []
          const selectedUpsellPlan = upsellPlans[planIndex]
          const upsellDeliverableId = selectedUpsellPlan?.deliverableId || (msgMetadata?.deliverableId as string) || ""
          const upsellSequenceIndex = (msgMetadata?.sequence_index as number) || 0

          console.log(`[v0] Upsell deliverableId: ${upsellDeliverableId}, sequenceIndex: ${upsellSequenceIndex}`)

          // Salvar pagamento do upsell (igual ao downsell)
          console.log("[v0] Saving upsell payment - user_id:", botOwner.user_id, "bot_id:", botUuid, "amount:", price, "product_type: upsell", "telegram_user_id:", telegramUserId)
          const { data: savedUpPayment, error: upPaymentError } = await supabase.from("payments").insert({
            user_id: botOwner.user_id,
            bot_id: botUuid,
            flow_id: flowId || flowUp?.id || null, // IMPORTANTE: salvar flow_id
            telegram_user_id: String(telegramUserId),
            telegram_username: userUsername || null,
            telegram_first_name: userFirstName || null,
            telegram_last_name: userLastName || null,
            amount: price,
            status: "pending",
            payment_method: "pix",
            gateway: gateway.gateway_name || "mercadopago",
            external_payment_id: String(pixResult.paymentId),
            description: `Pagamento - ${planName}`,
            product_name: planName,
            product_type: "upsell",
            qr_code: pixResult.qrCode,
            qr_code_url: pixResult.qrCodeUrl,
            copy_paste: pixResult.copyPaste,
            pix_code: pixResult.copyPaste || pixResult.qrCode,
            // IMPORTANTE: salvar metadata com info do entregavel
            metadata: {
              deliverable_id: upsellDeliverableId,
              upsell_sequence_index: upsellSequenceIndex,
              plan_index: planIndex,
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).select().single()

          if (upPaymentError) {
            console.error("[v0] Error saving upsell payment:", upPaymentError.message)
          } else {
            console.log("[v0] Upsell payment saved successfully - id:", savedUpPayment?.id)
          }

          // Cancelar demais upsells agendados para este usuario neste fluxo
          await supabase
            .from("scheduled_messages")
            .update({ status: "cancelled" })
            .eq("bot_id", botUuid)
            .eq("telegram_user_id", String(telegramUserId))
            .eq("flow_id", flowId)
            .eq("message_type", "upsell")
            .eq("status", "pending")

          // Buscar config de mensagens de pagamento do flow
          const flowUp = await getActiveFlowForBot(supabase, botUuid)
          const flowConfigUp = (flowUp?.config as Record<string, unknown>) || {}
          const paymentMessagesUp = (flowConfigUp.paymentMessages as PaymentMessagesConfig) || {}

          // Enviar mensagens de PIX de forma centralizada (igual ao downsell)
          await sendPixPaymentMessages({
            botToken,
            chatId,
            pixCode: pixResult.copyPaste || pixResult.qrCode || "",
            qrCodeUrl: pixResult.qrCodeUrl,
            amount: price,
            productName: planName,
            paymentId: String(pixResult.paymentId),
            config: paymentMessagesUp,
            userName: userFirstName || "Cliente"
          })

        } catch (pixError) {
          const errorMsg = pixError instanceof Error ? pixError.message : String(pixError)
          console.error("[v0] Erro ao gerar PIX para Upsell:", errorMsg)
          await sendTelegramMessage(botToken, chatId, `Erro ao processar pagamento: ${errorMsg}`, undefined)
        }

        return
      }
      // ========== FIM UPSELL CALLBACKS ==========

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

          // Log detalhado dos order bumps para debug
          console.log("[v0] Order Bumps ativos detalhados:", activePlanOrderBumps.map((ob: { name?: string; price?: number; deliverableId?: string; deliveryType?: string }, idx: number) => ({
            index: idx,
            name: ob.name,
            price: ob.price,
            deliverableId: ob.deliverableId || "VAZIO",
            deliveryType: ob.deliveryType || "same"
          })))

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

            // Mostrar CADA order bump no formato correto (imagem + caption + botões juntos)
            for (let i = 0; i < activePlanOrderBumps.length; i++) {
              const planOrderBump = activePlanOrderBumps[i]
              const bumpPriceRounded = Math.round(planOrderBump.price * 100)

              console.log("[v0] Plan Order Bump", i + 1, "- price:", bumpPriceRounded)

              // Se tem APENAS 1 order bump: mostra QUERO + NAO QUERO
              // Se tem MAIS DE 1: mostra so QUERO (o PROSSEGUIR vem no final)
              if (hasMultipleBumps) {
                // Multiplos bumps: enviar cada um com só botão QUERO
                // Incluir indice no callback para identificar qual order bump foi aceito
                // Funcao para substituir variaveis {nome} e {username}
                const replaceVarsOb = (text: string) => {
                  if (!text) return ""
                  return text
                    .replace(/\{nome\}/gi, userFirstName || "")
                    .replace(/\{username\}/gi, userUsername ? `@${userUsername}` : "")
                }
                const obMessage = `<b>${replaceVarsOb(planOrderBump.name) || "Oferta Especial"}</b>\n\n${replaceVarsOb(planOrderBump.description || "")}\n\n💰 Por apenas <b>R$ ${planOrderBump.price.toFixed(2).replace(".", ",")}</b>`
                const acceptCallback = `ob_accept_${mainPriceRounded}_${bumpPriceRounded}_${i}`
                const obButtons = { inline_keyboard: [[{ text: planOrderBump.acceptText || "QUERO", callback_data: acceptCallback }]] }

                // Enviar TODAS as mídias em grupo primeiro
                if (planOrderBump.medias && planOrderBump.medias.length > 0) {
                  try {
                    await sendMediaGroup(botToken, chatId, planOrderBump.medias, "")
                  } catch (e) {
                    console.error("[v0] Erro ao enviar media group do Plan Order Bump:", e)
                  }
                }
                // Depois enviar mensagem com botão
                await sendTelegramMessage(botToken, chatId, obMessage, obButtons)
              } else {
                // Apenas 1 bump: usar sendOrderBumpOffer com QUERO + NAO QUERO
                await sendOrderBumpOffer({
                  botToken,
                  chatId,
                  name: planOrderBump.name || "Oferta Especial",
                  description: planOrderBump.description,
                  price: planOrderBump.price,
                  acceptText: planOrderBump.acceptText,
                  rejectText: planOrderBump.rejectText,
                  medias: planOrderBump.medias,
                  mainAmountCents: mainPriceRounded,
                  orderBumpIndex: i, // Incluir índice para identificar o order bump
                  userFirstName: userFirstName || "",
                  userUsername: userUsername || ""
                })
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
            // Salvar TODOS os order bumps para poder buscar o correto pelo índice depois
            console.log("[v0] Salvando estado Plan Order Bump - bot_id:", botUuid, "telegram_user_id:", String(telegramUserId))
            const orderBumpsData = activePlanOrderBumps.map((ob: { id?: string; name?: string; price?: number; deliverableId?: string; deliveryType?: string }) => ({
              id: ob.id || "", // IMPORTANTE: incluir ID para o webhook encontrar o order bump correto
              name: ob.name || "Order Bump",
              price: ob.price || 0,
              deliverableId: ob.deliverableId || "",
              deliveryType: ob.deliveryType || "same"
            }))

            // Buscar deliverableId especifico do plano (para entregar corretamente o produto principal)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const configPlansForOB = (flowConfig.plans as Array<Record<string, any>>) || []
            const selectedPlanConfigOB = configPlansForOB.find(p => p.id === planId || p.name === planName)
            const planDeliverableIdForOB = selectedPlanConfigOB?.deliverableId || ""
            console.log("[v0] Plan Order Bump - planDeliverableId:", planDeliverableIdForOB, "for plan:", planName)

            const { error: stateUpsertError } = await supabase.from("user_flow_state").upsert({
              bot_id: botUuid,
              telegram_user_id: String(telegramUserId),
              flow_id: flowForOrderBump.id,
              status: "waiting_order_bump", // MESMO STATUS DO ORDER BUMP GLOBAL
              current_node_position: 0,
              metadata: {
                type: "plan",
                plan_id: planId,
                plan_deliverable_id: planDeliverableIdForOB, // ID do entregavel do plano principal
                order_bump_name: activePlanOrderBumps[0].name || "Order Bump",
                order_bump_price: activePlanOrderBumps[0].price,
                order_bump_deliverable_id: activePlanOrderBumps[0].deliverableId || "",
                order_bumps: orderBumpsData, // Array com TODOS os order bumps
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

            const mainPriceRounded = Math.round(planPrice * 100)
            console.log("[v0] Order Bump callbacks - mainPrice:", mainPriceRounded, "bumpPrice:", Math.round(orderBumpInicial.price * 100))

            // Enviar mensagem do plano selecionado
            await sendTelegramMessage(
              botToken,
              chatId,
              `Voce selecionou: <b>${planName}</b>\n\nValor: R$ ${planPrice.toFixed(2).replace(".", ",")}`,
              undefined
            )

            // Enviar order bump no formato correto (imagem + caption + botões juntos)
            await sendOrderBumpOffer({
              botToken,
              chatId,
              name: orderBumpInicial.name || "Oferta Especial",
              description: orderBumpInicial.description,
              price: orderBumpInicial.price,
              acceptText: orderBumpInicial.acceptText,
              rejectText: orderBumpInicial.rejectText,
              medias: orderBumpInicial.medias,
              mainAmountCents: mainPriceRounded,
              userFirstName: userFirstName || "",
              userUsername: userUsername || ""
            })

            // Salvar estado para quando usuario responder
            // Buscar deliverableId especifico do plano (para entregar corretamente o produto principal)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const configPlansForGlobalOB = (flowConfig.plans as Array<Record<string, any>>) || []
            const selectedPlanConfigGlobalOB = configPlansForGlobalOB.find(p => p.id === planId || p.name === planName)
            const planDeliverableIdForGlobalOB = selectedPlanConfigGlobalOB?.deliverableId || ""
            console.log("[v0] Global Order Bump - planDeliverableId:", planDeliverableIdForGlobalOB, "for plan:", planName)

            console.log("[v0] Salvando estado Order Bump - bot_id:", botUuid, "telegram_user_id:", String(telegramUserId))
            const { error: stateUpsertError } = await supabase.from("user_flow_state").upsert({
              bot_id: botUuid,
              telegram_user_id: String(telegramUserId),
              flow_id: flowForOrderBump.id,
              status: "waiting_order_bump",
              current_node_position: 0,
              metadata: {
                type: "plan",
                plan_id: planId,
                plan_deliverable_id: planDeliverableIdForGlobalOB, // ID do entregavel do plano principal
                order_bump_name: orderBumpInicial.name || "Order Bump",
                order_bump_price: orderBumpInicial.price,
                order_bump_deliverable_id: orderBumpInicial.deliverableId || "",
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

          // Buscar deliverableId especifico do plano (se existir)
          let planDeliverableId = ""

          // Se o plano veio do banco (flow_plans), buscar deliverableId diretamente
          if (planFromDb && dbPlan) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            planDeliverableId = (dbPlan as any).deliverable_id || ""
            console.log("[v0] Plan deliverableId from DB:", planDeliverableId)
          }

          // Se nao tem do banco, buscar do config JSON
          if (!planDeliverableId) {
            const flowForDelivery = await getActiveFlowForBot(supabase, botUuid)
            const flowConfigDelivery = (flowForDelivery?.config as Record<string, unknown>) || {}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const configPlans = (flowConfigDelivery.plans as Array<Record<string, any>>) || []
            const selectedPlanConfig = configPlans.find(p => p.id === planId || p.name === planName)
            planDeliverableId = selectedPlanConfig?.deliverableId || ""
            console.log("[v0] Plan deliverableId from config JSON:", planDeliverableId)
          }

          // Save payment record with correct fields including Telegram user info AND plan metadata
          console.log("[v0] Saving plan payment - user_id:", botData?.user_id, "bot_id:", botUuid, "flow_id:", flowIdForGateway, "amount:", planPrice, "planId:", planId, "deliverableId:", planDeliverableId)
          const { data: savedPlanPayment, error: savePlanError } = await supabase.from("payments").insert({
            user_id: botData?.user_id,
            bot_id: botUuid,
            flow_id: flowIdForGateway || null, // IMPORTANTE: Incluir flow_id para cancelar downsells corretamente
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
            metadata: planDeliverableId ? { plan_id: planId, plan_deliverable_id: planDeliverableId } : { plan_id: planId },
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

          // ========== DOWNSELL PIX GERADO ==========
          // Quando PIX é gerado:
          // 1. Cancelar downsells NORMAIS (que foram agendados no /start)
          // 2. Agendar downsells de PIX GERADO (downsellPix)
          
          const supabaseAdmin = getSupabaseAdmin()
          const flowForDownsell = flowPlan
          const flowConfigDs = flowConfigPlan
          
          if (flowForDownsell?.id) {
            // 1. CANCELAR downsells normais para este usuario
            const { data: cancelledNormalDownsells } = await supabaseAdmin
              .from("scheduled_messages")
              .update({ status: "cancelled" })
              .eq("bot_id", botUuid)
              .eq("telegram_user_id", String(telegramUserId))
              .eq("flow_id", flowForDownsell.id)
              .eq("message_type", "downsell")
              .eq("status", "pending")
              .select("id")
            
            console.log(`[DOWNSELL PIX] Cancelled ${cancelledNormalDownsells?.length || 0} normal downsells for user ${telegramUserId}`)
            
            // 2. AGENDAR downsells de PIX gerado (downsellPix)
            const downsellPixConfig = flowConfigDs.downsellPix as {
              enabled?: boolean
              sequences?: Array<{
                id: string
                message: string
                medias?: string[]
                sendTiming?: string
                sendDelayValue?: number
                sendDelayUnit?: string
                plans?: Array<{ id: string; buttonText: string; price: number }>
                deliveryType?: string
                deliverableId?: string
                customDelivery?: string
                useDefaultPlans?: boolean
                discountPercent?: number
                showPriceInButton?: boolean
              }>
            } | undefined
            
            if (downsellPixConfig?.enabled && downsellPixConfig.sequences && downsellPixConfig.sequences.length > 0) {
              const now = new Date()
              
              // Buscar planos do flow principal (para usar quando useDefaultPlans = true)
              const { data: mainFlowPlans } = await supabase
                .from("flow_plans")
                .select("id, name, price")
                .eq("flow_id", flowForDownsell.id)
                .eq("is_active", true)
                .order("position", { ascending: true })
              
              // Fallback: se nao tem planos na tabela, pegar do config JSON
              let defaultPlansToUse = mainFlowPlans || []
              if (defaultPlansToUse.length === 0) {
                const configPlans = (flowConfigDs.plans as Array<{ id: string; name: string; price: number; active?: boolean }>) || []
                defaultPlansToUse = configPlans.filter(p => p.active !== false).map(p => ({
                  id: p.id,
                  name: p.name,
                  price: p.price
                }))
              }
              
              // Agendar cada sequencia de downsell PIX gerado
              for (const seq of downsellPixConfig.sequences) {
                // Calcular delay em minutos
                let delayMinutes = seq.sendDelayValue || 1
                if (seq.sendDelayUnit === "hours") delayMinutes = (seq.sendDelayValue || 1) * 60
                else if (seq.sendDelayUnit === "days") delayMinutes = (seq.sendDelayValue || 1) * 60 * 24
                
                // Calcular horario exato para envio
                const scheduledFor = new Date(now.getTime() + delayMinutes * 60 * 1000)
                
                // Determinar quais planos usar
                let plansToUse: Array<{ id: string; buttonText?: string; name?: string; price: number }> = []
                const useDefaultPlans = seq.useDefaultPlans !== false
                const discountPercent = seq.discountPercent || 20
                
                if (useDefaultPlans && defaultPlansToUse && defaultPlansToUse.length > 0) {
                  plansToUse = defaultPlansToUse.map(plan => {
                    const discountedPrice = plan.price * (1 - discountPercent / 100)
                    return {
                      id: plan.id,
                      buttonText: plan.name,
                      name: plan.name,
                      price: Math.round(discountedPrice * 100) / 100
                    }
                  })
                  console.log(`[DOWNSELL PIX] Usando planos do fluxo principal com ${discountPercent}% desconto:`, JSON.stringify(plansToUse))
                } else {
                  plansToUse = seq.plans || []
                  console.log(`[DOWNSELL PIX] Usando planos personalizados da sequencia:`, JSON.stringify(plansToUse))
                }
                
                // Inserir na tabela scheduled_messages
                console.log(`[DOWNSELL PIX] Agendando para ${scheduledFor.toISOString()} (delay: ${delayMinutes} min)`)
                
                const seqIndexForPixDownsell = downsellPixConfig.sequences.indexOf(seq)
                
                console.log(`[DOWNSELL PIX] IMPORTANTE - Salvando metadata:`)
                console.log(`[DOWNSELL PIX]   sequence_id: ${seq.id}`)
                console.log(`[DOWNSELL PIX]   sequence_index: ${seqIndexForPixDownsell}`)
                console.log(`[DOWNSELL PIX]   deliveryType: ${seq.deliveryType || "NAO DEFINIDO"}`)
                console.log(`[DOWNSELL PIX]   deliverableId: ${seq.deliverableId || "NAO DEFINIDO"}`)
                
                const { error: insertError } = await supabaseAdmin.from("scheduled_messages").insert({
                  bot_id: botUuid,
                  flow_id: flowForDownsell.id,
                  telegram_user_id: String(telegramUserId),
                  telegram_chat_id: String(chatId),
                  message_type: "downsell", // Usa o mesmo tipo para o cron processar igual
                  sequence_id: seq.id,
                  sequence_index: seqIndexForPixDownsell,
                  scheduled_for: scheduledFor.toISOString(),
                  status: "pending",
                  metadata: {
                    message: seq.message,
                    medias: seq.medias || [],
                    plans: plansToUse,
                    deliveryType: seq.deliveryType,
                    sequenceIndex: seqIndexForPixDownsell, // Duplicar no metadata para fallback
                    deliverableId: seq.deliverableId,
                    customDelivery: seq.customDelivery,
                    botToken: botToken,
                    showPriceInButton: seq.showPriceInButton === true,
                    userFirstName: userFirstName || "",
                    userUsername: userUsername || "",
                    useDefaultPlans: useDefaultPlans,
                    discountPercent: useDefaultPlans ? discountPercent : undefined,
                    source: "pix_generated" // Identificar que veio do PIX gerado
                  }
                })
                
                if (insertError) {
                  console.error(`[DOWNSELL PIX] ERRO ao agendar: ${insertError.message}`)
                } else {
                  console.log(`[DOWNSELL PIX] Agendado com sucesso para user ${telegramUserId}`)
                }
              }
              
              console.log(`[DOWNSELL PIX] Total: ${downsellPixConfig.sequences.length} downsell(s) de PIX gerado agendados para user ${telegramUserId}`)
            }
          }
          // ========== FIM DOWNSELL PIX GERADO ==========

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
    // ========== FIM HANDLE CALLBACKS ==========

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

        // Helper to replace variables and convert link syntax
        const replaceVars = (text: string) => {
          if (!text) return ""
          return text
            .replace(/\{nome\}/gi, (from?.first_name as string) || "")
            .replace(/\{username\}/gi, (from?.username as string) ? `@${from.username}` : "")
            .replace(/\{bot\.username\}/gi, bot.username ? `@${bot.username}` : bot.name || "")
            // Converter sintaxe [LINK: text | url] para HTML <a href="url">text</a>
            // Caso a mensagem tenha sido salva no formato display ao inves de HTML
            .replace(/\[LINK:\s*([^|]+)\s*\|\s*([^\]]+)\]/gi, '<a href="$2">$1</a>')
        }

        // Get welcome message - try config first, then table field
        const welcomeMsg = (flowConfig.welcomeMessage as string) || (startFlow.welcome_message as string) || ""

        // Get medias - filter out base64 (Telegram only accepts URLs)
        const allMedias = (flowConfig.welcomeMedias as string[]) || []
        const welcomeMedias = allMedias.filter(m => m && !m.startsWith("data:") && (m.startsWith("http") || m.startsWith("/")))

        const ctaButtonEnabled = flowConfig.ctaButtonEnabled !== false // default true
        const ctaButtonText = (flowConfig.ctaButtonText as string) || "Ver Planos"
        const redirectButton = flowConfig.redirectButton as { enabled?: boolean; text?: string; url?: string } || {}
        const secondaryMsg = flowConfig.secondaryMessage as { enabled?: boolean; message?: string } || {}

        // Verificar se Packs esta habilitado
        const packsConfig = flowConfig.packs as { enabled?: boolean; buttonText?: string; list?: Array<{ id: string; active?: boolean }> } | undefined
        const packsEnabled = packsConfig?.enabled && packsConfig?.list && packsConfig.list.filter(p => p.active !== false).length > 0
        const packsButtonText = packsConfig?.buttonText || "Packs Disponiveis"

        // Pegar planos para mostrar direto (se ctaButtonEnabled = false)
        // Primeiro tenta da tabela flow_plans, depois do config
        // Verificar se deve mostrar preco no botao
        const showPriceInButton = flowConfig.showPriceInButton === true
        let plansToShow: Array<{ id: string; name: string; price?: number }> = []
        if (!ctaButtonEnabled) {
          const { data: flowPlans } = await supabase
            .from("flow_plans")
            .select("id, name, price")
            .eq("flow_id", startFlow.id)
            .eq("is_active", true)
            .order("position", { ascending: true })

          if (flowPlans && flowPlans.length > 0) {
            plansToShow = flowPlans
          } else {
            // Fallback: planos do config
            const configPlans = (flowConfig.plans as Array<{ id: string; name: string; price: number; active?: boolean }>) || []
            plansToShow = configPlans.filter(p => p.active !== false)
          }
        }

        // Always send welcome flow (we have at least a default message)
        const finalMsg = replaceVars(welcomeMsg) || `Ola! Bem-vindo ao ${bot.name || "bot"}.`

        // Build inline keyboard with buttons
        const inlineKeyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = []

        // Se CTA Button ativado: mostra botao "Ver Planos"
        // Se CTA Button desativado: mostra planos direto na boas-vindas
        if (ctaButtonEnabled) {
          // CTA Button (Ver Planos) - callback button
          inlineKeyboard.push([{ text: ctaButtonText, callback_data: "ver_planos" }])
        } else {
          // Mostrar planos direto na mensagem de boas-vindas
          for (const plan of plansToShow) {
            // Mostrar preco no botao se a opcao estiver ativada
            const buttonText = showPriceInButton && plan.price && plan.price > 0
              ? `${plan.name} por R$ ${Number(plan.price).toFixed(2).replace(".", ",")}`
              : plan.name
            inlineKeyboard.push([{ text: buttonText, callback_data: `plan_${plan.id}` }])
          }
        }

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
          // Send all medias together as album with welcome message as caption
          const mediaResult = await sendMediaGroup(botToken, chatId, welcomeMedias, finalMsg)

          if (mediaResult.ok) {
            // Media group enviado com sucesso, enviar botoes separadamente
            await sendTelegramMessage(botToken, chatId, "Escolha uma opcao:", replyMarkup)
          } else {
            // Se media group falhou, tentar enviar mensagem normalmente com botoes
            console.log("[v0] Welcome - mediaGroup falhou, enviando mensagem sem midia")
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
        const downsellConfig = flowConfig.downsell as {
          enabled?: boolean; sequences?: Array<{
            id: string; message: string; medias?: string[]; sendTiming?: string; sendDelayValue?: number; sendDelayUnit?: string;
            plans?: Array<{ id: string; buttonText: string; price: number }>; deliveryType?: string; deliverableId?: string; customDelivery?: string;
            useDefaultPlans?: boolean; discountPercent?: number; showPriceInButton?: boolean
          }>
        } | undefined

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

        // Buscar planos do flow principal (para usar quando useDefaultPlans = true)
        // Primeiro tenta da tabela flow_plans, se vazio usa o config JSON
        const { data: mainFlowPlans } = await supabase
          .from("flow_plans")
          .select("id, name, price")
          .eq("flow_id", startFlow.id)
          .eq("is_active", true)
          .order("position", { ascending: true })

        // Fallback: se nao tem planos na tabela, pegar do config JSON (planos legados)
        let defaultPlansToUse = mainFlowPlans || []
        if (defaultPlansToUse.length === 0) {
          const configPlans = (flowConfig.plans as Array<{ id: string; name: string; price: number; active?: boolean }>) || []
          defaultPlansToUse = configPlans.filter(p => p.active !== false).map(p => ({
            id: p.id,
            name: p.name,
            price: p.price
          }))
          console.log(`[DOWNSELL] Usando planos do config JSON (fallback):`, JSON.stringify(defaultPlansToUse))
        }

        // Processar todas as sequencias de downsell
        for (const seq of downsellConfig.sequences) {
          // Calcular delay em minutos
          let delayMinutes = seq.sendDelayValue || 1
          if (seq.sendDelayUnit === "hours") delayMinutes = (seq.sendDelayValue || 1) * 60
          else if (seq.sendDelayUnit === "days") delayMinutes = (seq.sendDelayValue || 1) * 60 * 24

          // Calcular horario exato para envio
          const scheduledFor = new Date(now.getTime() + delayMinutes * 60 * 1000)

          // Determinar quais planos usar: se useDefaultPlans = true, usa os planos do fluxo principal com desconto
          let plansToUse: Array<{ id: string; buttonText?: string; name?: string; price: number }> = []
          const useDefaultPlans = seq.useDefaultPlans !== false // default true
          const discountPercent = seq.discountPercent || 20 // default 20%

          if (useDefaultPlans && defaultPlansToUse && defaultPlansToUse.length > 0) {
            // Usar planos do fluxo principal com desconto aplicado
            plansToUse = defaultPlansToUse.map(plan => {
              const discountedPrice = plan.price * (1 - discountPercent / 100)
              return {
                id: plan.id,
                buttonText: plan.name,
                name: plan.name,
                price: Math.round(discountedPrice * 100) / 100 // Arredondar para 2 casas decimais
              }
            })
            console.log(`[DOWNSELL] Usando planos do fluxo principal com ${discountPercent}% desconto:`, JSON.stringify(plansToUse))
          } else {
            // Usar planos personalizados da sequencia
            plansToUse = seq.plans || []
            console.log(`[DOWNSELL] Usando planos personalizados da sequencia:`, JSON.stringify(plansToUse))
          }

          // Salvar no banco para o cron processar
          console.log(`[DOWNSELL] Agendando downsell para ${scheduledFor.toISOString()} (delay: ${delayMinutes} min)`)

          const seqIndexForDownsell = downsellConfig.sequences.indexOf(seq)
          
          console.log(`[DOWNSELL] IMPORTANTE - Salvando metadata:`)
          console.log(`[DOWNSELL]   sequence_id: ${seq.id}`)
          console.log(`[DOWNSELL]   sequence_index: ${seqIndexForDownsell}`)
          console.log(`[DOWNSELL]   deliveryType: ${seq.deliveryType || "NAO DEFINIDO"}`)
          console.log(`[DOWNSELL]   deliverableId: ${seq.deliverableId || "NAO DEFINIDO"}`)
          
          const { error: insertError } = await supabaseAdmin.from("scheduled_messages").insert({
            bot_id: botUuid,
            flow_id: startFlow.id,
            telegram_user_id: String(telegramUserId),
            telegram_chat_id: String(chatId),
            message_type: "downsell",
            sequence_id: seq.id,
            sequence_index: seqIndexForDownsell,
            scheduled_for: scheduledFor.toISOString(),
            status: "pending",
            metadata: {
              message: seq.message,
              medias: seq.medias || [],
              plans: plansToUse,
              deliveryType: seq.deliveryType,
              deliverableId: seq.deliverableId,
              // Duplicar o index no metadata para fallback
              sequenceIndex: seqIndexForDownsell,
              customDelivery: seq.customDelivery,
              botToken: botToken,
              // Flag para mostrar preco no botao (ex: "Mensal por R$ 20,00")
              showPriceInButton: seq.showPriceInButton === true,
              // Dados do usuario para substituir variaveis {NOME} e {USERNAME}
              userFirstName: from?.first_name || "",
              userUsername: from?.username || "",
              // Info de desconto (para referencia)
              useDefaultPlans: useDefaultPlans,
              discountPercent: useDefaultPlans ? discountPercent : undefined,
            }
          })

          if (insertError) {
            console.error(`[DOWNSELL] ERRO ao agendar: ${insertError.message}`)
          } else {
            console.log(`[DOWNSELL] Agendado com sucesso para user ${telegramUserId}`)
            console.log(`[DOWNSELL] sequence_id salvo: ${seq.id}`)
            console.log(`[DOWNSELL] deliveryType salvo: ${seq.deliveryType || "NAO DEFINIDO"}`)
            console.log(`[DOWNSELL] deliverableId salvo: ${seq.deliverableId || "NAO DEFINIDO"}`)
            console.log(`[DOWNSELL] Planos salvos: ${JSON.stringify(plansToUse)}`)
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

  // Helper to replace variables and convert link syntax
  const replaceVars = (text: string) => {
    return text
      .replace(/\{nome\}/gi, (from?.first_name as string) || "")
      .replace(/\{username\}/gi, (from?.username as string) ? `@${from.username}` : "")
      // Converter sintaxe [LINK: text | url] para HTML <a href="url">text</a>
      .replace(/\[LINK:\s*([^|]+)\s*\|\s*([^\]]+)\]/gi, '<a href="$2">$1</a>')
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

/**
 * Telegram Message Utilities
 * Funcoes para sanitizar e enviar mensagens para o Telegram de forma segura
 */

/**
 * Sanitiza HTML para o Telegram
 * Remove tags vazias e corrige formatacao quebrada que causa erro na API
 */
export function sanitizeTelegramHTML(text: string): string {
  if (!text) return ""
  
  let result = text
  
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
      for (let j = 0; j < openCount - closeCount; j++) {
        result = result.replace(new RegExp(`<${tag}>(?!.*<${tag}>)`, "i"), "")
      }
    }
    // Se tem mais fechamentos que aberturas, remove os fechamentos extras
    else if (closeCount > openCount) {
      for (let j = 0; j < closeCount - openCount; j++) {
        result = result.replace(new RegExp(`</${tag}>`, "i"), "")
      }
    }
  }
  
  // Remove tags <a> mal formadas (sem href valido)
  result = result.replace(/<a[^>]*href=["']?(?!http)[^"']*["']?[^>]*>([^<]*)<\/a>/gi, "$1")
  
  // Remove multiplos espacos em branco consecutivos (exceto quebras de linha)
  result = result.replace(/[ \t]+/g, " ")
  
  // Remove linhas vazias excessivas (mais de 2 consecutivas)
  result = result.replace(/\n{4,}/g, "\n\n\n")
  
  // Trim final
  result = result.trim()
  
  return result
}

/**
 * Remove todas as tags HTML de um texto
 */
export function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, "")
}

/**
 * Envia mensagem de texto para o Telegram com fallback em caso de erro de HTML
 */
export async function sendTelegramMessageSafe(
  botToken: string,
  chatId: number | string,
  text: string,
  replyMarkup?: object
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`
  
  // Sanitizar HTML
  const sanitizedText = sanitizeTelegramHTML(text)
  
  // Se apos sanitizacao o texto ficou vazio, nao enviar
  if (!sanitizedText || sanitizedText.trim() === "") {
    console.log("[telegram-utils] sendMessage - texto vazio apos sanitizacao, pulando envio")
    return { ok: false, error: "Empty text after sanitization" }
  }
  
  const body: Record<string, unknown> = { 
    chat_id: chatId, 
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
    if (!data.ok && data.description?.includes("can't parse")) {
      console.log("[telegram-utils] sendMessage - erro de parse HTML, tentando sem formatacao:", data.description)
      const fallbackBody: Record<string, unknown> = { 
        chat_id: chatId, 
        text: stripHtmlTags(sanitizedText) 
      }
      if (replyMarkup) fallbackBody.reply_markup = replyMarkup
      const fallbackRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fallbackBody),
      })
      const fallbackData = await fallbackRes.json()
      return { 
        ok: fallbackData.ok, 
        messageId: fallbackData?.result?.message_id,
        error: fallbackData.ok ? undefined : fallbackData.description
      }
    }
    
    return { 
      ok: data.ok, 
      messageId: data?.result?.message_id,
      error: data.ok ? undefined : data.description
    }
  } catch (err) {
    console.error("[telegram-utils] sendMessage - exception:", err)
    return { ok: false, error: String(err) }
  }
}

/**
 * Envia foto para o Telegram com fallback em caso de erro de HTML no caption
 */
export async function sendTelegramPhotoSafe(
  botToken: string,
  chatId: number | string,
  photoUrl: string,
  caption?: string,
  replyMarkup?: object
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const url = `https://api.telegram.org/bot${botToken}/sendPhoto`
  
  // Sanitizar caption
  const sanitizedCaption = caption ? sanitizeTelegramHTML(caption) : undefined
  
  const body: Record<string, unknown> = {
    chat_id: chatId,
    photo: photoUrl,
  }
  
  if (sanitizedCaption) {
    body.caption = sanitizedCaption
    body.parse_mode = "HTML"
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
    if (!data.ok && data.description?.includes("can't parse")) {
      console.log("[telegram-utils] sendPhoto - erro de parse HTML, tentando sem formatacao")
      const fallbackBody: Record<string, unknown> = {
        chat_id: chatId,
        photo: photoUrl,
      }
      if (sanitizedCaption) {
        fallbackBody.caption = stripHtmlTags(sanitizedCaption)
      }
      if (replyMarkup) fallbackBody.reply_markup = replyMarkup
      const fallbackRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fallbackBody),
      })
      const fallbackData = await fallbackRes.json()
      return { 
        ok: fallbackData.ok, 
        messageId: fallbackData?.result?.message_id,
        error: fallbackData.ok ? undefined : fallbackData.description
      }
    }
    
    return { 
      ok: data.ok, 
      messageId: data?.result?.message_id,
      error: data.ok ? undefined : data.description
    }
  } catch (err) {
    console.error("[telegram-utils] sendPhoto - exception:", err)
    return { ok: false, error: String(err) }
  }
}

/**
 * Envia video para o Telegram com fallback em caso de erro de HTML no caption
 */
export async function sendTelegramVideoSafe(
  botToken: string,
  chatId: number | string,
  videoUrl: string,
  caption?: string,
  replyMarkup?: object
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const url = `https://api.telegram.org/bot${botToken}/sendVideo`
  
  // Sanitizar caption
  const sanitizedCaption = caption ? sanitizeTelegramHTML(caption) : undefined
  
  const body: Record<string, unknown> = {
    chat_id: chatId,
    video: videoUrl,
  }
  
  if (sanitizedCaption) {
    body.caption = sanitizedCaption
    body.parse_mode = "HTML"
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
    if (!data.ok && data.description?.includes("can't parse")) {
      console.log("[telegram-utils] sendVideo - erro de parse HTML, tentando sem formatacao")
      const fallbackBody: Record<string, unknown> = {
        chat_id: chatId,
        video: videoUrl,
      }
      if (sanitizedCaption) {
        fallbackBody.caption = stripHtmlTags(sanitizedCaption)
      }
      if (replyMarkup) fallbackBody.reply_markup = replyMarkup
      const fallbackRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fallbackBody),
      })
      const fallbackData = await fallbackRes.json()
      return { 
        ok: fallbackData.ok, 
        messageId: fallbackData?.result?.message_id,
        error: fallbackData.ok ? undefined : fallbackData.description
      }
    }
    
    return { 
      ok: data.ok, 
      messageId: data?.result?.message_id,
      error: data.ok ? undefined : data.description
    }
  } catch (err) {
    console.error("[telegram-utils] sendVideo - exception:", err)
    return { ok: false, error: String(err) }
  }
}

/**
 * Envia grupo de midias para o Telegram com fallback em caso de erro de HTML
 */
export async function sendTelegramMediaGroupSafe(
  botToken: string,
  chatId: number | string,
  mediaUrls: string[],
  caption?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!mediaUrls || mediaUrls.length === 0) return { ok: true }
  
  // Sanitizar caption
  const sanitizedCaption = caption ? sanitizeTelegramHTML(caption) : undefined
  
  // Se for apenas 1 midia, envia individualmente
  if (mediaUrls.length === 1) {
    const mediaUrl = mediaUrls[0]
    const isVideo = mediaUrl.includes("/videos/") || mediaUrl.match(/\.(mp4|webm|mov)($|\?)/i)
    if (isVideo) {
      const result = await sendTelegramVideoSafe(botToken, chatId, mediaUrl, sanitizedCaption)
      return { ok: result.ok, error: result.error }
    } else {
      const result = await sendTelegramPhotoSafe(botToken, chatId, mediaUrl, sanitizedCaption)
      return { ok: result.ok, error: result.error }
    }
  }
  
  const url = `https://api.telegram.org/bot${botToken}/sendMediaGroup`
  
  const media = mediaUrls.map((mediaUrl, index) => {
    const isVideo = mediaUrl.includes("/videos/") || mediaUrl.match(/\.(mp4|webm|mov)($|\?)/i)
    const item: Record<string, unknown> = {
      type: isVideo ? "video" : "photo",
      media: mediaUrl,
    }
    // Caption apenas no primeiro item
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
      console.log("[telegram-utils] sendMediaGroup - erro de parse HTML, tentando sem formatacao")
      
      const mediaWithoutHtml = mediaUrls.map((mediaUrl, index) => {
        const isVideo = mediaUrl.includes("/videos/") || mediaUrl.match(/\.(mp4|webm|mov)($|\?)/i)
        const item: Record<string, unknown> = {
          type: isVideo ? "video" : "photo",
          media: mediaUrl,
        }
        if (index === 0 && sanitizedCaption) {
          item.caption = stripHtmlTags(sanitizedCaption)
        }
        return item
      })
      
      const fallbackRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, media: mediaWithoutHtml }),
      })
      
      const fallbackData = await fallbackRes.json()
      return { ok: fallbackData.ok, error: fallbackData.ok ? undefined : fallbackData.description }
    }
    
    return { ok: data.ok, error: data.ok ? undefined : data.description }
  } catch (err) {
    console.error("[telegram-utils] sendMediaGroup exception:", err)
    return { ok: false, error: String(err) }
  }
}

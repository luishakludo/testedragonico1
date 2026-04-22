import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"
import { 
  sendTelegramMessageSafe, 
  sendTelegramPhotoSafe, 
  sendTelegramVideoSafe 
} from "@/lib/telegram-utils"

// ---------------------------------------------------------------------------
// Telegram helpers (same as webhook)
// ---------------------------------------------------------------------------

async function getBotUsername(botToken: string): Promise<string> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
    const data = await res.json()
    if (data.ok && data.result?.username) {
      return data.result.username
    }
  } catch (e) {
    console.error("[getBotUsername] Error:", e)
  }
  return ""
}

interface InlineButton { type?: string; text: string; url?: string }

function buildInlineKeyboard(buttons: InlineButton[], botUsername?: string) {
  if (!buttons || buttons.length === 0) return undefined
  
  // Processar botoes - usar callback_data para plans/packs (ativa direto no chat)
  const keyboardRows: Array<Array<{ text: string; url?: string; callback_data?: string }>> = []
  
  for (const btn of buttons) {
    if (!btn.text) continue
    
    // Botao de planos - usar callback_data para ativar direto no fluxo
    if (btn.type === "plans") {
      keyboardRows.push([{ text: btn.text, callback_data: "ver_planos" }])
      continue
    }
    
    // Botao de packs - usar callback_data para ativar direto no fluxo
    if (btn.type === "packs") {
      keyboardRows.push([{ text: btn.text, callback_data: "show_packs" }])
      continue
    }
    
    // Botao com URL normal
    if (btn.url && btn.url.trim() !== "") {
      keyboardRows.push([{ text: btn.text, url: btn.url }])
    }
  }
  
  if (keyboardRows.length === 0) return undefined
  
  console.log("[buildInlineKeyboard] Keyboard rows:", JSON.stringify(keyboardRows))
  return { inline_keyboard: keyboardRows }
}

async function sendTelegramMessage(botToken: string, chatId: number, text: string, replyMarkup?: object) {
  console.log("[sendTelegramMessage] Sending to chat_id:", chatId, "text:", text.substring(0, 50))
  const result = await sendTelegramMessageSafe(botToken, chatId, text, replyMarkup)
  console.log("[sendTelegramMessage] Response:", JSON.stringify(result))
  return { ok: result.ok, description: result.error, result: { message_id: result.messageId } }
}

async function sendTelegramPhoto(botToken: string, chatId: number, photoUrl: string, caption: string, replyMarkup?: object) {
  console.log("[sendTelegramPhoto] Sending to chat_id:", chatId, "caption:", caption?.substring(0, 50), "photoUrl:", photoUrl?.substring(0, 50))
  // Base64 handling (still need special handling for FormData)
  if (photoUrl.startsWith("data:")) {
    const url = `https://api.telegram.org/bot${botToken}/sendPhoto`
    const formData = new FormData()
    formData.append("chat_id", String(chatId))
    if (caption) formData.append("caption", caption)
    formData.append("parse_mode", "HTML")
    if (replyMarkup) formData.append("reply_markup", JSON.stringify(replyMarkup))
    const base64Match = photoUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (base64Match) {
      const binaryStr = atob(base64Match[2])
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
      formData.append("photo", new Blob([bytes], { type: base64Match[1] }), "photo.jpg")
    }
    const res = await fetch(url, { method: "POST", body: formData })
    const result = await res.json()
    console.log("[sendTelegramPhoto] Base64 Response:", JSON.stringify(result))
    return result
  }
  const result = await sendTelegramPhotoSafe(botToken, chatId, photoUrl, caption, replyMarkup)
  console.log("[sendTelegramPhoto] URL Response:", JSON.stringify(result))
  return { ok: result.ok, description: result.error, result: { message_id: result.messageId } }
}

async function sendTelegramVideo(botToken: string, chatId: number, videoUrl: string, caption: string, replyMarkup?: object) {
  // Base64 handling (still need special handling for FormData)
  if (videoUrl.startsWith("data:")) {
    const url = `https://api.telegram.org/bot${botToken}/sendVideo`
    const formData = new FormData()
    formData.append("chat_id", String(chatId))
    if (caption) formData.append("caption", caption)
    formData.append("parse_mode", "HTML")
    if (replyMarkup) formData.append("reply_markup", JSON.stringify(replyMarkup))
    const base64Match = videoUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (base64Match) {
      const binaryStr = atob(base64Match[2])
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
      formData.append("video", new Blob([bytes], { type: base64Match[1] }), "video.mp4")
    }
    const res = await fetch(url, { method: "POST", body: formData })
    return res.json()
  }
  const result = await sendTelegramVideoSafe(botToken, chatId, videoUrl, caption, replyMarkup)
  return { ok: result.ok, description: result.error, result: { message_id: result.messageId } }
}

// ---------------------------------------------------------------------------
// Send a campaign message node to a user
// ---------------------------------------------------------------------------

async function sendCampaignMessageToUser(
  botToken: string,
  chatId: number,
  config: Record<string, unknown>,
  botUsername?: string
) {
  const text = (config.text as string) || ""
  const buttonsStr = (config.buttons as string) || ""
  
  console.log("[sendCampaignMessageToUser] config.buttons:", config.buttons)
  console.log("[sendCampaignMessageToUser] buttonsStr:", buttonsStr)
  console.log("[sendCampaignMessageToUser] botUsername:", botUsername)
  
  // Support both old format (media_url/media_type) and new format (medias array)
  const medias = config.medias as string[] | undefined
  const legacyMediaUrl = (config.media_url as string) || ""
  const legacyMediaType = (config.media_type as string) || ""

  let inlineKeyboard: object | undefined
  if (buttonsStr) {
    try {
      inlineKeyboard = buildInlineKeyboard(JSON.parse(buttonsStr) as InlineButton[], botUsername)
    } catch { /* ignore */ }
  }

  const displayText = text || "Mensagem"

  try {
    let lastResult: { ok?: boolean; description?: string } = { ok: false }
    
    // Process new medias array format
    if (medias && medias.length > 0) {
      // Se tem apenas 1 midia, envia COM o texto e botoes
      if (medias.length === 1) {
        const mediaUrl = medias[0]
        const isVideo = mediaUrl.includes("video/") || 
                       mediaUrl.endsWith(".mp4") || 
                       mediaUrl.endsWith(".mov")
        
        if (isVideo) {
          lastResult = await sendTelegramVideo(botToken, chatId, mediaUrl, displayText, inlineKeyboard)
          console.log("[campaigns/execute] Video+text send result:", JSON.stringify(lastResult))
        } else {
          lastResult = await sendTelegramPhoto(botToken, chatId, mediaUrl, displayText, inlineKeyboard)
          console.log("[campaigns/execute] Photo+text send result:", JSON.stringify(lastResult))
        }
      } else {
        // Se tem multiplas midias, envia cada uma e texto+botoes no final
        for (let i = 0; i < medias.length; i++) {
          const mediaUrl = medias[i]
          const isVideo = mediaUrl.includes("video/") || 
                         mediaUrl.endsWith(".mp4") || 
                         mediaUrl.endsWith(".mov")
          
          // Ultima midia recebe o texto e botoes
          const isLast = i === medias.length - 1
          const caption = isLast ? displayText : ""
          const keyboard = isLast ? inlineKeyboard : undefined
          
          if (isVideo) {
            lastResult = await sendTelegramVideo(botToken, chatId, mediaUrl, caption, keyboard)
            console.log("[campaigns/execute] Video send result:", JSON.stringify(lastResult))
          } else {
            lastResult = await sendTelegramPhoto(botToken, chatId, mediaUrl, caption, keyboard)
            console.log("[campaigns/execute] Photo send result:", JSON.stringify(lastResult))
          }
        }
      }
    } 
    // Fallback to legacy format
    else if (legacyMediaUrl && legacyMediaType) {
      if (legacyMediaType === "photo") {
        lastResult = await sendTelegramPhoto(botToken, chatId, legacyMediaUrl, "", undefined)
      } else if (legacyMediaType === "video") {
        lastResult = await sendTelegramVideo(botToken, chatId, legacyMediaUrl, "", undefined)
      }
      if (displayText) {
        lastResult = await sendTelegramMessage(botToken, chatId, displayText, inlineKeyboard)
      }
    } 
    // No media, just text
    else {
      lastResult = await sendTelegramMessage(botToken, chatId, displayText, inlineKeyboard)
      console.log("[campaigns/execute] Text-only send result:", JSON.stringify(lastResult))
    }
    
    // Verificar se a API do Telegram retornou sucesso
    if (!lastResult.ok) {
      console.error("[campaigns/execute] Telegram API error:", lastResult.description || "Unknown error")
      return false
    }
    
    return true
  } catch (err) {
    console.error("[campaigns/execute] Send error:", err)
    return false
  }
}

// ---------------------------------------------------------------------------
// Delay conversion
// ---------------------------------------------------------------------------

const DELAY_MS: Record<string, number> = {
  "1h": 3600000,
  "6h": 21600000,
  "12h": 43200000,
  "1d": 86400000,
  "2d": 172800000,
  "3d": 259200000,
  "7d": 604800000,
}

// ---------------------------------------------------------------------------
// POST /api/campaigns/execute
// Called when campaign is activated OR by cron to process pending sends
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const supabase = getSupabase()

  try {
    const body = await req.json().catch(() => ({}))
    const campaignId = (body as { campaign_id?: string }).campaign_id
    const now = new Date()

    // ----- Mode 1: Specific campaign just activated => initialize all users -----
    if (campaignId) {
      console.log("[campaigns/execute] Executando campanha:", campaignId)
      
      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", campaignId)
        .single()

      if (campaignError) {
        console.error("[campaigns/execute] Erro ao buscar campanha:", campaignError)
      }

      if (!campaign || campaign.status !== "ativa") {
        console.log("[campaigns/execute] Campanha nao encontrada ou nao ativa:", campaign?.status)
        return NextResponse.json({ error: "Campanha nao encontrada ou nao ativa" }, { status: 400 })
      }
      
      console.log("[campaigns/execute] Campanha encontrada:", campaign.name, "status:", campaign.status)

      // Fetch bot - use select("*") to get all fields including username if it exists
      const { data: bot, error: botError } = await supabase
        .from("bots")
        .select("*")
        .eq("id", campaign.bot_id)
        .single()

      console.log("[campaigns/execute] Bot query result:", bot ? "found" : "not found", "error:", botError?.message)

      if (!bot?.token) {
        return NextResponse.json({ error: "Bot nao encontrado" }, { status: 400 })
      }

      const botToken = bot.token
      // Try to get username from DB, if not available fetch from Telegram API
      let botUsername = (bot.username as string) || ""
      if (!botUsername) {
        botUsername = await getBotUsername(botToken)
        console.log("[campaigns/execute] Bot username from API:", botUsername)
      } else {
        console.log("[campaigns/execute] Bot username from DB:", botUsername)
      }

      // Get campaign nodes ordered by position
      const { data: nodes } = await supabase
        .from("campaign_nodes")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("position", { ascending: true })

      if (!nodes || nodes.length === 0) {
        return NextResponse.json({ error: "Campanha sem nodes" }, { status: 400 })
      }

      // Get users based on audience_type and audience filter
      let botUsers: { id: string; telegram_user_id: string; chat_id: number }[] = []
      
      const audienceType = campaign.audience_type as string | null
      const audience = campaign.audience as string | null
      
      console.log("[campaigns/execute] Campaign audience_type:", audienceType, "audience:", audience)
      
      if (audienceType === "imported") {
        // For imported campaigns, get users from bot_users table with source = 'imported'
        // Note: For imported users, chat_id might be null, so we use telegram_user_id as chat_id
        // (they are the same for private chats in Telegram)
        const { data: importedUsers } = await supabase
          .from("bot_users")
          .select("id, telegram_user_id, chat_id")
          .eq("bot_id", campaign.bot_id)
          .eq("source", "imported")
        
        if (importedUsers && importedUsers.length > 0) {
          botUsers = importedUsers.map(u => ({
            id: u.id,
            telegram_user_id: u.telegram_user_id,
            // Use chat_id if available, otherwise use telegram_user_id (they're the same for private chats)
            chat_id: u.chat_id || parseInt(u.telegram_user_id)
          }))
        }
        
        console.log("[campaigns/execute] Imported users found:", botUsers.length)
      } else {
        // For start campaigns, filter bot_users by audience criteria
        const { data: allBotUsers } = await supabase
          .from("bot_users")
          .select("id, telegram_user_id, chat_id, funnel_step, is_subscriber")
          .eq("bot_id", campaign.bot_id)
        
        if (allBotUsers && allBotUsers.length > 0) {
          // Get all payments for this bot to check payment status
          const { data: allPayments } = await supabase
            .from("payments")
            .select("telegram_user_id, status")
            .eq("bot_id", campaign.bot_id)
          
          // Create maps for quick lookup
          const pendingPaymentUsers = new Set<string>()
          const paidUsers = new Set<string>()
          
          if (allPayments) {
            for (const payment of allPayments) {
              const tgId = payment.telegram_user_id?.toString()
              if (!tgId) continue
              
              const status = (payment.status || "").toLowerCase()
              if (status === "pending" || status === "aguardando" || status === "pix_gerado") {
                pendingPaymentUsers.add(tgId)
              }
              if (status === "approved" || status === "paid" || status === "pago") {
                paidUsers.add(tgId)
              }
            }
          }
          
          console.log("[campaigns/execute] Payment stats - pending:", pendingPaymentUsers.size, "paid:", paidUsers.size)
          
          // Filter based on audience
          let filteredUsers = allBotUsers
          
          if (audience === "started_not_continued") {
            // Users who started (funnel_step >= 1) but didn't continue (funnel_step < 3 and not subscriber)
            filteredUsers = allBotUsers.filter(u => {
              const step = typeof u.funnel_step === "number" ? u.funnel_step : parseInt(String(u.funnel_step || "0"))
              return step >= 1 && step < 3 && !u.is_subscriber
            })
            console.log("[campaigns/execute] Filtering started_not_continued: found", filteredUsers.length, "of", allBotUsers.length)
          } else if (audience === "not_paid") {
            // Users who generated PIX but didn't pay
            // They have a pending payment AND are not yet subscribers
            filteredUsers = allBotUsers.filter(u => {
              const tgId = u.telegram_user_id?.toString()
              const hasPending = pendingPaymentUsers.has(tgId)
              const alreadyPaid = paidUsers.has(tgId) || u.is_subscriber === true
              return hasPending && !alreadyPaid
            })
            console.log("[campaigns/execute] Filtering not_paid: found", filteredUsers.length, "of", allBotUsers.length)
          } else if (audience === "paid") {
            // Users who already paid (is_subscriber = true or has approved payment)
            filteredUsers = allBotUsers.filter(u => {
              const tgId = u.telegram_user_id?.toString()
              return u.is_subscriber === true || paidUsers.has(tgId)
            })
            console.log("[campaigns/execute] Filtering paid: found", filteredUsers.length, "of", allBotUsers.length)
          } else {
            // No filter, send to all
            console.log("[campaigns/execute] No audience filter, sending to all:", allBotUsers.length)
          }
          
          botUsers = filteredUsers.map(u => ({
            id: u.id,
            telegram_user_id: u.telegram_user_id,
            chat_id: u.chat_id
          }))
        }
      }

      if (!botUsers || botUsers.length === 0) {
        return NextResponse.json({ sent: 0, message: "Nenhum usuario encontrado para o publico selecionado" })
      }
      
      console.log("[campaigns/execute] Total users to send:", botUsers.length)

      // Find the first message node (skip leading delays)
      let firstMessageIdx = 0
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].type === "message") {
          firstMessageIdx = i
          break
        }
      }

      const firstMessageNode = nodes[firstMessageIdx]
      let sentCount = 0
      let failCount = 0
      
      console.log("[campaigns/execute] Primeiro node de mensagem:", firstMessageIdx)
      console.log("[campaigns/execute] Config do node:", JSON.stringify(firstMessageNode.config))
      console.log("[campaigns/execute] Iniciando envio para", botUsers.length, "usuarios")

      for (const user of botUsers) {
        // Check if user already has state for this campaign
        const { data: existing } = await supabase
          .from("campaign_user_state")
          .select("id")
          .eq("campaign_id", campaignId)
          .eq("bot_user_id", user.id)
          .limit(1)

        if (existing && existing.length > 0) {
          console.log("[campaigns/execute] Usuario ja inscrito, pulando:", user.telegram_user_id)
          continue // already enrolled
        }

        console.log("[campaigns/execute] Enviando para usuario:", user.telegram_user_id, "chat_id:", user.chat_id)
        
        // Send the first message immediately
        const success = await sendCampaignMessageToUser(
          botToken,
          user.chat_id,
          firstMessageNode.config as Record<string, unknown>,
          botUsername
        )

        if (success) {
          sentCount++
          console.log("[campaigns/execute] Enviado com sucesso para:", user.telegram_user_id)
        } else {
          failCount++
          console.log("[campaigns/execute] Falha ao enviar para:", user.telegram_user_id)
        }

        // Record the send
        await supabase.from("campaign_sends").insert({
          campaign_id: campaignId,
          campaign_node_id: firstMessageNode.id,
          bot_user_id: user.id,
          telegram_user_id: user.telegram_user_id,
          chat_id: user.chat_id,
          status: success ? "sent" : "failed",
        })

        // Calculate next_send_at based on next node(s)
        let nextSendAt: string | null = null
        let nextPosition = firstMessageIdx + 1

        // Walk through delay nodes to calculate when the next message should be sent
        let accumulatedDelay = 0
        for (let i = nextPosition; i < nodes.length; i++) {
          if (nodes[i].type === "delay") {
            const delayValue = (nodes[i].config as Record<string, unknown>).delay as string || "1d"
            accumulatedDelay += DELAY_MS[delayValue] || 86400000
            nextPosition = i + 1
          } else {
            // Found the next message node
            break
          }
        }

        if (nextPosition < nodes.length) {
          nextSendAt = new Date(now.getTime() + accumulatedDelay).toISOString()
        }

        // Create user state
        await supabase.from("campaign_user_state").upsert({
          campaign_id: campaignId,
          bot_user_id: user.id,
          telegram_user_id: user.telegram_user_id,
          chat_id: user.chat_id,
          current_node_position: nextPosition < nodes.length ? nextPosition : nodes.length,
          next_send_at: nextSendAt,
          status: nextPosition >= nodes.length ? "completed" : "active",
        }, { onConflict: "campaign_id,bot_user_id" })

        // Small delay to avoid Telegram rate limits (30 msgs/sec)
        await new Promise((r) => setTimeout(r, 50))
      }

      return NextResponse.json({ sent: sentCount, failed: failCount, total: botUsers.length })
    }

    // ----- Mode 2: Cron/scheduled => process users whose next_send_at has passed -----
    const { data: pendingStates } = await supabase
      .from("campaign_user_state")
      .select("*")
      .eq("status", "active")
      .not("next_send_at", "is", null)
      .lte("next_send_at", now.toISOString())
      .limit(100)

    if (!pendingStates || pendingStates.length === 0) {
      return NextResponse.json({ processed: 0 })
    }

    let processedCount = 0

    for (const state of pendingStates) {
      // Fetch campaign and bot token separately
      const { data: campaign2 } = await supabase
        .from("campaigns")
        .select("id, bot_id, status")
        .eq("id", state.campaign_id)
        .single()

      if (!campaign2 || campaign2.status !== "ativa") continue

      const { data: bot2 } = await supabase
        .from("bots")
        .select("*")
        .eq("id", campaign2.bot_id)
        .single()

      if (!bot2?.token) continue

      const botToken = bot2.token
      let botUsername2 = (bot2.username as string) || ""
      if (!botUsername2) {
        botUsername2 = await getBotUsername(botToken)
      }
      const campaignId2 = campaign2.id

      // Get all nodes for this campaign
      const { data: allNodes } = await supabase
        .from("campaign_nodes")
        .select("*")
        .eq("campaign_id", campaignId2)
        .order("position", { ascending: true })

      if (!allNodes) continue

      const currentPos = state.current_node_position
      if (currentPos >= allNodes.length) {
        // Campaign finished for this user
        await supabase
          .from("campaign_user_state")
          .update({ status: "completed", updated_at: now.toISOString() })
          .eq("id", state.id)
        continue
      }

      // Current node should be a message
      const currentNode = allNodes[currentPos]
      if (currentNode.type !== "message") continue

      // Send
      const success = await sendCampaignMessageToUser(
        botToken,
        state.chat_id,
        currentNode.config as Record<string, unknown>,
        botUsername2
      )

      // Record send
      await supabase.from("campaign_sends").insert({
        campaign_id: campaignId2,
        campaign_node_id: currentNode.id,
        bot_user_id: state.bot_user_id,
        telegram_user_id: state.telegram_user_id,
        chat_id: state.chat_id,
        status: success ? "sent" : "failed",
      })

      // Calculate next
      let nextPosition = currentPos + 1
      let accumulatedDelay = 0
      let nextSendAt: string | null = null

      for (let i = nextPosition; i < allNodes.length; i++) {
        if (allNodes[i].type === "delay") {
          const delayValue = (allNodes[i].config as Record<string, unknown>).delay as string || "1d"
          accumulatedDelay += DELAY_MS[delayValue] || 86400000
          nextPosition = i + 1
        } else {
          break
        }
      }

      if (nextPosition < allNodes.length) {
        nextSendAt = new Date(now.getTime() + accumulatedDelay).toISOString()
      }

      await supabase
        .from("campaign_user_state")
        .update({
          current_node_position: nextPosition < allNodes.length ? nextPosition : allNodes.length,
          next_send_at: nextSendAt,
          status: nextPosition >= allNodes.length ? "completed" : "active",
          updated_at: now.toISOString(),
        })
        .eq("id", state.id)

      processedCount++
      await new Promise((r) => setTimeout(r, 50))
    }

    return NextResponse.json({ processed: processedCount })
  } catch (err) {
    console.error("[campaigns/execute] Error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

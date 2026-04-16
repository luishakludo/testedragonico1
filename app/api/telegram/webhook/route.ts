import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"
import { orderBumpLog, paymentLog, webhookLog } from "@/lib/logger"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InlineButton {
  text: string
  url: string
}

interface FlowNode {
  id: string
  type: string
  label: string
  config: Record<string, unknown>
  position: number
}

interface ConditionBranch {
  label: string
  target_flow_id: string
}

// ---------------------------------------------------------------------------
// Telegram helpers
// ---------------------------------------------------------------------------

function buildInlineKeyboard(buttons: InlineButton[]) {
  if (!buttons || buttons.length === 0) return undefined
  return { inline_keyboard: buttons.map((btn) => [{ text: btn.text, url: btn.url }]) }
}

async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
  replyMarkup?: object,
) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`
  const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: "HTML" }
  if (replyMarkup) body.reply_markup = replyMarkup
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function sendTelegramPhoto(
  botToken: string,
  chatId: number,
  photoUrl: string,
  caption: string,
  replyMarkup?: object,
) {
  const url = `https://api.telegram.org/bot${botToken}/sendPhoto`

  if (photoUrl.startsWith("data:")) {
    const formData = new FormData()
    formData.append("chat_id", String(chatId))
    if (caption) formData.append("caption", caption)
    formData.append("parse_mode", "HTML")
    if (replyMarkup) formData.append("reply_markup", JSON.stringify(replyMarkup))

    const base64Match = photoUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (base64Match) {
      const mimeType = base64Match[1]
      const base64Data = base64Match[2]
      const binaryStr = atob(base64Data)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }
      formData.append("photo", new Blob([bytes], { type: mimeType }), "photo.jpg")
    }

    const res = await fetch(url, { method: "POST", body: formData })
    return res.json()
  }

  const body: Record<string, unknown> = {
    chat_id: chatId,
    photo: photoUrl,
    caption,
    parse_mode: "HTML",
  }
  if (replyMarkup) body.reply_markup = replyMarkup
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function sendTelegramVideo(
  botToken: string,
  chatId: number,
  videoUrl: string,
  caption: string,
  replyMarkup?: object,
) {
  const url = `https://api.telegram.org/bot${botToken}/sendVideo`

  if (videoUrl.startsWith("data:")) {
    const formData = new FormData()
    formData.append("chat_id", String(chatId))
    if (caption) formData.append("caption", caption)
    formData.append("parse_mode", "HTML")
    if (replyMarkup) formData.append("reply_markup", JSON.stringify(replyMarkup))

    const base64Match = videoUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (base64Match) {
      const mimeType = base64Match[1]
      const base64Data = base64Match[2]
      const binaryStr = atob(base64Data)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }
      formData.append("video", new Blob([bytes], { type: mimeType }), "video.mp4")
    }

    const res = await fetch(url, { method: "POST", body: formData })
    return res.json()
  }

  const body: Record<string, unknown> = {
    chat_id: chatId,
    video: videoUrl,
    caption,
    parse_mode: "HTML",
  }
  if (replyMarkup) body.reply_markup = replyMarkup
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.json()
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Helpers – send message node (text / photo / video + inline buttons)
// ---------------------------------------------------------------------------

async function sendMessageNode(botToken: string, chatId: number, config: Record<string, unknown>) {
  const text = (config.text as string) || ""
  const mediaType = (config.media_type as string) || ""
  const mediaUrl = (config.media_url as string) || ""
  const buttonsStr = (config.buttons as string) || ""

  let inlineKeyboard: object | undefined
  if (buttonsStr) {
    try {
      inlineKeyboard = buildInlineKeyboard(JSON.parse(buttonsStr) as InlineButton[])
    } catch {
      /* ignore */
    }
  }

  const displayText = text || "Mensagem"
  const hasMedia = !!mediaUrl && !!mediaType

  try {
    if (hasMedia) {
      // Step 1: Send media alone (no caption, no buttons)
      let mediaResult: { ok?: boolean; description?: string } = { ok: false }
      if (mediaType === "photo") {
        mediaResult = await sendTelegramPhoto(botToken, chatId, mediaUrl, "", undefined)
      } else if (mediaType === "video") {
        mediaResult = await sendTelegramVideo(botToken, chatId, mediaUrl, "", undefined)
      }

      // If media failed, just log and continue to text
      if (!mediaResult.ok) {
        console.log("[v0] Media send failed, continuing to text message")
      }

      // Step 2: Send text + buttons as a separate message
      await sendTelegramMessage(botToken, chatId, displayText, inlineKeyboard)
    } else {
      // No media - just send text with buttons
      await sendTelegramMessage(botToken, chatId, displayText, inlineKeyboard)
    }
  } catch {
    // Last resort: plain text
    try {
      await sendTelegramMessage(botToken, chatId, displayText)
    } catch {
      /* give up */
    }
  }
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

async function upsertBotUser(
  botId: string,
  telegramUserId: number,
  chatId: number,
  fromData: Record<string, string>,
) {
  const supabase = getSupabase()

  const { data: existing } = await supabase
    .from("bot_users")
    .select("id")
    .eq("bot_id", botId)
    .eq("telegram_user_id", telegramUserId)
    .limit(1)

  if (existing && existing.length > 0) {
    await supabase
      .from("bot_users")
      .update({
        first_name: fromData.first_name || null,
        last_name: fromData.last_name || null,
        username: fromData.username || null,
        last_activity: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("bot_id", botId)
      .eq("telegram_user_id", telegramUserId)
  } else {
    await supabase.from("bot_users").insert({
      bot_id: botId,
      telegram_user_id: telegramUserId,
      chat_id: chatId,
      first_name: fromData.first_name || null,
      last_name: fromData.last_name || null,
      username: fromData.username || null,
      funnel_step: 1,
      is_subscriber: false,
      last_activity: new Date().toISOString(),
    })
  }
}

async function updateFunnelStep(botId: string, telegramUserId: number, newStep: number) {
  const supabase = getSupabase()
  const { data: users } = await supabase
    .from("bot_users")
    .select("funnel_step")
    .eq("bot_id", botId)
    .eq("telegram_user_id", telegramUserId)
    .limit(1)

  const user = users?.[0]
  if (user && newStep > user.funnel_step) {
    const payload: Record<string, unknown> = {
      funnel_step: newStep,
      updated_at: new Date().toISOString(),
    }
    if (newStep >= 4) {
      payload.is_subscriber = true
      payload.subscription_start = new Date().toISOString()
      payload.subscription_end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      payload.subscription_plan = "Mensal"
    }
    await supabase
      .from("bot_users")
      .update(payload)
      .eq("bot_id", botId)
      .eq("telegram_user_id", telegramUserId)
  }
}

async function fetchNodes(flowId: string): Promise<FlowNode[]> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from("flow_nodes")
    .select("id, type, label, config, position")
    .eq("flow_id", flowId)
    .order("position", { ascending: true })
  return (data as FlowNode[]) || []
}

async function setFlowState(
  botId: string,
  flowId: string,
  telegramUserId: number,
  chatId: number,
  position: number,
  status: string,
) {
  const supabase = getSupabase()

  const { data: existing } = await supabase
    .from("user_flow_state")
    .select("id")
    .eq("bot_id", botId)
    .eq("flow_id", flowId)
    .eq("telegram_user_id", telegramUserId)
    .limit(1)

  if (existing && existing.length > 0) {
    await supabase
      .from("user_flow_state")
      .update({
        current_node_position: position,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing[0].id)
  } else {
    await supabase.from("user_flow_state").insert({
      bot_id: botId,
      flow_id: flowId,
      telegram_user_id: telegramUserId,
      chat_id: chatId,
      current_node_position: position,
      status,
    })
  }
}

async function completeAllStates(botId: string, telegramUserId: number) {
  const supabase = getSupabase()
  const { data: states } = await supabase
    .from("user_flow_state")
    .select("id")
    .eq("bot_id", botId)
    .eq("telegram_user_id", telegramUserId)

  if (states && states.length > 0) {
    for (const s of states) {
      // Mark as "finished" to indicate flow ended (not "completed" which is for explicit ends)
      await supabase
        .from("user_flow_state")
        .update({ status: "finished", updated_at: new Date().toISOString() })
        .eq("id", s.id)
    }
  }
}

// ---------------------------------------------------------------------------
// POST – Telegram webhook entry point
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const botToken = searchParams.get("token")

  if (!botToken) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 })
  }

  let update: Record<string, unknown>
  try {
    update = await req.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  // Handle callback_query (button clicks)
  const callbackQuery = update?.callback_query as Record<string, unknown> | undefined
  if (callbackQuery) {
    const cbFrom = callbackQuery.from as Record<string, unknown>
    const cbMessage = callbackQuery.message as Record<string, unknown>
    const cbData = callbackQuery.data as string
    const cbChatId = (cbMessage?.chat as Record<string, unknown>)?.id as number
    const cbUserId = cbFrom?.id as number

    try {
      await processCallbackQuery({ botToken, chatId: cbChatId, telegramUserId: cbUserId, callbackData: cbData, callbackQueryId: callbackQuery.id as string })
    } catch {
      // Always return 200
    }
    return NextResponse.json({ ok: true })
  }

  const message = update?.message as Record<string, unknown> | undefined
  if (!message) {
    return NextResponse.json({ ok: true })
  }

  const chat = message.chat as Record<string, unknown>
  const from = (message.from as Record<string, string>) || {}
  const chatId = chat.id as number
  const telegramUserId = (from.id as unknown as number) || chatId
  const messageText = ((message.text as string) || "").trim()
  const isStart = messageText === "/start" || messageText.startsWith("/start ")

  try {
    await processWebhook({ botToken, chatId, telegramUserId, messageText, isStart, fromData: from })
  } catch {
    // Always return 200 to Telegram
  }

  return NextResponse.json({ ok: true })
}

// ---------------------------------------------------------------------------
// Core processing
// ---------------------------------------------------------------------------

async function processWebhook({
  botToken,
  chatId,
  telegramUserId,
  messageText,
  isStart,
  fromData,
}: {
  botToken: string
  chatId: number
  telegramUserId: number
  messageText: string
  isStart: boolean
  fromData: Record<string, string>
}) {
  const supabase = getSupabase()

  // 1. Find bot
  const { data: bots, error: botError } = await supabase
    .from("bots")
    .select("id, token, status")
    .eq("token", botToken)
    .limit(1)

  if (botError || !bots?.length) return
  const bot = bots[0]
  if (bot.status !== "active") return

  // 2. Upsert user
  await upsertBotUser(bot.id, telegramUserId, chatId, fromData)

  // 3. Find active flows
  const { data: allFlows, error: flowsError } = await supabase
    .from("flows")
    .select("id, name, category, status")
    .eq("bot_id", bot.id)
    .eq("status", "ativo")
    .order("created_at", { ascending: true })

  if (!allFlows || allFlows.length === 0) return
  const primaryFlow = allFlows[0]

  // 4. Get user states
  const { data: allStates } = await supabase
    .from("user_flow_state")
    .select("*")
    .eq("bot_id", bot.id)
    .eq("telegram_user_id", telegramUserId)
    .order("updated_at", { ascending: false })

  // Find active state - only "in_progress" or "waiting_response" are considered active
  // "completed" and "finished" mean the flow has ended and should NOT restart
  const activeState = allStates?.find(
    (s: Record<string, unknown>) =>
      s.status === "in_progress" || s.status === "waiting_response",
  ) || null

  // ------------------------------------------------------------------
  // /start  –  Reset everything and run the primary flow from scratch
  // ------------------------------------------------------------------
if (isStart) {
  await completeAllStates(bot.id, telegramUserId)
  
  const nodes = await fetchNodes(primaryFlow.id)
  if (nodes.length === 0) return
  
  await setFlowState(bot.id, primaryFlow.id, telegramUserId, chatId, 0, "in_progress")
  await executeNodes(botToken, chatId, nodes, 0, bot.id, primaryFlow.id, telegramUserId)
  return
  }

  // ------------------------------------------------------------------
  // Normal message – only matters if we're waiting for a response
  // ------------------------------------------------------------------
  // If there's no active state, or the flow has completed/finished, or it's in_progress
  // (meaning it's still executing), we should NOT process the message.
  // "finished" = flow ended naturally (no more messages to send)
  // "completed" = flow was explicitly ended (e.g., by "end" action or condition redirect)
  if (!activeState || 
      activeState.status === "completed" || 
      activeState.status === "finished" || 
      activeState.status === "in_progress") {
    return
  }

  if (activeState.status === "waiting_response") {
    const currentFlowId = activeState.flow_id as string
    const currentPosition = activeState.current_node_position as number
    const nodes = await fetchNodes(currentFlowId)

    // Find the condition node we're waiting on
    const conditionNode = nodes.find((n) => n.position === currentPosition)

    if (conditionNode && conditionNode.type === "condition") {
      // Try to match the user's response against the condition branches
      const branchesRaw = (conditionNode.config?.condition_branches as string) || "[]"
      let branches: ConditionBranch[] = []
      try {
        branches = JSON.parse(branchesRaw)
      } catch {
        branches = []
      }

      // Normalize user text for matching (lowercase, trimmed)
      const normalizedResponse = messageText.toLowerCase().trim()

      // Find a matching branch
      const matchedBranch = branches.find((b) => {
        if (!b.label) return false
        return normalizedResponse === b.label.toLowerCase().trim()
      })

      if (matchedBranch && matchedBranch.target_flow_id) {
        // Branch has a target flow -> redirect to that flow
        await setFlowState(bot.id, currentFlowId, telegramUserId, chatId, currentPosition, "completed")

        const targetNodes = await fetchNodes(matchedBranch.target_flow_id)
        if (targetNodes.length === 0) return

        await setFlowState(bot.id, matchedBranch.target_flow_id, telegramUserId, chatId, 0, "in_progress")
        await executeNodes(botToken, chatId, targetNodes, 0, bot.id, matchedBranch.target_flow_id, telegramUserId)
        return
      }

      // No matching branch or no target -> just advance to the next node
      const nextPos = currentPosition + 1
      await setFlowState(bot.id, currentFlowId, telegramUserId, chatId, nextPos, "in_progress")
      await executeNodes(botToken, chatId, nodes, nextPos, bot.id, currentFlowId, telegramUserId)
      return
    }

    // Not a condition node (shouldn't normally happen) – advance anyway
    const nextPos = currentPosition + 1
    await setFlowState(bot.id, currentFlowId, telegramUserId, chatId, nextPos, "in_progress")
    await executeNodes(botToken, chatId, nodes, nextPos, bot.id, currentFlowId, telegramUserId)
  }
}

// ---------------------------------------------------------------------------
// Node execution engine
// ---------------------------------------------------------------------------

async function executeNodes(
  botToken: string,
  chatId: number,
  nodes: FlowNode[],
  startPosition: number,
  botId: string,
  flowId: string,
  telegramUserId: number,
  depth: number = 0,
) {
  // Proteção contra loop infinito (max 5 restarts por execução)
  if (depth > 5) return
  
  const supabase = getSupabase()
  const remaining = nodes.filter((n) => n.position >= startPosition)

  for (const node of remaining) {
    // Update position & refresh lock
    await supabase
      .from("user_flow_state")
      .update({
        current_node_position: node.position,
        status: "in_progress",
        updated_at: new Date().toISOString(),
      })
      .eq("bot_id", botId)
      .eq("flow_id", flowId)
      .eq("telegram_user_id", telegramUserId)

    switch (node.type) {
      // ---------------------------------------------------------------
      case "trigger":
        // No-op, it's just a marker
        break

      // ---------------------------------------------------------------
      case "message": {
        await sendMessageNode(botToken, chatId, node.config || {})
        await updateFunnelStep(botId, telegramUserId, 2)
        break
      }

      // ---------------------------------------------------------------
      case "delay": {
        const seconds = Math.min(parseInt((node.config?.seconds as string) || "5", 10), 55)
        await sleep(seconds * 1000)
        // Refresh lock after sleeping so it doesn't look stale
        await supabase
          .from("user_flow_state")
          .update({ updated_at: new Date().toISOString() })
          .eq("bot_id", botId)
          .eq("flow_id", flowId)
          .eq("telegram_user_id", telegramUserId)
        break
      }

      // ---------------------------------------------------------------
      case "condition": {
        // Send the condition question to the user
        const conditionMessage = (node.config?.condition_message as string) || (node.config?.text as string) || ""
        if (conditionMessage) {
          await sendTelegramMessage(botToken, chatId, conditionMessage)
        }

        // Pause and wait for user response
        await supabase
          .from("user_flow_state")
          .update({
            current_node_position: node.position,
            status: "waiting_response",
            updated_at: new Date().toISOString(),
          })
          .eq("bot_id", botId)
          .eq("flow_id", flowId)
          .eq("telegram_user_id", telegramUserId)

        return // STOP – wait for user reply
      }

      // ---------------------------------------------------------------
      case "payment": {
        const paymentMessage = (node.config?.payment_message as string) || "Escolha seu plano:"
        const paymentButtonsStr = (node.config?.payment_buttons as string) || "[]"
        
        let paymentButtons: { id: string; text: string; amount: string }[] = []
        try {
          paymentButtons = JSON.parse(paymentButtonsStr)
        } catch { /* ignore */ }

        // Filtrar botoes validos (com texto e valor)
        const validButtons = paymentButtons.filter(btn => btn.text?.trim() && btn.amount?.trim())

        // Mostrar botoes de pagamento normalmente
        // O Order Bump sera verificado quando o usuario clicar no botao (no callback)
        if (validButtons.length > 0) {
          // Criar keyboard com os botoes de pagamento configurados
          // IMPORTANTE: callback_data do Telegram tem limite de 64 bytes
          // Formato curto: pay_{amount}_{index} (ex: pay_15.90_0)
          const inlineKeyboard = {
            inline_keyboard: validButtons.map((btn, idx) => [{
              text: btn.text,
              callback_data: `pay_${btn.amount.replace(",", ".")}_${idx}`
            }])
          }
          
          await sendTelegramMessage(botToken, chatId, paymentMessage, inlineKeyboard)
        } else {
          // Fallback: modo antigo para compatibilidade
          const amount = (node.config?.amount as string) || "0"
          const buttonText = (node.config?.button_text as string) || `Pagar R$ ${amount}`
          
          if (amount && amount !== "0") {
            const inlineKeyboard = {
              inline_keyboard: [[{
                text: buttonText,
                callback_data: `pay_${amount.replace(",", ".")}_0`
              }]]
            }
            await sendTelegramMessage(botToken, chatId, paymentMessage, inlineKeyboard)
          } else {
            await sendTelegramMessage(botToken, chatId, paymentMessage)
          }
        }

        // Pausar e aguardar o usuario clicar no botao de pagamento
        // Quando clicar, o callback verifica se ha Order Bump antes de gerar o PIX
        await supabase
          .from("user_flow_state")
          .update({
            current_node_position: node.position,
            status: "waiting_payment",
            updated_at: new Date().toISOString(),
          })
          .eq("bot_id", botId)
          .eq("flow_id", flowId)
          .eq("telegram_user_id", telegramUserId)

        await updateFunnelStep(botId, telegramUserId, 3)
        return // STOP - aguardar callback do botao
      }

      // ---------------------------------------------------------------
      // ACTION – this is where restart / end / goto_flow / add_group live
      // The dashboard saves all of these with type="action" and
      // config.subVariant to distinguish them.
      // ---------------------------------------------------------------
      case "action": {
        const subVariant = (node.config?.subVariant as string) || ""

        switch (subVariant) {
          // -- End the conversation --
          case "end": {
            await setFlowState(botId, flowId, telegramUserId, chatId, node.position, "completed")
            return // STOP
          }

          // -- Go to another flow --
          case "goto_flow": {
            const targetFlowId = (node.config?.target_flow_id as string) || ""
            if (!targetFlowId) break // no target, just continue

            // Complete current flow
            await setFlowState(botId, flowId, telegramUserId, chatId, node.position, "completed")

            // Load & execute target flow
            const targetNodes = await fetchNodes(targetFlowId)
            if (targetNodes.length === 0) return

            await setFlowState(botId, targetFlowId, telegramUserId, chatId, 0, "in_progress")
            await executeNodes(botToken, chatId, targetNodes, 0, botId, targetFlowId, telegramUserId, depth + 1)
            return // STOP
          }

          // -- Add to group (send group link) --
          case "add_group": {
            const groupLink = (node.config?.action_name as string) || ""
            if (groupLink) {
              await sendTelegramMessage(botToken, chatId, groupLink)
            }
            await updateFunnelStep(botId, telegramUserId, 4)
            break
          }

          // -- Generic / unknown action --
          default: {
            const actionText =
              (node.config?.text as string) ||
              (node.config?.action_name as string) ||
              node.label
            if (actionText) {
              await sendTelegramMessage(botToken, chatId, actionText)
            }
            break
          }
        }
        break
      }

      // ---------------------------------------------------------------
      // Fallback for any unknown node type
      // ---------------------------------------------------------------
      default:
        break
    }
  }

  // All nodes executed – mark flow as completed (finished naturally)
  // When a flow ends naturally (no more messages), mark it as "finished" 
  // so it won't restart or loop infinitely
  if (remaining.length > 0) {
    const lastNode = remaining[remaining.length - 1]
    await setFlowState(botId, flowId, telegramUserId, chatId, lastNode.position, "finished")
  } else {
    // No remaining nodes means flow is done - mark as finished
    await setFlowState(botId, flowId, telegramUserId, chatId, startPosition, "finished")
  }
}

// ---------------------------------------------------------------------------
// Process callback query (button clicks)
// ---------------------------------------------------------------------------

async function processCallbackQuery({
  botToken,
  chatId,
  telegramUserId,
  callbackData,
  callbackQueryId,
}: {
  botToken: string
  chatId: number
  telegramUserId: number
  callbackData: string
  callbackQueryId: string
}) {
  const supabase = getSupabase()

  // Answer the callback to remove loading state
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  })

  // Find bot
  const { data: bots } = await supabase
    .from("bots")
    .select("id, user_id, token, status")
    .eq("token", botToken)
    .limit(1)

  if (!bots?.length) return
  const bot = bots[0]

  // ========== ORDER BUMP CALLBACKS ==========
  // Formato: ob_accept_{mainAmount}_{bumpAmount} ou ob_decline_{mainAmount}
  if (callbackData.startsWith("ob_accept_") || callbackData.startsWith("ob_decline_")) {
    await orderBumpLog.info("CALLBACK RECEBIDO - Usuario respondeu ao Order Bump", {
      callback_data: callbackData,
      bot_id: bot.id,
    }, { telegram_user_id: telegramUserId, bot_id: bot.id })

    const isAccept = callbackData.startsWith("ob_accept_")
    const parts = callbackData.replace("ob_accept_", "").replace("ob_decline_", "").split("_")
    
    await orderBumpLog.debug("Parsing do callback", {
      is_accept: isAccept,
      parts: parts,
    }, { telegram_user_id: telegramUserId, bot_id: bot.id })
    
    // Buscar metadata do order bump salvo no estado
    const { data: userState, error: stateError } = await supabase
      .from("user_flow_state")
      .select("metadata, flow_id")
      .eq("bot_id", bot.id)
      .eq("telegram_user_id", telegramUserId)
      .eq("status", "waiting_order_bump")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single()

    await orderBumpLog.debug("Metadata buscado do estado", {
      encontrou_state: !!userState,
      state_error: stateError?.message,
      metadata: userState?.metadata,
      flow_id: userState?.flow_id,
    }, { telegram_user_id: telegramUserId, bot_id: bot.id })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata = userState?.metadata as Record<string, any> | null
    const orderBumpName = metadata?.order_bump_name || "Order Bump"
    const mainDescription = metadata?.main_description || "Produto Principal"
    
    let totalAmount = 0
    let productType: "main_product" | "order_bump" = "main_product"
    let description = mainDescription
    
    if (isAccept) {
      // Aceito: cobrar produto principal + order bump
      const mainAmount = parseFloat(parts[0]) || 0
      const bumpAmount = parseFloat(parts[1]) || 0
      totalAmount = mainAmount + bumpAmount
      productType = "order_bump"
      description = `${mainDescription} + ${orderBumpName}`
      
      await orderBumpLog.info("ORDER BUMP ACEITO pelo usuario", {
        main_amount: mainAmount,
        bump_amount: bumpAmount,
        total_amount: totalAmount,
        description: description,
        product_type: productType,
      }, { telegram_user_id: telegramUserId, bot_id: bot.id })
    } else {
      // Recusado: cobrar apenas produto principal
      totalAmount = parseFloat(parts[0]) || 0
      description = mainDescription
      
      await orderBumpLog.info("ORDER BUMP RECUSADO pelo usuario", {
        total_amount: totalAmount,
        description: description,
        product_type: productType,
      }, { telegram_user_id: telegramUserId, bot_id: bot.id })
    }

    if (totalAmount <= 0) {
      await orderBumpLog.error("ERRO - Valor total invalido", {
        total_amount: totalAmount,
        parts: parts,
      }, { telegram_user_id: telegramUserId, bot_id: bot.id })
      await sendTelegramMessage(botToken, chatId, "Erro ao processar. Tente novamente.")
      return
    }

    await orderBumpLog.info("Gerando pagamento PIX", {
      total_amount: totalAmount,
      description: description,
      product_type: productType,
    }, { telegram_user_id: telegramUserId, bot_id: bot.id })

    // Gerar o pagamento com o valor correto
    await generatePayment(
      supabase, botToken, chatId, telegramUserId, bot,
      totalAmount, description,
      productType
    )
    return
  }

  // ========== UPSELL CALLBACKS ==========
  // Formato: up_accept_{amount}_{upsellIndex} ou up_decline_{upsellIndex}
  if (callbackData.startsWith("up_accept_") || callbackData.startsWith("up_decline_")) {
    const isAccept = callbackData.startsWith("up_accept_")
    
    if (isAccept) {
      const parts = callbackData.replace("up_accept_", "").split("_")
      const amount = parseFloat(parts[0]) || 0
      const upsellIndex = parseInt(parts[1]) || 0

      if (amount <= 0) {
        await sendTelegramMessage(botToken, chatId, "Erro ao processar. Tente novamente.")
        return
      }

      // Gerar pagamento do upsell
      await generatePayment(
        supabase, botToken, chatId, telegramUserId, bot,
        amount, `Upsell ${upsellIndex + 1}`,
        "upsell"
      )
    } else {
      // Upsell recusado - verificar se tem downsell
      const upsellIndex = parseInt(callbackData.replace("up_decline_", "")) || 0
      
      // Buscar o estado atual e o nó de pagamento para pegar as configurações de downsell
      const { data: state } = await supabase
        .from("user_flow_state")
        .select("flow_id, current_node_position")
        .eq("bot_id", bot.id)
        .eq("telegram_user_id", telegramUserId)
        .in("status", ["waiting_upsell", "in_progress"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .single()

      if (state) {
        const nodes = await fetchNodes(state.flow_id)
        const paymentNode = nodes.find(n => n.type === "payment")
        
        if (paymentNode) {
          let downsells: { enabled: boolean; description: string; buttons: { text: string; amount: string }[]; media_url?: string; media_type?: string }[] = []
          try {
            const downsellsStr = paymentNode.config?.downsells as string
            if (downsellsStr) downsells = JSON.parse(downsellsStr)
          } catch { /* ignore */ }

          const downsell = downsells[upsellIndex]
          if (downsell?.enabled && downsell.buttons?.length > 0) {
            // Enviar downsell
            await sendDownsellOffer(botToken, chatId, downsell, upsellIndex)
            
            // Atualizar estado para aguardar decisão do downsell
            await supabase
              .from("user_flow_state")
              .update({
                status: "waiting_downsell",
                updated_at: new Date().toISOString(),
              })
              .eq("bot_id", bot.id)
              .eq("telegram_user_id", telegramUserId)
            return
          }
        }

        // Sem downsell - continuar para próximo upsell ou encerrar ofertas
        await checkNextUpsell(supabase, botToken, chatId, telegramUserId, bot, state.flow_id, upsellIndex + 1)
      }
    }
    return
  }

  // ========== DOWNSELL CALLBACKS (NOVO FORMATO) ==========
  // Formato: ds_sequenceId_planId_price
  if (callbackData.startsWith("ds_") && !callbackData.startsWith("ds_test_")) {
    console.log("[v0] Downsell Callback (ds_) recebido:", callbackData)
    
    // Confirmar recebimento do callback
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: "Gerando pagamento..."
      })
    })
    
    // Parsear: ds_sequenceId_planId_price
    const parts = callbackData.replace("ds_", "").split("_")
    const price = parseFloat(parts[2]) || 0
    
    if (price > 0) {
      // Usar a funcao generatePayment que ja existe
      await generatePayment(
        supabase, botToken, chatId, telegramUserId, bot,
        price, "Oferta Especial - Downsell",
        "downsell"
      )
    } else {
      await sendTelegramMessage(botToken, chatId, "Erro: Preco invalido.")
    }
    return
  }

  // ========== DOWNSELL CALLBACKS (FORMATO ANTIGO) ==========
  // Formato: down_accept_{amount}_{downsellIndex} ou down_decline_{downsellIndex}
  if (callbackData.startsWith("down_accept_") || callbackData.startsWith("down_decline_")) {
    const isAccept = callbackData.startsWith("down_accept_")
    const parts = callbackData.replace("down_accept_", "").replace("down_decline_", "").split("_")
    const downsellIndex = isAccept ? parseInt(parts[1]) || 0 : parseInt(parts[0]) || 0

    if (isAccept) {
      const amount = parseFloat(parts[0]) || 0
      
      if (amount <= 0) {
        await sendTelegramMessage(botToken, chatId, "Erro ao processar. Tente novamente.")
        return
      }

      // Gerar pagamento do downsell
      await generatePayment(
        supabase, botToken, chatId, telegramUserId, bot,
        amount, `Downsell ${downsellIndex + 1}`,
        "downsell"
      )
    } else {
      // Downsell recusado - verificar próximo upsell
      const { data: state } = await supabase
        .from("user_flow_state")
        .select("flow_id")
        .eq("bot_id", bot.id)
        .eq("telegram_user_id", telegramUserId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single()

      if (state) {
        await checkNextUpsell(supabase, botToken, chatId, telegramUserId, bot, state.flow_id, downsellIndex + 1)
      }
    }
    return
  }

  // ========== PAYMENT CALLBACKS (ORIGINAL) ==========
  // Formatos suportados:
  // - pay_{amount}_{index} (novo formato curto)
  // - pay_plan_{planId} (planos do bot - legado)
  // - pay_custom_{amount}_{nodeId} (personalizado - legado)
  // - pay_btn_{amount}_{buttonId}_{nodeId} (formato anterior - legado)
  const isPaymentCallback = callbackData.startsWith("pay_")
  
  if (isPaymentCallback) {
    let amount = 0
    let description = "Pagamento"
    let planId: string | null = null

    if (callbackData.startsWith("pay_plan_")) {
      planId = callbackData.replace("pay_plan_", "")
      const { data: plan } = await supabase
        .from("payment_plans")
        .select("id, name, price")
        .eq("id", planId)
        .single()

      if (plan) {
        amount = plan.price
        description = plan.name
      }
    } else if (callbackData.startsWith("pay_btn_")) {
      const parts = callbackData.replace("pay_btn_", "").split("_")
      amount = parseFloat(parts[0]) || 0
    } else if (callbackData.startsWith("pay_custom_")) {
      const parts = callbackData.replace("pay_custom_", "").split("_")
      amount = parseFloat(parts[0]) || 0
    } else {
      const parts = callbackData.replace("pay_", "").split("_")
      amount = parseFloat(parts[0]) || 0
    }

    if (amount <= 0) {
      await sendTelegramMessage(botToken, chatId, "Erro ao processar pagamento. Tente novamente.")
      return
    }

    // ========== VERIFICAR ORDER BUMP ANTES DE GERAR PAGAMENTO ==========
    await orderBumpLog.info("INICIO - Verificando Order Bump antes de gerar pagamento", {
      callback_data: callbackData,
      amount,
      description,
      bot_id: bot.id,
    }, { telegram_user_id: telegramUserId, bot_id: bot.id })

    // Primeiro tentar buscar o estado do usuario
    const { data: state, error: stateError } = await supabase
      .from("user_flow_state")
      .select("flow_id, current_node_position, status")
      .eq("bot_id", bot.id)
      .eq("telegram_user_id", telegramUserId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single()

    await orderBumpLog.debug("Estado do usuario buscado", {
      encontrou_estado: !!state,
      state_flow_id: state?.flow_id,
      state_status: state?.status,
      state_error: stateError?.message,
    }, { telegram_user_id: telegramUserId, bot_id: bot.id })

    // Se nao tiver estado, buscar o fluxo diretamente pelo bot_id ou pela tabela flow_bots
    let flowId = state?.flow_id
    if (!flowId) {
      await orderBumpLog.warn("Estado nao encontrado, buscando fluxo pelo bot_id", {
        bot_id: bot.id,
      }, { telegram_user_id: telegramUserId, bot_id: bot.id })

      // Primeiro tenta buscar pelo bot_id direto na tabela flows
      const { data: flowByBot, error: flowByBotError } = await supabase
        .from("flows")
        .select("id, name, config")
        .eq("bot_id", bot.id)
        .limit(1)
        .single()
      
      flowId = flowByBot?.id
      
      await orderBumpLog.debug("Fluxo buscado pelo bot_id direto", {
        encontrou_fluxo: !!flowByBot,
        flow_id: flowByBot?.id,
        flow_name: flowByBot?.name,
        flow_error: flowByBotError?.message,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        flow_config_keys: flowByBot?.config ? Object.keys(flowByBot.config as Record<string, any>) : [],
      }, { telegram_user_id: telegramUserId, bot_id: bot.id })

      // Se nao encontrou, tenta buscar pela tabela flow_bots (vinculo indireto)
      if (!flowId) {
        await orderBumpLog.info("Buscando fluxo pela tabela flow_bots", {
          bot_id: bot.id,
        }, { telegram_user_id: telegramUserId, bot_id: bot.id })

        const { data: flowBotLink, error: flowBotLinkError } = await supabase
          .from("flow_bots")
          .select("flow_id, flow:flows(id, name, config)")
          .eq("bot_id", bot.id)
          .limit(1)
          .single()

        await orderBumpLog.debug("Resultado da busca em flow_bots", {
          encontrou_link: !!flowBotLink,
          flow_bot_link: flowBotLink,
          link_error: flowBotLinkError?.message,
        }, { telegram_user_id: telegramUserId, bot_id: bot.id })

        if (flowBotLink) {
          flowId = flowBotLink.flow_id
          await orderBumpLog.info("Fluxo encontrado via flow_bots!", {
            flow_id: flowId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            flow_name: (flowBotLink.flow as any)?.name,
          }, { telegram_user_id: telegramUserId, bot_id: bot.id })
        }
      }
    }

    if (!flowId) {
      await orderBumpLog.error("ERRO CRITICO - Nenhum fluxo encontrado para o bot (nem direto nem via flow_bots)", {
        bot_id: bot.id,
        state: state,
      }, { telegram_user_id: telegramUserId, bot_id: bot.id })
    }

    if (flowId) {
      // Buscar a config do fluxo
      const { data: flowData, error: flowDataError } = await supabase
        .from("flows")
        .select("id, name, config")
        .eq("id", flowId)
        .single()

      await orderBumpLog.debug("Config do fluxo carregada", {
        flow_id: flowId,
        flow_name: flowData?.name,
        flow_error: flowDataError?.message,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config_keys: flowData?.config ? Object.keys(flowData.config as Record<string, any>) : [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        has_order_bump_key: flowData?.config ? "orderBump" in (flowData.config as Record<string, any>) : false,
      }, { telegram_user_id: telegramUserId, bot_id: bot.id, flow_id: flowId })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const flowConfig = flowData?.config as Record<string, any> | null
      const orderBumpConfig = flowConfig?.orderBump
      const orderBumpInicial = orderBumpConfig?.inicial

      await orderBumpLog.info("Verificando config do Order Bump", {
        has_flow_config: !!flowConfig,
        has_order_bump_config: !!orderBumpConfig,
        has_order_bump_inicial: !!orderBumpInicial,
        order_bump_enabled: orderBumpInicial?.enabled,
        order_bump_price: orderBumpInicial?.price,
        order_bump_name: orderBumpInicial?.name,
        order_bump_description: orderBumpInicial?.description,
        full_order_bump_config: orderBumpConfig,
      }, { telegram_user_id: telegramUserId, bot_id: bot.id, flow_id: flowId })

      // Verificar se o Order Bump Inicial esta habilitado
      if (orderBumpInicial?.enabled && orderBumpInicial?.price > 0) {
        await orderBumpLog.info("ORDER BUMP ATIVADO - Enviando oferta ao usuario", {
          main_amount: amount,
          bump_amount: orderBumpInicial.price,
          bump_name: orderBumpInicial.name,
        }, { telegram_user_id: telegramUserId, bot_id: bot.id, flow_id: flowId })

        const orderBumpDesc = orderBumpInicial.description || `Deseja adicionar ${orderBumpInicial.name || "este bonus"} por apenas R$ ${orderBumpInicial.price}?`
        const orderBumpAmount = orderBumpInicial.price
        const orderBumpAcceptText = orderBumpInicial.acceptText || "ADICIONAR"
        const orderBumpDeclineText = orderBumpInicial.rejectText || "NAO QUERO"
        const orderBumpName = orderBumpInicial.name || "Order Bump"

        // Formato: ob_accept_{mainAmount}_{bumpAmount}_{bumpName} ou ob_decline_{mainAmount}
        const mainAmount = String(amount)
        const bumpAmount = String(orderBumpAmount)
        
        const orderBumpKeyboard = {
          inline_keyboard: [
            [{ text: orderBumpAcceptText, callback_data: `ob_accept_${mainAmount}_${bumpAmount}` }],
            [{ text: orderBumpDeclineText, callback_data: `ob_decline_${mainAmount}` }]
          ]
        }

        await orderBumpLog.debug("Enviando mensagem do Order Bump", {
          message: orderBumpDesc,
          keyboard: orderBumpKeyboard,
        }, { telegram_user_id: telegramUserId, bot_id: bot.id, flow_id: flowId })

        const sendResult = await sendTelegramMessage(botToken, chatId, orderBumpDesc, orderBumpKeyboard)
        
        await orderBumpLog.info("Resultado do envio da mensagem Order Bump", {
          telegram_response: sendResult,
        }, { telegram_user_id: telegramUserId, bot_id: bot.id, flow_id: flowId })

        // Atualizar ou criar estado para aguardar decisao do Order Bump
        // Salvar informacoes do order bump no estado
        if (state) {
          const { error: updateError } = await supabase
            .from("user_flow_state")
            .update({
              status: "waiting_order_bump",
              updated_at: new Date().toISOString(),
              metadata: {
                order_bump_name: orderBumpName,
                order_bump_price: orderBumpAmount,
                main_amount: amount,
                main_description: description
              }
            })
            .eq("bot_id", bot.id)
            .eq("telegram_user_id", telegramUserId)

          await orderBumpLog.debug("Estado atualizado para waiting_order_bump", {
            update_error: updateError?.message,
          }, { telegram_user_id: telegramUserId, bot_id: bot.id, flow_id: flowId })
        } else {
          // Criar novo estado se nao existir
          const { error: insertError } = await supabase
            .from("user_flow_state")
            .insert({
              bot_id: bot.id,
              telegram_user_id: telegramUserId,
              flow_id: flowId,
              status: "waiting_order_bump",
              current_node_position: 0,
              metadata: {
                order_bump_name: orderBumpName,
                order_bump_price: orderBumpAmount,
                main_amount: amount,
                main_description: description
              }
            })

          await orderBumpLog.debug("Novo estado criado para waiting_order_bump", {
            insert_error: insertError?.message,
          }, { telegram_user_id: telegramUserId, bot_id: bot.id, flow_id: flowId })
        }

        await orderBumpLog.info("ORDER BUMP - Aguardando decisao do usuario", {
          accept_callback: `ob_accept_${mainAmount}_${bumpAmount}`,
          decline_callback: `ob_decline_${mainAmount}`,
        }, { telegram_user_id: telegramUserId, bot_id: bot.id, flow_id: flowId })

        return // STOP - aguardar decisao do Order Bump
      } else {
        await orderBumpLog.warn("Order Bump NAO esta ativado ou preco invalido", {
          enabled: orderBumpInicial?.enabled,
          price: orderBumpInicial?.price,
          reason: !orderBumpInicial ? "orderBump.inicial nao existe" : 
                  !orderBumpInicial.enabled ? "enabled = false" :
                  orderBumpInicial.price <= 0 ? "price <= 0" : "desconhecido",
        }, { telegram_user_id: telegramUserId, bot_id: bot.id, flow_id: flowId })
      }
    }

    // Sem Order Bump - gerar pagamento diretamente
    await orderBumpLog.info("Order Bump NAO ativado - gerando pagamento diretamente", {
      amount,
      description,
    }, { telegram_user_id: telegramUserId, bot_id: bot.id })
    await generatePayment(
      supabase, botToken, chatId, telegramUserId, bot,
      amount, description, "main_product"
    )
  }
}

// ---------------------------------------------------------------------------
// Helper: Generate PIX payment
// ---------------------------------------------------------------------------

async function generatePayment(
  supabase: ReturnType<typeof getSupabase>,
  botToken: string,
  chatId: number,
  telegramUserId: number,
  bot: { id: string; user_id: string },
  amount: number,
  description: string,
  productType: "main_product" | "order_bump" | "upsell" | "downsell"
) {
  // Get Telegram user data from bot_users table
  const { data: botUser } = await supabase
    .from("bot_users")
    .select("first_name, last_name, username")
    .eq("bot_id", bot.id)
    .eq("telegram_user_id", telegramUserId)
    .single()

  const telegramUserName = botUser 
    ? [botUser.first_name, botUser.last_name].filter(Boolean).join(" ") || "Usuario"
    : "Usuario"
  const telegramUsername = botUser?.username || null

  // Get user's gateway (Mercado Pago)
  let gateway = null
  
  const { data: botGateway } = await supabase
    .from("user_gateways")
    .select("id, access_token, is_active, bot_id, gateway_name")
    .eq("user_id", bot.user_id)
    .eq("bot_id", bot.id)
    .eq("gateway_name", "mercadopago")
    .eq("is_active", true)
    .single()
  
  if (botGateway?.access_token) {
    gateway = botGateway
  } else {
    const { data: anyGateway } = await supabase
      .from("user_gateways")
      .select("id, access_token, is_active, bot_id, gateway_name")
      .eq("user_id", bot.user_id)
      .eq("gateway_name", "mercadopago")
      .eq("is_active", true)
      .limit(1)
      .single()
    
    gateway = anyGateway
  }

  if (!gateway?.access_token) {
    await sendTelegramMessage(botToken, chatId, "Gateway de pagamento nao configurado. Entre em contato com o suporte.")
    return
  }

  try {
    await sendTelegramMessage(botToken, chatId, "Gerando seu pagamento PIX... Aguarde.")

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${gateway.access_token}`,
        "X-Idempotency-Key": `${telegramUserId}-${Date.now()}`,
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: description,
        payment_method_id: "pix",
        payer: {
          email: `telegram_${telegramUserId}@temp.com`,
        },
      }),
    })

    const mpData = await mpResponse.json()

    if (mpData.id && mpData.point_of_interaction?.transaction_data) {
      const pixData = mpData.point_of_interaction.transaction_data
      const qrCodeBase64 = pixData.qr_code_base64
      const pixCopyPaste = pixData.qr_code

      // Save payment to database with all user data
      const { data: insertedPayment, error: insertError } = await supabase.from("payments").insert({
        user_id: bot.user_id,
        bot_id: bot.id,
        telegram_user_id: String(telegramUserId),
        telegram_user_name: telegramUserName,
        telegram_username: telegramUsername,
        gateway: "mercadopago",
        external_payment_id: String(mpData.id),
        amount: amount,
        description: description,
        product_name: description,
        product_type: productType,
        payment_method: "pix",
        qr_code: qrCodeBase64 || null,
        copy_paste: pixCopyPaste || null,
        status: "pending",
      }).select().single()

      // Send QR Code image
      if (qrCodeBase64) {
        const photoUrl = `data:image/png;base64,${qrCodeBase64}`
        await sendTelegramPhoto(botToken, chatId, photoUrl, "", undefined)
      }

      // Send PIX copy-paste
      const pixMessage = `<b>PIX Copia e Cola:</b>\n\n<code>${pixCopyPaste}</code>\n\n<b>Valor:</b> R$ ${amount.toFixed(2).replace(".", ",")}\n<b>Descricao:</b> ${description}\n\nCopie o codigo acima e pague no seu banco.`
      await sendTelegramMessage(botToken, chatId, pixMessage)

      // Update funnel step
      await updateFunnelStep(bot.id, telegramUserId, 4)

      // Update state based on product type
      const newStatus = productType === "main_product" || productType === "order_bump" 
        ? "waiting_payment_approval" 
        : "in_progress"

      const { data: state } = await supabase
        .from("user_flow_state")
        .select("id, flow_id, current_node_position")
        .eq("bot_id", bot.id)
        .eq("telegram_user_id", telegramUserId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single()

      if (state) {
        await supabase
          .from("user_flow_state")
          .update({
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", state.id)

        // For main product/order bump, continue flow after payment generation
        if (productType === "main_product" || productType === "order_bump") {
          const nodes = await fetchNodes(state.flow_id)
          const nextPos = state.current_node_position + 1
          await setFlowState(bot.id, state.flow_id, telegramUserId, chatId, nextPos, "in_progress")
          await executeNodes(botToken, chatId, nodes, nextPos, bot.id, state.flow_id, telegramUserId)
        }
      }
    } else {
      console.error("[v0] Mercado Pago error:", mpData)
      await sendTelegramMessage(botToken, chatId, "Erro ao gerar PIX. Tente novamente mais tarde.")
    }
  } catch (error) {
    console.error("[v0] Payment generation error:", error)
    await sendTelegramMessage(botToken, chatId, "Erro ao processar pagamento. Tente novamente.")
  }
}

// ---------------------------------------------------------------------------
// Helper: Send Upsell Offer
// ---------------------------------------------------------------------------

async function sendUpsellOffer(
  botToken: string,
  chatId: number,
  upsell: { description: string; buttons: { text: string; amount: string }[]; media_url?: string; media_type?: string; delay_seconds?: string },
  upsellIndex: number
) {
  // Delay opcional antes de enviar
  const delaySeconds = parseInt(upsell.delay_seconds || "0")
  if (delaySeconds > 0 && delaySeconds <= 30) {
    await sleep(delaySeconds * 1000)
  }

  // Enviar mídia se configurada
  if (upsell.media_url) {
    if (upsell.media_type === "video") {
      await sendTelegramVideo(botToken, chatId, upsell.media_url, "", undefined)
    } else if (upsell.media_type === "photo") {
      await sendTelegramPhoto(botToken, chatId, upsell.media_url, "", undefined)
    }
  }

  // Montar botões do upsell
  const validButtons = upsell.buttons?.filter(b => b.text?.trim() && b.amount?.trim()) || []
  
  if (validButtons.length > 0) {
    const amount = validButtons[0].amount.replace(",", ".")
    const inlineKeyboard = {
      inline_keyboard: [
        [{ text: validButtons[0].text, callback_data: `up_accept_${amount}_${upsellIndex}` }],
        [{ text: "Nao, obrigado", callback_data: `up_decline_${upsellIndex}` }]
      ]
    }

    const message = upsell.description || "Aproveite esta oferta especial!"
    await sendTelegramMessage(botToken, chatId, message, inlineKeyboard)
  }
}

// ---------------------------------------------------------------------------
// Helper: Send Downsell Offer
// ---------------------------------------------------------------------------

async function sendDownsellOffer(
  botToken: string,
  chatId: number,
  downsell: { description: string; buttons: { text: string; amount: string }[]; media_url?: string; media_type?: string; delay_seconds?: string },
  downsellIndex: number
) {
  // Delay opcional antes de enviar
  const delaySeconds = parseInt(downsell.delay_seconds || "0")
  if (delaySeconds > 0 && delaySeconds <= 30) {
    await sleep(delaySeconds * 1000)
  }

  // Enviar mídia se configurada
  if (downsell.media_url) {
    if (downsell.media_type === "video") {
      await sendTelegramVideo(botToken, chatId, downsell.media_url, "", undefined)
    } else if (downsell.media_type === "photo") {
      await sendTelegramPhoto(botToken, chatId, downsell.media_url, "", undefined)
    }
  }

  // Montar botões do downsell
  const validButtons = downsell.buttons?.filter(b => b.text?.trim() && b.amount?.trim()) || []
  
  if (validButtons.length > 0) {
    const amount = validButtons[0].amount.replace(",", ".")
    const inlineKeyboard = {
      inline_keyboard: [
        [{ text: validButtons[0].text, callback_data: `down_accept_${amount}_${downsellIndex}` }]
      ]
    }

    const message = downsell.description || "Ultima chance! Oferta especial para voce:"
    await sendTelegramMessage(botToken, chatId, message, inlineKeyboard)
  }
}

// ---------------------------------------------------------------------------
// Helper: Check for next upsell or finish offers
// ---------------------------------------------------------------------------

async function checkNextUpsell(
  supabase: ReturnType<typeof getSupabase>,
  botToken: string,
  chatId: number,
  telegramUserId: number,
  bot: { id: string; user_id: string },
  flowId: string,
  nextUpsellIndex: number
) {
  const nodes = await fetchNodes(flowId)
  const paymentNode = nodes.find(n => n.type === "payment")
  
  if (!paymentNode) {
    await sendTelegramMessage(botToken, chatId, "Obrigado! Seu fluxo de ofertas foi concluido.")
    return
  }

  let upsells: { enabled: boolean; description: string; buttons: { text: string; amount: string }[]; media_url?: string; media_type?: string; delay_seconds?: string }[] = []
  try {
    const upsellsStr = paymentNode.config?.upsells as string
    if (upsellsStr) upsells = JSON.parse(upsellsStr)
  } catch { /* ignore */ }

  // Procurar próximo upsell habilitado
  for (let i = nextUpsellIndex; i < upsells.length; i++) {
    if (upsells[i]?.enabled && upsells[i].buttons?.length > 0) {
      await sendUpsellOffer(botToken, chatId, upsells[i], i)
      
      // Atualizar estado para aguardar decisão do upsell
      await supabase
        .from("user_flow_state")
        .update({
          status: "waiting_upsell",
          updated_at: new Date().toISOString(),
        })
        .eq("bot_id", bot.id)
        .eq("telegram_user_id", telegramUserId)
      return
    }
  }

  // Nenhum upsell restante - encerrar fluxo de ofertas
  await sendTelegramMessage(botToken, chatId, "Obrigado pelo seu interesse!")
  
  // Continuar fluxo normal após ofertas
  const { data: state } = await supabase
    .from("user_flow_state")
    .select("current_node_position")
    .eq("bot_id", bot.id)
    .eq("flow_id", flowId)
    .eq("telegram_user_id", telegramUserId)
    .single()

  if (state) {
    const nextPos = state.current_node_position + 1
    await setFlowState(bot.id, flowId, telegramUserId, chatId, nextPos, "in_progress")
    await executeNodes(botToken, chatId, nodes, nextPos, bot.id, flowId, telegramUserId)
  }
}

// ---------------------------------------------------------------------------
// GET – health check
// ---------------------------------------------------------------------------

export async function GET() {
  return NextResponse.json({ status: "Telegram webhook is active" })
}

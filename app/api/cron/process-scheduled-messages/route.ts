import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
import { 
  sendTelegramMessageSafe, 
  sendTelegramPhotoSafe, 
  sendTelegramVideoSafe, 
  sendTelegramMediaGroupSafe 
} from "@/lib/telegram-utils"

// Wrappers para manter compatibilidade com o codigo existente
async function sendTelegramMessage(
  botToken: string,
  chatId: number | string,
  text: string,
  replyMarkup?: unknown
) {
  const result = await sendTelegramMessageSafe(botToken, chatId, text, replyMarkup as object)
  return { ok: result.ok, description: result.error, result: { message_id: result.messageId } }
}

async function sendTelegramPhoto(
  botToken: string,
  chatId: number | string,
  photoUrl: string,
  caption?: string,
  replyMarkup?: unknown
) {
  const result = await sendTelegramPhotoSafe(botToken, chatId, photoUrl, caption, replyMarkup as object)
  return { ok: result.ok, description: result.error, result: { message_id: result.messageId } }
}

async function sendTelegramVideo(
  botToken: string,
  chatId: number | string,
  videoUrl: string,
  caption?: string,
  replyMarkup?: unknown
) {
  const result = await sendTelegramVideoSafe(botToken, chatId, videoUrl, caption, replyMarkup as object)
  return { ok: result.ok, description: result.error, result: { message_id: result.messageId } }
}

async function sendTelegramMediaGroup(
  botToken: string,
  chatId: number | string,
  medias: string[],
  caption?: string
) {
  console.log(`[CRON] Enviando sendMediaGroup com ${medias.length} midias`)
  const result = await sendTelegramMediaGroupSafe(botToken, chatId, medias, caption)
  return { ok: result.ok, description: result.error }
}

export async function GET(request: NextRequest) {
  console.log("[CRON] Iniciando processamento de mensagens agendadas")
  
  // Autorizacao opcional - se CRON_SECRET estiver definido, verifica
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  
  // Apenas verifica se CRON_SECRET estiver definido E nao for vazio
  if (cronSecret && cronSecret.length > 0 && authHeader !== `Bearer ${cronSecret}`) {
    console.log("[CRON] Unauthorized - CRON_SECRET mismatch")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  // Criar cliente Supabase dentro da funcao (lazy initialization)
  let supabaseAdmin
  try {
    supabaseAdmin = getSupabaseAdmin()
    console.log("[CRON] Supabase client criado com sucesso")
  } catch (e) {
    console.error("[CRON] Erro ao criar Supabase client:", e)
    return NextResponse.json({ error: "Failed to create Supabase client", details: String(e) }, { status: 500 })
  }
  
  try {
    const now = new Date().toISOString()
    console.log("[CRON] Data atual:", now)
    
    // Buscar mensagens pendentes que devem ser enviadas agora
    const { data: pendingMessages, error } = await supabaseAdmin
      .from("scheduled_messages")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", now)
      .limit(50) // Processar em lotes
    
    if (error) {
      console.error("[CRON] Erro ao buscar mensagens agendadas:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    console.log("[CRON] Mensagens pendentes encontradas:", pendingMessages?.length || 0)
    
    if (!pendingMessages || pendingMessages.length === 0) {
      return NextResponse.json({ processed: 0, message: "Nenhuma mensagem pendente" })
    }
    
    let processed = 0
    let failed = 0
    
    for (const msg of pendingMessages) {
      try {
        const metadata = msg.metadata as {
          message?: string
          medias?: string[]
          plans?: Array<{ id: string; buttonText: string; price: number }>
          botToken?: string
          deliveryType?: string
          deliverableId?: string
          customDelivery?: string
        } | null
        
        if (!metadata?.botToken) {
          // Se nao tem token, buscar do bot
          const { data: bot } = await supabaseAdmin
            .from("bots")
            .select("token")
            .eq("id", msg.bot_id)
            .single()
          
          if (!bot?.token) {
            throw new Error("Bot token not found")
          }
          metadata!.botToken = bot.token
        }
        
        const botToken = metadata!.botToken
        const chatId = msg.telegram_chat_id
        const medias = metadata?.medias || []
        const plans = metadata?.plans || []
        
        // Extrair dados do usuario do metadata para substituir variaveis {NOME} e {USERNAME}
        const userFirstName = (metadata as Record<string, unknown>)?.userFirstName as string || ""
        const userUsername = (metadata as Record<string, unknown>)?.userUsername as string || ""
        
        // Funcao para substituir variaveis {NOME} e {USERNAME} na mensagem
        const replaceVars = (text: string) => {
          if (!text) return ""
          return text
            .replace(/\{nome\}/gi, userFirstName || "")
            .replace(/\{username\}/gi, userUsername ? `@${userUsername}` : "")
        }
        
        // Aplicar substituicao de variaveis na mensagem
        const message = replaceVars(metadata?.message || "")
        
        console.log(`[CRON] ========== PROCESSANDO MENSAGEM ==========`)
        console.log(`[CRON] ID: ${msg.id} - tipo: ${msg.message_type}`)
        console.log(`[CRON] telegram_chat_id: ${msg.telegram_chat_id}`)
        console.log(`[CRON] bot_id: ${msg.bot_id}`)
        console.log(`[CRON] Metadata recebido:`, JSON.stringify(metadata))
        console.log(`[CRON] Planos encontrados: ${plans.length}`, JSON.stringify(plans))
        
        // Logica diferente para DOWNSELL vs UPSELL
        const messageType = msg.message_type || "downsell"
        
        if (messageType === "downsell") {
          // DOWNSELL: Verificar se o usuario ja pagou (cancelar se ja pagou)
          // Verificacoes em ordem de prioridade:
          
          // 1. Verificar status no user_flow_state (com flow_id se disponivel)
          let userStateQuery = supabaseAdmin
            .from("user_flow_state")
            .select("status, flow_id")
            .eq("bot_id", msg.bot_id)
            .eq("telegram_user_id", msg.telegram_user_id)
          
          // Se msg tem flow_id, filtrar por ele
          if (msg.flow_id) {
            userStateQuery = userStateQuery.eq("flow_id", msg.flow_id)
          }
          
          const { data: userState } = await userStateQuery.maybeSingle()
          
          if (userState?.status === "paid" || userState?.status === "completed") {
            // Usuario ja pagou, cancelar downsell
            console.log(`[CRON] User ${msg.telegram_user_id} already paid (user_flow_state status=${userState.status}), cancelling downsell ${msg.id}`)
            await supabaseAdmin
              .from("scheduled_messages")
              .update({ status: "cancelled" })
              .eq("id", msg.id)
            continue
          }
          
          // 2. Verificar se existe pagamento aprovado na tabela payments
          // Verificar pagamentos do MESMO FLUXO OU sem flow_id (para compatibilidade)
          let paymentsQuery = supabaseAdmin
            .from("payments")
            .select("id, status, created_at, flow_id")
            .eq("bot_id", msg.bot_id)
            .eq("telegram_user_id", msg.telegram_user_id)
            .eq("status", "approved")
            .in("product_type", ["main_product", "plan", "pack"])
          
          // Se msg tem flow_id, verificar pagamentos desse fluxo
          if (msg.flow_id) {
            paymentsQuery = paymentsQuery.eq("flow_id", msg.flow_id)
          }
          
          const { data: approvedPayments } = await paymentsQuery.limit(5)
          
          // Verificar se algum pagamento aprovado foi feito APOS o agendamento do downsell
          const msgCreatedAt = new Date(msg.created_at).getTime()
          const hasRecentPayment = approvedPayments?.some(p => {
            const paymentTime = new Date(p.created_at).getTime()
            return paymentTime >= msgCreatedAt
          })
          
          if (hasRecentPayment) {
            // Usuario ja tem pagamento aprovado, cancelar downsell
            console.log(`[CRON] User ${msg.telegram_user_id} has approved payment after downsell was scheduled, cancelling downsell ${msg.id}`)
            await supabaseAdmin
              .from("scheduled_messages")
              .update({ status: "cancelled" })
              .eq("id", msg.id)
            continue
          }
          
          // 3. Verificar se existe QUALQUER pagamento aprovado recente (ultimos 30 min) para este usuario/bot
          // Isso pega casos onde flow_id nao foi salvo no pagamento
          const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
          const { data: recentAnyPayment } = await supabaseAdmin
            .from("payments")
            .select("id")
            .eq("bot_id", msg.bot_id)
            .eq("telegram_user_id", msg.telegram_user_id)
            .eq("status", "approved")
            .in("product_type", ["main_product", "plan", "pack"])
            .gte("created_at", thirtyMinutesAgo)
            .limit(1)
            .maybeSingle()
          
          if (recentAnyPayment) {
            console.log(`[CRON] User ${msg.telegram_user_id} has recent approved payment (last 30min), cancelling downsell ${msg.id}`)
            await supabaseAdmin
              .from("scheduled_messages")
              .update({ status: "cancelled" })
              .eq("id", msg.id)
            continue
          }
        } else if (messageType === "upsell") {
          // UPSELL: Verificar se o usuario ja comprou ESTE upsell especifico ou recusou
          // Verificar se ja comprou algum upsell apos o agendamento
          const { data: upsellPayment } = await supabaseAdmin
            .from("payments")
            .select("id, status")
            .eq("bot_id", msg.bot_id)
            .eq("telegram_user_id", msg.telegram_user_id)
            .eq("flow_id", msg.flow_id)
            .eq("status", "approved")
            .eq("product_type", "upsell")
            .gte("created_at", msg.created_at)
            .limit(1)
            .maybeSingle()
          
          if (upsellPayment) {
            // Usuario ja comprou um upsell, cancelar demais
            console.log(`[CRON] User ${msg.telegram_user_id} already bought upsell, cancelling remaining`)
            await supabaseAdmin
              .from("scheduled_messages")
              .update({ status: "cancelled" })
              .eq("id", msg.id)
            continue
          }
        }
        
  // Montar botoes dos planos - mesma estrutura para DOWNSELL e UPSELL
  const planButtons: Array<Array<{ text: string; callback_data: string }>> = []
  const sequenceIndex = (metadata as Record<string, unknown>)?.sequence_index as number || 0
  
  // Verificar se deve mostrar preco no botao
  const showPriceInButton = (metadata as Record<string, unknown>)?.showPriceInButton === true
  
  // Funcao para formatar texto do botao com preco se necessario
  const formatButtonText = (plan: { buttonText?: string; name?: string; price?: number }) => {
    const baseText = plan.buttonText || plan.name || "Plano"
    if (showPriceInButton && plan.price && plan.price > 0) {
      return `${baseText} por R$ ${Number(plan.price).toFixed(2).replace(".", ",")}`
    }
    return baseText
  }
  
  if (plans && plans.length > 0) {
  if (messageType === "upsell") {
  // UPSELL: usar callback up_{msgId}_{planIndex}_{priceInCents} (igual downsell)
  // Limite do Telegram: 64 caracteres
  for (let planIdx = 0; planIdx < plans.length; planIdx++) {
  const plan = plans[planIdx]
  const priceInCents = Math.round((plan.price || 0) * 100)
  // Usar apenas os ultimos 8 chars do msg.id para encurtar
  const shortMsgId = String(msg.id).slice(-8)
  const callbackData = `up_${shortMsgId}_${planIdx}_${priceInCents}`
  
  planButtons.push([{
  text: formatButtonText(plan),
  callback_data: callbackData
  }])
  console.log(`[CRON] Upsell button: ${formatButtonText(plan)} - callback: ${callbackData} (${callbackData.length} chars)`)
  }
  } else {
            // DOWNSELL: usar callback curto ds_{msgId}_{planIndex}_{priceInCents}
            // Limite do Telegram: 64 caracteres
            for (let planIdx = 0; planIdx < plans.length; planIdx++) {
              const plan = plans[planIdx]
              const priceInCents = Math.round((plan.price || 0) * 100)
              // Usar apenas os ultimos 8 chars do msg.id para encurtar
              const shortMsgId = String(msg.id).slice(-8)
              const callbackData = `ds_${shortMsgId}_${planIdx}_${priceInCents}`
              
              planButtons.push([{
                text: formatButtonText(plan),
                callback_data: callbackData
              }])
              console.log(`[CRON] Downsell button: ${formatButtonText(plan)} - callback: ${callbackData} (${callbackData.length} chars)`)
            }
          }
        }
        
        // Reply markup com os botoes (se houver)
        const replyMarkup = planButtons.length > 0 ? { inline_keyboard: planButtons } : undefined
        
        console.log(`[CRON] planButtons montados: ${planButtons.length}`)
        console.log(`[CRON] replyMarkup:`, JSON.stringify(replyMarkup))
        
        // Enviar mensagem
        if (medias.length > 0) {
          // Se tem apenas 1 midia, envia COM os botoes
          if (medias.length === 1) {
            const firstMedia = medias[0]
            console.log(`[CRON] Enviando midia unica COM botoes: ${firstMedia.substring(0, 50)}...`)
            let sendResult
            if (firstMedia.includes("video") || firstMedia.includes("mp4")) {
              sendResult = await sendTelegramVideo(botToken, chatId, firstMedia, message, replyMarkup)
            } else {
              sendResult = await sendTelegramPhoto(botToken, chatId, firstMedia, message, replyMarkup)
            }
            console.log(`[CRON] Resultado do envio:`, JSON.stringify(sendResult))
            if (!sendResult?.ok) {
              console.error(`[CRON] ERRO no envio Telegram:`, sendResult?.description || sendResult)
            }
          } else {
            // Multiplas midias: usar sendMediaGroup para enviar todas juntas
            const mediaGroupResult = await sendTelegramMediaGroup(botToken, chatId, medias, message)
            console.log(`[CRON] Resultado do sendMediaGroup:`, JSON.stringify(mediaGroupResult))
            
            if (!mediaGroupResult?.ok) {
              console.error(`[CRON] ERRO no sendMediaGroup:`, mediaGroupResult?.description || mediaGroupResult)
            }
            
            // Enviar botoes separadamente apos as midias (sendMediaGroup nao suporta botoes)
            if (replyMarkup) {
              const offerText = messageType === "upsell" ? "Aproveite essa oferta exclusiva!" : "Escolha seu plano:"
              await sendTelegramMessage(botToken, chatId, offerText, replyMarkup)
            }
          }
        } else {
          // Apenas texto com botoes
          await sendTelegramMessage(botToken, chatId, message, replyMarkup)
        }
        
        // Marcar como enviado
        await supabaseAdmin
          .from("scheduled_messages")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", msg.id)
        
        processed++
      } catch (err) {
        console.error("Erro ao processar mensagem:", msg.id, err)
        
        // Marcar como falho
        await supabaseAdmin
          .from("scheduled_messages")
          .update({ 
            status: "failed", 
            error_message: err instanceof Error ? err.message : "Unknown error" 
          })
          .eq("id", msg.id)
        
        failed++
      }
    }
    
    return NextResponse.json({ 
      processed, 
      failed, 
      total: pendingMessages.length,
      message: `Processado ${processed} mensagens, ${failed} falhas`
    })
  } catch (error) {
    console.error("[CRON] Erro geral no cron:", error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      type: typeof error
    }, { status: 500 })
  }
}

// Tambem aceitar POST para flexibilidade
export async function POST(request: NextRequest) {
  return GET(request)
}

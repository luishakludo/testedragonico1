import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

// Funcoes de envio do Telegram (copiadas do webhook)
async function sendTelegramMessage(
  botToken: string,
  chatId: number | string,
  text: string,
  replyMarkup?: unknown
) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
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

async function sendTelegramPhoto(
  botToken: string,
  chatId: number | string,
  photoUrl: string,
  caption?: string,
  replyMarkup?: unknown
) {
  const url = `https://api.telegram.org/bot${botToken}/sendPhoto`
  const body: Record<string, unknown> = {
    chat_id: chatId,
    photo: photoUrl,
    parse_mode: "HTML",
  }
  if (caption) body.caption = caption
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
  chatId: number | string,
  videoUrl: string,
  caption?: string,
  replyMarkup?: unknown
) {
  const url = `https://api.telegram.org/bot${botToken}/sendVideo`
  const body: Record<string, unknown> = {
    chat_id: chatId,
    video: videoUrl,
    parse_mode: "HTML",
  }
  if (caption) body.caption = caption
  if (replyMarkup) body.reply_markup = replyMarkup
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.json()
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
        const message = metadata?.message || ""
        const medias = metadata?.medias || []
        const plans = metadata?.plans || []
        
        // Logica diferente para DOWNSELL vs UPSELL
        const messageType = msg.message_type || "downsell"
        
        if (messageType === "downsell") {
          // DOWNSELL: Verificar se o usuario ja pagou (cancelar se ja pagou)
          // 1. Verificar status no user_flow_state
          const { data: userState } = await supabaseAdmin
            .from("user_flow_state")
            .select("status")
            .eq("bot_id", msg.bot_id)
            .eq("telegram_user_id", msg.telegram_user_id)
            .single()
          
          if (userState?.status === "paid" || userState?.status === "completed") {
            // Usuario ja pagou, cancelar downsell
            console.log(`[CRON] User ${msg.telegram_user_id} already paid (user_flow_state), cancelling downsell`)
            await supabaseAdmin
              .from("scheduled_messages")
              .update({ status: "cancelled" })
              .eq("id", msg.id)
            continue
          }
          
          // 2. Verificar se existe pagamento aprovado na tabela payments
          // APENAS verificar pagamentos do MESMO FLUXO e criados DEPOIS do agendamento
          const { data: approvedPayment } = await supabaseAdmin
            .from("payments")
            .select("id, status, created_at")
            .eq("bot_id", msg.bot_id)
            .eq("telegram_user_id", msg.telegram_user_id)
            .eq("flow_id", msg.flow_id)
            .eq("status", "approved")
            .in("product_type", ["main_product", "plan"])
            .gte("created_at", msg.created_at) // Apenas pagamentos apos o agendamento do downsell
            .limit(1)
            .maybeSingle()
          
          if (approvedPayment) {
            // Usuario ja tem pagamento aprovado NESTE FLUXO, cancelar downsell
            console.log(`[CRON] User ${msg.telegram_user_id} has approved payment in this flow, cancelling downsell`)
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
        
        // Montar botoes dos planos - logica diferente para DOWNSELL vs UPSELL
        const planButtons: Array<Array<{ text: string; callback_data: string }>> = []
        const sequenceIndex = (metadata as Record<string, unknown>)?.sequence_index as number || 0
        const hideRejectButton = (metadata as Record<string, unknown>)?.hideRejectButton as boolean || false
        const rejectButtonText = (metadata as Record<string, unknown>)?.rejectButtonText as string || "Nao tenho interesse"
        
        if (plans && plans.length > 0) {
          if (messageType === "upsell") {
            // UPSELL: usar callback up_plan_{sequenceIndex}_{planId}_{priceInCents}
            for (const plan of plans) {
              const priceInCents = Math.round((plan.price || 0) * 100)
              planButtons.push([{
                text: plan.buttonText || plan.name || `R$ ${(plan.price || 0).toFixed(2).replace(".", ",")}`,
                callback_data: `up_plan_${sequenceIndex}_${plan.id}_${priceInCents}`
              }])
              console.log(`[CRON] Upsell button: ${plan.buttonText} - callback: up_plan_${sequenceIndex}_${plan.id}_${priceInCents}`)
            }
            
            // Adicionar botao de recusar (se nao estiver escondido)
            if (!hideRejectButton) {
              planButtons.push([{
                text: rejectButtonText,
                callback_data: `up_decline_${sequenceIndex}`
              }])
            }
          } else {
            // DOWNSELL: criar plano temporario na flow_plans
            for (const plan of plans) {
              const tempPlanId = `ds_${msg.id}_${plan.id}_${Date.now()}`
              
              const { error: insertError } = await supabaseAdmin.from("flow_plans").insert({
                id: tempPlanId,
                flow_id: msg.flow_id,
                name: plan.buttonText,
                price: plan.price,
                is_active: true,
                position: 999,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              
              if (!insertError) {
                planButtons.push([{
                  text: plan.buttonText,
                  callback_data: `plan_${tempPlanId}`
                }])
                console.log(`[CRON] Plano temporario criado: ${tempPlanId} - ${plan.buttonText} - R$${plan.price}`)
              } else {
                console.error("[CRON] Erro ao criar plano temporario:", insertError.message)
              }
            }
          }
        }
        
        // Reply markup com os botoes (se houver)
        const replyMarkup = planButtons.length > 0 ? { inline_keyboard: planButtons } : undefined
        
        // Enviar mensagem
        if (medias.length > 0) {
          // Se tem apenas 1 midia, envia COM os botoes
          if (medias.length === 1) {
            const firstMedia = medias[0]
            if (firstMedia.includes("video") || firstMedia.includes("mp4")) {
              await sendTelegramVideo(botToken, chatId, firstMedia, message, replyMarkup)
            } else {
              await sendTelegramPhoto(botToken, chatId, firstMedia, message, replyMarkup)
            }
          } else {
            // Multiplas midias: enviar todas as midias primeiro
            for (let i = 0; i < medias.length; i++) {
              const media = medias[i]
              const caption = i === 0 ? message : undefined // Caption apenas na primeira
              if (media.includes("video") || media.includes("mp4")) {
                await sendTelegramVideo(botToken, chatId, media, caption)
              } else {
                await sendTelegramPhoto(botToken, chatId, media, caption)
              }
            }
            
            // Enviar botoes separadamente apos as midias (ultima midia nao suporta botoes em media group)
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

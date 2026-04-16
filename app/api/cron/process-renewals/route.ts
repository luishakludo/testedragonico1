import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Funcao para criar cliente Supabase (lazy initialization)
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Telegram helpers
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
  caption?: string
) {
  const url = `https://api.telegram.org/bot${botToken}/sendPhoto`
  const body: Record<string, unknown> = {
    chat_id: chatId,
    photo: photoUrl,
    parse_mode: "HTML",
  }
  if (caption) body.caption = caption
  
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
  caption?: string
) {
  const url = `https://api.telegram.org/bot${botToken}/sendVideo`
  const body: Record<string, unknown> = {
    chat_id: chatId,
    video: videoUrl,
    parse_mode: "HTML",
  }
  if (caption) body.caption = caption
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function sendTelegramAudio(
  botToken: string,
  chatId: number | string,
  audioUrl: string,
  caption?: string
) {
  const url = `https://api.telegram.org/bot${botToken}/sendAudio`
  const body: Record<string, unknown> = {
    chat_id: chatId,
    audio: audioUrl,
    parse_mode: "HTML",
  }
  if (caption) body.caption = caption
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.json()
}

// Banir usuario de um grupo
async function banChatMember(botToken: string, chatId: string, userId: number | string) {
  const url = `https://api.telegram.org/bot${botToken}/banChatMember`
  const body = {
    chat_id: chatId,
    user_id: userId,
  }
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.json()
}

// Substituir variaveis na mensagem
function replaceVariables(
  message: string,
  variables: {
    nome?: string
    plano?: string
    dias?: number
    data_expiracao?: string
    saudacao?: string
    uf?: string
  }
) {
  let result = message
  
  if (variables.nome) result = result.replace(/\{nome\}/gi, variables.nome)
  if (variables.plano) result = result.replace(/\{plano\}/gi, variables.plano)
  if (variables.dias !== undefined) result = result.replace(/\{dias\}/gi, String(variables.dias))
  if (variables.data_expiracao) result = result.replace(/\{data_expiracao\}/gi, variables.data_expiracao)
  if (variables.saudacao) result = result.replace(/\{saudacao\}/gi, variables.saudacao)
  if (variables.uf) result = result.replace(/\{uf\}/gi, variables.uf)
  
  return result
}

// Obter saudacao baseada na hora
function getSaudacao(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return "Bom dia"
  if (hour >= 12 && hour < 18) return "Boa tarde"
  return "Boa noite"
}

// Enviar midia baseado no tipo
async function sendMedia(
  botToken: string,
  chatId: number | string,
  mediaType: string,
  mediaUrl: string,
  caption?: string
) {
  if (mediaType === "video") {
    return sendTelegramVideo(botToken, chatId, mediaUrl, caption)
  } else if (mediaType === "audio") {
    return sendTelegramAudio(botToken, chatId, mediaUrl, caption)
  } else {
    return sendTelegramPhoto(botToken, chatId, mediaUrl, caption)
  }
}

// Converter "X dias" para numero de dias
function parseDays(dayString: string): number {
  if (dayString === "No dia") return 0
  const match = dayString.match(/(\d+)/)
  return match ? parseInt(match[1]) : 0
}

interface SubscriptionConfig {
  enabled?: boolean
  renewalDeliveryEnabled?: boolean
  renewalDeliverableId?: string
  notifyBeforeExpireEnabled?: boolean
  daysBeforeExpire?: string[]
  renewalMediaType?: string
  renewalMediaUrl?: string
  renewalMessage?: string
  notifyOnDayEnabled?: boolean
  notificationCount?: string
  selectedHours?: string[]
  expireMessageEnabled?: boolean
  expireMediaType?: string
  expireMediaUrl?: string
  expireMessage?: string
  useFlowPlans?: boolean
  renewalDiscount?: string
  kickFromGroup?: boolean
  removeVipStatus?: boolean
}

interface Deliverable {
  id: string
  name: string
  type: "media" | "vip_group" | "link"
  vipGroupChatId?: string
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && cronSecret.length > 0 && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  const supabase = getSupabaseAdmin()
  
  try {
    const now = new Date()
    const currentHour = now.getHours().toString().padStart(2, "0") + ":00"
    
    let notificationsSent = 0
    let usersExpired = 0
    let errors = 0

    // ========== PROCESSAR USUARIOS VIP COM DATA DE EXPIRACAO ==========
    
    // Buscar todos os usuarios VIP com data de expiracao definida
    const { data: vipUsers, error: vipError } = await supabase
      .from("bot_users")
      .select(`
        id,
        bot_id,
        telegram_user_id,
        first_name,
        last_name,
        is_vip,
        vip_expires_at,
        metadata
      `)
      .eq("is_vip", true)
      .not("vip_expires_at", "is", null)
    
    if (vipError) {
      console.error("[RENEWAL] Error fetching VIP users:", vipError)
      return NextResponse.json({ error: vipError.message }, { status: 500 })
    }

    if (!vipUsers || vipUsers.length === 0) {
      return NextResponse.json({ 
        message: "No VIP users to process",
        notificationsSent: 0,
        usersExpired: 0
      })
    }

    console.log(`[RENEWAL] Processing ${vipUsers.length} VIP users`)

    // Agrupar usuarios por bot para buscar configs uma vez
    const usersByBot: Record<string, typeof vipUsers> = {}
    for (const user of vipUsers) {
      if (!usersByBot[user.bot_id]) {
        usersByBot[user.bot_id] = []
      }
      usersByBot[user.bot_id].push(user)
    }

    // Processar cada bot
    for (const [botId, users] of Object.entries(usersByBot)) {
      // Buscar bot e flow config
      const { data: bot } = await supabase
        .from("bots")
        .select("id, token, user_id")
        .eq("id", botId)
        .single()

      if (!bot?.token) {
        console.log(`[RENEWAL] Bot ${botId} not found or no token`)
        continue
      }

      // Buscar flow vinculado ao bot
      let flowConfig: Record<string, unknown> | null = null
      let subscriptionConfig: SubscriptionConfig | null = null
      let deliverables: Deliverable[] = []

      const { data: directFlow } = await supabase
        .from("flows")
        .select("config")
        .eq("bot_id", botId)
        .limit(1)
        .single()

      if (directFlow?.config) {
        flowConfig = directFlow.config as Record<string, unknown>
      } else {
        const { data: flowBot } = await supabase
          .from("flow_bots")
          .select("flow_id, flows:flow_id(config)")
          .eq("bot_id", botId)
          .limit(1)
          .single()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((flowBot as any)?.flows?.config) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          flowConfig = (flowBot as any).flows.config as Record<string, unknown>
        }
      }

      if (flowConfig) {
        subscriptionConfig = flowConfig.subscription as SubscriptionConfig
        deliverables = (flowConfig.deliverables as Deliverable[]) || []
      }

      if (!subscriptionConfig) {
        console.log(`[RENEWAL] No subscription config for bot ${botId}`)
        continue
      }

      // Processar cada usuario VIP deste bot
      for (const user of users) {
        try {
          const expiresAt = new Date(user.vip_expires_at)
          const daysUntilExpire = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
          
          const userName = user.first_name || "Cliente"
          const variables = {
            nome: userName,
            plano: "VIP",
            dias: daysUntilExpire,
            data_expiracao: expiresAt.toLocaleDateString("pt-BR"),
            saudacao: getSaudacao(),
            uf: ""
          }

          // ========== USUARIO JA EXPIROU ==========
          if (daysUntilExpire < 0) {
            console.log(`[RENEWAL] User ${user.telegram_user_id} expired ${Math.abs(daysUntilExpire)} days ago`)
            
            // Enviar mensagem de expiracao (se habilitado)
            if (subscriptionConfig.expireMessageEnabled && subscriptionConfig.expireMessage) {
              const message = replaceVariables(subscriptionConfig.expireMessage, variables)
              
              // Verificar se ja enviou mensagem de expiracao para este usuario
              const { data: existingNotif } = await supabase
                .from("subscription_notifications")
                .select("id")
                .eq("bot_user_id", user.id)
                .eq("notification_type", "expired")
                .single()

              if (!existingNotif) {
                // Enviar midia se configurada
                if (subscriptionConfig.expireMediaType !== "none" && subscriptionConfig.expireMediaUrl) {
                  await sendMedia(
                    bot.token,
                    parseInt(user.telegram_user_id),
                    subscriptionConfig.expireMediaType,
                    subscriptionConfig.expireMediaUrl,
                    message
                  )
                } else {
                  await sendTelegramMessage(bot.token, parseInt(user.telegram_user_id), message)
                }

                // Registrar notificacao enviada
                await supabase.from("subscription_notifications").insert({
                  bot_user_id: user.id,
                  notification_type: "expired",
                  days_before: 0,
                  sent_at: now.toISOString()
                })

                notificationsSent++
              }
            }

            // Executar acoes ao expirar
            // 1. Expulsar do grupo VIP
            if (subscriptionConfig.kickFromGroup) {
              // Buscar grupo VIP do entregavel
              for (const del of deliverables) {
                if (del.type === "vip_group" && del.vipGroupChatId) {
                  console.log(`[RENEWAL] Kicking user ${user.telegram_user_id} from group ${del.vipGroupChatId}`)
                  await banChatMember(bot.token, del.vipGroupChatId, user.telegram_user_id)
                }
              }
            }

            // 2. Remover status VIP
            if (subscriptionConfig.removeVipStatus) {
              await supabase
                .from("bot_users")
                .update({
                  is_vip: false,
                  updated_at: now.toISOString()
                })
                .eq("id", user.id)
              
              usersExpired++
              console.log(`[RENEWAL] Removed VIP status from user ${user.telegram_user_id}`)
            }

            continue
          }

          // ========== NOTIFICACOES ANTES DE EXPIRAR ==========
          if (subscriptionConfig.notifyBeforeExpireEnabled && subscriptionConfig.daysBeforeExpire) {
            const daysToNotify = subscriptionConfig.daysBeforeExpire.map(parseDays)
            
            // Verificar se hoje e um dia para notificar
            if (daysToNotify.includes(daysUntilExpire)) {
              // Verificar horario (para "No dia", verificar selectedHours)
              let shouldSendNow = true
              
              if (daysUntilExpire === 0 && subscriptionConfig.notifyOnDayEnabled) {
                // No dia da expiracao, verificar horarios especificos
                shouldSendNow = subscriptionConfig.selectedHours?.includes(currentHour) || false
              }

              if (shouldSendNow) {
                // Verificar se ja enviou esta notificacao
                const notificationKey = `${daysUntilExpire}_${currentHour}`
                const { data: existingNotif } = await supabase
                  .from("subscription_notifications")
                  .select("id")
                  .eq("bot_user_id", user.id)
                  .eq("notification_type", "renewal_reminder")
                  .eq("days_before", daysUntilExpire)
                  .gte("sent_at", new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString()) // Ultimas 23h
                  .single()

                if (!existingNotif) {
                  const message = replaceVariables(
                    subscriptionConfig.renewalMessage || "Sua assinatura expira em {dias} dias!",
                    variables
                  )

                  // Enviar midia se configurada
                  if (subscriptionConfig.renewalMediaType !== "none" && subscriptionConfig.renewalMediaUrl) {
                    await sendMedia(
                      bot.token,
                      parseInt(user.telegram_user_id),
                      subscriptionConfig.renewalMediaType,
                      subscriptionConfig.renewalMediaUrl,
                      message
                    )
                  } else {
                    await sendTelegramMessage(bot.token, parseInt(user.telegram_user_id), message)
                  }

                  // Registrar notificacao enviada
                  await supabase.from("subscription_notifications").insert({
                    bot_user_id: user.id,
                    notification_type: "renewal_reminder",
                    days_before: daysUntilExpire,
                    sent_at: now.toISOString()
                  })

                  notificationsSent++
                  console.log(`[RENEWAL] Sent ${daysUntilExpire}-day reminder to user ${user.telegram_user_id}`)
                }
              }
            }
          }

        } catch (userError) {
          console.error(`[RENEWAL] Error processing user ${user.id}:`, userError)
          errors++
        }
      }
    }

    return NextResponse.json({
      message: "Renewal cron completed",
      notificationsSent,
      usersExpired,
      errors,
      processedUsers: vipUsers.length
    })

  } catch (error) {
    console.error("[RENEWAL] Cron error:", error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}

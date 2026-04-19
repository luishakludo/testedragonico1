/**
 * API Route para cron job externo (cron-job.org)
 * 
 * Este endpoint pode ser chamado externamente para verificar e processar
 * expiracoes de assinaturas automaticamente.
 * 
 * CONFIGURACAO:
 * 1. Acesse cron-job.org e crie um novo cron job
 * 2. URL: https://seu-dominio.vercel.app/api/cron-external/check-expirations
 * 3. Metodo: GET
 * 4. Headers: Authorization: Bearer SEU_CRON_SECRET
 * 5. Frequencia: a cada 1 minuto (ou conforme preferir)
 * 
 * VARIAVEIS DE AMBIENTE NECESSARIAS:
 * - CRON_SECRET: Token secreto para autenticacao (opcional mas recomendado)
 * - SUPABASE_SERVICE_ROLE_KEY: Chave de servico do Supabase
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"

interface Payment {
  id: string
  telegram_user_id: string
  bot_id: string
  flow_id?: string
  product_type: string
  plan_id?: string
  duration_days?: number
  created_at: string
  status: string
  product_name?: string
}

interface FlowConfig {
  deliverables?: Array<{
    id: string
    type: string
    vipGroupChatId?: string
    vipGroupName?: string
    vipAutoRemove?: boolean
  }>
  subscription?: {
    kickFromGroup?: boolean
    expireMessageEnabled?: boolean
    expireMessage?: string
  }
}

// Banir usuario de um grupo do Telegram
async function banChatMember(botToken: string, chatId: string, userId: string) {
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

// Enviar mensagem de expiracao
async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`
  const body = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  }
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function GET(request: NextRequest) {
  // Verificar autenticacao (opcional mas recomendado)
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  
  // Se CRON_SECRET estiver configurado, exigir autenticacao
  if (cronSecret && cronSecret.length > 0) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.log("[CRON-EXTERNAL] Unauthorized request")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }
  
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    console.error("[CRON-EXTERNAL] SUPABASE_SERVICE_ROLE_KEY not configured")
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }
  
  const supabase = createClient(SUPABASE_URL, serviceKey)
  
  const now = new Date()
  let usersExpired = 0
  let notificationsSent = 0
  let errors = 0

  console.log("[CRON-EXTERNAL] Starting expiration check at", now.toISOString())

  try {
    // Buscar APENAS pagamentos de PLANOS aprovados
    // IMPORTANTE: Exclui order_bump, upsell, downsell, pack - apenas assinaturas
    const { data: planPayments, error: paymentsError } = await supabase
      .from("payments")
      .select(`
        id,
        telegram_user_id,
        bot_id,
        flow_id,
        product_type,
        plan_id,
        duration_days,
        created_at,
        status,
        product_name
      `)
      .eq("status", "approved")
      .in("product_type", ["plan", "subscription", "plano", "main_product"])
      .not("duration_days", "is", null)
      .gt("duration_days", 0) // 0 = vitalicio, ignorar

    if (paymentsError) {
      console.error("[CRON-EXTERNAL] Error fetching payments:", paymentsError)
      return NextResponse.json({ error: paymentsError.message }, { status: 500 })
    }

    if (!planPayments || planPayments.length === 0) {
      console.log("[CRON-EXTERNAL] No plan payments to check")
      return NextResponse.json({ 
        success: true,
        message: "No plan payments to check",
        usersExpired: 0,
        notificationsSent: 0,
        timestamp: now.toISOString()
      })
    }

    console.log(`[CRON-EXTERNAL] Checking ${planPayments.length} plan payments`)

    // Agrupar por usuario/bot para pegar o pagamento mais recente
    const userLatestPayment: Record<string, Payment> = {}
    
    for (const payment of planPayments as Payment[]) {
      const key = `${payment.telegram_user_id}_${payment.bot_id}`
      
      if (!userLatestPayment[key] || 
          new Date(payment.created_at) > new Date(userLatestPayment[key].created_at)) {
        userLatestPayment[key] = payment
      }
    }

    console.log(`[CRON-EXTERNAL] Found ${Object.keys(userLatestPayment).length} unique user/bot combinations`)

    // Verificar cada usuario
    for (const [key, payment] of Object.entries(userLatestPayment)) {
      try {
        const purchaseDate = new Date(payment.created_at)
        const durationDays = payment.duration_days || 0
        const expirationDate = new Date(purchaseDate.getTime() + durationDays * 24 * 60 * 60 * 1000)
        
        // Verificar se expirou
        if (expirationDate > now) {
          continue // Ainda nao expirou
        }

        const daysSinceExpire = Math.floor((now.getTime() - expirationDate.getTime()) / (24 * 60 * 60 * 1000))
        
        console.log(`[CRON-EXTERNAL] User ${payment.telegram_user_id} expired ${daysSinceExpire} days ago`)

        // Verificar se ja foi processado
        const { data: existingExpiration } = await supabase
          .from("subscription_expirations")
          .select("id")
          .eq("payment_id", payment.id)
          .single()

        if (existingExpiration) {
          continue // Ja processado
        }

        // Buscar bot e seu token
        const { data: bot } = await supabase
          .from("bots")
          .select("id, token")
          .eq("id", payment.bot_id)
          .single()

        if (!bot?.token) {
          console.log(`[CRON-EXTERNAL] Bot ${payment.bot_id} not found`)
          continue
        }

        // Buscar flow config
        let flowConfig: FlowConfig | null = null

        if (payment.flow_id) {
          const { data: flow } = await supabase
            .from("flows")
            .select("config")
            .eq("id", payment.flow_id)
            .single()
          
          if (flow?.config) {
            flowConfig = flow.config as FlowConfig
          }
        }

        if (!flowConfig) {
          const { data: flowBot } = await supabase
            .from("flow_bots")
            .select("flows:flow_id(config)")
            .eq("bot_id", payment.bot_id)
            .limit(1)
            .single()

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((flowBot as any)?.flows?.config) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            flowConfig = (flowBot as any).flows.config as FlowConfig
          }
        }

        // Enviar mensagem de expiracao (se configurado)
        if (flowConfig?.subscription?.expireMessageEnabled && flowConfig?.subscription?.expireMessage) {
          const message = flowConfig.subscription.expireMessage
            .replace(/\{nome\}/gi, "Cliente")
            .replace(/\{plano\}/gi, payment.product_name || "Plano")
          
          await sendTelegramMessage(bot.token, payment.telegram_user_id, message)
          notificationsSent++
        }

        // Banir de grupos VIP
        if (flowConfig?.subscription?.kickFromGroup !== false && flowConfig?.deliverables) {
          for (const deliverable of flowConfig.deliverables) {
            if (deliverable.type === "vip_group" && 
                deliverable.vipGroupChatId && 
                deliverable.vipAutoRemove !== false) {
              
              console.log(`[CRON-EXTERNAL] Banning user ${payment.telegram_user_id} from group ${deliverable.vipGroupChatId}`)
              
              const banResult = await banChatMember(
                bot.token, 
                deliverable.vipGroupChatId, 
                payment.telegram_user_id
              )

              if (banResult.ok) {
                console.log(`[CRON-EXTERNAL] Successfully banned user from group`)
              } else {
                console.log(`[CRON-EXTERNAL] Failed to ban: ${banResult.description}`)
              }
            }
          }
        }

        // Atualizar bot_user para is_vip = false
        await supabase
          .from("bot_users")
          .update({ 
            is_vip: false, 
            vip_expires_at: null,
            updated_at: now.toISOString()
          })
          .eq("telegram_user_id", payment.telegram_user_id)
          .eq("bot_id", payment.bot_id)

        // Registrar expiracao processada
        await supabase.from("subscription_expirations").insert({
          payment_id: payment.id,
          telegram_user_id: payment.telegram_user_id,
          bot_id: payment.bot_id,
          expired_at: expirationDate.toISOString(),
          processed_at: now.toISOString()
        }).catch((err) => {
          console.log("[CRON-EXTERNAL] Could not insert expiration record:", err.message)
        })

        usersExpired++

      } catch (userError) {
        console.error(`[CRON-EXTERNAL] Error processing ${key}:`, userError)
        errors++
      }
    }

    console.log(`[CRON-EXTERNAL] Completed. Expired: ${usersExpired}, Notifications: ${notificationsSent}, Errors: ${errors}`)

    return NextResponse.json({
      success: true,
      message: "Expiration cron completed",
      usersExpired,
      notificationsSent,
      errors,
      processedPayments: Object.keys(userLatestPayment).length,
      timestamp: now.toISOString()
    })

  } catch (error) {
    console.error("[CRON-EXTERNAL] Cron error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

// Permitir POST tambem para compatibilidade
export async function POST(request: NextRequest) {
  return GET(request)
}

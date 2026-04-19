/**
 * Endpoint para verificar e processar expirações de assinaturas
 * Este arquivo é destinado a ser chamado por um cron job externo (ex: cron-job.org)
 * 
 * Como usar:
 * 1. Configure um cron job externo para chamar: GET /api/cron-external/check-expirations
 * 2. Adicione o header: Authorization: Bearer SEU_CRON_SECRET
 * 3. Configure para rodar a cada 1 minuto se necessário
 * 
 * Este endpoint:
 * - Verifica todos os pagamentos de PLANOS (subscription) que expiraram
 * - Bane automaticamente os usuários dos grupos VIP
 * - Envia mensagem de expiração (se configurado)
 * - Atualiza o status do bot_user para is_vip = false
 * - NÃO afeta entregáveis de order bump, upsell, downsell ou packs
 */

import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

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

export async function checkAndProcessExpirations() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  
  const now = new Date()
  let usersExpired = 0
  let notificationsSent = 0
  let errors = 0

  console.log("[EXPIRATION-CRON] Starting expiration check at", now.toISOString())

  // Buscar APENAS pagamentos de PLANOS aprovados (não order bumps, upsells, downsells)
  // IMPORTANTE: Apenas product_type que são assinaturas
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
    .gt("duration_days", 0) // Ignorar vitalicios (0 dias = vitalício)

  if (paymentsError) {
    console.error("[EXPIRATION-CRON] Error fetching payments:", paymentsError)
    return { error: paymentsError.message, usersExpired: 0, notificationsSent: 0 }
  }

  if (!planPayments || planPayments.length === 0) {
    console.log("[EXPIRATION-CRON] No plan payments to check")
    return { 
      message: "No plan payments to check",
      usersExpired: 0,
      notificationsSent: 0
    }
  }

  console.log(`[EXPIRATION-CRON] Checking ${planPayments.length} plan payments`)

  // Agrupar por usuario/bot para pegar o pagamento mais recente
  const userLatestPayment: Record<string, Payment> = {}
  
  for (const payment of planPayments as Payment[]) {
    const key = `${payment.telegram_user_id}_${payment.bot_id}`
    
    // Pegar sempre o pagamento mais recente para cada combinação user/bot
    if (!userLatestPayment[key] || 
        new Date(payment.created_at) > new Date(userLatestPayment[key].created_at)) {
      userLatestPayment[key] = payment
    }
  }

  console.log(`[EXPIRATION-CRON] Found ${Object.keys(userLatestPayment).length} unique user/bot combinations`)

  // Verificar cada usuario
  for (const [key, payment] of Object.entries(userLatestPayment)) {
    try {
      const purchaseDate = new Date(payment.created_at)
      const durationDays = payment.duration_days || 0
      const expirationDate = new Date(purchaseDate.getTime() + durationDays * 24 * 60 * 60 * 1000)
      
      // Verificar se expirou
      if (expirationDate > now) {
        // Ainda nao expirou, pular
        continue
      }

      const daysSinceExpire = Math.floor((now.getTime() - expirationDate.getTime()) / (24 * 60 * 60 * 1000))
      
      console.log(`[EXPIRATION-CRON] User ${payment.telegram_user_id} expired ${daysSinceExpire} days ago`)

      // Verificar se ja foi processado (tabela subscription_expirations)
      const { data: existingExpiration } = await supabase
        .from("subscription_expirations")
        .select("id")
        .eq("payment_id", payment.id)
        .single()

      if (existingExpiration) {
        // Ja processado anteriormente, pular
        continue
      }

      // Buscar bot e seu token
      const { data: bot } = await supabase
        .from("bots")
        .select("id, token")
        .eq("id", payment.bot_id)
        .single()

      if (!bot?.token) {
        console.log(`[EXPIRATION-CRON] Bot ${payment.bot_id} not found or has no token`)
        continue
      }

      // Buscar flow config para pegar configurações de entregáveis
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
        // Tentar via flow_bots
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

      // Enviar mensagem de expiracao (se configurado no fluxo)
      if (flowConfig?.subscription?.expireMessageEnabled && flowConfig?.subscription?.expireMessage) {
        const message = flowConfig.subscription.expireMessage
          .replace(/\{nome\}/gi, "Cliente")
          .replace(/\{plano\}/gi, payment.product_name || "Plano")
        
        await sendTelegramMessage(bot.token, payment.telegram_user_id, message)
        notificationsSent++
      }

      // Banir de grupos VIP (se kickFromGroup estiver habilitado ou não definido)
      if (flowConfig?.subscription?.kickFromGroup !== false && flowConfig?.deliverables) {
        for (const deliverable of flowConfig.deliverables) {
          // IMPORTANTE: Apenas grupos VIP com vipAutoRemove habilitado
          if (deliverable.type === "vip_group" && 
              deliverable.vipGroupChatId && 
              deliverable.vipAutoRemove !== false) {
            
            console.log(`[EXPIRATION-CRON] Banning user ${payment.telegram_user_id} from group ${deliverable.vipGroupChatId}`)
            
            const banResult = await banChatMember(
              bot.token, 
              deliverable.vipGroupChatId, 
              payment.telegram_user_id
            )

            if (banResult.ok) {
              console.log(`[EXPIRATION-CRON] Successfully banned user from group`)
            } else {
              console.log(`[EXPIRATION-CRON] Failed to ban: ${banResult.description}`)
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

      // Registrar expiracao processada para não processar novamente
      await supabase.from("subscription_expirations").insert({
        payment_id: payment.id,
        telegram_user_id: payment.telegram_user_id,
        bot_id: payment.bot_id,
        expired_at: expirationDate.toISOString(),
        processed_at: now.toISOString()
      }).catch((err) => {
        // Tabela pode nao existir ainda
        console.log("[EXPIRATION-CRON] Could not insert expiration record:", err.message)
      })

      usersExpired++

    } catch (userError) {
      console.error(`[EXPIRATION-CRON] Error processing ${key}:`, userError)
      errors++
    }
  }

  console.log(`[EXPIRATION-CRON] Completed. Expired: ${usersExpired}, Notifications: ${notificationsSent}, Errors: ${errors}`)

  return {
    message: "Expiration cron completed",
    usersExpired,
    notificationsSent,
    errors,
    processedPayments: Object.keys(userLatestPayment).length,
    timestamp: now.toISOString()
  }
}

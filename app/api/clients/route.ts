import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dnVsb2puZnZnc2JtaHl2cXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTk0NTMsImV4cCI6MjA4ODgzNTQ1M30.Djnn3tsrxSGLBR-Bm1dWOpQe0NHCSOWJFZkbbTOk2oM"



// Calcular dias restantes
function calculateRemainingDays(purchaseDate: string, durationDays: number | null): number | null {
  if (durationDays === null) return null // Vitalicio
  
  const purchaseTime = new Date(purchaseDate).getTime()
  const expirationTime = purchaseTime + (durationDays * 24 * 60 * 60 * 1000)
  const now = Date.now()
  
  const remainingMs = expirationTime - now
  if (remainingMs <= 0) return 0
  
  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000))
}

export interface Client {
  id: string
  telegram_user_id: string
  telegram_username?: string
  first_name?: string
  last_name?: string
  full_name: string
  type: "assinante" | "comprador" // assinante = plano, comprador = pack/upsell/downsell
  plan_name?: string
  plan_price?: number
  duration_type?: string
  duration_days?: number | null
  remaining_days?: number | null
  is_lifetime?: boolean
  is_expired?: boolean
  subscription_start?: string // Data de inicio da assinatura
  subscription_end?: string // Data de fim da assinatura (se nao for vitalicio)
  purchase_date: string
  purchases: Array<{
    id: string
    product_type: string
    product_name: string
    amount: number
    status: string
    created_at: string
    flow_id?: string
  }>
  total_spent: number
  bot_id: string
  bot_name?: string
  flow_id?: string
  flow_name?: string
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")
    const botId = searchParams.get("botId")
    const flowId = searchParams.get("flowId") // Filtro por fluxo
    const filter = searchParams.get("filter") // "all" | "assinantes" | "compradores"
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    console.log("[v0] clients API - userId:", userId, "botId:", botId, "flowId:", flowId)

    // Buscar bots do usuario
    let userBotIds: string[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let userBots: any[] = []
    if (userId) {
      const { data: bots } = await supabase
        .from("bots")
        .select("id, name")
        .eq("user_id", userId)
      
      userBots = bots || []
      userBotIds = userBots.map(b => b.id)
    }

    // Buscar fluxos do usuario (para o filtro de fluxo)
    let userFlows: { id: string; name: string; bot_id?: string }[] = []
    if (userId) {
      const { data: flows } = await supabase
        .from("flows")
        .select("id, name, bot_id")
        .eq("user_id", userId)
      
      userFlows = flows || []
    }

    // Se botId especifico, usar apenas ele
    const botIdsToQuery = botId ? [botId] : userBotIds

    if (botIdsToQuery.length === 0) {
      console.log("[v0] clients API - Nenhum bot encontrado para o usuario")
      return NextResponse.json({ 
        clients: [], 
        total: 0, 
        stats: { total: 0, assinantes: 0, compradores: 0, assinantes_ativos: 0, assinantes_expirados: 0, vitalicio: 0 },
        flows: userFlows,
        bots: userBots
      })
    }

    // Buscar todos os pagamentos aprovados dos bots
    let paymentsQuery = supabase
      .from("payments")
      .select(`
        id,
        telegram_user_id,
        bot_id,
        flow_id,
        amount,
        status,
        product_type,
        product_name,
        plan_id,
        duration_days,
        created_at,
        bots:bot_id (
          id,
          name
        )
      `)
      .in("bot_id", botIdsToQuery)
      .eq("status", "approved")
      .order("created_at", { ascending: false })

    // Filtrar por fluxo se especificado
    if (flowId) {
      paymentsQuery = paymentsQuery.eq("flow_id", flowId)
    }

    const { data: payments, error: paymentsError } = await paymentsQuery

    console.log("[v0] clients API - payments query result:", payments?.length || 0, "error:", paymentsError?.message || "none")

    if (paymentsError) {
      console.error("[clients] Error fetching payments:", paymentsError)
      return NextResponse.json({ error: "Erro ao buscar pagamentos" }, { status: 500 })
    }

    if (!payments || payments.length === 0) {
      console.log("[v0] clients API - Nenhum pagamento aprovado encontrado")
      return NextResponse.json({ 
        clients: [], 
        total: 0, 
        stats: { total: 0, assinantes: 0, compradores: 0, assinantes_ativos: 0, assinantes_expirados: 0, vitalicio: 0 },
        flows: userFlows,
        bots: userBots
      })
    }

    // Buscar informacoes dos bot_users
    const telegramUserIds = [...new Set(payments?.map(p => p.telegram_user_id).filter(Boolean) || [])]
    
    const { data: botUsers } = await supabase
      .from("bot_users")
      .select("telegram_user_id, username, first_name, last_name")
      .in("telegram_user_id", telegramUserIds)

    const botUsersMap = new Map(
      (botUsers || []).map(u => [String(u.telegram_user_id), u])
    )

    // Buscar flow_plans para pegar duracao
    const planIds = [...new Set(payments?.map(p => p.plan_id).filter(Boolean) || [])]
    
    const { data: flowPlans } = await supabase
      .from("flow_plans")
      .select("id, name, duration_days")
      .in("id", planIds)

    const flowPlansMap = new Map(
      (flowPlans || []).map(p => [p.id, p])
    )

    // Buscar flows para pegar configuracao de planos (duracao do pagamento pode vir de la)
    const flowIds = [...new Set(payments?.map(p => p.flow_id).filter(Boolean) || [])]
    
    interface FlowPlanConfig {
      id: string
      name: string
      duration_days: number
      price?: number | string
    }
    
    const flowConfigsMap = new Map<string, FlowPlanConfig[]>()
    
    if (flowIds.length > 0) {
      const { data: flows } = await supabase
        .from("flows")
        .select("id, config")
        .in("id", flowIds)
      
      for (const flow of flows || []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config = flow.config as any
        if (config?.plans) {
          flowConfigsMap.set(flow.id, config.plans)
        }
      }
    }

    // Agrupar pagamentos por telegram_user_id + bot_id
    const clientsMap = new Map<string, Client>()

    for (const payment of payments || []) {
      if (!payment.telegram_user_id) continue

      const key = `${payment.telegram_user_id}_${payment.bot_id}`
      const botUser = botUsersMap.get(String(payment.telegram_user_id))
      const botInfo = payment.bots as { id: string; name: string } | null

      // Determinar tipo de produto
      const productType = payment.product_type || "main_product"
      const isSubscription = productType === "main_product" || productType === "plan"
      
      // Buscar info do plano se for assinatura
      let planInfo = payment.plan_id ? flowPlansMap.get(payment.plan_id) : null
      
      // Tentar pegar duracao de multiplas fontes
      let durationDays: number | null = null
      let durationType: string | undefined = undefined
      
      // 1. Primeiro, verificar se o pagamento tem duration_days diretamente
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const paymentDuration = (payment as any).duration_days
      if (paymentDuration !== undefined && paymentDuration !== null) {
        durationDays = paymentDuration
      }
      // 2. Se nao, tentar buscar do flow_plans
      else if (planInfo?.duration_days !== undefined) {
        durationDays = planInfo.duration_days
      }
      // 3. Se nao, tentar buscar da configuracao do flow (plans no config)
      else if (payment.flow_id && flowConfigsMap.has(payment.flow_id)) {
        const flowPlans = flowConfigsMap.get(payment.flow_id) || []
        // Tentar encontrar o plano pelo plan_id ou pelo nome
        const matchingPlan = flowPlans.find(p => 
          p.id === payment.plan_id || 
          p.name === payment.product_name
        )
        if (matchingPlan?.duration_days !== undefined) {
          durationDays = matchingPlan.duration_days
        }
      }
      
      // Se durationDays for 0, e vitalicio
      if (durationDays === 0) {
        durationDays = null // null = vitalicio
      }

      if (!clientsMap.has(key)) {
        clientsMap.set(key, {
          id: key,
          telegram_user_id: payment.telegram_user_id,
          telegram_username: botUser?.username,
          first_name: botUser?.first_name,
          last_name: botUser?.last_name,
          full_name: botUser?.first_name 
            ? `${botUser.first_name}${botUser.last_name ? ` ${botUser.last_name}` : ""}`
            : `Usuario ${payment.telegram_user_id}`,
          type: isSubscription ? "assinante" : "comprador",
          plan_name: isSubscription ? (planInfo?.name || payment.product_name || "Plano") : undefined,
          plan_price: isSubscription ? Number(payment.amount) : undefined,
          duration_type: durationType,
          duration_days: durationDays,
          remaining_days: durationDays !== null 
            ? calculateRemainingDays(payment.created_at, durationDays) 
            : null,
          is_lifetime: durationDays === null && isSubscription,
          is_expired: durationDays !== null 
            ? calculateRemainingDays(payment.created_at, durationDays) === 0 
            : false,
subscription_start: isSubscription ? payment.created_at : undefined,
        subscription_end: isSubscription && durationDays !== null 
          ? new Date(new Date(payment.created_at).getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString()
          : undefined,
        purchase_date: payment.created_at,
        purchases: [],
        total_spent: 0,
        bot_id: payment.bot_id,
        bot_name: botInfo?.name,
        flow_id: payment.flow_id || undefined,
        flow_name: userFlows.find(f => f.id === payment.flow_id)?.name
        })
      }

      const client = clientsMap.get(key)!

      // Se este pagamento e uma assinatura e o cliente ainda nao tem, atualizar
      if (isSubscription && client.type !== "assinante") {
        client.type = "assinante"
        client.plan_name = planInfo?.name || payment.product_name || "Plano"
        client.plan_price = Number(payment.amount)
        client.duration_days = durationDays
        client.remaining_days = durationDays !== null 
          ? calculateRemainingDays(payment.created_at, durationDays) 
          : null
        client.is_lifetime = durationDays === null
        client.is_expired = durationDays !== null 
          ? calculateRemainingDays(payment.created_at, durationDays) === 0 
          : false
      }

      // Adicionar purchase
      client.purchases.push({
        id: payment.id,
        product_type: productType,
        product_name: payment.product_name || productType,
        amount: Number(payment.amount),
        status: payment.status,
        created_at: payment.created_at,
        flow_id: payment.flow_id || undefined
      })

      // Atualizar flow_id do cliente se ainda nao tiver
      if (payment.flow_id && !client.flow_id) {
        client.flow_id = payment.flow_id
        client.flow_name = userFlows.find(f => f.id === payment.flow_id)?.name
      }

      client.total_spent += Number(payment.amount)
    }

    // Converter para array e aplicar filtro
    let clients = Array.from(clientsMap.values())

    if (filter === "assinantes") {
      clients = clients.filter(c => c.type === "assinante")
    } else if (filter === "compradores") {
      clients = clients.filter(c => c.type === "comprador")
    }

    // Ordenar por data de compra mais recente
    clients.sort((a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime())

    // Stats
    const allClients = Array.from(clientsMap.values())
    const stats = {
      total: allClients.length,
      assinantes: allClients.filter(c => c.type === "assinante").length,
      compradores: allClients.filter(c => c.type === "comprador").length,
      assinantes_ativos: allClients.filter(c => c.type === "assinante" && !c.is_expired).length,
      assinantes_expirados: allClients.filter(c => c.type === "assinante" && c.is_expired).length,
      vitalicio: allClients.filter(c => c.is_lifetime).length,
    }

    // Paginar
    const paginatedClients = clients.slice(offset, offset + limit)

    return NextResponse.json({
      clients: paginatedClients,
      total: clients.length,
      stats,
      flows: userFlows,
      bots: userBots,
      limit,
      offset
    })
  } catch (error) {
    console.error("[clients] Error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor", details: String(error) },
      { status: 500 }
    )
  }
}

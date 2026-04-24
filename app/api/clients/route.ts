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

// Interface para assinaturas individuais (plano, upsell, downsell)
export interface Subscription {
  type: "plan" | "upsell" | "downsell"
  name: string
  price: number
  duration_days: number | null
  remaining_days: number | null
  is_lifetime: boolean
  is_expired: boolean
  start_date: string
  end_date?: string
}

export interface Client {
  id: string
  telegram_user_id: string
  telegram_username?: string
  first_name?: string
  last_name?: string
  full_name: string
  type: "assinante" | "comprador" // assinante = plano/upsell/downsell, comprador = pack/order_bump
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
  // Novas propriedades para mostrar assinaturas separadas
  subscriptions: Subscription[] // Lista de todas as assinaturas (plano, upsell, downsell)
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
    // Inclui todos os fluxos do usuario + pega os bots vinculados via flow_bots
    let userFlows: { id: string; name: string; bot_id?: string; linked_at?: string }[] = []
    const flowBotLinks: Map<string, { bot_id: string; linked_at: string }[]> = new Map()
    
    if (userId) {
      const { data: flows } = await supabase
        .from("flows")
        .select("id, name, bot_id")
        .eq("user_id", userId)
      
      userFlows = flows || []
      
      // Buscar vinculos flow_bots para saber quando cada bot foi vinculado
      if (userFlows.length > 0) {
        const flowIds = userFlows.map(f => f.id)
        const { data: flowBots } = await supabase
          .from("flow_bots")
          .select("flow_id, bot_id, created_at")
          .in("flow_id", flowIds)
        
        // Mapear vinculos por flow_id
        for (const fb of flowBots || []) {
          if (!flowBotLinks.has(fb.flow_id)) {
            flowBotLinks.set(fb.flow_id, [])
          }
          flowBotLinks.get(fb.flow_id)!.push({
            bot_id: fb.bot_id,
            linked_at: fb.created_at
          })
        }
      }
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

    // Determinar quais bots consultar baseado no filtro de fluxo
    let botsToQuery = botIdsToQuery
    let flowLinkedAt: string | null = null
    
    // Se filtro por fluxo, pegar apenas os bots vinculados a esse fluxo
    if (flowId && flowBotLinks.has(flowId)) {
      const linkedBots = flowBotLinks.get(flowId)!
      botsToQuery = linkedBots.map(lb => lb.bot_id).filter(bid => botIdsToQuery.includes(bid))
      // Pegar a data mais antiga de vinculacao (para filtrar pagamentos a partir dessa data)
      if (linkedBots.length > 0) {
        const dates = linkedBots.map(lb => new Date(lb.linked_at).getTime())
        flowLinkedAt = new Date(Math.min(...dates)).toISOString()
      }
    }
    
    // Buscar todos os pagamentos aprovados dos bots
    // Nota: Removido plan_id e duration_days pois podem nao existir na tabela
    let paymentsQuery = supabase
      .from("payments")
      .select(`
        id,
        telegram_user_id,
        bot_id,
        amount,
        status,
        product_type,
        product_name,
        created_at,
        bots:bot_id (
          id,
          name
        )
      `)
      .in("bot_id", botsToQuery.length > 0 ? botsToQuery : botIdsToQuery)
      .eq("status", "approved")
      .order("created_at", { ascending: false })

    // Filtrar por fluxo se especificado - aceita flow_id OU pagamentos apos data de vinculo
    if (flowId) {
      // Se tem data de vinculo, filtrar pagamentos criados apos essa data
      if (flowLinkedAt) {
        paymentsQuery = paymentsQuery.gte("created_at", flowLinkedAt)
      }
      // Tambem aceita pagamentos com flow_id direto (para compatibilidade)
      // paymentsQuery = paymentsQuery.or(`flow_id.eq.${flowId},created_at.gte.${flowLinkedAt}`)
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

    // Buscar flow_plans - nao temos plan_id no payment, vamos buscar pelo product_name
    const flowPlansMap = new Map()

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
      // Assinante inclui: plano, upsell e downsell (todos tem duracao)
      const isSubscription = productType === "main_product" || productType === "plan" || productType === "upsell" || productType === "downsell"
      
      // Buscar info do plano pelo nome do produto
      const planInfo = null // plan_id nao existe mais na tabela payments
      
      // Tentar pegar duracao de multiplas fontes
      let durationDays: number | null = null
      const durationType: string | undefined = undefined
      // 3. Derivar flow_id a partir do bot_id (via flow_bots) se nao existir diretamente
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let derivedFlowId = (payment as any).flow_id as string | undefined
      if (!derivedFlowId) {
        // Encontrar o fluxo que tem esse bot vinculado
        for (const [fid, links] of flowBotLinks.entries()) {
          const hasBot = links.some(l => l.bot_id === payment.bot_id)
          if (hasBot) {
            // Verificar se o pagamento foi criado apos o bot ser vinculado
            const link = links.find(l => l.bot_id === payment.bot_id)
            if (link && new Date(payment.created_at) >= new Date(link.linked_at)) {
              derivedFlowId = fid
              break
            }
          }
        }
      }
      
      // Tentar buscar da configuracao do flow (plans no config)
      if (derivedFlowId && flowConfigsMap.has(derivedFlowId)) {
        const flowPlans = flowConfigsMap.get(derivedFlowId) || []
        // Tentar encontrar o plano pelo nome
        const matchingPlan = flowPlans.find(p => p.name === payment.product_name)
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
        subscriptions: [], // Array para guardar assinaturas separadas (plano, upsell, downsell)
        total_spent: 0,
        bot_id: payment.bot_id,
        bot_name: botInfo?.name,
        flow_id: derivedFlowId || undefined,
        flow_name: userFlows.find(f => f.id === derivedFlowId)?.name
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
        flow_id: derivedFlowId || undefined
      })
      
      // Adicionar subscription se for plano, upsell ou downsell
      if (isSubscription) {
        // Determinar tipo de subscription
        let subType: "plan" | "upsell" | "downsell" = "plan"
        if (productType === "upsell") subType = "upsell"
        else if (productType === "downsell") subType = "downsell"
        
        const remainingDays = durationDays !== null 
          ? calculateRemainingDays(payment.created_at, durationDays) 
          : null
        
        client.subscriptions.push({
          type: subType,
          name: payment.product_name || productType,
          price: Number(payment.amount),
          duration_days: durationDays,
          remaining_days: remainingDays,
          is_lifetime: durationDays === null,
          is_expired: durationDays !== null ? remainingDays === 0 : false,
          start_date: payment.created_at,
          end_date: durationDays !== null 
            ? new Date(new Date(payment.created_at).getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString()
            : undefined
        })
      }
      
      // Atualizar flow_id do cliente se ainda nao tiver
      if (derivedFlowId && !client.flow_id) {
        client.flow_id = derivedFlowId
        client.flow_name = userFlows.find(f => f.id === derivedFlowId)?.name
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

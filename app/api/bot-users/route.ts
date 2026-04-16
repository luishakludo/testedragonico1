import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  try {
    const { searchParams } = new URL(req.url)
    const botId = searchParams.get("bot_id")

    if (!botId) {
      return NextResponse.json({ error: "bot_id is required" }, { status: 400 })
    }

    // Limpar registros de teste que sobraram
    await supabase.from("bot_users").delete().eq("telegram_user_id", 99999999)

    // Buscar todos os usuarios deste bot
    const { data: users, error } = await supabase
      .from("bot_users")
      .select("*")
      .eq("bot_id", botId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[bot-users] Error fetching users:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let allUsers = users || []

    // SEMPRE sincronizar: verificar usuarios do user_flow_state que faltam na bot_users
    const { data: flowStates } = await supabase
      .from("user_flow_state")
      .select("bot_id, telegram_user_id, chat_id, created_at")
      .eq("bot_id", botId)

    if (flowStates && flowStates.length > 0) {
      const existingTgIds = new Set(allUsers.map((u) => u.telegram_user_id))

      // Deduplica por telegram_user_id
      const uniqueMap = new Map<number, typeof flowStates[0]>()
      for (const s of flowStates) {
        if (!uniqueMap.has(s.telegram_user_id) && !existingTgIds.has(s.telegram_user_id)) {
          uniqueMap.set(s.telegram_user_id, s)
        }
      }

      if (uniqueMap.size > 0) {
        const toInsert = Array.from(uniqueMap.values()).map((s) => ({
          bot_id: s.bot_id,
          telegram_user_id: s.telegram_user_id,
          chat_id: s.chat_id,
          first_name: null,
          last_name: null,
          username: null,
          funnel_step: 1,
          is_subscriber: false,
          last_activity: s.created_at,
        }))

        await supabase.from("bot_users").insert(toInsert)

        // Re-buscar com os novos usuarios inclusos
        const { data: retryUsers } = await supabase
          .from("bot_users")
          .select("*")
          .eq("bot_id", botId)
          .order("created_at", { ascending: false })

        allUsers = retryUsers || []
      }
    }

    // Limpar usuarios de teste (telegram_user_id = 99999999)
    allUsers = allUsers.filter((u) => u.telegram_user_id !== 99999999)
    const now = new Date()

    // Calcular metricas
    const totalUsers = allUsers.length
    const subscribers = allUsers.filter((u) => u.is_subscriber)
    const totalSubscribers = subscribers.length
    const conversionRate = totalUsers > 0 ? ((totalSubscribers / totalUsers) * 100) : 0

    // Expirando em 7 dias
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const expiringSoon = subscribers.filter((u) => {
      if (!u.subscription_end) return false
      const endDate = new Date(u.subscription_end)
      return endDate <= sevenDaysFromNow && endDate >= now
    })

    // --------------- Funil dinamico baseado nos nodes reais do fluxo ---------------

    // 1. Buscar o fluxo primario (primeiro ativo, mesmo criterio do webhook)
    const { data: activeFlows } = await supabase
      .from("flows")
      .select("id, name")
      .eq("bot_id", botId)
      .eq("status", "ativo")
      .order("created_at", { ascending: true })
      .limit(1)

    const primaryFlowId = activeFlows?.[0]?.id

    // 2. Buscar os nodes reais desse fluxo
    let flowNodes: { id: string; type: string; label: string; config: Record<string, unknown>; position: number }[] = []
    if (primaryFlowId) {
      const { data: nodes } = await supabase
        .from("flow_nodes")
        .select("id, type, label, config, position")
        .eq("flow_id", primaryFlowId)
        .order("position", { ascending: true })
      flowNodes = (nodes as typeof flowNodes) || []
    }

    // 3. Buscar o estado (posicao atual) de cada usuario nesse fluxo
    let userPositions: Record<number, number> = {}
    if (primaryFlowId) {
      const { data: states } = await supabase
        .from("user_flow_state")
        .select("telegram_user_id, current_node_position, status")
        .eq("bot_id", botId)
        .eq("flow_id", primaryFlowId)

      if (states) {
        for (const s of states) {
          // Se o status e "completed" ou "finished", o usuario passou por todos os nodes
          if (s.status === "completed" || s.status === "finished") {
            userPositions[s.telegram_user_id] = 9999 // passou por tudo
          } else {
            userPositions[s.telegram_user_id] = s.current_node_position ?? 0
          }
        }
      }
    }

    // 4. Montar o funil com os nodes reais (excluir trigger e delay, mostrar mensagens/payment/action)
    const funnelNodeTypes = ["message", "payment", "condition", "action"]
    const funnelNodes = flowNodes.filter(n => funnelNodeTypes.includes(n.type))

    // O primeiro step e sempre "Iniciaram o Bot" (todos os usuarios)
    const funnelData: { id: string; label: string; count: number }[] = [
      { id: "start", label: "Iniciaram o Bot", count: allUsers.length },
    ]

    for (const node of funnelNodes) {
      // Determinar label legivel
      let label = node.label || ""
      if (!label || label === "Mensagem") {
        const text = (node.config?.text as string) || ""
        label = text.length > 50 ? text.slice(0, 50) + "..." : text || (node.type === "payment" ? "Pagamento" : node.type === "condition" ? "Condicao" : "Mensagem")
      }

      // Contar quantos usuarios chegaram ate esse node (position >= node.position)
      const count = allUsers.filter(u => {
        const pos = userPositions[u.telegram_user_id]
        if (pos === undefined) return false
        return pos >= node.position
      }).length

      funnelData.push({
        id: node.id,
        label,
        count,
      })
    }

    // Se nao tem nodes, fallback para o funil padrao
    if (funnelNodes.length === 0) {
      funnelData.length = 0
      funnelData.push(
        { id: "start", label: "Iniciaram o Bot", count: allUsers.filter((u) => u.funnel_step >= 1).length },
        { id: "msg", label: "Receberam Mensagem", count: allUsers.filter((u) => u.funnel_step >= 2).length },
        { id: "pay", label: "Chegaram ao Pagamento", count: allUsers.filter((u) => u.funnel_step >= 3).length },
        { id: "sub", label: "Assinaram", count: allUsers.filter((u) => u.funnel_step >= 4).length },
      )
    }

    // Formatar usuarios para o frontend
    const formattedUsers = allUsers.map((u) => {
      const diasRestantes = u.subscription_end
        ? Math.max(0, Math.ceil((new Date(u.subscription_end).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 0

      const nome = [u.first_name, u.last_name].filter(Boolean).join(" ") || "Usuario"

      // Calcular ultima atividade em texto
      const lastAct = new Date(u.last_activity)
      const diffMs = now.getTime() - lastAct.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      let ultimaAtividade = "Hoje"
      if (diffDays === 1) ultimaAtividade = "Ontem"
      else if (diffDays > 1) ultimaAtividade = `Ha ${diffDays} dias`

      return {
        id: u.id,
        nome,
        telegram: u.username ? `@${u.username}` : `ID: ${u.telegram_user_id}`,
        assinante: u.is_subscriber,
        diasRestantes,
        plano: u.subscription_plan || null,
        iniciadoEm: u.created_at,
        ultimaAtividade,
        etapa: u.funnel_step,
        isVip: u.is_vip || false,
        vipSince: u.vip_since || null,
        vipExpiresAt: u.vip_expires_at || null,
      }
    })

    return NextResponse.json({
      kpis: {
        totalUsuarios: totalUsers,
        assinantes: totalSubscribers,
        expirando7d: expiringSoon.length,
        taxaConversao: Math.round(conversionRate * 10) / 10,
      },
      funnel: funnelData,
      users: formattedUsers,
    })
  } catch (err) {
    console.error("[bot-users] Error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

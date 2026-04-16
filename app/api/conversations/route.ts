import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  try {
    const { searchParams } = new URL(req.url)
    const botId = searchParams.get("bot_id")
    const period = searchParams.get("period") || "month" // week, month, year

    if (!botId) {
      return NextResponse.json({ error: "bot_id is required" }, { status: 400 })
    }

    // Calcular data de início baseada no período
    const now = new Date()
    let startDate = new Date()
    
    switch (period) {
      case "week":
        startDate.setDate(now.getDate() - 7)
        break
      case "month":
        startDate.setMonth(now.getMonth() - 1)
        break
      case "year":
        startDate.setFullYear(now.getFullYear() - 1)
        break
      default:
        startDate.setMonth(now.getMonth() - 1)
    }

    // Buscar usuários do bot com atividade recente
    const { data: users, error: usersError } = await supabase
      .from("bot_users")
      .select("*")
      .eq("bot_id", botId)
      .gte("last_activity", startDate.toISOString())
      .order("last_activity", { ascending: false })
      .limit(50)

    if (usersError) {
      console.error("[conversations] Error fetching users:", usersError)
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    // Buscar estados do fluxo para cada usuário
    const telegramIds = (users || []).map(u => u.telegram_user_id)
    
    let flowStates: Record<number, { status: string; position: number; flow_name?: string }> = {}
    
    if (telegramIds.length > 0) {
      const { data: states } = await supabase
        .from("user_flow_state")
        .select("telegram_user_id, status, current_node_position, flow_id")
        .eq("bot_id", botId)
        .in("telegram_user_id", telegramIds)
        .order("updated_at", { ascending: false })

      if (states) {
        // Buscar nomes dos fluxos
        const flowIds = [...new Set(states.map(s => s.flow_id))]
        const { data: flows } = await supabase
          .from("flows")
          .select("id, name")
          .in("id", flowIds)
        
        const flowNames: Record<string, string> = {}
        if (flows) {
          for (const f of flows) {
            flowNames[f.id] = f.name
          }
        }

        // Mapear estados por telegram_user_id (pegando o mais recente)
        for (const s of states) {
          if (!flowStates[s.telegram_user_id]) {
            flowStates[s.telegram_user_id] = {
              status: s.status,
              position: s.current_node_position || 0,
              flow_name: flowNames[s.flow_id] || "Fluxo"
            }
          }
        }
      }
    }

    // Buscar contagem de pagamentos por usuário
    let paymentCounts: Record<number, { count: number; total: number }> = {}
    if (telegramIds.length > 0) {
      const { data: payments } = await supabase
        .from("payments")
        .select("telegram_user_id, amount, status")
        .eq("bot_id", botId)
        .in("telegram_user_id", telegramIds)
        .eq("status", "approved")

      if (payments) {
        for (const p of payments) {
          if (!paymentCounts[p.telegram_user_id]) {
            paymentCounts[p.telegram_user_id] = { count: 0, total: 0 }
          }
          paymentCounts[p.telegram_user_id].count++
          paymentCounts[p.telegram_user_id].total += Number(p.amount) || 0
        }
      }
    }

    // Formatar conversas para o frontend
    const conversations = (users || []).map(user => {
      const state = flowStates[user.telegram_user_id]
      const payment = paymentCounts[user.telegram_user_id]
      
      // Calcular tempo desde última atividade
      const lastAct = new Date(user.last_activity)
      const diffMs = now.getTime() - lastAct.getTime()
      const diffMins = Math.floor(diffMs / (1000 * 60))
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      
      let tempoResposta = "Agora"
      if (diffMins < 60) {
        tempoResposta = diffMins <= 1 ? "1 min" : `${diffMins} min`
      } else if (diffHours < 24) {
        tempoResposta = diffHours === 1 ? "1 hora" : `${diffHours} horas`
      } else {
        tempoResposta = diffDays === 1 ? "1 dia" : `${diffDays} dias`
      }

      // Determinar status da conversa
      let status = "ativo"
      let statusLabel = "Ativo"
      if (state?.status === "completed" || state?.status === "finished") {
        status = "concluido"
        statusLabel = "Concluído"
      } else if (state?.status === "waiting_payment") {
        status = "aguardando"
        statusLabel = "Aguardando Pgto"
      } else if (diffDays > 3) {
        status = "inativo"
        statusLabel = "Inativo"
      }

      // Determinar resultado
      let resultado = "Em andamento"
      let resultadoTipo = "neutro"
      if (payment && payment.count > 0) {
        resultado = `R$ ${payment.total.toFixed(2).replace(".", ",")}`
        resultadoTipo = "positivo"
      } else if (user.is_subscriber) {
        resultado = "Assinante"
        resultadoTipo = "positivo"
      } else if (status === "concluido" && !payment) {
        resultado = "Sem conversão"
        resultadoTipo = "negativo"
      }

      const nome = [user.first_name, user.last_name].filter(Boolean).join(" ") || "Usuário"

      return {
        id: user.id,
        nome,
        telegram: user.username ? `@${user.username}` : `ID: ${user.telegram_user_id}`,
        telegramUserId: String(user.telegram_user_id),
        telegramChatId: String(user.chat_id || user.telegram_user_id),
        mensagens: state?.position || user.funnel_step || 1,
        status,
        statusLabel,
        tempoResposta,
        resultado,
        resultadoTipo,
        fluxo: state?.flow_name || null,
        iniciadoEm: user.created_at,
        ultimaAtividade: user.last_activity
      }
    })

    return NextResponse.json({
      conversations,
      total: conversations.length
    })
  } catch (err) {
    console.error("[conversations] Error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase()
  try {
    const { id: botId } = await params

    if (!botId) {
      return NextResponse.json({ error: "bot_id is required" }, { status: 400 })
    }

    // Buscar usuarios
    const { data: users, error } = await supabase
      .from("bot_users")
      .select("*")
      .eq("bot_id", botId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[bot-users] Error fetching:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Buscar pagamentos aprovados para este bot
    const { data: approvedPayments } = await supabase
      .from("payments")
      .select("telegram_user_id")
      .eq("bot_id", botId)
      .eq("status", "approved")

    // Criar mapa de usuarios que pagaram
    const paidUsersSet = new Set(
      (approvedPayments || []).map(p => String(p.telegram_user_id))
    )

    // Enriquecer usuarios com payment_status calculado
    const enrichedUsers = (users || []).map(user => {
      const telegramUserId = String(user.telegram_user_id)
      const hasPaid = paidUsersSet.has(telegramUserId)
      const funnelStep = typeof user.funnel_step === 'string' 
        ? parseInt(user.funnel_step, 10) 
        : (user.funnel_step || 1)
      
      // Calcular payment_status:
      // - subscriber: assinante ativo
      // - paid/approved: tem pagamento aprovado
      // - abandoned: funnel_step == 1 (so deu start)
      // - not_paid: avancou no funil mas nao pagou
      let paymentStatus = "not_started"
      
      if (user.is_subscriber) {
        paymentStatus = "subscriber"
      } else if (hasPaid) {
        paymentStatus = "approved"
      } else if (funnelStep === 1) {
        paymentStatus = "abandoned"
      } else if (funnelStep > 1) {
        paymentStatus = "not_paid"
      }

      return {
        ...user,
        payment_status: paymentStatus
      }
    })

    return NextResponse.json({ users: enrichedUsers })
  } catch (err) {
    console.error("[bot-users] Unexpected error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase()
  try {
    const { id: botId } = await params
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("user_id")

    if (!botId) {
      return NextResponse.json({ error: "bot_id is required" }, { status: 400 })
    }

    if (userId) {
      // Delete specific user
      const { error } = await supabase
        .from("bot_users")
        .delete()
        .eq("bot_id", botId)
        .eq("id", userId)

      if (error) {
        console.error("[bot-users] Error deleting user:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    } else {
      // Delete all users from bot
      const { error } = await supabase
        .from("bot_users")
        .delete()
        .eq("bot_id", botId)

      if (error) {
        console.error("[bot-users] Error deleting all users:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[bot-users] Unexpected error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

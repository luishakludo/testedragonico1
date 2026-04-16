import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// GET: Return referral stats for a user
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 })
  }

  try {
    // Buscar contagem de referrals
    const { count, error } = await supabase
      .from("referrals")
      .select("*", { count: "exact", head: true })
      .eq("referrer_id", userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const totalReferrals = count || 0

    // Buscar o saldo de afiliado do usuario (affiliate_balance_adjustment)
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("affiliate_balance_adjustment")
      .eq("id", userId)
      .single()

    if (userError && userError.code !== "PGRST116") {
      // PGRST116 = no rows returned (usuario novo sem ajuste ainda)
      console.error("Error fetching user balance:", userError.message)
    }

    // GANHOS TOTAIS = valor que o admin definiu (fixo, nunca muda com saques)
    const totalEarnings = Number(userData?.affiliate_balance_adjustment) || 0

    // Buscar saques APROVADOS (ja foram pagos)
    const { data: approvedWithdraws } = await supabase
      .from("referral_withdraws")
      .select("amount")
      .eq("user_id", userId)
      .eq("status", "approved")

    // Buscar saques PAGOS
    const { data: paidWithdraws } = await supabase
      .from("referral_withdraws")
      .select("amount")
      .eq("user_id", userId)
      .eq("status", "paid")

    // Buscar saques PENDENTES (reservados, aguardando aprovacao)
    const { data: pendingWithdraws } = await supabase
      .from("referral_withdraws")
      .select("amount")
      .eq("user_id", userId)
      .eq("status", "pending")

    const totalApproved = approvedWithdraws?.reduce((acc, w) => acc + (Number(w.amount) || 0), 0) || 0
    const totalPaid = paidWithdraws?.reduce((acc, w) => acc + (Number(w.amount) || 0), 0) || 0
    const totalPending = pendingWithdraws?.reduce((acc, w) => acc + (Number(w.amount) || 0), 0) || 0
    
    // Total sacado = aprovados + pagos
    const totalWithdrawn = totalApproved + totalPaid

    // SALDO DISPONIVEL = ganhos totais - saques (aprovados + pagos + pendentes)
    const availableBalance = totalEarnings - totalWithdrawn - totalPending

    return NextResponse.json({
      total_referrals: totalReferrals,
      total_sales: 0,
      // Ganhos totais (fixo, definido pelo admin)
      total_earnings: totalEarnings,
      // Saldo disponivel para saque (desconta saques e pendentes)
      available_balance: availableBalance,
      // Totais detalhados
      total_withdrawn: totalWithdrawn,
      total_pending: totalPending,
    })
  } catch (err) {
    console.error("[v0] Stats GET error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  try {
    // Buscar total de usuarios (usando tabela users - mesma da pagina de usuarios)
    const { count: totalUsers } = await supabaseAdmin
      .from("users")
      .select("*", { count: "exact", head: true })

    // Buscar usuarios ativos (nao banidos)
    const { count: activeUsers } = await supabaseAdmin
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("banned", false)

    // Buscar usuarios banidos
    const { count: bannedUsers } = await supabaseAdmin
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("banned", true)

    // Buscar total de bots
    const { count: totalBots } = await supabaseAdmin
      .from("bots")
      .select("*", { count: "exact", head: true })

    // Buscar bots ativos
    const { count: activeBots } = await supabaseAdmin
      .from("bots")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)

    // Buscar total de pagamentos
    const { count: totalPayments } = await supabaseAdmin
      .from("payments")
      .select("*", { count: "exact", head: true })

    // Buscar pagamentos pendentes
    const { count: pendingPayments } = await supabaseAdmin
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")

    // Buscar receita total (pagamentos aprovados)
    const { data: revenueData } = await supabaseAdmin
      .from("payments")
      .select("amount")
      .eq("status", "approved")

    const totalRevenue = revenueData?.reduce((acc, p) => acc + (p.amount || 0), 0) || 0

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      activeUsers: activeUsers || 0,
      bannedUsers: bannedUsers || 0,
      totalBots: totalBots || 0,
      activeBots: activeBots || 0,
      totalPayments: totalPayments || 0,
      pendingPayments: pendingPayments || 0,
      totalRevenue,
    })
  } catch (error) {
    console.error("Erro ao buscar stats:", error)
    return NextResponse.json({ error: "Erro ao buscar estatisticas" }, { status: 500 })
  }
}

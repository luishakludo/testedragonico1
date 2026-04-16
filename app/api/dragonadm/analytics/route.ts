import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET() {
  try {
    const now = new Date()
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString()

    // Total de usuarios
    const { count: totalUsers } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })

    // Usuarios ativos
    const { count: activeUsers } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("banned", false)

    // Usuarios banidos
    const { count: bannedUsers } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("banned", true)

    // Usuarios este mes
    const { count: usersThisMonth } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", firstDayThisMonth)

    // Usuarios mes passado
    const { count: usersLastMonth } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", firstDayLastMonth)
      .lte("created_at", lastDayLastMonth)

    // Total de bots
    const { count: totalBots } = await supabase
      .from("bots")
      .select("*", { count: "exact", head: true })

    // Bots ativos
    const { count: activeBots } = await supabase
      .from("bots")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)

    // Bots este mes
    const { count: botsThisMonth } = await supabase
      .from("bots")
      .select("*", { count: "exact", head: true })
      .gte("created_at", firstDayThisMonth)

    // Bots mes passado
    const { count: botsLastMonth } = await supabase
      .from("bots")
      .select("*", { count: "exact", head: true })
      .gte("created_at", firstDayLastMonth)
      .lte("created_at", lastDayLastMonth)

    // Total de pagamentos
    const { count: totalPayments } = await supabase
      .from("payments")
      .select("*", { count: "exact", head: true })

    // Pagamentos pendentes
    const { count: pendingPayments } = await supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")

    // Receita total
    const { data: revenueData } = await supabase
      .from("payments")
      .select("amount")
      .eq("status", "approved")

    const totalRevenue = revenueData?.reduce((acc, p) => acc + (p.amount || 0), 0) || 0

    // Receita este mes
    const { data: revenueThisMonthData } = await supabase
      .from("payments")
      .select("amount")
      .eq("status", "approved")
      .gte("created_at", firstDayThisMonth)

    const revenueThisMonth = revenueThisMonthData?.reduce((acc, p) => acc + (p.amount || 0), 0) || 0

    // Receita mes passado
    const { data: revenueLastMonthData } = await supabase
      .from("payments")
      .select("amount")
      .eq("status", "approved")
      .gte("created_at", firstDayLastMonth)
      .lte("created_at", lastDayLastMonth)

    const revenueLastMonth = revenueLastMonthData?.reduce((acc, p) => acc + (p.amount || 0), 0) || 0

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      activeUsers: activeUsers || 0,
      bannedUsers: bannedUsers || 0,
      usersThisMonth: usersThisMonth || 0,
      usersLastMonth: usersLastMonth || 0,
      totalBots: totalBots || 0,
      activeBots: activeBots || 0,
      botsThisMonth: botsThisMonth || 0,
      botsLastMonth: botsLastMonth || 0,
      totalPayments: totalPayments || 0,
      pendingPayments: pendingPayments || 0,
      totalRevenue,
      revenueThisMonth,
      revenueLastMonth,
    })
  } catch (error) {
    console.error("Erro ao buscar analytics:", error)
    return NextResponse.json({ error: "Erro ao buscar analytics" }, { status: 500 })
  }
}

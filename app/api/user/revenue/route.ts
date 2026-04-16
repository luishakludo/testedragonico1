import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    // Buscar todos os bots do usuario
    const { data: bots, error: botsError } = await supabaseAdmin
      .from("bots")
      .select("id")
      .eq("user_id", userId)

    if (botsError) {
      console.error("Error fetching bots:", botsError)
      return NextResponse.json({ totalRevenue: 0 })
    }

    if (!bots || bots.length === 0) {
      return NextResponse.json({ totalRevenue: 0 })
    }

    const botIds = bots.map(b => b.id)

    // Buscar todos os pagamentos aprovados de todos os bots do usuario
    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from("payments")
      .select("amount")
      .in("bot_id", botIds)
      .eq("status", "approved")

    if (paymentsError) {
      console.error("Error fetching payments:", paymentsError)
      return NextResponse.json({ totalRevenue: 0 })
    }

    // Somar o faturamento total
    const totalRevenue = payments?.reduce((acc, p) => acc + (Number(p.amount) || 0), 0) || 0

    return NextResponse.json({ 
      totalRevenue,
      botsCount: bots.length,
      paymentsCount: payments?.length || 0
    })
  } catch (error) {
    console.error("Error in user revenue API:", error)
    return NextResponse.json({ totalRevenue: 0 })
  }
}

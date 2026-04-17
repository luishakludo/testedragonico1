import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dnVsb2puZnZnc2JtaHl2cXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTk0NTMsImV4cCI6MjA4ODgzNTQ1M30.Djnn3tsrxSGLBR-Bm1dWOpQe0NHCSOWJFZkbbTOk2oM"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const botId = searchParams.get("botId") || searchParams.get("bot_id")
    const userId = searchParams.get("userId")
    const status = searchParams.get("status")
    const limit = parseInt(searchParams.get("limit") || searchParams.get("per_page") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")
    const page = parseInt(searchParams.get("page") || "1")
    
    // Calcular offset baseado em page se fornecido
    const finalOffset = searchParams.get("page") ? (page - 1) * limit : offset

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    // Build query
    let query = supabase
      .from("payments")
      .select(`
        *,
        bots:bot_id (
          id,
          name
        )
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(finalOffset, finalOffset + limit - 1)

    // Filtrar por bot_id se fornecido
    if (botId) {
      query = query.eq("bot_id", botId)
    }

    if (status && status !== "todos") {
      query = query.eq("status", status)
    }

    const { data: payments, error, count } = await query

    if (error) {
      console.error("[v0] Error fetching payments:", error)
      return NextResponse.json(
        { error: "Erro ao buscar pagamentos" },
        { status: 500 }
      )
    }

    // Calculate stats - filtrar pelo mesmo bot_id
    let statsQuery = supabase
      .from("payments")
      .select("status, amount, telegram_user_id, payer_email, id")

    if (botId) {
      statsQuery = statsQuery.eq("bot_id", botId)
    }

    const { data: allPayments } = await statsQuery

    // Contar usuarios unicos com pagamentos aprovados
    const approvedPayments = allPayments?.filter(p => p.status === "approved") || []
    const uniqueApprovedUsers = new Set(
      approvedPayments.map(p => p.telegram_user_id || p.payer_email || p.id)
    )

    const stats = {
      total: allPayments?.length || 0,
      approved: approvedPayments.length,
      approvedUniqueUsers: uniqueApprovedUsers.size,
      pending: allPayments?.filter(p => p.status === "pending").length || 0,
      rejected: allPayments?.filter(p => p.status === "rejected").length || 0,
      cancelled: allPayments?.filter(p => p.status === "cancelled").length || 0,
      totalApproved: approvedPayments
        .reduce((sum, p) => sum + Number(p.amount), 0) || 0,
      totalPending: allPayments
        ?.filter(p => p.status === "pending")
        .reduce((sum, p) => sum + Number(p.amount), 0) || 0,
    }

    return NextResponse.json({
      payments: payments || [],
      stats,
      total: count || 0,
      limit,
      offset: finalOffset,
    })
  } catch (error) {
    console.error("ERROR in payments list:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor", details: String(error) },
      { status: 500 }
    )
  }
}

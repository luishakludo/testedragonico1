import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dnVsb2puZnZnc2JtaHl2cXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTk0NTMsImV4cCI6MjA4ODgzNTQ1M30.Djnn3tsrxSGLBR-Bm1dWOpQe0NHCSOWJFZkbbTOk2oM"

// Funcao para calcular datas baseado no periodo
function getDateRange(period: string): { startDate: string; endDate: string } | null {
  const now = new Date()
  const endDate = now.toISOString()
  
  switch (period) {
    case "today": {
      const start = new Date(now)
      start.setHours(0, 0, 0, 0)
      return { startDate: start.toISOString(), endDate }
    }
    case "yesterday": {
      const start = new Date(now)
      start.setDate(start.getDate() - 1)
      start.setHours(0, 0, 0, 0)
      const end = new Date(now)
      end.setDate(end.getDate() - 1)
      end.setHours(23, 59, 59, 999)
      return { startDate: start.toISOString(), endDate: end.toISOString() }
    }
    case "7days": {
      const start = new Date(now)
      start.setDate(start.getDate() - 7)
      return { startDate: start.toISOString(), endDate }
    }
    case "30days": {
      const start = new Date(now)
      start.setDate(start.getDate() - 30)
      return { startDate: start.toISOString(), endDate }
    }
    case "3months": {
      const start = new Date(now)
      start.setMonth(start.getMonth() - 3)
      return { startDate: start.toISOString(), endDate }
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { startDate: start.toISOString(), endDate }
    }
    case "year": {
      const start = new Date(now.getFullYear(), 0, 1)
      return { startDate: start.toISOString(), endDate }
    }
    default:
      return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const botId = searchParams.get("botId")
    const userId = searchParams.get("userId")
    const status = searchParams.get("status")
    const period = searchParams.get("period") // Novo: filtro por periodo
    const startDate = searchParams.get("startDate") // Novo: data inicial customizada
    const endDateParam = searchParams.get("endDate") // Novo: data final customizada
    const since = searchParams.get("since") // Novo: filtro desde uma data (usado para stats de fluxo)
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    // Calcular range de datas
    let dateFilter: { startDate: string; endDate: string } | null = null
    if (period) {
      dateFilter = getDateRange(period)
    } else if (startDate && endDateParam) {
      dateFilter = { startDate, endDate: endDateParam }
    }

    // Se tiver userId, buscar os bots desse usuario
    let userBotIds: string[] = []
    if (userId) {
      // Buscar bots do usuario
      const { data: userBots, error: botsError } = await supabase
        .from("bots")
        .select("id")
        .eq("user_id", userId)
      
      userBotIds = userBots?.map(b => b.id) || []
      
      console.log("[v0] Payments list - userId:", userId, "userBots:", userBotIds.length, "error:", botsError)
    }

    // Build query - buscar pagamentos dos bots do usuario OU com user_id direto
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
      .range(offset, offset + limit - 1)

    // Filtrar por bot_id dos bots do usuario OU user_id direto (checkout)
    if (userId) {
      if (userBotIds.length > 0) {
        // Tem bots: buscar por bot_id OU user_id
        const botIdsString = userBotIds.join(",")
        const orFilter = `bot_id.in.(${botIdsString}),user_id.eq.${userId}`
        console.log("[v0] Payments list - OR filter:", orFilter)
        query = query.or(orFilter)
      } else {
        // Sem bots: buscar apenas por user_id
        query = query.eq("user_id", userId)
      }
    }

    if (botId) {
      query = query.eq("bot_id", botId)
    }

    if (status && status !== "todos") {
      query = query.eq("status", status)
    }

    // Aplicar filtro de datas se existir
    if (dateFilter) {
      query = query.gte("created_at", dateFilter.startDate).lte("created_at", dateFilter.endDate)
    }
    
    // Aplicar filtro "since" (usado para stats de fluxo - so conta a partir da data de vinculo)
    if (since) {
      query = query.gte("created_at", since)
    }

    const { data: payments, error, count } = await query

    console.log("[v0] Payments query result - count:", count, "payments:", payments?.length, "error:", error)
    
    // Debug: mostrar os product_types encontrados
    const productTypes = payments?.map(p => p.product_type).filter(Boolean)
    const uniqueTypes = [...new Set(productTypes)]
    console.log("[v0] Product types found:", uniqueTypes, "order_bump count:", payments?.filter(p => p.product_type?.includes("order_bump")).length)

    if (error) {
      console.error("[v0] Error fetching payments:", error)
      return NextResponse.json(
        { error: "Erro ao buscar pagamentos" },
        { status: 500 }
      )
    }

    // Calculate stats - mesmo filtro da query principal
    let statsQuery = supabase
      .from("payments")
      .select("status, amount")

    if (userId) {
      if (userBotIds.length > 0) {
        const botIdsString = userBotIds.join(",")
        const statsOrFilter = `bot_id.in.(${botIdsString}),user_id.eq.${userId}`
        statsQuery = statsQuery.or(statsOrFilter)
      } else {
        statsQuery = statsQuery.eq("user_id", userId)
      }
    }

    if (botId) {
      statsQuery = statsQuery.eq("bot_id", botId)
    }

    // Aplicar mesmo filtro de datas nos stats
    if (dateFilter) {
      statsQuery = statsQuery.gte("created_at", dateFilter.startDate).lte("created_at", dateFilter.endDate)
    }
    
    // Aplicar filtro "since" nos stats tambem
    if (since) {
      statsQuery = statsQuery.gte("created_at", since)
    }

    const { data: allPayments } = await statsQuery

    // Contar usuarios unicos com pagamentos aprovados (pelo telegram_user_id ou payer_email)
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
      offset,
    })
  } catch (error) {
    console.error("ERROR in payments list:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor", details: String(error) },
      { status: 500 }
    )
  }
}

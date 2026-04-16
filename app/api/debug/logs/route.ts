import { NextRequest, NextResponse } from "next/server"
import { getMemoryLogs, clearMemoryLogs, LogCategory, LogLevel } from "@/lib/logger"
import { getSupabase } from "@/lib/supabase"

/**
 * GET /api/debug/logs
 * 
 * Retorna os logs de debug para análise.
 * 
 * Query params:
 * - source: "memory" | "database" (default: "memory")
 * - category: "order_bump" | "payment" | "upsell" | "webhook" | "flow" | "general"
 * - level: "info" | "warn" | "error" | "debug"
 * - limit: número de logs (default: 100)
 * - telegram_user_id: filtrar por usuário
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const source = searchParams.get("source") || "memory"
  const category = searchParams.get("category") as LogCategory | null
  const level = searchParams.get("level") as LogLevel | null
  const limit = parseInt(searchParams.get("limit") || "100")
  const telegramUserId = searchParams.get("telegram_user_id")

  if (source === "database") {
    // Buscar do banco de dados
    try {
      const supabase = getSupabase()
      let query = supabase
        .from("debug_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit)

      if (category) {
        query = query.eq("category", category)
      }
      if (level) {
        query = query.eq("level", level)
      }
      if (telegramUserId) {
        query = query.eq("telegram_user_id", telegramUserId)
      }

      const { data: logs, error } = await query

      if (error) {
        return NextResponse.json({
          success: false,
          error: "Erro ao buscar logs do banco",
          details: error.message,
          hint: "A tabela debug_logs pode não existir. Execute o script de migração.",
        })
      }

      return NextResponse.json({
        success: true,
        source: "database",
        count: logs?.length || 0,
        logs: logs || [],
      })
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: "Erro ao conectar ao banco",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      })
    }
  }

  // Buscar da memória (padrão)
  const logs = getMemoryLogs({
    category: category || undefined,
    level: level || undefined,
    limit,
    telegram_user_id: telegramUserId ? parseInt(telegramUserId) : undefined,
  })

  return NextResponse.json({
    success: true,
    source: "memory",
    count: logs.length,
    logs,
    note: "Logs da memória são perdidos quando o servidor reinicia. Use source=database para logs persistentes.",
  })
}

/**
 * DELETE /api/debug/logs
 * 
 * Limpa os logs.
 * 
 * Query params:
 * - source: "memory" | "database" | "all" (default: "memory")
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const source = searchParams.get("source") || "memory"

  const results: { memory?: boolean; database?: boolean; error?: string } = {}

  if (source === "memory" || source === "all") {
    clearMemoryLogs()
    results.memory = true
  }

  if (source === "database" || source === "all") {
    try {
      const supabase = getSupabase()
      // Deletar logs mais antigos que 7 dias
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      await supabase
        .from("debug_logs")
        .delete()
        .lt("created_at", sevenDaysAgo)
      results.database = true
    } catch (error) {
      results.error = error instanceof Error ? error.message : "Erro ao limpar banco"
    }
  }

  return NextResponse.json({
    success: true,
    message: "Logs limpos",
    results,
  })
}

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dnVsb2puZnZnc2JtaHl2cXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTk0NTMsImV4cCI6MjA4ODgzNTQ1M30.Djnn3tsrxSGLBR-Bm1dWOpQe0NHCSOWJFZkbbTOk2oM"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: "userId obrigatorio" }, { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    // Buscar bots do usuario
    const { data: bots, error: botsError } = await supabase
      .from("bots")
      .select("id")
      .eq("user_id", userId)

    if (botsError) {
      console.error("[clear-clients] Error fetching bots:", botsError)
      return NextResponse.json({ error: "Erro ao buscar bots" }, { status: 500 })
    }

    if (!bots || bots.length === 0) {
      return NextResponse.json({ success: true, message: "Nenhum bot encontrado", deleted: 0 })
    }

    const botIds = bots.map(b => b.id)

    // Deletar pagamentos dos bots do usuario
    const { error: paymentsError, count: paymentsCount } = await supabase
      .from("payments")
      .delete({ count: "exact" })
      .in("bot_id", botIds)

    if (paymentsError) {
      console.error("[clear-clients] Error deleting payments:", paymentsError)
      return NextResponse.json({ error: "Erro ao deletar pagamentos" }, { status: 500 })
    }

    // Deletar bot_users dos bots do usuario
    const { error: botUsersError, count: botUsersCount } = await supabase
      .from("bot_users")
      .delete({ count: "exact" })
      .in("bot_id", botIds)

    if (botUsersError) {
      console.error("[clear-clients] Error deleting bot_users:", botUsersError)
      // Nao retornar erro, apenas logar
    }

    console.log(`[clear-clients] Deleted ${paymentsCount || 0} payments and ${botUsersCount || 0} bot_users for user ${userId}`)

    return NextResponse.json({
      success: true,
      message: `Todos os clientes foram removidos`,
      deleted: {
        payments: paymentsCount || 0,
        botUsers: botUsersCount || 0
      }
    })
  } catch (error) {
    console.error("[clear-clients] Error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor", details: String(error) },
      { status: 500 }
    )
  }
}

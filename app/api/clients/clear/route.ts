import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: "userId obrigatorio" }, { status: 400 })
    }

    // Usar admin client para bypassar RLS
    const supabase = getSupabaseAdmin()

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
    console.log("[v0] clear-clients - botIds:", botIds)

    // Verificar quantos pagamentos existem antes de deletar
    const { data: existingPayments, count: existingCount } = await supabase
      .from("payments")
      .select("id", { count: "exact" })
      .in("bot_id", botIds)
    
    console.log("[v0] clear-clients - existing payments:", existingCount, existingPayments?.length)

    // Deletar pagamentos dos bots do usuario - usar loop para garantir
    let totalPaymentsDeleted = 0
    for (const botId of botIds) {
      const { error: delError, count } = await supabase
        .from("payments")
        .delete({ count: "exact" })
        .eq("bot_id", botId)
      
      console.log("[v0] clear-clients - delete payments for bot", botId, "count:", count, "error:", delError?.message || "none")
      
      if (!delError && count) {
        totalPaymentsDeleted += count
      }
    }

    // Deletar bot_users dos bots do usuario
    let totalBotUsersDeleted = 0
    for (const botId of botIds) {
      const { error: delError, count } = await supabase
        .from("bot_users")
        .delete({ count: "exact" })
        .eq("bot_id", botId)
      
      console.log("[v0] clear-clients - delete bot_users for bot", botId, "count:", count, "error:", delError?.message || "none")
      
      if (!delError && count) {
        totalBotUsersDeleted += count
      }
    }

    console.log(`[clear-clients] Deleted ${totalPaymentsDeleted} payments and ${totalBotUsersDeleted} bot_users for user ${userId}`)

    return NextResponse.json({
      success: true,
      message: `Removidos ${totalPaymentsDeleted} pagamentos e ${totalBotUsersDeleted} usuarios`,
      deleted: {
        payments: totalPaymentsDeleted,
        botUsers: totalBotUsersDeleted
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

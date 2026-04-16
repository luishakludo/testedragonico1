import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET() {
  try {
    // Buscar todos os bots com info do usuario
    const { data: bots, error } = await supabase
      .from("bots")
      .select(`
        id,
        name,
        username,
        is_active,
        created_at,
        user_id,
        profiles:user_id (
          email
        )
      `)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Erro ao buscar bots:", error)
      return NextResponse.json({ error: "Erro ao buscar bots" }, { status: 500 })
    }

    const formattedBots = bots?.map(bot => ({
      id: bot.id,
      name: bot.name,
      username: bot.username,
      is_active: bot.is_active,
      created_at: bot.created_at,
      user_email: (bot.profiles as any)?.email || null,
    }))

    return NextResponse.json({ bots: formattedBots })
  } catch (error) {
    console.error("Erro ao buscar bots:", error)
    return NextResponse.json({ error: "Erro ao buscar bots" }, { status: 500 })
  }
}

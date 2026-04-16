import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  
  try {
    const body = await req.json()
    const { botId, textData } = body as { botId: string; textData: string }

    if (!botId || !textData) {
      return NextResponse.json({ 
        success: false, 
        error: "botId e textData sao obrigatorios" 
      }, { status: 400 })
    }

    // Parse IDs from text (comma, newline, or space separated)
    const rawIds = textData
      .split(/[\n,;\s]+/)
      .map(s => s.trim())
      .filter(s => /^-?\d+$/.test(s))

    if (rawIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Nenhum ID valido encontrado",
        parseErrors: ["O texto nao contem IDs de chat validos"]
      })
    }

    // Get existing users for this bot to check for duplicates
    const { data: existingUsers } = await supabase
      .from("bot_users")
      .select("telegram_user_id")
      .eq("bot_id", botId)

    const existingIds = new Set((existingUsers || []).map(u => u.telegram_user_id))

    // Filter out duplicates
    const newIds = rawIds.filter(id => !existingIds.has(id))
    const duplicateCount = rawIds.length - newIds.length

    if (newIds.length === 0) {
      return NextResponse.json({
        success: true,
        imported: 0,
        skipped: rawIds.length,
        duplicates: duplicateCount,
        message: "Todos os IDs ja existem no bot"
      })
    }

    // Insert new users as imported
    // Note: For Telegram, telegram_user_id and chat_id are the same for private chats
    const usersToInsert = newIds.map(id => ({
      bot_id: botId,
      telegram_user_id: id,
      chat_id: id, // Same as telegram_user_id for private chats
      source: "imported",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))

    const { error: insertError } = await supabase
      .from("bot_users")
      .insert(usersToInsert)

    if (insertError) {
      console.error("[import] Error inserting users:", insertError)
      return NextResponse.json({
        success: false,
        error: insertError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      imported: newIds.length,
      skipped: 0,
      duplicates: duplicateCount
    })

  } catch (err) {
    console.error("[import] Unexpected error:", err)
    return NextResponse.json({ 
      success: false, 
      error: "Erro interno" 
    }, { status: 500 })
  }
}

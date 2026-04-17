import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  
  try {
    const { searchParams } = new URL(req.url)
    const botId = searchParams.get("bot_id")
    const telegramUserId = searchParams.get("telegram_user_id")

    console.log("[v0] chat/messages - bot_id:", botId, "telegram_user_id:", telegramUserId)
    
    if (!botId || !telegramUserId) {
      return NextResponse.json({ 
        error: "bot_id and telegram_user_id are required" 
      }, { status: 400 })
    }

    // Buscar as 100 mensagens mais recentes em ordem decrescente
    const { data: messagesDesc, error } = await supabase
      .from("bot_messages")
      .select("*")
      .eq("bot_id", botId)
      .eq("telegram_user_id", telegramUserId)
      .order("created_at", { ascending: false })
      .limit(100)

    // Inverter para ordem crescente (mais antigas primeiro) para exibicao no chat
    const messages = messagesDesc ? [...messagesDesc].reverse() : []

    console.log("[v0] chat/messages - encontrou", messages?.length || 0, "mensagens")
    
    if (error) {
      console.error("[chat/messages] Error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Filtrar mensagens de /start para nao poluir o chat
    const filteredMessages = (messages || []).filter(msg => {
      const content = msg.content?.trim()?.toLowerCase() || ""
      return content !== "/start" && !content.startsWith("/start ")
    })

    return NextResponse.json({ 
      messages: filteredMessages,
      count: filteredMessages.length
    })
  } catch (err) {
    console.error("[chat/messages] Error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

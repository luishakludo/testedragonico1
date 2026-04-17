import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const { botId, chatId, message, telegramUserId } = await request.json()

    if (!botId || !chatId || !message) {
      return NextResponse.json({ success: false, error: "Dados incompletos" }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Buscar o bot usando admin - o bot precisa existir no sistema
    const { data: bot, error: botError } = await supabaseAdmin
      .from("bots")
      .select("id, token, name, user_id")
      .eq("id", botId)
      .single()

    if (botError || !bot) {
      return NextResponse.json({ success: false, error: "Bot nao encontrado" }, { status: 404 })
    }

    // Enviar mensagem via Telegram API
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${bot.token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
        }),
      }
    )

    const telegramData = await telegramResponse.json()

    if (!telegramData.ok) {
      console.error("Telegram error:", telegramData)
      return NextResponse.json({ 
        success: false, 
        error: telegramData.description || "Erro ao enviar mensagem" 
      }, { status: 500 })
    }

    // Salvar mensagem no banco usando admin
    // Usar telegramUserId se fornecido, senao usar chatId
    const userIdToSave = telegramUserId || chatId
    const { error: saveError } = await supabaseAdmin
      .from("bot_messages")
      .insert({
        bot_id: botId,
        telegram_user_id: String(userIdToSave),
        telegram_chat_id: String(chatId),
        direction: "outgoing",
        message_type: "text",
        content: message,
        telegram_message_id: telegramData.result?.message_id,
      })

    if (saveError) {
      console.error("Erro ao salvar mensagem:", saveError)
      // Nao retorna erro pois a mensagem foi enviada
    }

    return NextResponse.json({ 
      success: true, 
      messageId: telegramData.result?.message_id 
    })

  } catch (error) {
    console.error("Erro ao enviar mensagem:", error)
    return NextResponse.json({ 
      success: false, 
      error: "Erro interno" 
    }, { status: 500 })
  }
}

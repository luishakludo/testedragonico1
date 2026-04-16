import { NextRequest, NextResponse } from "next/server"

// Register or unregister a Telegram webhook for a bot
// POST /api/telegram/register
// Body: { botToken: string, botId: string, action: "register" | "unregister" }

const BASE_URL = "https://dragonteste.onrender.com"

export async function POST(req: NextRequest) {
  try {
    const { botToken, botId, action } = await req.json()

    if (!botToken) {
      return NextResponse.json({ error: "Missing botToken" }, { status: 400 })
    }

    if (action === "unregister") {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/deleteWebhook`
      )
      const data = await res.json()
      return NextResponse.json(data)
    }

    // Para registrar, precisamos do botId (ID numerico do Telegram)
    // Se nao fornecido, extrair do token (formato: "123456789:AAxxxxxxx")
    const telegramBotId = botId || botToken.split(":")[0]
    
    if (!telegramBotId) {
      return NextResponse.json({ error: "Missing botId" }, { status: 400 })
    }

    // Usar BASE_URL hardcoded para a Render
    const webhookUrl = `${BASE_URL}/api/telegram/webhook/${telegramBotId}`

    console.log("[v0] Registrando webhook com URL:", webhookUrl)

    // Delete old webhook first
    await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook?drop_pending_updates=true`)

    // Set new webhook
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ["message", "callback_query", "my_chat_member"],
          drop_pending_updates: true,
        }),
      }
    )

    const data = await res.json()

    return NextResponse.json({
      success: data.ok,
      webhook_url: webhookUrl,
      telegram_response: data,
    })
  } catch (err) {
    console.error("[register] Error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

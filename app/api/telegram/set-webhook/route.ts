import { NextRequest, NextResponse } from "next/server"

// POST /api/telegram/set-webhook
// Register webhook URL with Telegram for a bot
export async function POST(req: NextRequest) {
  try {
    const { botId, token } = await req.json()

    if (!botId || !token) {
      return NextResponse.json({ error: "botId and token required" }, { status: 400 })
    }

    // Usa BASE_URL obrigatoriamente - URL da Render
    const baseUrl = process.env.BASE_URL
    
    if (!baseUrl) {
      return NextResponse.json({ 
        error: "BASE_URL nao configurada. Configure: https://dragonteste.onrender.com" 
      }, { status: 500 })
    }

    const webhookUrl = `${baseUrl}/api/telegram/webhook/${botId}`

    console.log("[v0] Setting webhook for bot:", botId, "URL:", webhookUrl, "BASE_URL:", baseUrl)

    // Set webhook with Telegram
    const telegramUrl = `https://api.telegram.org/bot${token}/setWebhook`
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "my_chat_member", "chat_member"]
      })
    })

    const result = await response.json()
    console.log("[v0] Telegram setWebhook result:", result)

    if (!result.ok) {
      return NextResponse.json({ 
        success: false, 
        error: result.description || "Failed to set webhook" 
      }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      webhookUrl,
      message: "Webhook configurado! Agora adicione o bot em um grupo como admin."
    })
  } catch (error: any) {
    console.error("[v0] Error setting webhook:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/telegram/set-webhook
// Remove webhook
export async function DELETE(req: NextRequest) {
  try {
    const { token } = await req.json()

    if (!token) {
      return NextResponse.json({ error: "token required" }, { status: 400 })
    }

    const telegramUrl = `https://api.telegram.org/bot${token}/deleteWebhook`
    const response = await fetch(telegramUrl, { method: "POST" })
    const result = await response.json()

    return NextResponse.json({ success: result.ok })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

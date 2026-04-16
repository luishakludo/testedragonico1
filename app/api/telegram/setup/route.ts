import { NextRequest, NextResponse } from "next/server"

// GET /api/telegram/setup?token=BOT_TOKEN
// Easy setup route to register webhook via browser
// Use your PRODUCTION URL, not preview URL!

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  
  if (!token) {
    return NextResponse.json({ 
      error: "Token obrigatorio",
      usage: "GET /api/telegram/setup?token=SEU_BOT_TOKEN",
      note: "Acesse esta URL no seu dominio de PRODUCAO, nao no preview!"
    }, { status: 400 })
  }

  // Build webhook URL from current request
  // IMPORTANT: This should be your PRODUCTION URL, not preview!
  const baseUrl = req.nextUrl.origin
  const webhookUrl = `${baseUrl}/api/telegram/webhook?token=${encodeURIComponent(token)}`

  // Check if this looks like a preview URL
  const isPreviewUrl = baseUrl.includes("vusercontent.net") || 
                       baseUrl.includes("localhost") ||
                       baseUrl.includes("vercel.app") && !process.env.VERCEL_PROJECT_PRODUCTION_URL

  // Delete old webhook first
  await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`)

  // Set new webhook
  const setRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    }),
  })
  const setData = await setRes.json()

  // Get webhook info to confirm
  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
  const infoData = await infoRes.json()

  return NextResponse.json({
    success: setData.ok,
    webhook_url: webhookUrl,
    warning: isPreviewUrl ? "ATENCAO: Voce parece estar usando uma URL de preview! O webhook so vai funcionar enquanto o preview estiver ativo. Para funcionar 24/7, acesse esta rota pela URL de PRODUCAO do seu deploy." : null,
    telegram_response: setData,
    current_webhook: infoData.result,
    instructions: [
      "1. Deploy seu projeto na Vercel",
      "2. Acesse: https://SEU-PROJETO.vercel.app/api/telegram/setup?token=SEU_BOT_TOKEN",
      "3. Verifique se 'webhook_url' mostra a URL de producao",
      "4. Teste enviando /start no Telegram"
    ]
  })
}

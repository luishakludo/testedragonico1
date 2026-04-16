import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  const BASE_URL = process.env.BASE_URL || "https://dragonteste.onrender.com"
  
  const supabase = getSupabase()
  
  // 1. Buscar bot pelo ID do Telegram
  const { data: bot, error: botError } = await supabase
    .from("bots")
    .select("*")
    .like("token", `${botId}:%`)
    .single()

  if (!bot?.token) {
    return NextResponse.json({ 
      error: "Bot nao encontrado", 
      botId,
      botError: botError?.message 
    }, { status: 404 })
  }

  // 2. URL correta do webhook
  const webhookUrl = `${BASE_URL}/api/telegram/webhook/${botId}`

  // 3. Deletar webhook antigo
  await fetch(`https://api.telegram.org/bot${bot.token}/deleteWebhook?drop_pending_updates=true`)

  // 4. Registrar webhook novo
  const setRes = await fetch(
    `https://api.telegram.org/bot${bot.token}/setWebhook?url=${encodeURIComponent(webhookUrl)}&drop_pending_updates=true`
  )
  const setData = await setRes.json()

  // 5. Verificar se funcionou
  const infoRes = await fetch(`https://api.telegram.org/bot${bot.token}/getWebhookInfo`)
  const infoData = await infoRes.json()

  return NextResponse.json({
    success: setData.ok,
    message: setData.ok ? "Webhook atualizado com sucesso!" : "Erro ao atualizar webhook",
    webhookUrl,
    telegramResponse: setData,
    currentWebhook: infoData.result,
    botId,
    botUuid: bot.id,
    botName: bot.name
  })
}

import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

// Funcao de envio de foto com botoes
async function sendTelegramPhoto(
  botToken: string,
  chatId: number | string,
  photoUrl: string,
  caption?: string,
  replyMarkup?: unknown
) {
  const url = `https://api.telegram.org/bot${botToken}/sendPhoto`
  const body: Record<string, unknown> = {
    chat_id: chatId,
    photo: photoUrl,
    parse_mode: "HTML",
  }
  if (caption) body.caption = caption
  if (replyMarkup) body.reply_markup = replyMarkup
  
  console.log("[TESTE] Enviando para Telegram:", JSON.stringify(body, null, 2))
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function GET(request: NextRequest) {
  const chatId = request.nextUrl.searchParams.get("chat")
  
  if (!chatId) {
    return NextResponse.json({ 
      erro: "Passe ?chat=SEU_CHAT_ID",
      exemplo: "/api/test/downsell/teste-envio?chat=5099610171"
    })
  }
  
  const supabaseAdmin = getSupabaseAdmin()
  
  // Buscar a ultima mensagem agendada com status "sent" para pegar os dados
  const { data: lastMsg } = await supabaseAdmin
    .from("scheduled_messages")
    .select("*")
    .eq("telegram_chat_id", chatId)
    .eq("message_type", "downsell")
    .order("created_at", { ascending: false })
    .limit(1)
    .single()
  
  if (!lastMsg) {
    return NextResponse.json({ erro: "Nenhuma mensagem de downsell encontrada para este chat" })
  }
  
  const metadata = lastMsg.metadata as Record<string, unknown> | null
  const botToken = metadata?.botToken as string
  const message = (metadata?.message as string) || "Teste de downsell"
  const medias = (metadata?.medias as string[]) || []
  const plans = (metadata?.plans as Array<{ id: string; price: number; buttonText: string }>) || []
  
  if (!botToken) {
    return NextResponse.json({ erro: "botToken nao encontrado no metadata" })
  }
  
  // Montar botoes - formato curto: ds_{shortMsgId}_{planIndex}_{priceInCents}
  // Limite de 64 chars do Telegram
  const planButtons: Array<Array<{ text: string; callback_data: string }>> = []
  const shortMsgId = String(lastMsg.id).slice(-8)
  
  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i]
    const priceInCents = Math.round((plan.price || 0) * 100)
    const callbackData = `ds_${shortMsgId}_${i}_${priceInCents}`
    
    planButtons.push([{
      text: plan.buttonText || `R$ ${(plan.price || 0).toFixed(2).replace(".", ",")}`,
      callback_data: callbackData
    }])
    
    console.log(`[TESTE] Callback: ${callbackData} (${callbackData.length} chars)`)
  }
  
  const replyMarkup = planButtons.length > 0 ? { inline_keyboard: planButtons } : undefined
  
  // Log detalhado
  console.log("[TESTE] ==================")
  console.log("[TESTE] Chat ID:", chatId)
  console.log("[TESTE] Bot Token:", botToken.substring(0, 10) + "...")
  console.log("[TESTE] Message:", message)
  console.log("[TESTE] Medias:", medias)
  console.log("[TESTE] Plans:", plans)
  console.log("[TESTE] Plan Buttons:", JSON.stringify(planButtons))
  console.log("[TESTE] Reply Markup:", JSON.stringify(replyMarkup))
  console.log("[TESTE] ==================")
  
  let resultado
  
  if (medias.length > 0) {
    // Enviar foto com botoes
    resultado = await sendTelegramPhoto(botToken, chatId, medias[0], message, replyMarkup)
  } else {
    // Enviar apenas texto com botoes
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`
    const body = {
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
      reply_markup: replyMarkup
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    resultado = await res.json()
  }
  
  console.log("[TESTE] Resultado Telegram:", JSON.stringify(resultado))
  
  return NextResponse.json({
    teste: "ENVIO_DOWNSELL",
    chat_id: chatId,
    mensagem_usada: message.substring(0, 50),
    midias: medias,
    planos: plans,
    botoes_montados: planButtons,
    reply_markup: replyMarkup,
    resultado_telegram: resultado,
    sucesso: resultado?.ok === true
  })
}

import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

// Simula o clique no botao do downsell para testar se o PIX e gerado corretamente
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const chatId = searchParams.get("chat") || "5099610171"
  const callback = searchParams.get("callback") // ex: ds_77993b15_0_1200
  
  const supabase = getSupabaseAdmin()
  
  // Se nao passou callback, buscar o ultimo downsell enviado
  let callbackData = callback
  let scheduledMsg = null
  
  if (!callbackData) {
    const { data: lastMsg } = await supabase
      .from("scheduled_messages")
      .select("*")
      .eq("telegram_chat_id", parseInt(chatId))
      .eq("message_type", "downsell")
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
    
    if (!lastMsg) {
      return NextResponse.json({ erro: "Nenhum downsell encontrado para este chat" })
    }
    
    scheduledMsg = lastMsg
    const shortMsgId = String(lastMsg.id).slice(-8)
    const metadata = lastMsg.metadata as Record<string, unknown>
    const plans = (metadata?.plans as Array<{ price: number }>) || []
    const priceInCents = Math.round((plans[0]?.price || 0) * 100)
    callbackData = `ds_${shortMsgId}_0_${priceInCents}`
  }
  
  // Parse do callback: ds_{shortMsgId}_{planIndex}_{priceInCents}
  const parts = callbackData.replace("ds_", "").split("_")
  const shortMsgId = parts[0] || ""
  const planIndex = parseInt(parts[1]) || 0
  const priceInCents = parseInt(parts[2]) || 0
  const price = priceInCents / 100
  
  // Buscar a mensagem original pelo shortMsgId
  if (!scheduledMsg) {
    const { data: foundMsg } = await supabase
      .from("scheduled_messages")
      .select("*")
      .like("id", `%${shortMsgId}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
    
    scheduledMsg = foundMsg
  }
  
  if (!scheduledMsg) {
    return NextResponse.json({ 
      erro: "Mensagem agendada nao encontrada",
      callback: callbackData,
      shortMsgId 
    })
  }
  
  const flowId = scheduledMsg.flow_id
  const botId = scheduledMsg.bot_id
  const msgMetadata = scheduledMsg.metadata as Record<string, unknown>
  const plans = (msgMetadata?.plans as Array<{ id: string; buttonText: string; price: number }>) || []
  const selectedPlan = plans[planIndex]
  const planName = selectedPlan?.buttonText || "Oferta Especial"
  
  // Buscar bot
  const { data: bot } = await supabase
    .from("bots")
    .select("user_id, token, name")
    .eq("id", botId)
    .single()
  
  if (!bot?.user_id) {
    return NextResponse.json({ 
      erro: "Bot nao encontrado",
      botId 
    })
  }
  
  // Buscar gateway pelo user_id (igual ao plano normal)
  const { data: gateway, error: gwError } = await supabase
    .from("user_gateways")
    .select("*")
    .eq("user_id", bot.user_id)
    .eq("is_active", true)
    .limit(1)
    .single()
  
  // Buscar flow config para ver as configuracoes de pagamento
  const { data: flow } = await supabase
    .from("flows")
    .select("config, name")
    .eq("id", flowId)
    .single()
  
  const flowConfig = (flow?.config as Record<string, unknown>) || {}
  const paymentMessages = flowConfig.paymentMessages || {}
  
  return NextResponse.json({
    teste: "SIMULAR_CLIQUE_DOWNSELL",
    callback_recebido: callbackData,
    parse_resultado: {
      shortMsgId,
      planIndex,
      priceInCents,
      price_reais: price
    },
    mensagem_agendada: {
      id: scheduledMsg.id,
      flow_id: flowId,
      status: scheduledMsg.status,
      planos_salvos: plans,
      plano_selecionado: selectedPlan
    },
    bot: {
      id: botId,
      name: bot.name,
      user_id: bot.user_id,
      has_token: !!bot.token
    },
    gateway: {
      encontrado: !!gateway,
      erro: gwError?.message,
      dados: gateway ? {
        id: gateway.id,
        gateway_name: gateway.gateway_name,
        is_active: gateway.is_active,
        has_access_token: !!gateway.access_token,
        access_token_preview: gateway.access_token ? `${gateway.access_token.substring(0, 20)}...` : null
      } : null
    },
    flow: {
      id: flowId,
      name: flow?.name,
      payment_messages_config: paymentMessages
    },
    proximos_passos: gateway?.access_token 
      ? "Gateway OK! O PIX sera gerado usando createPixPayment com as configuracoes de paymentMessages do fluxo."
      : "ERRO: Gateway nao encontrado ou sem access_token. Configure o gateway de pagamento.",
    funcoes_usadas: [
      "createPixPayment({ accessToken, amount, description, payerEmail })",
      "sendPixPaymentMessages({ botToken, chatId, pixCode, qrCodeUrl, amount, productName, paymentId, config })"
    ]
  })
}

import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

// API de teste que busca dados REAIS do usuario do Telegram pelo ID
export async function GET(request: NextRequest) {
  const supabase = getSupabase()
  const { searchParams } = request.nextUrl
  
  // ID real do usuario do Telegram
  const telegramUserId = searchParams.get("telegramUserId") || "5099610171"
  const amount = Number(searchParams.get("amount") || "50")
  const planName = searchParams.get("planName") || "Plano Teste"
  
  try {
    // Buscar bot com token para chamar API do Telegram
    const { data: bot } = await supabase
      .from("bots")
      .select("id, user_id, name, token")
      .limit(1)
      .single()
    
    if (!bot?.token) {
      return NextResponse.json({ error: "Bot sem token configurado" }, { status: 404 })
    }
    
    // Buscar dados REAIS do usuario via API do Telegram
    let telegramUser = {
      first_name: "Usuario",
      last_name: "",
      username: ""
    }
    
    const tgResponse = await fetch(
      `https://api.telegram.org/bot${bot.token}/getChat?chat_id=${telegramUserId}`
    )
    const tgData = await tgResponse.json()
    
    if (tgData.ok && tgData.result) {
      telegramUser = {
        first_name: tgData.result.first_name || "Usuario",
        last_name: tgData.result.last_name || "",
        username: tgData.result.username || ""
      }
    } else {
      return NextResponse.json({ 
        error: "Nao foi possivel buscar dados do usuario no Telegram",
        telegramError: tgData
      }, { status: 400 })
    }
    
    // Criar pagamento com dados reais do Telegram
    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        user_id: bot.user_id,
        bot_id: bot.id,
        telegram_user_id: telegramUserId,
        telegram_username: telegramUser.username,
        telegram_first_name: telegramUser.first_name,
        telegram_last_name: telegramUser.last_name,
        gateway: "mercadopago",
        external_payment_id: `TEST_${Date.now()}`,
        amount,
        description: `Pagamento - ${planName}`,
        status: "pending",
      })
      .select()
      .single()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      message: "Pagamento criado com dados REAIS do Telegram!",
      telegramUser: {
        id: telegramUserId,
        nome: `${telegramUser.first_name} ${telegramUser.last_name}`.trim(),
        username: telegramUser.username ? `@${telegramUser.username}` : null,
      },
      payment: {
        id: payment.id,
        amount: `R$ ${amount.toFixed(2)}`,
        status: payment.status,
      },
      nextStep: "Acesse /payments para ver o pagamento"
    })
    
  } catch (err) {
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : "Erro desconhecido" 
    }, { status: 500 })
  }
}

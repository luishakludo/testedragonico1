import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"
import { createPixPayment } from "@/lib/payments/gateways/mercadopago"

export async function GET(request: NextRequest) {
  const supabase = getSupabase()
  const searchParams = request.nextUrl.searchParams
  const botId = searchParams.get("botId")
  const amount = parseFloat(searchParams.get("amount") || "10")
  const planName = searchParams.get("planName") || "Plano Teste"
  
  if (!botId) {
    return NextResponse.json({ 
      error: "botId obrigatorio",
      usage: "/api/test/create-payment?botId=XXX&amount=10&planName=Teste"
    }, { status: 400 })
  }
  
  try {
    // Buscar user_id do bot primeiro
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("user_id, name")
      .eq("id", botId)
      .single()
    
    if (botError || !bot?.user_id) {
      return NextResponse.json({ 
        error: "Bot nao encontrado",
        botId,
        details: botError?.message
      }, { status: 404 })
    }
    
    // Buscar gateway do USUARIO (gateway e global para todos os bots)
    const { data: gateways, error: gwError } = await supabase
      .from("user_gateways")
      .select("*")
      .eq("user_id", bot.user_id)
      .eq("is_active", true)
    
    if (gwError) {
      return NextResponse.json({ 
        error: "Erro ao buscar gateway",
        userId: bot.user_id,
        details: gwError.message
      }, { status: 500 })
    }
    
    if (!gateways || gateways.length === 0) {
      return NextResponse.json({ 
        error: "Nenhum gateway ativo encontrado para este usuario",
        userId: bot.user_id,
        hint: "Va em Gateways e conecte seu Mercado Pago"
      }, { status: 404 })
    }
    
    const gateway = gateways[0]
    
    // Gerar PIX
    const pixResult = await createPixPayment({
      accessToken: gateway.access_token,
      amount,
      description: `Pagamento - ${planName}`,
      payerEmail: "luismarquesdevp@gmail.com",
    })
    
    if (!pixResult.success) {
      return NextResponse.json({ 
        error: "Erro ao gerar PIX",
        details: pixResult.error
      }, { status: 500 })
    }
    
    // Salvar pagamento no banco com dados do usuario Telegram
    const { data: payment, error: insertError } = await supabase
      .from("payments")
      .insert({
        user_id: bot?.user_id,
        bot_id: botId,
        telegram_user_id: "123456789",
        telegram_username: "usuario_teste",
        telegram_first_name: "Joao",
        telegram_last_name: "Silva",
        gateway: gateway.gateway_name || "mercadopago",
        external_payment_id: pixResult.paymentId,
        amount,
        description: `Pagamento - ${planName}`,
        qr_code: pixResult.qrCode,
        qr_code_url: pixResult.qrCodeUrl,
        copy_paste: pixResult.copyPaste,
        status: "pending",
      })
      .select()
      .single()
    
    if (insertError) {
      return NextResponse.json({ 
        error: "Erro ao salvar pagamento",
        details: insertError.message
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      message: "Pagamento criado com sucesso!",
      payment: {
        id: payment.id,
        amount,
        planName,
        status: "pending",
        external_payment_id: pixResult.paymentId,
        qrCodeUrl: pixResult.qrCodeUrl,
        copyPaste: pixResult.copyPaste,
      },
      nextStep: "Acesse /financeiro para ver o pagamento pendente"
    })
    
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ 
      error: "Erro interno",
      details: errorMsg
    }, { status: 500 })
  }
}

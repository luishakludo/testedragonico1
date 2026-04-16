import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
import { createPayment } from "@/lib/payments/createPayment"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, botId, gateway, amount, description, telegramUserId } = body

    if (!userId || !gateway || !amount) {
      return NextResponse.json(
        { error: "userId, gateway e amount sao obrigatorios" },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    // Busca o gateway do usuario
    const { data: gatewayData, error: gatewayError } = await supabase
      .from("user_gateways")
      .select("*")
      .eq("user_id", userId)
      .eq("gateway_name", gateway)
      .eq("is_active", true)
      .single()

    if (gatewayError || !gatewayData) {
      return NextResponse.json(
        { error: "Gateway nao encontrado ou nao conectado" },
        { status: 404 }
      )
    }

    // Cria o pagamento usando o gateway apropriado
    const result = await createPayment({
      gateway: gateway,
      accessToken: gatewayData.access_token,
      amount: Number(amount),
      description: description || `Pagamento de R$ ${amount}`,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Erro ao criar pagamento" },
        { status: 500 }
      )
    }

    // Salva o pagamento no banco
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        user_id: userId,
        bot_id: botId || null,
        telegram_user_id: telegramUserId || null,
        gateway: gateway,
        external_payment_id: result.paymentId,
        amount: amount,
        description: description,
        qr_code: result.qrCode,
        qr_code_url: result.qrCodeUrl,
        copy_paste: result.copyPaste,
        status: result.status,
      })
      .select()
      .single()

    if (paymentError) {
      console.error("Error saving payment:", paymentError)
      // Retorna o resultado mesmo se falhar ao salvar
    }

    return NextResponse.json({
      success: true,
      paymentId: payment?.id || result.paymentId,
      externalPaymentId: result.paymentId,
      qrCode: result.qrCode,
      qrCodeUrl: result.qrCodeUrl,
      copyPaste: result.copyPaste,
      status: result.status,
    })
  } catch (error) {
    console.error("Error in payment creation:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}

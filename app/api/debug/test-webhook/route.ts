import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

// GET: Testar busca de pagamento e consulta ao MP
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const paymentId = searchParams.get("paymentId")
  
  if (!paymentId) {
    return NextResponse.json({ 
      error: "Falta paymentId na query string",
      uso: "/api/debug/test-webhook?paymentId=123456789"
    })
  }

  const supabase = getSupabaseAdmin()

  // 1. Buscar pagamento no banco
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("*")
    .eq("external_payment_id", paymentId)
    .single()

  if (!payment) {
    return NextResponse.json({
      step: "1_buscar_pagamento",
      error: "Pagamento nao encontrado no banco",
      paymentId,
      dbError: paymentError?.message
    })
  }

  // 2. Buscar gateway
  const { data: gateway, error: gatewayError } = await supabase
    .from("user_gateways")
    .select("access_token, gateway_name, bot_id")
    .eq("bot_id", payment.bot_id)
    .eq("is_active", true)
    .single()

  if (!gateway) {
    return NextResponse.json({
      step: "2_buscar_gateway",
      error: "Gateway nao encontrado para este bot",
      botId: payment.bot_id,
      dbError: gatewayError?.message,
      payment: {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        bot_id: payment.bot_id
      }
    })
  }

  // 3. Consultar API do MP
  let mpStatus = null
  let mpError = null
  try {
    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${gateway.access_token}`,
        },
      }
    )
    
    if (mpResponse.ok) {
      const mpData = await mpResponse.json()
      mpStatus = {
        status: mpData.status,
        status_detail: mpData.status_detail,
        date_approved: mpData.date_approved,
        transaction_amount: mpData.transaction_amount
      }
    } else {
      mpError = `HTTP ${mpResponse.status}: ${await mpResponse.text()}`
    }
  } catch (err) {
    mpError = String(err)
  }

  // 4. Resultado
  return NextResponse.json({
    success: true,
    pagamentoNoBanco: {
      id: payment.id,
      status: payment.status,
      amount: payment.amount,
      bot_id: payment.bot_id,
      external_payment_id: payment.external_payment_id,
      telegram_user_id: payment.telegram_user_id
    },
    gateway: {
      bot_id: gateway.bot_id,
      gateway_name: gateway.gateway_name,
      hasAccessToken: !!gateway.access_token
    },
    statusNoMercadoPago: mpStatus,
    mpError,
    conclusao: mpStatus?.status === "approved" && payment.status !== "approved"
      ? "PROBLEMA: MP diz approved mas banco diz " + payment.status + " - webhook nao esta funcionando!"
      : mpStatus?.status === payment.status
        ? "OK: Status igual no MP e no banco"
        : "Status diferente - verificar webhook"
  })
}

// POST: Simular webhook manualmente para um pagamento
export async function POST(request: NextRequest) {
  const body = await request.json()
  const paymentId = body.paymentId
  
  if (!paymentId) {
    return NextResponse.json({ error: "Falta paymentId no body" })
  }

  const supabase = getSupabaseAdmin()

  // 1. Buscar pagamento
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("*")
    .eq("external_payment_id", String(paymentId))
    .single()

  if (!payment) {
    return NextResponse.json({ error: "Pagamento nao encontrado", paymentError })
  }

  // 2. Buscar gateway
  const { data: gateway } = await supabase
    .from("user_gateways")
    .select("access_token")
    .eq("bot_id", payment.bot_id)
    .eq("is_active", true)
    .single()

  if (!gateway?.access_token) {
    return NextResponse.json({ error: "Gateway sem access_token" })
  }

  // 3. Consultar MP
  const mpResponse = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      headers: {
        Authorization: `Bearer ${gateway.access_token}`,
      },
    }
  )

  if (!mpResponse.ok) {
    return NextResponse.json({ 
      error: "Erro ao consultar MP", 
      status: mpResponse.status,
      body: await mpResponse.text()
    })
  }

  const mpData = await mpResponse.json()
  const newStatus = mpData.status

  // 4. Atualizar banco
  const { error: updateError } = await supabase
    .from("payments")
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id)

  return NextResponse.json({
    success: true,
    paymentId,
    statusAnterior: payment.status,
    statusNovo: newStatus,
    atualizado: !updateError,
    erro: updateError?.message
  })
}

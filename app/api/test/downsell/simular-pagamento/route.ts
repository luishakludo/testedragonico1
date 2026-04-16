import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// API de teste para simular a criacao de pagamento downsell
// GET /api/test/downsell/simular-pagamento?bot_id=xxx&price=29.90
export async function GET(req: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  const { searchParams } = new URL(req.url)
  const botId = searchParams.get("bot_id")
  const priceParam = searchParams.get("price") || "29.90"
  const price = parseFloat(priceParam)
  
  const debug: Record<string, unknown> = {
    step: "inicio",
    botId,
    price,
    timestamp: new Date().toISOString()
  }
  
  try {
    // 1. Buscar todos os bots se nao especificar
    if (!botId) {
      const { data: allBots, error: botsError } = await supabase
        .from("bots")
        .select("id, name, telegram_bot_id, user_id")
        .limit(10)
      
      return NextResponse.json({
        message: "Especifique bot_id como parametro. Bots disponiveis:",
        bots: allBots,
        error: botsError?.message,
        exemplo: "/api/test/downsell/simular-pagamento?bot_id=UUID_DO_BOT&price=29.90"
      })
    }
    
    debug.step = "buscando_bot"
    
    // 2. Buscar o bot
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("id, name, user_id, telegram_bot_id")
      .eq("id", botId)
      .single()
    
    debug.bot = bot
    debug.botError = botError?.message
    
    if (!bot) {
      return NextResponse.json({ 
        success: false, 
        error: "Bot nao encontrado",
        debug 
      }, { status: 404 })
    }
    
    debug.step = "buscando_gateway"
    
    // 3. Buscar gateway do user_id do bot
    const { data: gateway, error: gwError } = await supabase
      .from("user_gateways")
      .select("id, user_id, gateway_name, is_active, access_token")
      .eq("user_id", bot.user_id)
      .eq("is_active", true)
      .limit(1)
      .single()
    
    debug.gateway = gateway ? {
      id: gateway.id,
      user_id: gateway.user_id,
      gateway_name: gateway.gateway_name,
      is_active: gateway.is_active,
      has_access_token: !!gateway.access_token
    } : null
    debug.gatewayError = gwError?.message
    
    if (!gateway) {
      // Buscar todos os gateways do usuario para debug
      const { data: allGateways } = await supabase
        .from("user_gateways")
        .select("id, user_id, gateway_name, is_active")
        .eq("user_id", bot.user_id)
      
      debug.allUserGateways = allGateways
      
      return NextResponse.json({
        success: false,
        error: "Gateway nao encontrado ou inativo",
        debug
      }, { status: 400 })
    }
    
    debug.step = "buscando_flow"
    
    // 4. Buscar flow vinculado ao bot
    const { data: flowDirect } = await supabase
      .from("flows")
      .select("id, name")
      .eq("bot_id", botId)
      .limit(1)
      .single()
    
    let flowId = flowDirect?.id || null
    
    if (!flowId) {
      const { data: flowBot } = await supabase
        .from("flow_bots")
        .select("flow_id")
        .eq("bot_id", botId)
        .limit(1)
        .single()
      
      flowId = flowBot?.flow_id || null
    }
    
    debug.flowId = flowId
    
    debug.step = "simulando_insert"
    
    // 5. Simular o insert do pagamento (sem realmente inserir)
    const paymentData = {
      user_id: bot.user_id,
      bot_id: botId,
      flow_id: flowId,
      telegram_user_id: "123456789",
      telegram_username: "teste_user",
      telegram_first_name: "Teste",
      telegram_last_name: "User",
      amount: price,
      status: "pending",
      payment_method: "pix",
      gateway: gateway.gateway_name || "mercadopago",
      external_payment_id: "TEST_" + Date.now(),
      description: "Pagamento - Downsell Teste",
      product_name: "Downsell Teste",
      product_type: "downsell",
      qr_code: "TEST_QR_CODE",
      qr_code_url: "https://example.com/qr.png",
      copy_paste: "TEST_PIX_COPY_PASTE",
      pix_code: "TEST_PIX_CODE",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    
    debug.paymentData = paymentData
    
    // 6. Verificar se os campos estao corretos comparando com um pagamento existente
    const { data: samplePayment, error: sampleError } = await supabase
      .from("payments")
      .select("*")
      .eq("bot_id", botId)
      .limit(1)
      .single()
    
    debug.sampleExistingPayment = samplePayment ? {
      id: samplePayment.id,
      user_id: samplePayment.user_id,
      bot_id: samplePayment.bot_id,
      flow_id: samplePayment.flow_id,
      product_type: samplePayment.product_type,
      status: samplePayment.status,
      amount: samplePayment.amount
    } : null
    debug.samplePaymentError = sampleError?.message
    
    // 7. Verificar pagamentos downsell existentes
    const { data: downsellPayments, error: dsError } = await supabase
      .from("payments")
      .select("id, user_id, bot_id, product_type, status, amount, created_at")
      .eq("product_type", "downsell")
      .order("created_at", { ascending: false })
      .limit(5)
    
    debug.existingDownsellPayments = downsellPayments
    debug.downsellPaymentsError = dsError?.message
    
    // 8. Testar insert real (opcional - com parametro insert=true)
    const shouldInsert = searchParams.get("insert") === "true"
    
    if (shouldInsert) {
      debug.step = "inserindo_pagamento_real"
      
      const { data: insertedPayment, error: insertError } = await supabase
        .from("payments")
        .insert(paymentData)
        .select()
        .single()
      
      debug.insertedPayment = insertedPayment
      debug.insertError = insertError?.message
      
      if (insertError) {
        return NextResponse.json({
          success: false,
          error: "Erro ao inserir pagamento",
          debug
        }, { status: 500 })
      }
      
      return NextResponse.json({
        success: true,
        message: "Pagamento downsell inserido com sucesso!",
        paymentId: insertedPayment?.id,
        debug
      })
    }
    
    debug.step = "completo"
    
    return NextResponse.json({
      success: true,
      message: "Simulacao completa - dados prontos para insert",
      info: "Adicione ?insert=true para realmente criar o pagamento",
      paymentDataToInsert: paymentData,
      debug
    })
    
  } catch (error) {
    debug.step = "erro"
    debug.error = error instanceof Error ? error.message : String(error)
    
    return NextResponse.json({
      success: false,
      error: "Erro interno",
      debug
    }, { status: 500 })
  }
}

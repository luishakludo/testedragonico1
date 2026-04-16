import { getSupabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

// API simples - so acessar o link e ver o JSON
// GET /api/debug/order-bump-test
export async function GET() {
  const supabase = getSupabaseAdmin()
  const flowId = "bd37e11c-705a-4bf5-81a0-ccefdd2fcad0"
  const loggedUserId = "7db32fb5-e69a-42ff-9157-f92fc30269a1" // Usuario que esta logado
  
  // Buscar flow
  const { data: flow } = await supabase
    .from("flows")
    .select("*")
    .eq("id", flowId)
    .single()
  
  // Buscar bot se tiver
  let bot = null
  if (flow?.bot_id) {
    const { data: botData } = await supabase
      .from("bots")
      .select("*")
      .eq("id", flow.bot_id)
      .single()
    bot = botData
  }
  
  // Buscar o bot que TEM os order bumps (65f4a521-b310-4638-bfb3-522895406e30)
  const obBotId = "65f4a521-b310-4638-bfb3-522895406e30"
  const { data: obBot, error: obBotError } = await supabase
    .from("bots")
    .select("id, name, user_id")
    .eq("id", obBotId)
    .single()
  
  // Buscar TODOS os bots sem user_id para debug
  const { data: orphanBots, error: orphanBotsError } = await supabase
    .from("bots")
    .select("id, name, user_id")
    .is("user_id", null)
    .limit(10)
  
  // Buscar pagamentos com user_id null
  const { data: nullUserPayments, error: nullPaymentsError } = await supabase
    .from("payments")
    .select("id, bot_id, user_id, product_type, amount, status, created_at")
    .is("user_id", null)
    .order("created_at", { ascending: false })
    .limit(20)
  
  // TODOS os pagamentos recentes
  const { data: allPayments } = await supabase
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50)
  
  // Pagamentos desse flow especificamente
  const { data: flowPayments } = await supabase
    .from("payments")
    .select("*")
    .eq("flow_id", flowId)
    .order("created_at", { ascending: false })
    .limit(20)
  
  // Filtrar order bumps
  const allOrderBumps = allPayments?.filter(p => p.product_type?.includes("order_bump")) || []
  const flowOrderBumps = flowPayments?.filter(p => p.product_type?.includes("order_bump")) || []
  
  // Buscar bots do sistema para referencia
  const { data: allBots } = await supabase
    .from("bots")
    .select("id, name")
    .limit(10)
  
  return NextResponse.json({
    flow: { 
      id: flow?.id, 
      name: flow?.name,
      bot_id: flow?.bot_id,
      ALERTA: flow?.bot_id ? null : "FLOW SEM BOT_ID - ISSO PODE SER O PROBLEMA!"
    },
    bot: bot ? { id: bot.id, name: bot.name, user_id: bot.user_id } : "NENHUM BOT ASSOCIADO",
    order_bump_config: flow?.config?.orderBump?.inicial,
    
    pagamentos_deste_flow: {
      total: flowPayments?.length || 0,
      com_order_bump: flowOrderBumps.length,
      lista: flowPayments?.map(p => ({
        id: p.id,
        bot_id: p.bot_id,
        valor: p.amount,
        status: p.status,
        tipo: p.product_type,
        produto: p.product_name,
        data: p.created_at
      }))
    },
    
    todos_pagamentos_recentes: {
      total: allPayments?.length || 0,
      com_order_bump: allOrderBumps.length,
      order_bumps: allOrderBumps.map(p => ({
        id: p.id,
        bot_id: p.bot_id,
        flow_id: p.flow_id,
        valor: p.amount,
        status: p.status,
        tipo: p.product_type,
        data: p.created_at
      })),
      ultimos_10: allPayments?.slice(0, 10).map(p => ({
        id: p.id,
        bot_id: p.bot_id,
        flow_id: p.flow_id,
        valor: p.amount,
        status: p.status,
        tipo: p.product_type,
        data: p.created_at
      }))
    },
    
    bots_no_sistema: allBots,
    
    bot_com_order_bumps: obBot ? {
      id: obBot.id,
      name: obBot.name,
      user_id: obBot.user_id,
      IMPORTANTE: "Este bot tem os order bumps salvos. O user_id dele precisa ser o mesmo do usuario logado no painel."
    } : "NAO ENCONTRADO",
    
    // DEBUG: Pagamentos com user_id NULL
    pagamentos_sem_user_id: {
      total: nullUserPayments?.length || 0,
      error: nullPaymentsError?.message || null,
      lista: nullUserPayments?.map(p => ({
        id: p.id,
        bot_id: p.bot_id,
        user_id: p.user_id,
        tipo: p.product_type,
        valor: p.amount,
        status: p.status,
        data: p.created_at
      }))
    },
    
    // DEBUG: Bots orfaos (sem user_id)
    bots_orfaos: {
      total: orphanBots?.length || 0,
      error: orphanBotsError?.message || null,
      lista: orphanBots
    },
    
    // DEBUG: Erro ao buscar bot 65f4a521
    debug_ob_bot: {
      found: !!obBot,
      error: obBotError?.message || null,
      data: obBot
    },
    
    diagnostico: {
      flow_tem_bot: !!flow?.bot_id,
      order_bump_ativo: !!flow?.config?.orderBump?.inicial?.enabled,
      total_order_bumps_sistema: allOrderBumps.length,
      total_pagamentos_sem_user_id: nullUserPayments?.length || 0,
      total_bots_orfaos: orphanBots?.length || 0,
      logged_user_id: loggedUserId,
      problema: !flow?.bot_id 
        ? "FLOW NAO TEM BOT_ID ASSOCIADO" 
        : allOrderBumps.length === 0 
          ? "NENHUM ORDER BUMP FOI SALVO NO SISTEMA"
          : (nullUserPayments?.length || 0) > 0
            ? "EXISTEM PAGAMENTOS COM USER_ID NULL - ESSES NAO APARECEM NO PAINEL"
            : "OK"
    }
  })
}

// POST /api/debug/order-bump-test - Simula criacao de pagamento com order bump
export async function POST(request: Request) {
  const body = await request.json()
  const { bot_id, user_id, flow_id, amount, with_order_bump } = body
  
  if (!bot_id || !user_id) {
    return NextResponse.json({ error: "bot_id e user_id sao obrigatorios" }, { status: 400 })
  }
  
  const supabase = getSupabaseAdmin()
  
  const testAmount = amount || 23.00
  const productType = with_order_bump ? "plan_order_bump" : "plan"
  const description = with_order_bump ? "Plano Teste + Order Bump" : "Plano Teste"
  
  // Simular criacao de pagamento igual ao order bump faz
  const paymentData = {
    bot_id,
    user_id,
    flow_id: flow_id || null,
    amount: testAmount,
    status: "pending",
    payment_method: "pix",
    gateway: "mercadopago",
    external_payment_id: `test_${Date.now()}`,
    copy_paste: "00020126360014br.gov.bcb.pix0114+5579991399006520400005303986540523.005802BR5925TESTE6009Sao Paulo",
    pix_code: "00020126360014br.gov.bcb.pix0114+5579991399006520400005303986540523.005802BR5925TESTE6009Sao Paulo",
    qr_code: null,
    qr_code_url: null,
    telegram_user_id: "123456789",
    telegram_chat_id: "123456789",
    telegram_username: "test_user",
    telegram_first_name: "Test",
    telegram_last_name: "User",
    description: `Pagamento - ${description}`,
    product_name: description,
    product_type: productType,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  
  console.log("[v0] DEBUG - Inserting test payment:", JSON.stringify(paymentData))
  
  const { data: savedPayment, error: saveError } = await supabase
    .from("payments")
    .insert(paymentData)
    .select()
    .single()
  
  if (saveError) {
    console.error("[v0] DEBUG - Error saving test payment:", saveError)
    return NextResponse.json({ 
      success: false, 
      error: saveError.message,
      error_details: saveError,
      attempted_data: paymentData
    }, { status: 500 })
  }
  
  console.log("[v0] DEBUG - Test payment saved:", savedPayment?.id)
  
  // Verificar se aparece na query do painel de vendas
  const { data: verifyPayment, error: verifyError } = await supabase
    .from("payments")
    .select("*")
    .eq("id", savedPayment.id)
    .single()
  
  return NextResponse.json({
    success: true,
    message: "Pagamento de teste criado",
    payment: savedPayment,
    verification: verifyPayment,
    verify_error: verifyError?.message || null,
    product_type_used: productType,
    with_order_bump
  })
}

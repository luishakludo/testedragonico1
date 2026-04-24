import { getSupabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

// API de teste para debugar entrega de order bump
// Acesse: /api/debug/test-delivery

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  const debug: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    step: "iniciando"
  }

  try {
    // Usar cliente Supabase Admin do projeto (tem credenciais hardcoded)
    const supabase = getSupabaseAdmin()

    // 1. Buscar todos os bots
    debug.step = "buscando_bots"
    const { data: bots, error: botsError } = await supabase
      .from("bots")
      .select("id, name, user_id, token")
      .limit(10)

    if (botsError) {
      return NextResponse.json({ 
        success: false, 
        step: "buscando_bots",
        error: botsError.message,
        details: botsError
      }, { status: 500 })
    }

    debug.bots_count = bots?.length || 0
    debug.bots = bots

    if (!bots || bots.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: "Nenhum bot encontrado",
        debug 
      }, { status: 404 })
    }

    const bot = bots[0]
    debug.selected_bot = bot

    // 2. Buscar fluxos do bot
    debug.step = "buscando_fluxos"
    const { data: flows, error: flowsError } = await supabase
      .from("flows")
      .select("id, name, config, is_active")
      .eq("bot_id", bot.id)
      .limit(5)

    if (flowsError) {
      return NextResponse.json({ 
        success: false, 
        step: "buscando_fluxos",
        error: flowsError.message,
        bot: bot,
        details: flowsError
      }, { status: 500 })
    }

    debug.flows_count = flows?.length || 0
    
    // Pegar fluxo ativo ou o primeiro
    const activeFlow = flows?.find(f => f.is_active) || flows?.[0]
    
    if (!activeFlow) {
      return NextResponse.json({ 
        success: false, 
        error: "Nenhum fluxo encontrado",
        bot: bot,
        flows: flows,
        debug 
      }, { status: 404 })
    }

    const flowConfig = activeFlow.config as Record<string, unknown> || {}
    
    debug.selected_flow = {
      id: activeFlow.id,
      name: activeFlow.name,
      is_active: activeFlow.is_active
    }

    // 3. Extrair configuracoes do fluxo
    debug.step = "analisando_config"
    
    const deliverables = (flowConfig.deliverables as Array<Record<string, unknown>>) || []
    debug.deliverables = deliverables
    debug.mainDeliverableId = flowConfig.mainDeliverableId || "NAO_CONFIGURADO"

    const plans = (flowConfig.plans as Array<Record<string, unknown>>) || []
    debug.plans = plans

    const orderBumpConfig = flowConfig.orderBump as Record<string, unknown> || {}
    debug.orderBump_config_completo = orderBumpConfig
    
    const orderBumpInicial = orderBumpConfig.inicial as Record<string, unknown> || {}
    debug.orderBump_inicial = orderBumpInicial

    // 4. Buscar pagamentos
    debug.step = "buscando_pagamentos"
    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select("id, status, product_type, amount, telegram_user_id, metadata, created_at")
      .eq("bot_id", bot.id)
      .order("created_at", { ascending: false })
      .limit(10)

    if (paymentsError) {
      debug.payments_error = paymentsError.message
    }

    debug.pagamentos = payments || []

    // 5. Filtrar order bumps
    const obPayments = payments?.filter(p => 
      p.product_type === "plan_order_bump" || 
      p.product_type === "order_bump" ||
      p.product_type === "pack_order_bump"
    ) || []

    debug.pagamentos_order_bump = obPayments

    // 6. Diagnostico
    debug.step = "diagnostico"
    
    if (obPayments.length > 0) {
      const payment = obPayments[0]
      const metadata = payment.metadata as Record<string, unknown> || {}
      
      debug.diagnostico = {
        pagamento: {
          id: payment.id,
          product_type: payment.product_type,
          status: payment.status,
          metadata: metadata
        },
        verificacoes: {
          tem_order_bump_deliverable_id_no_metadata: !!metadata.order_bump_deliverable_id,
          order_bump_deliverable_id: metadata.order_bump_deliverable_id || "VAZIO",
          tem_plan_deliverable_id: !!metadata.plan_deliverable_id,
          plan_deliverable_id: metadata.plan_deliverable_id || "VAZIO",
          config_global_deliverable_id: orderBumpInicial.deliverableId || "VAZIO",
          config_global_delivery_type: orderBumpInicial.deliveryType || "same"
        },
        problema: !metadata.order_bump_deliverable_id && !orderBumpInicial.deliverableId
          ? "PROBLEMA: Nenhum deliverableId de order bump configurado!"
          : "VERIFICAR: Verifique se o deliverableId existe na lista de entregaveis"
      }
    } else {
      debug.diagnostico = "Nenhum pagamento de order bump encontrado"
    }

    // 7. Buscar user_flow_state
    debug.step = "buscando_states"
    const { data: states } = await supabase
      .from("user_flow_state")
      .select("telegram_user_id, status, metadata, updated_at")
      .eq("bot_id", bot.id)
      .order("updated_at", { ascending: false })
      .limit(5)

    debug.user_flow_states = states || []

    debug.step = "concluido"
    debug.success = true

    return NextResponse.json(debug, { 
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    })

  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      step: debug.step,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

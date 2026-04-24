import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// API de teste para debugar entrega de order bump
// Acesse: /api/debug/test-delivery
// Não precisa passar nenhum parâmetro - puxa tudo do banco automaticamente

export async function GET() {
  const supabase = await createClient()
  const debug: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    step: "iniciando"
  }

  try {
    // 1. Buscar todos os bots
    debug.step = "buscando_bots"
    const { data: bots, error: botsError } = await supabase
      .from("bots")
      .select("*")
      .limit(10)

    if (botsError) {
      debug.error = botsError
      return NextResponse.json({ success: false, debug }, { status: 500 })
    }

    debug.bots_count = bots?.length || 0
    debug.bots = bots?.map(b => ({
      id: b.id,
      name: b.name,
      username: b.username,
      user_id: b.user_id
    }))

    if (!bots || bots.length === 0) {
      debug.error = "Nenhum bot encontrado"
      return NextResponse.json({ success: false, debug }, { status: 404 })
    }

    // Pegar o primeiro bot para teste
    const bot = bots[0]
    debug.selected_bot = { id: bot.id, name: bot.name, username: bot.username }

    // 2. Buscar fluxos do bot
    debug.step = "buscando_fluxos"
    const { data: flows, error: flowsError } = await supabase
      .from("flows")
      .select("*")
      .eq("bot_id", bot.id)
      .eq("is_active", true)
      .limit(5)

    if (flowsError) {
      debug.error = flowsError
      return NextResponse.json({ success: false, debug }, { status: 500 })
    }

    debug.flows_count = flows?.length || 0

    if (!flows || flows.length === 0) {
      debug.error = "Nenhum fluxo ativo encontrado para este bot"
      return NextResponse.json({ success: false, debug }, { status: 404 })
    }

    const flow = flows[0]
    const flowConfig = flow.config as Record<string, unknown> || {}
    
    debug.selected_flow = {
      id: flow.id,
      name: flow.name,
      type: flow.type
    }

    // 3. Analisar configuração do fluxo - DETALHADO
    debug.step = "analisando_config"
    
    // Entregáveis configurados - MOSTRA TUDO
    const deliverables = (flowConfig.deliverables as Array<Record<string, unknown>>) || []
    debug.deliverables = deliverables.map(d => ({
      id: d.id,
      name: d.name,
      type: d.type,
      link: d.link || null,
      vipGroupChatId: d.vipGroupChatId || null,
      vipGroupName: d.vipGroupName || null
    }))
    debug.mainDeliverableId = flowConfig.mainDeliverableId || "NAO_CONFIGURADO"

    // Planos configurados - MOSTRA ORDER BUMPS COMPLETOS
    const plans = (flowConfig.plans as Array<Record<string, unknown>>) || []
    debug.plans = plans.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      deliverableId: p.deliverableId || "USA_PRINCIPAL",
      orderBumps: (p.orderBumps as Array<Record<string, unknown>> || []).map(ob => ({
        id: ob.id,
        name: ob.name,
        price: ob.price,
        enabled: ob.enabled,
        deliverableId: ob.deliverableId || "NAO_CONFIGURADO",
        deliveryType: ob.deliveryType || "same"
      }))
    }))

    // Order bump global - COMPLETO
    const orderBumpConfig = flowConfig.orderBump as Record<string, unknown> || {}
    const orderBumpInicial = orderBumpConfig.inicial as Record<string, unknown> || {}
    debug.orderBump_global = {
      enabled: orderBumpInicial.enabled || false,
      name: orderBumpInicial.name,
      price: orderBumpInicial.price,
      deliverableId: orderBumpInicial.deliverableId || "NAO_CONFIGURADO",
      deliveryType: orderBumpInicial.deliveryType || "same",
      _raw: orderBumpInicial
    }

    // 4. Buscar TODOS os pagamentos recentes (nao so order bump)
    debug.step = "buscando_pagamentos"
    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select("*")
      .eq("bot_id", bot.id)
      .order("created_at", { ascending: false })
      .limit(10)

    if (paymentsError) {
      debug.payments_error = paymentsError
    }

    debug.todos_pagamentos = payments?.map(p => ({
      id: p.id,
      status: p.status,
      product_type: p.product_type,
      amount: p.amount,
      telegram_user_id: p.telegram_user_id,
      metadata: p.metadata,
      created_at: p.created_at
    })) || []

    // 5. Filtrar pagamentos de order bump para analise
    const obPayments = payments?.filter(p => 
      p.product_type === "plan_order_bump" || p.product_type === "order_bump"
    ) || []

    debug.pagamentos_order_bump = obPayments.map(p => ({
      id: p.id,
      status: p.status,
      product_type: p.product_type,
      amount: p.amount,
      telegram_user_id: p.telegram_user_id,
      metadata: p.metadata,
      created_at: p.created_at
    }))

    // 6. DIAGNOSTICO PRINCIPAL
    debug.step = "diagnostico"
    
    const paymentToSimulate = obPayments[0]
    
    if (paymentToSimulate) {
      const paymentMetadata = paymentToSimulate.metadata as Record<string, unknown> || {}
      
      // Verificar se o entregavel do OB existe
      const obDeliverableIdMetadata = paymentMetadata.order_bump_deliverable_id as string || ""
      const obDeliverableIdConfig = orderBumpInicial.deliverableId as string || ""
      const finalObDeliverableId = obDeliverableIdMetadata || obDeliverableIdConfig
      
      const obDeliverableFound = deliverables.find(d => d.id === finalObDeliverableId)
      
      debug.diagnostico = {
        pagamento_analisado: {
          id: paymentToSimulate.id,
          product_type: paymentToSimulate.product_type,
          status: paymentToSimulate.status,
          metadata_completo: paymentMetadata
        },
        
        verificacoes: {
          "1_metadata_tem_order_bump_deliverable_id": {
            resultado: !!obDeliverableIdMetadata,
            valor: obDeliverableIdMetadata || "VAZIO"
          },
          "2_config_global_tem_deliverable_id": {
            resultado: !!obDeliverableIdConfig,
            valor: obDeliverableIdConfig || "VAZIO"
          },
          "3_delivery_type_config": {
            valor: orderBumpInicial.deliveryType || "same",
            explicacao: orderBumpInicial.deliveryType === "custom" 
              ? "Usa entregavel CUSTOMIZADO para order bump" 
              : "Usa MESMO entregavel do principal"
          },
          "4_deliverable_final_usado": {
            id: finalObDeliverableId || "NENHUM",
            encontrado_na_lista: !!obDeliverableFound,
            detalhes: obDeliverableFound || "NAO_ENCONTRADO"
          }
        },
        
        problema_raiz: !obDeliverableIdMetadata && !obDeliverableIdConfig
          ? "PROBLEMA: Nenhum deliverableId configurado para o order bump! Configure em 'Tipo de Entrega: Personalizado' e selecione um entregavel."
          : !obDeliverableFound && finalObDeliverableId
            ? `PROBLEMA: O deliverableId "${finalObDeliverableId}" nao existe na lista de entregaveis! Verifique se o entregavel foi criado.`
            : orderBumpInicial.deliveryType === "same"
              ? "INFO: deliveryType = 'same' significa que o order bump usa o MESMO entregavel do plano principal (nao envia entregavel separado)"
              : "OK: Configuracao parece correta. Verifique os logs do webhook para mais detalhes."
      }
    } else {
      debug.diagnostico = {
        mensagem: "Nenhum pagamento de order bump encontrado para analisar",
        sugestao: "Faca um pagamento de teste com order bump para gerar dados de debug"
      }
    }

    // 7. Buscar user_flow_state para ver o estado salvo
    debug.step = "buscando_user_flow_state"
    const { data: flowStates, error: statesError } = await supabase
      .from("user_flow_state")
      .select("*")
      .eq("bot_id", bot.id)
      .order("updated_at", { ascending: false })
      .limit(5)

    if (statesError) {
      debug.states_error = statesError
    }

    debug.user_flow_states = flowStates?.map(s => ({
      telegram_user_id: s.telegram_user_id,
      status: s.status,
      metadata: s.metadata,
      updated_at: s.updated_at
    })) || []

    debug.step = "concluido"
    debug.success = true

    return NextResponse.json(debug, { status: 200 })

  } catch (error) {
    debug.error = error instanceof Error ? error.message : String(error)
    debug.stack = error instanceof Error ? error.stack : undefined
    return NextResponse.json({ success: false, debug }, { status: 500 })
  }
}

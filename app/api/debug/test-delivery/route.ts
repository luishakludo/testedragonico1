import { getSupabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

// API de teste para debugar entrega de order bump
// Acesse: /api/debug/test-delivery
// Usa flow_id fixo passado pelo usuario

export const dynamic = "force-dynamic"
export const revalidate = 0

const FLOW_ID = "206cbb10-efeb-4f59-a153-9c9d420b4e84"

export async function GET() {
  const debug: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    flow_id_usado: FLOW_ID
  }

  try {
    const supabase = getSupabaseAdmin()

    // 1. Buscar o fluxo diretamente pelo ID
    debug.step = "buscando_fluxo"
    const { data: flow, error: flowError } = await supabase
      .from("flows")
      .select("*")
      .eq("id", FLOW_ID)
      .single()

    if (flowError) {
      return NextResponse.json({ 
        success: false, 
        step: "buscando_fluxo",
        error: flowError.message,
        flow_id: FLOW_ID
      }, { status: 500 })
    }

    const flowConfig = flow.config as Record<string, unknown> || {}
    const botId = flow.bot_id
    
    debug.flow = { id: flow.id, name: flow.name, bot_id: botId }

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

    // 4. Buscar pagamentos - Se bot_id é null, buscar todos os recentes
    debug.step = "buscando_pagamentos"
    let payments: Array<Record<string, unknown>> = []
    let paymentsError: string | null = null
    
    if (botId) {
      const { data, error } = await supabase
        .from("payments")
        .select("id, status, product_type, amount, telegram_user_id, metadata, created_at, bot_id")
        .eq("bot_id", botId)
        .order("created_at", { ascending: false })
        .limit(10)
      
      if (error) paymentsError = error.message
      payments = data || []
    } else {
      // bot_id é null, buscar TODOS os pagamentos recentes
      const { data, error } = await supabase
        .from("payments")
        .select("id, status, product_type, amount, telegram_user_id, metadata, created_at, bot_id")
        .order("created_at", { ascending: false })
        .limit(20)
      
      if (error) paymentsError = error.message
      payments = data || []
      debug.aviso = "bot_id do fluxo é NULL - buscando TODOS os pagamentos recentes"
    }

    if (paymentsError) {
      debug.payments_error = paymentsError
    }

    debug.pagamentos = payments

    // 5. Filtrar order bumps
    const obPayments = payments.filter(p => 
      p.product_type === "plan_order_bump" || 
      p.product_type === "order_bump" ||
      p.product_type === "pack_order_bump"
    )

    debug.pagamentos_order_bump = obPayments

    // 6. SIMULACAO DE ENTREGA - Simula o que o webhook do MercadoPago faria
    debug.step = "simulando_entrega"
    
    // Pegar o primeiro pagamento de order bump para simular
    const paymentToSimulate = obPayments[0]
    
    if (paymentToSimulate) {
      const paymentMetadata = paymentToSimulate.metadata as Record<string, unknown> || {}
      
      // Simular a logica do webhook do MercadoPago
      const orderBumpDeliverableIdFromMetadata = paymentMetadata?.order_bump_deliverable_id as string || ""
      const planDeliverableIdFromMetadata = paymentMetadata?.plan_deliverable_id as string || ""
      const planIdFromMetadata = paymentMetadata?.plan_id as string || ""
      
      // DEBUG: mostrar valores raw
      debug.debug_valores = {
        orderBumpConfig_tipo: typeof orderBumpConfig,
        orderBumpConfig_keys: Object.keys(orderBumpConfig),
        orderBumpInicial_tipo: typeof orderBumpInicial,
        orderBumpInicial_keys: Object.keys(orderBumpInicial),
        orderBumpInicial_deliverableId: orderBumpInicial.deliverableId,
        orderBumpInicial_deliverableId_tipo: typeof orderBumpInicial.deliverableId
      }
      
      // Determinar deliverableId do order bump (mesma logica do webhook)
      // FALLBACK COMPLETO: 1) metadata, 2) config global, 3) order bump do plano
      let finalOrderBumpDeliverableId = ""
      let fonte_ob_deliverable = ""
      
      // 1. Tentar do metadata do pagamento
      if (orderBumpDeliverableIdFromMetadata) {
        finalOrderBumpDeliverableId = orderBumpDeliverableIdFromMetadata
        fonte_ob_deliverable = "METADATA_DO_PAGAMENTO"
      } 
      // 2. Tentar do config global do order bump
      else if (orderBumpInicial.deliverableId && orderBumpInicial.deliverableId !== "") {
        finalOrderBumpDeliverableId = orderBumpInicial.deliverableId as string
        fonte_ob_deliverable = "CONFIG_GLOBAL_ORDER_BUMP (orderBump.inicial)"
      }
      // 3. Tentar do primeiro plano que tem order bump
      else {
        for (const plan of plans) {
          const planOrderBumps = (plan.order_bumps as Array<Record<string, unknown>>) || []
          if (planOrderBumps.length > 0 && planOrderBumps[0].deliverableId) {
            finalOrderBumpDeliverableId = planOrderBumps[0].deliverableId as string
            fonte_ob_deliverable = `ORDER_BUMP_DO_PLANO (${plan.name})`
            break
          }
        }
      }
      
      // Verificar se o deliverableId existe
      const obDeliverableEncontrado = deliverables.find(d => d.id === finalOrderBumpDeliverableId)
      
      // Determinar deliverableId do produto principal
      let finalPlanDeliverableId = ""
      let fonte_plan_deliverable = ""
      
      if (planDeliverableIdFromMetadata) {
        finalPlanDeliverableId = planDeliverableIdFromMetadata
        fonte_plan_deliverable = "METADATA_DO_PAGAMENTO"
      } else if (flowConfig.mainDeliverableId) {
        finalPlanDeliverableId = flowConfig.mainDeliverableId as string
        fonte_plan_deliverable = "MAIN_DELIVERABLE_ID_GLOBAL"
      }
      
      const planDeliverableEncontrado = deliverables.find(d => d.id === finalPlanDeliverableId)
      
      debug.simulacao_entrega = {
        pagamento_usado: {
          id: paymentToSimulate.id,
          product_type: paymentToSimulate.product_type,
          status: paymentToSimulate.status,
          metadata: paymentMetadata
        },
        
        entrega_produto_principal: {
          deliverable_id: finalPlanDeliverableId || "NENHUM",
          fonte: fonte_plan_deliverable || "NAO_ENCONTRADO",
          deliverable_encontrado: planDeliverableEncontrado ? {
            id: planDeliverableEncontrado.id,
            name: planDeliverableEncontrado.name,
            type: planDeliverableEncontrado.type
          } : "NAO_ENCONTRADO_NA_LISTA",
          vai_entregar: !!planDeliverableEncontrado
        },
        
        entrega_order_bump: {
          deliverable_id: finalOrderBumpDeliverableId || "NENHUM",
          fonte: fonte_ob_deliverable || "NAO_ENCONTRADO",
          deliverable_encontrado: obDeliverableEncontrado ? {
            id: obDeliverableEncontrado.id,
            name: obDeliverableEncontrado.name,
            type: obDeliverableEncontrado.type
          } : "NAO_ENCONTRADO_NA_LISTA",
          vai_entregar: !!obDeliverableEncontrado
        },
        
        resultado_final: {
          principal_ok: !!planDeliverableEncontrado,
          order_bump_ok: !!obDeliverableEncontrado,
          problema: !obDeliverableEncontrado 
            ? `ORDER BUMP NAO VAI SER ENTREGUE! deliverableId="${finalOrderBumpDeliverableId}" nao foi encontrado ou esta vazio`
            : "TUDO OK - Ambos vao ser entregues"
        }
      }
    } else {
      debug.simulacao_entrega = {
        erro: "Nenhum pagamento de order bump encontrado para simular",
        sugestao: "Faca um pagamento de teste com order bump"
      }
    }

    // 7. Buscar user_flow_state
    debug.step = "buscando_states"
    let states: Array<Record<string, unknown>> = []
    
    if (botId) {
      const { data } = await supabase
        .from("user_flow_state")
        .select("telegram_user_id, status, metadata, updated_at, bot_id")
        .eq("bot_id", botId)
        .order("updated_at", { ascending: false })
        .limit(5)
      states = data || []
    } else {
      // Buscar todos os states recentes
      const { data } = await supabase
        .from("user_flow_state")
        .select("telegram_user_id, status, metadata, updated_at, bot_id")
        .order("updated_at", { ascending: false })
        .limit(10)
      states = data || []
    }

    debug.user_flow_states = states

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

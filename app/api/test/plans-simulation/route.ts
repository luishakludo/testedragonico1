import { getSupabase } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const flowId = searchParams.get("flowId")
    const action = searchParams.get("action") || "ver_planos"
    const planId = searchParams.get("planId")
    
    if (!flowId) {
      return NextResponse.json({ error: "flowId is required" }, { status: 400 })
    }
    
    const supabase = getSupabase()
    
    // Buscar o flow
    const { data: flow, error: flowError } = await supabase
      .from("flows")
      .select("*")
      .eq("id", flowId)
      .single()
    
    if (flowError || !flow) {
      return NextResponse.json({ 
        error: "Flow not found", 
        details: flowError?.message 
      }, { status: 404 })
    }
    
    const flowConfig = (flow.config as Record<string, unknown>) || {}
    
    // ACTION: ver_planos - mostrar os planos como botoes
    if (action === "ver_planos") {
      // Primeiro tenta buscar da tabela flow_plans
      const { data: dbPlans } = await supabase
        .from("flow_plans")
        .select("*")
        .eq("flow_id", flowId)
        .eq("is_active", true)
        .order("position", { ascending: true })
      
      // Se nao tiver na tabela, busca do config
      const configPlans = (flowConfig.plans as Array<{
        id: string
        name: string
        price: number
        description?: string
      }>) || []
      
      const plans = (dbPlans && dbPlans.length > 0) ? dbPlans : configPlans
      const plansSource = (dbPlans && dbPlans.length > 0) ? "database (flow_plans)" : "config JSON"
      
      if (plans.length === 0) {
        return NextResponse.json({
          success: true,
          action: "ver_planos",
          flowId: flow.id,
          flowName: flow.name,
          plansSource,
          message: "Nenhum plano encontrado",
          simulatedResponse: {
            type: "MESSAGE",
            content: "Nenhum plano disponivel no momento."
          }
        })
      }
      
      // Simular os botoes que seriam mostrados (only name, no price)
      const planButtons = plans.map(plan => ({
        text: plan.name,
        callback_data: `plan_${plan.id}`,
        planDetails: {
          id: plan.id,
          name: plan.name,
          price: plan.price,
          description: plan.description || null
        }
      }))
      
      return NextResponse.json({
        success: true,
        action: "ver_planos",
        flowId: flow.id,
        flowName: flow.name,
        plansSource,
        plansCount: plans.length,
        simulatedResponse: {
          type: "MESSAGE_WITH_BUTTONS",
          content: "Escolha seu plano:",
          buttons: planButtons
        },
        nextStep: "Clique em um plano para ver a simulacao do pagamento. Use: ?flowId=XXX&action=select_plan&planId=YYY"
      })
    }
    
    // ACTION: select_plan - simular selecao de plano e geracao de pagamento
    if (action === "select_plan" && planId) {
      // Buscar o plano
      let plan: Record<string, unknown> | null = null
      let planSource = ""
      
      // Primeiro tenta na tabela
      const { data: dbPlan } = await supabase
        .from("flow_plans")
        .select("*")
        .eq("id", planId)
        .single()
      
      if (dbPlan) {
        plan = dbPlan
        planSource = "database (flow_plans)"
      } else {
        // Busca no config
        const configPlans = (flowConfig.plans as Array<{
          id: string
          name: string
          price: number
          description?: string
        }>) || []
        const configPlan = configPlans.find(p => p.id === planId)
        if (configPlan) {
          plan = configPlan as Record<string, unknown>
          planSource = "config JSON"
        }
      }
      
      if (!plan) {
        return NextResponse.json({
          success: false,
          error: "Plano nao encontrado",
          planId
        }, { status: 404 })
      }
      
      // Get bot_id from flow or flow_bots table
      let botId = flow.bot_id
      
      // If no direct bot_id, check flow_bots table
      if (!botId) {
        const { data: flowBot } = await supabase
          .from("flow_bots")
          .select("bot_id")
          .eq("flow_id", flow.id)
          .limit(1)
          .single()
        
        botId = flowBot?.bot_id || null
      }
      
      // Check if gateway is configured for this bot (table is user_gateways, not payment_gateways)
      let gatewayInfo = null
      if (botId) {
        const { data: gateway } = await supabase
          .from("user_gateways")
          .select("*")
          .eq("bot_id", botId)
          .eq("is_active", true)
          .limit(1)
          .single()
        
        if (gateway) {
          gatewayInfo = {
            name: gateway.gateway_name,
            hasAccessToken: !!gateway.access_token,
            isActive: gateway.is_active
          }
        }
      }
      
      // Simular geracao de pagamento
      const paymentSimulation = {
        planSelected: {
          id: plan.id,
          name: plan.name,
          price: plan.price,
          description: plan.description || null
        },
        gateway: gatewayInfo || { name: "nenhum", hasAccessToken: false, isActive: false },
        simulatedMessages: gatewayInfo?.hasAccessToken ? [
          {
            step: 1,
            type: "MESSAGE",
            content: `Voce selecionou: *${plan.name}*\n\nValor: R$ ${Number(plan.price).toFixed(2).replace(".", ",")}\n\nGerando pagamento PIX...`
          },
          {
            step: 2,
            type: "PIX_QR_CODE",
            content: `QR Code PIX seria gerado via ${gatewayInfo.name}`,
            details: {
              gateway: gatewayInfo.name,
              amount: plan.price,
              description: `Pagamento - ${plan.name}`
            }
          },
          {
            step: 3,
            type: "PIX_COPY_PASTE",
            content: "Codigo PIX copia-cola seria enviado aqui"
          }
        ] : [
          {
            step: 1,
            type: "ERROR",
            content: "Gateway de pagamento nao configurado!"
          }
        ]
      }
      
      return NextResponse.json({
        success: true,
        action: "select_plan",
        flowId: flow.id,
        flowName: flow.name,
        botId: botId || "nenhum bot vinculado",
        planSource,
        paymentSimulation,
        warnings: !gatewayInfo?.hasAccessToken ? [
          "Gateway de pagamento nao configurado!",
          "Va em Gateways e conecte seu Mercado Pago"
        ] : []
      })
    }
    
    return NextResponse.json({
      error: "Acao invalida",
      availableActions: [
        "ver_planos - Mostra os planos disponiveis",
        "select_plan - Simula selecao de plano (requer planId)"
      ]
    }, { status: 400 })
    
  } catch (error) {
    return NextResponse.json({ 
      error: "Internal error", 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 })
  }
}

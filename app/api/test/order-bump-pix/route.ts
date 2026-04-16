import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dnVsb2puZnZnc2JtaHl2cXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTk0NTMsImV4cCI6MjA4ODgzNTQ1M30.Djnn3tsrxSGLBR-Bm1dWOpQe0NHCSOWJFZkbbTOk2oM"

/**
 * API DE TESTE - SIMULACAO DE GERACAO DE PIX
 * 
 * Simula exatamente o que aconteceria quando usuario clica em ADICIONAR ou NAO QUERO
 * Mostra os parametros que seriam enviados para gerar o PIX
 * 
 * GET /api/test/order-bump-pix?flow_id=xxx
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const flowId = searchParams.get("flow_id")

  if (!flowId) {
    return NextResponse.json({
      success: false,
      error: "flow_id obrigatorio",
      usage: "/api/test/order-bump-pix?flow_id=SEU_FLOW_ID",
    })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  try {
    // Buscar fluxo
    const { data: flow, error: flowError } = await supabase
      .from("flows")
      .select("id, name, config, bot_id")
      .eq("id", flowId)
      .single()

    if (flowError || !flow) {
      return NextResponse.json({
        success: false,
        error: "Fluxo nao encontrado",
        flowId,
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = flow.config as Record<string, any>
    const orderBumpInicial = config?.orderBump?.inicial
    const plans = config?.plans || []

    if (!orderBumpInicial?.enabled) {
      return NextResponse.json({
        success: false,
        error: "Order Bump nao esta ativado neste fluxo",
        flowId,
        flowName: flow.name,
      })
    }

    if (plans.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Fluxo nao tem planos configurados",
        flowId,
        flowName: flow.name,
      })
    }

    // Buscar bot para pegar gateway
    const { data: bot } = await supabase
      .from("bots")
      .select("id, name, gateway_config")
      .eq("id", flow.bot_id)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gatewayConfig = bot?.gateway_config as Record<string, any> | null
    const gatewayType = gatewayConfig?.gateway || "mercadopago"

    // Pegar primeiro plano
    const plan = plans[0]
    const mainAmount = plan.price || 0
    const bumpAmount = orderBumpInicial.price || 0
    const totalWithBump = mainAmount + bumpAmount

    // ============ SIMULACAO: USUARIO CLICA EM "ADICIONAR" ============
    const simulationAccept = {
      cenario: "USUARIO CLICOU EM ADICIONAR (ACEITAR ORDER BUMP)",
      callback_data: `ob_accept_${mainAmount}_${bumpAmount}`,
      processamento: {
        isAccept: true,
        mainAmount: mainAmount,
        bumpAmount: bumpAmount,
        totalAmount: totalWithBump,
        productType: "order_bump",
        description: `${plan.name} + ${orderBumpInicial.name}`,
      },
      chamada_generatePayment: {
        gateway: gatewayType,
        amount: totalWithBump,
        description: `${plan.name} + ${orderBumpInicial.name}`,
        metadata: {
          flow_id: flow.id,
          plan_name: plan.name,
          order_bump_name: orderBumpInicial.name,
          order_bump_price: bumpAmount,
          product_type: "order_bump",
        },
      },
      resultado_esperado: {
        pix_valor: `R$ ${totalWithBump.toFixed(2)}`,
        mensagem_telegram: `Gerando PIX de R$ ${totalWithBump.toFixed(2)}...`,
      },
    }

    // ============ SIMULACAO: USUARIO CLICA EM "NAO QUERO" ============
    const simulationReject = {
      cenario: "USUARIO CLICOU EM NAO QUERO (RECUSAR ORDER BUMP)",
      callback_data: `ob_decline_${mainAmount}`,
      processamento: {
        isAccept: false,
        mainAmount: mainAmount,
        bumpAmount: 0,
        totalAmount: mainAmount,
        productType: "main",
        description: plan.name,
      },
      chamada_generatePayment: {
        gateway: gatewayType,
        amount: mainAmount,
        description: plan.name,
        metadata: {
          flow_id: flow.id,
          plan_name: plan.name,
          product_type: "main",
        },
      },
      resultado_esperado: {
        pix_valor: `R$ ${mainAmount.toFixed(2)}`,
        mensagem_telegram: `Gerando PIX de R$ ${mainAmount.toFixed(2)}...`,
      },
    }

    // ============ CODIGO QUE SERIA EXECUTADO NO WEBHOOK ============
    const codigoWebhook = `
// Codigo que roda no webhook quando usuario clica:

if (callbackData.startsWith("ob_accept_")) {
  // ACEITAR ORDER BUMP
  const parts = callbackData.replace("ob_accept_", "").split("_")
  const mainAmount = parseFloat(parts[0]) // ${mainAmount}
  const bumpAmount = parseFloat(parts[1]) // ${bumpAmount}
  const totalAmount = mainAmount + bumpAmount // ${totalWithBump}
  
  await generatePayment({
    amount: totalAmount, // R$ ${totalWithBump.toFixed(2)}
    description: "${plan.name} + ${orderBumpInicial.name}",
    productType: "order_bump"
  })
}

if (callbackData.startsWith("ob_decline_")) {
  // RECUSAR ORDER BUMP
  const totalAmount = parseFloat(callbackData.replace("ob_decline_", "")) // ${mainAmount}
  
  await generatePayment({
    amount: totalAmount, // R$ ${mainAmount.toFixed(2)}
    description: "${plan.name}",
    productType: "main"
  })
}
`

    return NextResponse.json({
      success: true,
      fluxo: {
        id: flow.id,
        nome: flow.name,
        bot: bot?.name || "N/A",
        gateway: gatewayType,
      },
      plano_selecionado: {
        nome: plan.name,
        preco: `R$ ${mainAmount.toFixed(2)}`,
      },
      order_bump: {
        nome: orderBumpInicial.name,
        preco: `R$ ${bumpAmount.toFixed(2)}`,
        descricao: orderBumpInicial.description,
        botao_aceitar: orderBumpInicial.acceptText || "ADICIONAR",
        botao_recusar: orderBumpInicial.rejectText || "NAO QUERO",
      },
      simulacoes: {
        se_clicar_ADICIONAR: simulationAccept,
        se_clicar_NAO_QUERO: simulationReject,
      },
      codigo_webhook: codigoWebhook,
      resumo: {
        "SE ADICIONAR": `PIX de R$ ${totalWithBump.toFixed(2)} (produto + order bump)`,
        "SE NAO QUERO": `PIX de R$ ${mainAmount.toFixed(2)} (so produto principal)`,
      },
      conclusao: "OS VALORES ESTAO CORRETOS! O Order Bump vai somar os valores quando aceitar e manter o valor original quando recusar.",
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Erro no teste",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    })
  }
}

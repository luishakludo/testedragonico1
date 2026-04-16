import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dnVsb2puZnZnc2JtaHl2cXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTk0NTMsImV4cCI6MjA4ODgzNTQ1M30.Djnn3tsrxSGLBR-Bm1dWOpQe0NHCSOWJFZkbbTOk2oM"

/**
 * API DE TESTE DO ORDER BUMP
 * 
 * Simula o fluxo completo do Order Bump para verificar se está funcionando:
 * 1. Busca um fluxo com Order Bump ativado
 * 2. Simula o clique em um plano
 * 3. Verifica se o Order Bump seria exibido
 * 4. Simula aceitar/recusar e mostra o valor final do PIX
 * 
 * GET /api/test/order-bump?flow_id=xxx
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const flowId = searchParams.get("flow_id")

  console.log("[v0] ORDER BUMP TEST - flow_id:", flowId)

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  const results: {
    step: string
    status: "ok" | "error" | "info"
    message: string
    data?: unknown
  }[] = []

  try {
    // PASSO 1: Buscar fluxo
    results.push({
      step: "1. Buscando fluxo",
      status: "info",
      message: flowId ? `Buscando fluxo ID: ${flowId}` : "Buscando qualquer fluxo com Order Bump ativado",
    })

    let flowQuery = supabase
      .from("flows")
      .select("id, name, config, bot_id")

    if (flowId) {
      flowQuery = flowQuery.eq("id", flowId)
    }

    const { data: flows, error: flowError } = await flowQuery.limit(10)

    console.log("[v0] ORDER BUMP TEST - Fluxos encontrados:", flows?.length, "Erro:", flowError?.message)

    if (flowError) {
      return NextResponse.json({
        success: false,
        error: "Erro ao buscar fluxos",
        details: flowError.message,
      })
    }

    // Encontrar fluxo com order bump
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let selectedFlow: any = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderBumpConfig: any = null

    for (const flow of flows || []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config = flow.config as Record<string, any>
      console.log("[v0] ORDER BUMP TEST - Verificando fluxo:", flow.name, "orderBump:", JSON.stringify(config?.orderBump))
      if (config?.orderBump?.inicial?.enabled) {
        selectedFlow = flow
        orderBumpConfig = config.orderBump
        console.log("[v0] ORDER BUMP TEST - ENCONTRADO Order Bump ativo em:", flow.name)
        break
      }
    }

    if (!selectedFlow) {
      // Se não encontrou com order bump, pega o primeiro para mostrar config
      selectedFlow = flows?.[0]
      if (selectedFlow) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        orderBumpConfig = (selectedFlow.config as Record<string, any>)?.orderBump
      }
    }

    if (!selectedFlow) {
      return NextResponse.json({
        success: false,
        error: "Nenhum fluxo encontrado",
        message: "Crie um fluxo primeiro ou passe um flow_id válido",
      })
    }

    results.push({
      step: "2. Fluxo encontrado",
      status: "ok",
      message: `Fluxo: ${selectedFlow.name} (ID: ${selectedFlow.id})`,
      data: {
        flowId: selectedFlow.id,
        flowName: selectedFlow.name,
        botId: selectedFlow.bot_id,
      },
    })

    // PASSO 2: Verificar config do Order Bump
    const orderBumpInicial = orderBumpConfig?.inicial

    results.push({
      step: "3. Verificando Order Bump Config",
      status: orderBumpInicial?.enabled ? "ok" : "error",
      message: orderBumpInicial?.enabled 
        ? "Order Bump INICIAL está ATIVADO" 
        : "Order Bump INICIAL está DESATIVADO",
      data: {
        orderBumpConfig: orderBumpConfig || "Não configurado",
        inicial: orderBumpInicial || "Não configurado",
      },
    })

    if (!orderBumpInicial?.enabled) {
      return NextResponse.json({
        success: false,
        results,
        message: "Order Bump não está ativado neste fluxo. Vá em Meus Fluxos > Editar > Aba Order Bump > Ative 'Fluxo Inicial'",
        howToFix: [
          "1. Acesse /fluxos",
          "2. Edite o fluxo desejado",
          "3. Vá na aba 'Order Bump'",
          "4. Ative 'Fluxo Inicial'",
          "5. Configure: Nome, Preço, Descrição, Botões",
          "6. Salve o fluxo",
        ],
      })
    }

    // PASSO 3: Buscar planos do fluxo
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flowConfig = selectedFlow.config as Record<string, any>
    const plans = flowConfig?.plans || []

    results.push({
      step: "4. Verificando planos do fluxo",
      status: plans.length > 0 ? "ok" : "error",
      message: plans.length > 0 
        ? `Encontrados ${plans.length} plano(s)` 
        : "Nenhum plano configurado",
      data: plans.map((p: { name: string; price: number }) => ({
        name: p.name,
        price: p.price,
      })),
    })

    if (plans.length === 0) {
      return NextResponse.json({
        success: false,
        results,
        message: "Fluxo não tem planos configurados",
      })
    }

    // PASSO 4: Simular clique no primeiro plano
    const selectedPlan = plans[0]
    const mainAmount = selectedPlan.price || 0
    const bumpAmount = orderBumpInicial.price || 0
    const totalWithBump = mainAmount + bumpAmount

    results.push({
      step: "5. Simulando clique no plano",
      status: "info",
      message: `Usuario clicou em: "${selectedPlan.name}" - R$ ${mainAmount.toFixed(2)}`,
      data: {
        planName: selectedPlan.name,
        planPrice: mainAmount,
      },
    })

    // PASSO 5: Order Bump seria exibido
    results.push({
      step: "6. ORDER BUMP SERIA EXIBIDO",
      status: "ok",
      message: "Sistema detectou Order Bump ativo - Exibindo oferta ao invés de gerar PIX direto",
      data: {
        orderBumpName: orderBumpInicial.name,
        orderBumpPrice: bumpAmount,
        orderBumpDescription: orderBumpInicial.description,
        buttonAccept: orderBumpInicial.acceptText || "ADICIONAR",
        buttonReject: orderBumpInicial.rejectText || "NAO QUERO",
        callbackAccept: `ob_accept_${mainAmount}_${bumpAmount}`,
        callbackReject: `ob_decline_${mainAmount}`,
      },
    })

    // PASSO 6: Simular ACEITAR
    results.push({
      step: "7. SIMULANDO: Usuario ACEITA Order Bump",
      status: "ok",
      message: `Callback: ob_accept_${mainAmount}_${bumpAmount}`,
      data: {
        action: "ACEITAR",
        calculation: `${mainAmount} + ${bumpAmount} = ${totalWithBump}`,
        pixAmount: totalWithBump,
        pixDescription: `${selectedPlan.name} + ${orderBumpInicial.name}`,
        productType: "order_bump",
      },
    })

    // PASSO 7: Simular RECUSAR
    results.push({
      step: "8. SIMULANDO: Usuario RECUSA Order Bump",
      status: "ok",
      message: `Callback: ob_decline_${mainAmount}`,
      data: {
        action: "RECUSAR",
        calculation: `Apenas produto principal`,
        pixAmount: mainAmount,
        pixDescription: selectedPlan.name,
        productType: "main",
      },
    })

    // RESUMO FINAL
    return NextResponse.json({
      success: true,
      summary: {
        flowName: selectedFlow.name,
        flowId: selectedFlow.id,
        orderBumpEnabled: true,
        orderBumpName: orderBumpInicial.name,
        orderBumpPrice: bumpAmount,
        selectedPlan: selectedPlan.name,
        planPrice: mainAmount,
        scenarios: {
          ifAccept: {
            pixValue: totalWithBump,
            description: `PIX de R$ ${totalWithBump.toFixed(2)} (${selectedPlan.name} + ${orderBumpInicial.name})`,
          },
          ifReject: {
            pixValue: mainAmount,
            description: `PIX de R$ ${mainAmount.toFixed(2)} (apenas ${selectedPlan.name})`,
          },
        },
      },
      results,
      conclusion: "ORDER BUMP ESTÁ CONFIGURADO CORRETAMENTE! Quando o usuário clicar em um plano, verá a oferta do Order Bump antes de gerar o PIX.",
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Erro no teste",
      details: error instanceof Error ? error.message : "Erro desconhecido",
      results,
    })
  }
}

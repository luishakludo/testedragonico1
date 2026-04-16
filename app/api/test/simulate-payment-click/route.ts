import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dnVsb2puZnZnc2JtaHl2cXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTk0NTMsImV4cCI6MjA4ODgzNTQ1M30.Djnn3tsrxSGLBR-Bm1dWOpQe0NHCSOWJFZkbbTOk2oM"

/**
 * API QUE SIMULA EXATAMENTE O QUE O WEBHOOK FAZ
 * 
 * Essa API reproduz o código real do webhook quando o usuário clica em um plano.
 * Útil para testar se o Order Bump está funcionando sem precisar usar o Telegram.
 * 
 * GET /api/test/simulate-payment-click?flow_id=xxx&plan_index=0
 * 
 * Parâmetros:
 * - flow_id: ID do fluxo (obrigatório)
 * - plan_index: Índice do plano (0, 1, 2...) - padrão: 0
 * - telegram_user_id: ID fake do usuário (padrão: 123456789)
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const flowId = searchParams.get("flow_id")
  const planIndex = parseInt(searchParams.get("plan_index") || "0")
  const telegramUserId = searchParams.get("telegram_user_id") || "123456789"

  if (!flowId) {
    return NextResponse.json({
      success: false,
      error: "flow_id é obrigatório",
      usage: "/api/test/simulate-payment-click?flow_id=SEU_FLOW_ID",
    })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  const simulation = {
    step: 0,
    logs: [] as string[],
    webhookBehavior: "" as string,
    orderBumpWouldShow: false,
    orderBumpMessage: null as { text: string; buttons: { text: string; callback: string }[] } | null,
    pixWouldGenerate: null as { amount: number; description: string } | null,
  }

  const log = (msg: string) => {
    simulation.step++
    simulation.logs.push(`[${simulation.step}] ${msg}`)
  }

  try {
    // ========== SIMULAR: Buscar fluxo ==========
    log("Buscando fluxo no banco de dados...")
    
    const { data: flow, error: flowError } = await supabase
      .from("flows")
      .select("id, name, config, bot_id")
      .eq("id", flowId)
      .single()

    if (flowError || !flow) {
      return NextResponse.json({
        success: false,
        error: "Fluxo não encontrado",
        flowId,
        details: flowError?.message,
      })
    }

    log(`Fluxo encontrado: "${flow.name}" (bot_id: ${flow.bot_id})`)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flowConfig = flow.config as Record<string, any>
    const plans = flowConfig?.plans || []

    if (plans.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Fluxo não tem planos configurados",
        flowId,
      })
    }

    if (planIndex >= plans.length) {
      return NextResponse.json({
        success: false,
        error: `Plano índice ${planIndex} não existe. Máximo: ${plans.length - 1}`,
        availablePlans: plans.map((p: { name: string; price: number }, i: number) => ({
          index: i,
          name: p.name,
          price: p.price,
        })),
      })
    }

    const selectedPlan = plans[planIndex]
    const amount = selectedPlan.price || 0

    log(`Usuário clicou no plano: "${selectedPlan.name}" - R$ ${amount}`)
    log(`Callback simulado: pay_custom_${amount}`)

    // ========== SIMULAR: Exatamente o que o webhook faz ==========
    log("--- EXECUTANDO LÓGICA DO WEBHOOK ---")

    // Simular busca do estado do usuário (igual ao webhook)
    log("Buscando estado do usuário no user_flow_state...")
    
    const { data: state, error: stateError } = await supabase
      .from("user_flow_state")
      .select("flow_id, current_node_position, status")
      .eq("bot_id", flow.bot_id)
      .eq("telegram_user_id", telegramUserId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single()

    if (stateError || !state) {
      log(`Estado não encontrado para user ${telegramUserId} - Usando flow_id do parâmetro`)
      // Se não tem estado, simula como se tivesse
    } else {
      log(`Estado encontrado: flow_id=${state.flow_id}, status=${state.status}`)
    }

    // Buscar config do fluxo para Order Bump (igual ao webhook)
    log("Verificando configuração do Order Bump...")

    const orderBumpConfig = flowConfig?.orderBump
    const orderBumpInicial = orderBumpConfig?.inicial

    log(`Order Bump Config: ${JSON.stringify(orderBumpConfig)}`)
    log(`Order Bump Inicial: enabled=${orderBumpInicial?.enabled}, price=${orderBumpInicial?.price}`)

    // ========== DECISÃO: Order Bump ou PIX direto? ==========
    if (orderBumpInicial?.enabled && orderBumpInicial?.price > 0) {
      log("✅ ORDER BUMP ESTÁ ATIVADO!")
      simulation.orderBumpWouldShow = true
      simulation.webhookBehavior = "MOSTRAR ORDER BUMP (não gera PIX ainda)"

      const bumpPrice = orderBumpInicial.price
      const bumpName = orderBumpInicial.name || "Oferta Especial"
      const bumpDesc = orderBumpInicial.description || `Adicione ${bumpName} por apenas R$ ${bumpPrice}`
      const acceptText = orderBumpInicial.acceptText || "ADICIONAR"
      const rejectText = orderBumpInicial.rejectText || "NAO QUERO"

      simulation.orderBumpMessage = {
        text: bumpDesc,
        buttons: [
          {
            text: `${acceptText} (+R$ ${bumpPrice})`,
            callback: `ob_accept_${amount}_${bumpPrice}`,
          },
          {
            text: rejectText,
            callback: `ob_decline_${amount}`,
          },
        ],
      }

      log(`Mensagem Order Bump: "${bumpDesc}"`)
      log(`Botão ACEITAR: "${acceptText}" -> callback: ob_accept_${amount}_${bumpPrice}`)
      log(`Botão RECUSAR: "${rejectText}" -> callback: ob_decline_${amount}`)

      // ========== SIMULAR: Se usuário ACEITAR ==========
      const totalWithBump = amount + bumpPrice
      log(`--- SE USUÁRIO CLICAR ACEITAR ---`)
      log(`Callback: ob_accept_${amount}_${bumpPrice}`)
      log(`Cálculo: ${amount} + ${bumpPrice} = ${totalWithBump}`)
      log(`PIX seria gerado com valor: R$ ${totalWithBump}`)

      // ========== SIMULAR: Se usuário RECUSAR ==========
      log(`--- SE USUÁRIO CLICAR RECUSAR ---`)
      log(`Callback: ob_decline_${amount}`)
      log(`PIX seria gerado com valor: R$ ${amount}`)

      return NextResponse.json({
        success: true,
        simulation,
        result: {
          orderBumpShown: true,
          message: "Order Bump seria exibido ao usuário",
          orderBumpDetails: {
            name: bumpName,
            price: bumpPrice,
            description: bumpDesc,
          },
          scenarios: {
            ifAccept: {
              callback: `ob_accept_${amount}_${bumpPrice}`,
              pixAmount: totalWithBump,
              pixDescription: `${selectedPlan.name} + ${bumpName}`,
            },
            ifReject: {
              callback: `ob_decline_${amount}`,
              pixAmount: amount,
              pixDescription: selectedPlan.name,
            },
          },
        },
        conclusion: "ORDER BUMP FUNCIONANDO! Quando usuário clicar no plano, verá a oferta antes do PIX.",
      })
    } else {
      log("❌ Order Bump NÃO está ativado ou preço é 0")
      simulation.orderBumpWouldShow = false
      simulation.webhookBehavior = "GERAR PIX DIRETAMENTE (sem Order Bump)"
      simulation.pixWouldGenerate = {
        amount: amount,
        description: selectedPlan.name,
      }

      log(`PIX seria gerado diretamente: R$ ${amount}`)

      return NextResponse.json({
        success: true,
        simulation,
        result: {
          orderBumpShown: false,
          message: "PIX seria gerado diretamente (Order Bump não ativo)",
          pixDetails: {
            amount: amount,
            description: selectedPlan.name,
          },
        },
        howToEnableOrderBump: {
          steps: [
            "1. Acesse /fluxos",
            "2. Edite este fluxo",
            "3. Vá na aba 'Order Bump'",
            "4. Ative 'Fluxo Inicial'",
            "5. Configure: Nome, Preço (> 0), Descrição",
            "6. Clique em Salvar",
          ],
          currentConfig: {
            enabled: orderBumpInicial?.enabled || false,
            price: orderBumpInicial?.price || 0,
            name: orderBumpInicial?.name || "não configurado",
          },
        },
      })
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Erro na simulação",
      details: error instanceof Error ? error.message : "Erro desconhecido",
      simulation,
    })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

/**
 * SIMULA exatamente o que o webhook faz para encontrar o Order Bump
 * 
 * Use: /api/debug/simulate-order-bump?bot_id=UUID_DO_BOT
 * 
 * Isso simula o processo do webhook sem precisar enviar mensagem no Telegram
 */
export async function GET(request: NextRequest) {
  const supabase = getSupabase()
  const searchParams = request.nextUrl.searchParams
  const botId = searchParams.get("bot_id")

  const result: Record<string, unknown> = {
    titulo: "SIMULACAO - Busca do Order Bump (igual ao webhook)",
    timestamp: new Date().toISOString(),
  }

  if (!botId) {
    // Listar bots disponiveis
    const { data: bots } = await supabase
      .from("bots")
      .select("id, telegram_bot_id, status")
    
    return NextResponse.json({
      ...result,
      erro: "Passe ?bot_id=UUID para simular",
      bots_disponiveis: bots?.map(b => ({
        id: b.id,
        telegram_bot_id: b.telegram_bot_id,
        status: b.status,
        simular_url: `/api/debug/simulate-order-bump?bot_id=${b.id}`,
      })) || [],
    })
  }

  const steps: Array<{ step: string; resultado: unknown; sucesso: boolean }> = []

  try {
    // STEP 1: Verificar se o bot existe
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("*")
      .eq("id", botId)
      .single()

    steps.push({
      step: "1. Buscar bot por ID",
      resultado: bot ? { id: bot.id, telegram_bot_id: bot.telegram_bot_id, status: bot.status } : { erro: botError?.message },
      sucesso: !!bot,
    })

    if (!bot) {
      return NextResponse.json({
        ...result,
        erro: "Bot nao encontrado",
        steps,
      })
    }

    // STEP 2: Buscar fluxo pelo bot_id direto na tabela flows
    const { data: flowDireto, error: flowDiretoError } = await supabase
      .from("flows")
      .select("id, name, config")
      .eq("bot_id", botId)
      .limit(1)
      .single()

    steps.push({
      step: "2. Buscar fluxo por bot_id direto (flows.bot_id)",
      resultado: flowDireto 
        ? { 
            id: flowDireto.id, 
            name: flowDireto.name, 
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            config_keys: flowDireto.config ? Object.keys(flowDireto.config as Record<string, any>) : [],
          } 
        : { erro: flowDiretoError?.message || "Nenhum fluxo com bot_id direto" },
      sucesso: !!flowDireto,
    })

    let flowId = flowDireto?.id

    // STEP 3: Se nao encontrou, buscar pela tabela flow_bots
    if (!flowId) {
      const { data: flowBotLink, error: flowBotLinkError } = await supabase
        .from("flow_bots")
        .select("flow_id, flow:flows(id, name, config)")
        .eq("bot_id", botId)
        .limit(1)
        .single()

      steps.push({
        step: "3. Buscar fluxo via flow_bots (vinculo indireto)",
        resultado: flowBotLink 
          ? { 
              flow_id: flowBotLink.flow_id, 
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              flow_name: (flowBotLink.flow as any)?.name,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              flow_config_keys: (flowBotLink.flow as any)?.config ? Object.keys((flowBotLink.flow as any).config) : [],
            } 
          : { erro: flowBotLinkError?.message || "Nenhum vinculo em flow_bots" },
        sucesso: !!flowBotLink,
      })

      if (flowBotLink) {
        flowId = flowBotLink.flow_id
      }
    } else {
      steps.push({
        step: "3. Buscar fluxo via flow_bots (PULADO - ja encontrou direto)",
        resultado: "Pulado porque encontrou fluxo direto",
        sucesso: true,
      })
    }

    // STEP 4: Se encontrou flowId, buscar config completa
    if (flowId) {
      const { data: flowData, error: flowDataError } = await supabase
        .from("flows")
        .select("id, name, config")
        .eq("id", flowId)
        .single()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const flowConfig = flowData?.config as Record<string, any> | null
      const orderBumpConfig = flowConfig?.orderBump
      const orderBumpInicial = orderBumpConfig?.inicial

      steps.push({
        step: "4. Carregar config do fluxo",
        resultado: {
          flow_id: flowId,
          flow_name: flowData?.name,
          config_keys: flowConfig ? Object.keys(flowConfig) : [],
          has_order_bump: !!orderBumpConfig,
          order_bump_keys: orderBumpConfig ? Object.keys(orderBumpConfig) : [],
          erro: flowDataError?.message,
        },
        sucesso: !!flowData,
      })

      // STEP 5: Verificar Order Bump
      steps.push({
        step: "5. Verificar Order Bump Inicial",
        resultado: {
          existe_orderBump: !!orderBumpConfig,
          existe_inicial: !!orderBumpInicial,
          enabled: orderBumpInicial?.enabled,
          price: orderBumpInicial?.price,
          name: orderBumpInicial?.name,
          description: orderBumpInicial?.description,
          config_completa: orderBumpInicial,
        },
        sucesso: orderBumpInicial?.enabled && orderBumpInicial?.price > 0,
      })

      // STEP 6: Verificar se seria exibido
      const seriaExibido = orderBumpInicial?.enabled && orderBumpInicial?.price > 0

      steps.push({
        step: "6. RESULTADO FINAL - Order Bump seria exibido?",
        resultado: seriaExibido 
          ? {
              exibido: true,
              mensagem: orderBumpInicial.description || `Deseja adicionar ${orderBumpInicial.name || "este bonus"} por apenas R$ ${orderBumpInicial.price}?`,
              botao_aceitar: orderBumpInicial.acceptText || "ADICIONAR",
              botao_recusar: orderBumpInicial.rejectText || "NAO QUERO",
            }
          : {
              exibido: false,
              motivo: !orderBumpConfig ? "orderBump nao existe na config" 
                    : !orderBumpInicial ? "orderBump.inicial nao existe"
                    : !orderBumpInicial.enabled ? "orderBump.inicial.enabled = false"
                    : orderBumpInicial.price <= 0 ? "orderBump.inicial.price <= 0"
                    : "motivo desconhecido",
            },
        sucesso: seriaExibido,
      })
    } else {
      steps.push({
        step: "4-6. ERRO - Nenhum fluxo encontrado",
        resultado: {
          erro: "Nao foi possivel encontrar nenhum fluxo vinculado a este bot",
          solucao: "Va na pagina do fluxo e vincule este bot ao fluxo",
        },
        sucesso: false,
      })
    }

    // Resumo final
    const sucesso = steps.every(s => s.sucesso)
    const primeiroErro = steps.find(s => !s.sucesso)

    return NextResponse.json({
      ...result,
      bot_id: botId,
      sucesso_geral: sucesso,
      problema: primeiroErro ? `Falhou no passo: ${primeiroErro.step}` : null,
      steps,
    })

  } catch (error) {
    return NextResponse.json({
      ...result,
      erro: error instanceof Error ? error.message : "Erro desconhecido",
      steps,
    }, { status: 500 })
  }
}

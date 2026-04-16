import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  const supabase = getSupabase()
  const searchParams = request.nextUrl.searchParams
  const botUsername = searchParams.get("bot") // username do bot (sem @)
  const telegramBotId = searchParams.get("telegram_id") // ou ID do telegram

  const result: Record<string, unknown> = {
    titulo: "DEBUG - Verificar Vinculo Bot <-> Fluxo",
    timestamp: new Date().toISOString(),
  }

  try {
    // PRIMEIRO: Verificar se conseguimos acessar as tabelas (debug RLS)
    const { data: botsCount, error: botsCountError } = await supabase
      .from("bots")
      .select("id", { count: "exact", head: true })
    
    const { data: flowsCount, error: flowsCountError } = await supabase
      .from("flows")
      .select("id", { count: "exact", head: true })

    const { data: flowBotsCount, error: flowBotsCountError } = await supabase
      .from("flow_bots")
      .select("id", { count: "exact", head: true })

    const { data: plansCount, error: plansCountError } = await supabase
      .from("payment_plans")
      .select("id", { count: "exact", head: true })

    result.debug_tabelas = {
      bots: { acessivel: !botsCountError, erro: botsCountError?.message },
      flows: { acessivel: !flowsCountError, erro: flowsCountError?.message },
      flow_bots: { acessivel: !flowBotsCountError, erro: flowBotsCountError?.message },
      payment_plans: { acessivel: !plansCountError, erro: plansCountError?.message },
    }

    // Buscar TODOS os bots sem filtro para debug
    const { data: allBotsRaw, error: allBotsError } = await supabase
      .from("bots")
      .select("*")
    
    result.debug_bots_raw = {
      total: allBotsRaw?.length || 0,
      erro: allBotsError?.message,
      bots: allBotsRaw?.map(b => ({
        id: b.id,
        username: b.username,
        telegram_bot_id: b.telegram_bot_id,
        status: b.status,
        user_id: b.user_id,
      })) || [],
    }

    // Buscar TODOS os fluxos para debug
    const { data: allFlowsRaw, error: allFlowsError } = await supabase
      .from("flows")
      .select("id, name, bot_id, config")
    
    result.debug_flows_raw = {
      total: allFlowsRaw?.length || 0,
      erro: allFlowsError?.message,
      flows: allFlowsRaw?.map(f => ({
        id: f.id,
        name: f.name,
        bot_id: f.bot_id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        has_order_bump: f.config ? "orderBump" in (f.config as Record<string, any>) : false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        order_bump_enabled: (f.config as Record<string, any>)?.orderBump?.inicial?.enabled,
      })) || [],
    }

    // Buscar TODOS os vinculos flow_bots
    const { data: allFlowBots, error: allFlowBotsError } = await supabase
      .from("flow_bots")
      .select("id, flow_id, bot_id")
    
    result.debug_flow_bots_raw = {
      total: allFlowBots?.length || 0,
      erro: allFlowBotsError?.message,
      vinculos: allFlowBots || [],
    }

    // Buscar o bot
    let botQuery = supabase.from("bots").select("id, username, telegram_bot_id, token")
    
    if (botUsername) {
      botQuery = botQuery.eq("username", botUsername)
    } else if (telegramBotId) {
      botQuery = botQuery.eq("telegram_bot_id", telegramBotId)
    } else {
      // Listar todos os bots
      const { data: allBots, error: listError } = await supabase.from("bots").select("id, username, telegram_bot_id")
      return NextResponse.json({
        ...result,
        instrucao: "Passe ?bot=USERNAME ou ?telegram_id=ID para verificar um bot especifico",
        list_error: listError?.message,
        todos_bots: allBots?.map(b => ({
          id: b.id,
          username: b.username,
          telegram_id: b.telegram_bot_id,
          check_url: `/api/debug/check-bot-flow?bot=${b.username}`,
        })) || [],
      })
    }

    const { data: bot, error: botError } = await botQuery.single()

    if (!bot) {
      return NextResponse.json({
        ...result,
        erro: "Bot nao encontrado",
        detalhe: botError?.message,
      })
    }

    result.bot = {
      id: bot.id,
      username: bot.username,
      telegram_bot_id: bot.telegram_bot_id,
    }

    // Metodo 1: Buscar fluxo pelo bot_id direto
    const { data: flowDireto, error: flowDiretoError } = await supabase
      .from("flows")
      .select("id, name, config")
      .eq("bot_id", bot.id)
      .limit(1)
      .single()

    result.metodo_1_bot_id_direto = {
      encontrou: !!flowDireto,
      erro: flowDiretoError?.message,
      flow_id: flowDireto?.id,
      flow_name: flowDireto?.name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      has_order_bump: flowDireto?.config ? "orderBump" in (flowDireto.config as Record<string, any>) : false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      order_bump_inicial_enabled: (flowDireto?.config as Record<string, any>)?.orderBump?.inicial?.enabled,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      order_bump_inicial_price: (flowDireto?.config as Record<string, any>)?.orderBump?.inicial?.price,
    }

    // Metodo 2: Buscar pela tabela flow_bots
    const { data: flowBotLinks, error: flowBotLinksError } = await supabase
      .from("flow_bots")
      .select("id, flow_id, flow:flows(id, name, config)")
      .eq("bot_id", bot.id)

    result.metodo_2_flow_bots = {
      encontrou: flowBotLinks && flowBotLinks.length > 0,
      erro: flowBotLinksError?.message,
      total_vinculos: flowBotLinks?.length || 0,
      vinculos: flowBotLinks?.map(link => ({
        flow_bot_id: link.id,
        flow_id: link.flow_id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        flow_name: (link.flow as any)?.name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        has_order_bump: (link.flow as any)?.config ? "orderBump" in ((link.flow as any)?.config as Record<string, any>) : false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        order_bump_inicial_enabled: ((link.flow as any)?.config as Record<string, any>)?.orderBump?.inicial?.enabled,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        order_bump_inicial_price: ((link.flow as any)?.config as Record<string, any>)?.orderBump?.inicial?.price,
      })) || [],
    }

    // Metodo 3: Verificar user_flow_state (se o usuario ja interagiu)
    const { data: userStates } = await supabase
      .from("user_flow_state")
      .select("id, flow_id, telegram_user_id, status, updated_at")
      .eq("bot_id", bot.id)
      .order("updated_at", { ascending: false })
      .limit(5)

    result.metodo_3_user_states = {
      total_estados: userStates?.length || 0,
      ultimos_estados: userStates?.map(s => ({
        telegram_user_id: s.telegram_user_id,
        flow_id: s.flow_id,
        status: s.status,
        updated_at: s.updated_at,
      })) || [],
    }

    // Diagnostico final
    const temVinculoDireto = !!flowDireto
    const temVinculoFlowBots = flowBotLinks && flowBotLinks.length > 0

    let orderBumpConfig = null
    if (temVinculoDireto) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      orderBumpConfig = (flowDireto?.config as Record<string, any>)?.orderBump?.inicial
    } else if (temVinculoFlowBots && flowBotLinks[0]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      orderBumpConfig = ((flowBotLinks[0].flow as any)?.config as Record<string, any>)?.orderBump?.inicial
    }

    result.diagnostico = {
      bot_tem_fluxo_vinculado: temVinculoDireto || temVinculoFlowBots,
      metodo_vinculo: temVinculoDireto ? "bot_id direto" : temVinculoFlowBots ? "flow_bots" : "NENHUM",
      order_bump_configurado: !!orderBumpConfig,
      order_bump_ativado: orderBumpConfig?.enabled === true,
      order_bump_preco_valido: orderBumpConfig?.price > 0,
      vai_funcionar: (temVinculoDireto || temVinculoFlowBots) && orderBumpConfig?.enabled === true && orderBumpConfig?.price > 0,
      config_order_bump: orderBumpConfig,
    }

    if (!temVinculoDireto && !temVinculoFlowBots) {
      result.como_resolver = {
        problema: "Bot NAO esta vinculado a nenhum fluxo!",
        solucao: "Va em Fluxos > Selecione o fluxo > Aba 'Bots Vinculados' > Adicione este bot",
      }
    } else if (!orderBumpConfig?.enabled) {
      result.como_resolver = {
        problema: "Order Bump NAO esta ativado no fluxo!",
        solucao: "Va em Fluxos > Selecione o fluxo > Aba 'Order Bump' > Ative o Order Bump Inicial",
      }
    } else if (!orderBumpConfig?.price || orderBumpConfig.price <= 0) {
      result.como_resolver = {
        problema: "Order Bump nao tem preco configurado!",
        solucao: "Va em Fluxos > Selecione o fluxo > Aba 'Order Bump' > Defina um preco > 0",
      }
    }

    return NextResponse.json(result)

  } catch (error) {
    return NextResponse.json({
      ...result,
      erro: "Erro ao processar",
      detalhe: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}

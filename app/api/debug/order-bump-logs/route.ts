import { NextRequest, NextResponse } from "next/server"
import { getMemoryLogs } from "@/lib/logger"
import { getSupabase } from "@/lib/supabase"

/**
 * GET /api/debug/order-bump-logs
 * 
 * Endpoint especializado para debug do Order Bump.
 * Retorna logs formatados e informacoes uteis sobre o Order Bump.
 * 
 * Query params:
 * - telegram_user_id: filtrar por usuario
 * - limit: numero de logs (default: 50)
 * - bot_id: filtrar por bot
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const telegramUserId = searchParams.get("telegram_user_id")
  const botId = searchParams.get("bot_id")
  const limit = parseInt(searchParams.get("limit") || "50")

  // Buscar logs da memoria
  const logs = getMemoryLogs({
    category: "order_bump",
    limit,
    telegram_user_id: telegramUserId ? parseInt(telegramUserId) : undefined,
  })

  // Buscar informacoes do banco para contexto
  const supabase = getSupabase()
  const diagnostics: Record<string, unknown> = {}

  try {
    // Buscar fluxos com Order Bump
    const { data: flows } = await supabase
      .from("flows")
      .select("id, name, config, bot_id")
      .not("config", "is", null)

    const flowsWithOrderBump = flows?.filter(flow => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config = flow.config as Record<string, any>
      return config?.orderBump?.inicial?.enabled
    }) || []

    diagnostics.flows_com_order_bump = flowsWithOrderBump.map(f => ({
      id: f.id,
      name: f.name,
      bot_id: f.bot_id,
      bot_id_problema: f.bot_id === null ? "SIM - FLUXO NAO VINCULADO A BOT!" : "OK",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      order_bump_config: (f.config as Record<string, any>)?.orderBump?.inicial,
    }))

    // Buscar vinculos da tabela flow_bots
    const { data: flowBots } = await supabase
      .from("flow_bots")
      .select("id, flow_id, bot_id, bot:bots(id, username)")
    
    diagnostics.flow_bots_vinculos = flowBots?.map(fb => ({
      flow_id: fb.flow_id,
      bot_id: fb.bot_id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bot_username: (fb.bot as any)?.username,
    })) || []

    // Verificar se fluxos com Order Bump tem vinculo
    diagnostics.verificacao_vinculos = flowsWithOrderBump.map(f => {
      const temVinculoDireto = f.bot_id !== null
      const temVinculoFlowBots = flowBots?.some(fb => fb.flow_id === f.id) || false
      return {
        flow_id: f.id,
        flow_name: f.name,
        tem_bot_id_direto: temVinculoDireto,
        tem_vinculo_flow_bots: temVinculoFlowBots,
        status: temVinculoDireto || temVinculoFlowBots ? "OK" : "ERRO - Fluxo sem vinculo com bot!",
      }
    })

    // Se tiver bot_id, buscar estado dos usuarios
    if (botId) {
      const { data: states } = await supabase
        .from("user_flow_state")
        .select("telegram_user_id, status, flow_id, metadata, updated_at")
        .eq("bot_id", botId)
        .order("updated_at", { ascending: false })
        .limit(10)

      diagnostics.estados_usuarios = states
    }

    // Se tiver telegram_user_id, buscar pagamentos
    if (telegramUserId) {
      const { data: payments } = await supabase
        .from("payments")
        .select("id, amount, status, product_type, description, created_at")
        .eq("telegram_user_id", telegramUserId)
        .order("created_at", { ascending: false })
        .limit(5)

      diagnostics.pagamentos_usuario = payments
    }
  } catch (error) {
    diagnostics.error = error instanceof Error ? error.message : "Erro ao buscar diagnosticos"
  }

  // Formatar output para facilitar leitura
  const formattedLogs = logs.map(log => ({
    id: log.id,
    hora: new Date(log.timestamp).toLocaleTimeString("pt-BR"),
    nivel: log.level.toUpperCase(),
    mensagem: log.message,
    dados: log.data,
    usuario: log.telegram_user_id,
    bot: log.bot_id,
    fluxo: log.flow_id,
  }))

  return NextResponse.json({
    titulo: "DEBUG ORDER BUMP - LOGS",
    instrucoes: [
      "1. Execute uma acao no bot (clique em um plano)",
      "2. Atualize esta pagina para ver os logs",
      "3. Procure por erros ou warnings",
      "4. Verifique se o Order Bump esta configurado corretamente",
    ],
    total_logs: formattedLogs.length,
    logs: formattedLogs,
    diagnosticos: diagnostics,
    dicas_debug: {
      se_nao_aparecer_order_bump: [
        "Verifique se o fluxo tem orderBump.inicial.enabled = true",
        "Verifique se orderBump.inicial.price > 0",
        "Verifique se o usuario tem estado (user_flow_state) para o bot",
        "Verifique nos logs se a config esta sendo carregada corretamente",
      ],
      se_aparecer_mas_nao_funcionar: [
        "Verifique se o callback esta sendo recebido (ob_accept ou ob_decline)",
        "Verifique se o estado esta sendo atualizado para waiting_order_bump",
        "Verifique se o metadata esta sendo salvo corretamente",
      ],
    },
  })
}

import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

// Test endpoint to debug webhook and flow configuration
// GET /api/telegram/test?token=BOT_TOKEN

export async function GET(req: NextRequest) {
  try {
    const botToken = req.nextUrl.searchParams.get("token")
    
    if (!botToken) {
      return NextResponse.json({ error: "Missing token parameter" }, { status: 400 })
    }

    const supabase = getSupabase()
    const results: Record<string, unknown> = {}

    // 1. Check bot
    const { data: bots, error: botError } = await supabase
      .from("bots")
      .select("id, name, token, status")
      .eq("token", botToken)

    results.botQuery = { data: bots, error: botError }
    
    const bot = bots?.[0]
    if (!bot) {
      return NextResponse.json({ 
        error: "Bot not found", 
        results,
        suggestion: "Check if the bot token is correct"
      }, { status: 404 })
    }

    if (bot.status !== "active") {
      return NextResponse.json({ 
        error: "Bot is not active", 
        bot,
        results,
        suggestion: "Activate the bot in the Bots page"
      }, { status: 400 })
    }

    // 2. Check flows
    const { data: flows, error: flowsError } = await supabase
      .from("flows")
      .select("id, name, status, is_primary, category")
      .eq("bot_id", bot.id)

    results.flowsQuery = { data: flows, error: flowsError }

    const activeFlows = flows?.filter(f => f.status === "ativo") || []
    if (activeFlows.length === 0) {
      return NextResponse.json({ 
        error: "No active flows found", 
        bot,
        allFlows: flows,
        results,
        suggestion: "Make sure at least one flow has status 'ativo'"
      }, { status: 400 })
    }

    const primaryFlow = activeFlows.find(f => f.is_primary) || activeFlows[0]

    // 3. Check nodes
    const { data: nodes, error: nodesError } = await supabase
      .from("flow_nodes")
      .select("id, type, label, config, position")
      .eq("flow_id", primaryFlow.id)
      .order("position", { ascending: true })

    results.nodesQuery = { data: nodes, error: nodesError }

    if (!nodes || nodes.length === 0) {
      return NextResponse.json({ 
        error: "No nodes found in the primary flow", 
        bot,
        primaryFlow,
        results,
        suggestion: "Add nodes to the flow"
      }, { status: 400 })
    }

    // 4. Check webhook registration
    const webhookInfo = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`)
    const webhookData = await webhookInfo.json()

    // 5. Analyze potential problems
    const problems: string[] = []
    
    const webhookUrl = webhookData?.result?.url || ""
    if (!webhookUrl) {
      problems.push("CRITICO: Webhook nao esta registrado no Telegram! Va em Bots > clique no bot > registrar webhook.")
    } else if (webhookUrl.includes("vusercontent.net") || webhookUrl.includes("localhost")) {
      problems.push(`CRITICO: Webhook aponta para URL de preview/local (${webhookUrl}). Precisa apontar para a URL de producao do Vercel.`)
    }
    
    if (webhookData?.result?.last_error_message) {
      problems.push(`Telegram reportou erro no webhook: ${webhookData.result.last_error_message} (em ${webhookData.result.last_error_date ? new Date(webhookData.result.last_error_date * 1000).toISOString() : "?"})`)
    }

    const firstNode = nodes[0]
    if (firstNode?.type !== "trigger") {
      problems.push(`Primeiro node nao e trigger, e sim '${firstNode?.type}'. O fluxo pode nao iniciar corretamente.`)
    }
    
    const messageNodes = nodes.filter(n => n.type === "message")
    for (const mn of messageNodes) {
      const cfg = mn.config as Record<string, unknown>
      if (!cfg?.text && !cfg?.media_url) {
        problems.push(`Node '${mn.label}' (pos ${mn.position}) e do tipo message mas nao tem texto nem midia.`)
      }
    }

    // 6. Optional: send test message directly
    const testChatId = req.nextUrl.searchParams.get("chat_id")
    let testMessageResult = null
    if (testChatId) {
      const testRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: parseInt(testChatId),
          text: "Teste de conexao do bot - se voce recebeu isso, o token esta funcionando!",
        }),
      })
      testMessageResult = await testRes.json()
    }

    return NextResponse.json({
      status: problems.length > 0 ? "PROBLEMAS ENCONTRADOS" : "OK",
      message: problems.length > 0 
        ? `Encontrados ${problems.length} problema(s) que podem impedir o bot de funcionar.`
        : "Todos os checks passaram! O bot deve estar funcionando.",
      problems,
      bot: {
        id: bot.id,
        name: bot.name,
        status: bot.status
      },
      primaryFlow: {
        id: primaryFlow.id,
        name: primaryFlow.name,
        status: primaryFlow.status,
        is_primary: primaryFlow.is_primary
      },
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.type,
        label: n.label,
        position: n.position,
        configKeys: n.config ? Object.keys(n.config as Record<string, unknown>) : [],
        configPreview: n.config ? JSON.stringify(n.config).slice(0, 200) : null,
      })),
      webhookInfo: webhookData,
      testMessageResult,
    })

  } catch (err) {
    console.error("[test] Error:", err)
    return NextResponse.json({ 
      error: "Internal error", 
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 })
  }
}

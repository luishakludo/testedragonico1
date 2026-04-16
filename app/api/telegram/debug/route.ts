import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

// POST: Limpar estados e re-registrar webhook (RESET COMPLETO)
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  
  if (!token) {
    return NextResponse.json({ error: "Token obrigatorio" }, { status: 400 })
  }

  const supabase = getSupabase()

  // Buscar bot pelo token
  const { data: bot } = await supabase
    .from("bots")
    .select("id")
    .eq("token", token)
    .single()

  if (!bot) {
    return NextResponse.json({ error: "Bot nao encontrado" }, { status: 404 })
  }

  // 1. Deletar todos os estados de fluxo deste bot
  const { count: statesDeleted } = await supabase
    .from("user_flow_state")
    .delete()
    .eq("bot_id", bot.id)

  // 2. Re-registrar o webhook com a URL correta
  const webhookUrl = `${req.nextUrl.origin}/api/telegram/webhook?token=${encodeURIComponent(token)}`
  
  // Primeiro deletar webhook antigo
  await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`)
  
  // Depois registrar novo
  const registerRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}&drop_pending_updates=true`)
  const registerData = await registerRes.json()

  // 3. Verificar se funcionou
  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
  const infoData = await infoRes.json()

  return NextResponse.json({ 
    success: registerData.ok,
    message: registerData.ok ? "RESET COMPLETO! Estados limpos e webhook re-registrado. Tente /start agora!" : "Erro ao registrar webhook",
    details: {
      statesDeleted: statesDeleted || 0,
      webhookUrl,
      telegramResponse: registerData,
      currentWebhook: infoData.result
    }
  })
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  const reset = req.nextUrl.searchParams.get("reset") === "true"
  
  if (!token) {
    return NextResponse.json({ error: "Token do bot nao fornecido. Use ?token=SEU_TOKEN" }, { status: 400 })
  }

  // Se reset=true, fazer reset completo
  if (reset) {
    const supabase = getSupabase()

    const { data: bot } = await supabase
      .from("bots")
      .select("id")
      .eq("token", token)
      .single()

    if (!bot) {
      return NextResponse.json({ error: "Bot nao encontrado" }, { status: 404 })
    }

    // Deletar estados
    const { count } = await supabase
      .from("user_flow_state")
      .delete()
      .eq("bot_id", bot.id)

    // Re-registrar webhook
    const webhookUrl = `${req.nextUrl.origin}/api/telegram/webhook?token=${encodeURIComponent(token)}`
    await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`)
    const registerRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}&drop_pending_updates=true`)
    const registerData = await registerRes.json()

    return NextResponse.json({ 
      success: registerData.ok,
      message: "RESET COMPLETO! Estados limpos e webhook re-registrado. Tente /start agora!",
      statesDeleted: count || 0,
      webhookUrl,
      telegramOk: registerData.ok
    })
  }

  const supabase = getSupabase()
  const results: Record<string, unknown> = {}
  const problems: string[] = []

  // 1. Verificar bot
  const { data: bots, error: botError } = await supabase
    .from("bots")
    .select("id, name, token, status")
    .eq("token", token)

  if (botError) {
    return NextResponse.json({ error: "Erro ao buscar bot", details: botError.message }, { status: 500 })
  }

  const bot = bots?.[0]
  if (!bot) {
    return NextResponse.json({ 
      success: false, 
      problems: ["Bot nao encontrado com esse token. Verifique se o token esta correto."],
      results: { bot: null }
    })
  }

  results.bot = {
    id: bot.id,
    name: bot.name,
    status: bot.status,
    isActive: bot.status === "active"
  }

  if (bot.status !== "active") {
    problems.push("Bot nao esta ativo. Ative o bot na pagina de bots.")
  }

  // 2. Verificar fluxos ativos (SEM is_primary que nao existe)
  const { data: flows, error: flowsError } = await supabase
    .from("flows")
    .select("id, name, status, created_at")
    .eq("bot_id", bot.id)
    .order("created_at", { ascending: true })
  
  if (flowsError) {
    results.flowsError = flowsError.message
    problems.push("Erro ao buscar fluxos: " + flowsError.message)
  }
  
  const activeFlows = flows?.filter(f => f.status === "ativo") || []
  const primaryFlow = activeFlows[0]
  
  results.flows = {
    total: flows?.length || 0,
    active: activeFlows.length,
    primaryFlow: primaryFlow ? {
      id: primaryFlow.id,
      name: primaryFlow.name,
    } : null,
    allFlows: flows?.map(f => ({
      id: f.id,
      name: f.name,
      status: f.status,
    }))
  }

  if (activeFlows.length === 0) {
    problems.push("Nenhum fluxo ativo encontrado. Defina o status do fluxo como 'Ativo'.")
  }

  // 3. Se tem fluxo ativo, verificar nodes
  if (primaryFlow) {
    const { data: nodes, error: nodesError } = await supabase
      .from("flow_nodes")
      .select("id, type, label, position, config")
      .eq("flow_id", primaryFlow.id)
      .order("position", { ascending: true })

    if (nodesError) {
      results.nodesError = nodesError.message
      problems.push("Erro ao buscar nodes: " + nodesError.message)
    }

    results.nodes = {
      total: nodes?.length || 0,
      list: nodes?.map(n => ({
        id: n.id,
        type: n.type,
        label: n.label,
        position: n.position,
        hasConfig: !!n.config && Object.keys(n.config).length > 0
      }))
    }

    if (!nodes || nodes.length === 0) {
      problems.push("O fluxo ativo nao tem nenhum node/mensagem. Adicione mensagens ao fluxo.")
    }
  }

  // 4. Verificar webhook no Telegram
  try {
    const webhookRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
    const webhookData = await webhookRes.json()
    
    results.telegramWebhook = {
      url: webhookData.result?.url || null,
      hasUrl: !!webhookData.result?.url,
      pendingUpdates: webhookData.result?.pending_update_count || 0,
      lastError: webhookData.result?.last_error_message || null,
      lastErrorDate: webhookData.result?.last_error_date ? new Date(webhookData.result.last_error_date * 1000).toISOString() : null
    }

    if (!webhookData.result?.url) {
      problems.push("Webhook nao esta configurado no Telegram. Desative e ative o bot novamente.")
    }

    if (webhookData.result?.last_error_message) {
      problems.push("Ultimo erro do webhook: " + webhookData.result.last_error_message)
    }

    // 5. Testar se o webhook responde corretamente
    if (webhookData.result?.url) {
      try {
        const testPayload = {
          update_id: 999999999,
          message: {
            message_id: 1,
            from: { id: 123456, is_bot: false, first_name: "Test" },
            chat: { id: 123456, type: "private" },
            date: Math.floor(Date.now() / 1000),
            text: "/start"
          }
        }
        
        const webhookTestRes = await fetch(webhookData.result.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(testPayload)
        })
        
        results.webhookTest = {
          status: webhookTestRes.status,
          statusText: webhookTestRes.statusText,
          ok: webhookTestRes.ok,
          redirected: webhookTestRes.redirected,
          url: webhookTestRes.url
        }
        
        if (webhookTestRes.status === 302 || webhookTestRes.redirected) {
          problems.push("Webhook esta retornando redirect (302). Isso impede o Telegram de receber a resposta.")
        } else if (!webhookTestRes.ok) {
          problems.push(`Webhook retornou erro ${webhookTestRes.status}: ${webhookTestRes.statusText}`)
        }
      } catch (testErr) {
        results.webhookTestError = testErr instanceof Error ? testErr.message : "Erro desconhecido"
        problems.push("Erro ao testar webhook: " + (testErr instanceof Error ? testErr.message : "Erro desconhecido"))
      }
    }
  } catch (e) {
    results.telegramWebhookError = e instanceof Error ? e.message : "Erro desconhecido"
    problems.push("Erro ao verificar webhook do Telegram")
  }

  return NextResponse.json({
    success: problems.length === 0,
    problems,
    results
  })
}

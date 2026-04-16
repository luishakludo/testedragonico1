import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://izvulojnfvgsbmhyvqtn.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dnVsb2puZnZnc2JtaHl2cXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTk0NTMsImV4cCI6MjA4ODgzNTQ1M30.Djnn3tsrxSGLBR-Bm1dWOpQe0NHCSOWJFZkbbTOk2oM"
  )
}

// GET - Simula /start e mostra todos os passos
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const supabase = getSupabase()
  const { botId } = await params
  const logs: string[] = []
  const log = (msg: string) => {
    console.log(msg)
    logs.push(msg)
  }

  log("========== TESTE WEBHOOK /start ==========")
  log(`botId recebido na URL: ${botId}`)

  // 1. Buscar bot pelo token prefix (como o webhook real faz)
  log("")
  log("PASSO 1: Buscando bot no banco...")
  log(`Query: SELECT * FROM bots WHERE token LIKE '${botId}:%'`)
  
  const { data: bot, error: botError } = await supabase
    .from("bots")
    .select("*")
    .like("token", `${botId}:%`)
    .single()

  if (botError) {
    log(`ERRO ao buscar bot: ${botError.message} (code: ${botError.code})`)
  }

  if (!bot) {
    log("Bot NAO encontrado!")
    log("")
    log("Possíveis causas:")
    log("- O botId na URL está errado (deve ser o ID numerico do Telegram, ex: 8339469623)")
    log("- O token do bot não está salvo corretamente no banco")
    log("")
    
    // Tenta buscar de outras formas
    log("Tentando buscar bot de outras formas...")
    
    // Por UUID
    const { data: botByUuid } = await supabase
      .from("bots")
      .select("id, name, token")
      .eq("id", botId)
      .single()
    
    if (botByUuid) {
      log(`Encontrado por UUID: ${botByUuid.name}`)
      log(`Token: ${botByUuid.token?.substring(0, 15)}...`)
      log(`Use o ID numerico do token na URL, nao o UUID`)
    }

    // Lista todos os bots
    const { data: allBots } = await supabase
      .from("bots")
      .select("id, name, token")
      .limit(5)
    
    if (allBots && allBots.length > 0) {
      log("")
      log("Bots encontrados no banco:")
      allBots.forEach((b, i) => {
        const tokenPrefix = b.token?.split(":")[0] || "sem-token"
        log(`  ${i + 1}. ${b.name} - UUID: ${b.id} - Token prefix: ${tokenPrefix}`)
      })
    }

    return NextResponse.json({
      success: false,
      error: "Bot nao encontrado",
      logs,
      hint: "Use o ID numerico do Telegram (ex: 8339469623) na URL, nao o UUID"
    }, { status: 404 })
  }

  log(`Bot encontrado: ${bot.name}`)
  log(`Bot UUID: ${bot.id}`)
  log(`Bot token: ${bot.token?.substring(0, 20)}...`)

  // 2. Buscar fluxo - primeiro por bot_id direto, depois por flow_bots
  log("")
  log("PASSO 2: Buscando fluxo...")
  
  let flow = null
  
  // Strategy 1: Direct bot_id in flows table
  log("Estrategia 1: Buscando por flows.bot_id...")
  const { data: directFlow, error: directError } = await supabase
    .from("flows")
    .select("*")
    .eq("bot_id", bot.id)
    .eq("status", "ativo")
    .order("is_primary", { ascending: false })
    .limit(1)
    .single()

  if (directError && directError.code !== "PGRST116") {
    log(`ERRO: ${directError.message}`)
  }

  if (directFlow) {
    log(`Encontrado via bot_id direto: ${directFlow.name}`)
    flow = directFlow
  } else {
    // Strategy 2: Check flow_bots table
    log("Nao encontrado. Estrategia 2: Buscando por flow_bots...")
    const { data: flowBotLink, error: fbError } = await supabase
      .from("flow_bots")
      .select("flow_id")
      .eq("bot_id", bot.id)
      .limit(1)
      .single()

    if (fbError && fbError.code !== "PGRST116") {
      log(`ERRO flow_bots: ${fbError.message}`)
    }

    if (flowBotLink) {
      log(`Encontrado link em flow_bots: flow_id = ${flowBotLink.flow_id}`)
      const { data: linkedFlow } = await supabase
        .from("flows")
        .select("*")
        .eq("id", flowBotLink.flow_id)
        .single()

      if (linkedFlow) {
        log(`Fluxo vinculado encontrado: ${linkedFlow.name}`)
        flow = linkedFlow
      }
    } else {
      log("Nenhum link encontrado em flow_bots")
    }
  }

  if (!flow) {
    log("Nenhum fluxo encontrado para este bot!")
    
    // Lista fluxos do usuario
    const { data: userFlows } = await supabase
      .from("flows")
      .select("id, name, bot_id, status, is_primary, welcome_message")
      .eq("user_id", bot.user_id)
    
    log("")
    log(`Fluxos do usuario (${bot.user_id}):`)
    if (userFlows && userFlows.length > 0) {
      userFlows.forEach((f, i) => {
        log(`  ${i + 1}. ${f.name} - bot_id: ${f.bot_id || "(nenhum)"} - status: ${f.status}`)
      })
      log("")
      log("DICA: Vincule um bot ao fluxo na aba 'Bots' do editor de fluxos")
    } else {
      log("  Nenhum fluxo encontrado!")
    }

    return NextResponse.json({
      success: false,
      error: "Nenhum fluxo encontrado",
      bot: { id: bot.id, name: bot.name },
      logs,
      hint: "Vincule o bot a um fluxo na pagina /fluxos -> Editar -> Aba Bots"
    }, { status: 404 })
  }

  log(`Fluxo encontrado: ${flow.name}`)
  log(`Fluxo ID: ${flow.id}`)
  log(`Fluxo status: ${flow.status}`)
  log(`Fluxo is_primary: ${flow.is_primary}`)
  log(`Fluxo welcome_message: ${flow.welcome_message || "(vazio)"}`)

  // 3. Verificar welcome_message
  log("")
  log("PASSO 3: Verificando mensagem de boas-vindas...")
  
  const welcomeMsg = flow.welcome_message as string
  if (welcomeMsg && welcomeMsg.trim()) {
    log(`Mensagem encontrada: "${welcomeMsg}"`)
    log("O bot DEVERIA enviar esta mensagem no /start")
  } else {
    log("welcome_message esta VAZIO!")
    log("Verificando flow_nodes...")

    // 4. Buscar nodes
    const { data: nodes, error: nodesError } = await supabase
      .from("flow_nodes")
      .select("*")
      .eq("flow_id", flow.id)
      .order("position", { ascending: true })

    if (nodesError) {
      log(`ERRO ao buscar nodes: ${nodesError.message}`)
    }

    if (nodes && nodes.length > 0) {
      log(`Encontrados ${nodes.length} nodes:`)
      nodes.forEach((n, i) => {
        const config = n.config as Record<string, unknown> || {}
        log(`  ${i + 1}. type: ${n.type} - label: ${n.label}`)
        log(`     config.text: ${(config.text as string)?.substring(0, 50) || "(vazio)"}`)
      })
    } else {
      log("Nenhum node encontrado!")
    }
  }

  // 5. Simular envio
  log("")
  log("PASSO 4: Simulando envio de mensagem...")
  
  const testChatId = 123456789
  let messageToSend = ""

  if (welcomeMsg && welcomeMsg.trim()) {
    messageToSend = welcomeMsg
      .replace(/\{nome\}/gi, "TestUser")
      .replace(/\{username\}/gi, "@testuser")
      .replace(/\{bot\.username\}/gi, bot.username ? `@${bot.username}` : bot.name)
    
    log(`Mensagem final (com variaveis substituidas): "${messageToSend}"`)
  } else {
    messageToSend = `Ola! Bem-vindo ao ${bot.name || "bot"}.`
    log(`Usando mensagem padrao: "${messageToSend}"`)
  }

  // 6. Testar envio real (opcional)
  log("")
  log("PASSO 5: Verificando se consegue enviar mensagem...")

  const telegramUrl = `https://api.telegram.org/bot${bot.token}/getMe`
  try {
    const tgResponse = await fetch(telegramUrl)
    const tgData = await tgResponse.json()
    
    if (tgData.ok) {
      log(`Token valido! Bot username: @${tgData.result.username}`)
    } else {
      log(`ERRO: Token invalido ou expirado!`)
      log(`Resposta Telegram: ${JSON.stringify(tgData)}`)
    }
  } catch (err) {
    log(`ERRO ao verificar token: ${err}`)
  }

  // 7. Verificar webhook
  log("")
  log("PASSO 6: Verificando webhook registrado...")

  const webhookUrl = `https://api.telegram.org/bot${bot.token}/getWebhookInfo`
  try {
    const whResponse = await fetch(webhookUrl)
    const whData = await whResponse.json()
    
    if (whData.ok) {
      log(`Webhook URL: ${whData.result.url}`)
      log(`Pending updates: ${whData.result.pending_update_count}`)
      if (whData.result.last_error_message) {
        log(`ULTIMO ERRO: ${whData.result.last_error_message}`)
        log(`Data do erro: ${whData.result.last_error_date}`)
      }
    }
  } catch (err) {
    log(`ERRO ao verificar webhook: ${err}`)
  }

  log("")
  log("========== FIM DO TESTE ==========")

  return NextResponse.json({
    success: true,
    bot: {
      id: bot.id,
      name: bot.name,
      token_prefix: bot.token?.split(":")[0]
    },
    flow: {
      id: flow.id,
      name: flow.name,
      status: flow.status,
      is_primary: flow.is_primary,
      welcome_message: flow.welcome_message
    },
    messageToSend,
    logs
  })
}

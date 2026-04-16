import { getSupabase } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const supabase = getSupabase()
  const { searchParams } = new URL(req.url)
  const campaignId = searchParams.get("campaign_id")
  const action = searchParams.get("action") // reset, execute, reset_and_execute

  // Se tem action, redirecionar para a logica de POST
  if (action && campaignId) {
    const fakeReq = {
      json: async () => ({ campaign_id: campaignId, action }),
      headers: req.headers,
    } as Request
    return POST(fakeReq)
  }

  try {
    // Get all campaigns or specific one
    let campaignsQuery = supabase
      .from("campaigns")
      .select("id, name, status, audience_type, audience, bot_id, created_at")
      .order("created_at", { ascending: false })

    if (campaignId) {
      campaignsQuery = campaignsQuery.eq("id", campaignId)
    }

    const { data: campaigns, error: campaignsError } = await campaignsQuery.limit(10)

    if (campaignsError) {
      return NextResponse.json({ error: "Erro ao buscar campanhas", details: campaignsError }, { status: 500 })
    }

    const results = []

    for (const campaign of campaigns || []) {
      // Get campaign nodes - select ALL columns to see full data
      const { data: nodes, error: nodesError } = await supabase
        .from("campaign_nodes")
        .select("*")
        .eq("campaign_id", campaign.id)
        .order("position", { ascending: true })

      // Get bot info
      const { data: bot } = await supabase
        .from("bots")
        .select("id, name, token")
        .eq("id", campaign.bot_id)
        .single()

      // Count users based on audience
      let usersQuery
      let userCount = 0
      let usersSample: { telegram_user_id: string; chat_id: number | null; funnel_step?: number; is_subscriber?: boolean }[] = []

      if (campaign.audience_type === "imported") {
        // Get imported users
        const { data: importedUsers, count } = await supabase
          .from("bot_users")
          .select("telegram_user_id, chat_id", { count: "exact" })
          .eq("bot_id", campaign.bot_id)
          .eq("source", "imported")
          .limit(5)

        userCount = count || 0
        usersSample = importedUsers || []
      } else {
        // Get all bot users
        const { data: allUsers } = await supabase
          .from("bot_users")
          .select("telegram_user_id, chat_id, funnel_step, is_subscriber")
          .eq("bot_id", campaign.bot_id)

        // Get payments for filtering
        const { data: payments } = await supabase
          .from("payments")
          .select("telegram_user_id, status")
          .eq("bot_id", campaign.bot_id)

        const pendingPaymentUsers = new Set<string>()
        const paidUsers = new Set<string>()

        if (payments) {
          for (const payment of payments) {
            const tgId = payment.telegram_user_id?.toString()
            if (!tgId) continue
            const status = (payment.status || "").toLowerCase()
            if (status === "pending" || status === "aguardando" || status === "pix_gerado") {
              pendingPaymentUsers.add(tgId)
            }
            if (status === "approved" || status === "paid" || status === "pago") {
              paidUsers.add(tgId)
            }
          }
        }

        let filteredUsers = allUsers || []

        if (campaign.audience === "started_not_continued") {
          filteredUsers = (allUsers || []).filter(u => {
            const step = typeof u.funnel_step === "number" ? u.funnel_step : parseInt(String(u.funnel_step || "0"))
            return step >= 1 && step < 3 && !u.is_subscriber
          })
        } else if (campaign.audience === "not_paid") {
          filteredUsers = (allUsers || []).filter(u => {
            const tgId = u.telegram_user_id?.toString()
            const hasPending = pendingPaymentUsers.has(tgId)
            const alreadyPaid = paidUsers.has(tgId) || u.is_subscriber === true
            return hasPending && !alreadyPaid
          })
        } else if (campaign.audience === "paid") {
          filteredUsers = (allUsers || []).filter(u => {
            const tgId = u.telegram_user_id?.toString()
            return u.is_subscriber === true || paidUsers.has(tgId)
          })
        }

        userCount = filteredUsers.length
        usersSample = filteredUsers.slice(0, 5)
      }

      // Check campaign_user_progress
      const { data: progress, count: progressCount } = await supabase
        .from("campaign_user_progress")
        .select("*", { count: "exact" })
        .eq("campaign_id", campaign.id)
        .limit(5)

      // Check if bot token is valid
      let botTokenValid = false
      let botTokenPreview = ""
      if (bot?.token) {
        botTokenPreview = bot.token.substring(0, 10) + "..." + bot.token.substring(bot.token.length - 5)
        botTokenValid = bot.token.length > 20 && bot.token.includes(":")
      }

      results.push({
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          audience_type: campaign.audience_type,
          audience: campaign.audience,
          created_at: campaign.created_at,
        },
        bot: {
          id: bot?.id,
          name: bot?.name,
          token_preview: botTokenPreview,
          token_valid: botTokenValid,
        },
        nodes: {
          count: nodes?.length || 0,
          error: nodesError?.message || null,
          details: nodes?.map(n => {
            const cfg = n.config as Record<string, unknown>
            const medias = cfg?.medias as string[] | undefined
            return {
              id: n.id,
              position: n.position,
              type: n.type,
              label: n.label,
              text: (cfg?.text as string) || null,
              media_count: medias?.length || 0,
              media_types: medias?.map(m => {
                if (m.startsWith("data:image")) return "image (base64)"
                if (m.startsWith("data:video")) return "video (base64)"
                if (m.includes("http")) return "url"
                return "unknown"
              }) || [],
              buttons: cfg?.buttons ? "configurado" : null,
            }
          }),
        },
        target_users: {
          total_count: userCount,
          sample: usersSample.map(u => ({
            telegram_user_id: u.telegram_user_id,
            chat_id: u.chat_id,
            has_chat_id: !!u.chat_id,
          })),
        },
        progress: {
          users_with_progress: progressCount || 0,
          sample: progress?.map(p => ({
            user_id: p.user_id,
            current_node_index: p.current_node_index,
            status: p.status,
            last_sent_at: p.last_sent_at,
          })),
        },
        // Check campaign_sends table for actual sends
        sends: await (async () => {
          const { data: sends, count: sendsCount } = await supabase
            .from("campaign_sends")
            .select("*", { count: "exact" })
            .eq("campaign_id", campaign.id)
            .order("created_at", { ascending: false })
            .limit(5)
          return {
            total_sends: sendsCount || 0,
            sample: sends?.map(s => ({
              telegram_user_id: s.telegram_user_id,
              chat_id: s.chat_id,
              status: s.status,
              node_id: s.campaign_node_id,
              created_at: s.created_at,
            })),
          }
        })(),
        // Check campaign_user_state table for user states
        user_states: await (async () => {
          const { data: states, count: statesCount } = await supabase
            .from("campaign_user_state")
            .select("*", { count: "exact" })
            .eq("campaign_id", campaign.id)
            .limit(5)
          return {
            total_states: statesCount || 0,
            sample: states?.map(s => ({
              telegram_user_id: s.telegram_user_id,
              chat_id: s.chat_id,
              status: s.status,
              current_node_position: s.current_node_position,
              next_send_at: s.next_send_at,
            })),
          }
        })(),
        diagnosis: {
          can_send: campaign.status === "ativa" && botTokenValid && userCount > 0 && (nodes?.length || 0) > 0,
          issues: [
            campaign.status !== "ativa" ? `Status da campanha: "${campaign.status}" (precisa ser "ativa")` : null,
            !botTokenValid ? "Token do bot invalido ou ausente" : null,
            userCount === 0 ? `Nenhum usuario encontrado para audience_type="${campaign.audience_type}" audience="${campaign.audience}"` : null,
            (nodes?.length || 0) === 0 ? "Campanha sem mensagens/nodes configurados - voce precisa configurar a mensagem antes de ativar" : null,
            nodesError ? `Erro ao buscar nodes: ${nodesError.message}` : null,
            nodes?.length > 0 && !nodes.some(n => (n.config as Record<string, unknown>)?.text) ? "Nodes existem mas nenhum tem texto configurado" : null,
            usersSample.some(u => !u.chat_id) ? "Alguns usuarios nao tem chat_id (necessario para enviar mensagem)" : null,
          ].filter(Boolean),
          // Fluxo esperado de envio
          expected_flow: {
            step1: "Campanha ativa -> chama /api/campaigns/execute",
            step2: "Execute busca nodes da campanha",
            step3: "Execute busca usuarios baseado em audience_type/audience",
            step4: "Para cada usuario, envia primeiro node de mensagem",
            step5: "Registra em campaign_sends e campaign_user_state",
          },
        },
      })
    }

    return NextResponse.json({
      total_campaigns: results.length,
      campaigns: results,
    })
  } catch (error) {
    return NextResponse.json({ error: "Erro interno", details: String(error) }, { status: 500 })
  }
}

// POST - Simular envio de campanha e retornar resultado detalhado
export async function POST(req: Request) {
  const supabase = getSupabase()
  
  try {
    const body = await req.json()
    const { campaign_id, action } = body as { campaign_id: string; action?: string }
    
    if (!campaign_id) {
      return NextResponse.json({ error: "campaign_id obrigatorio" }, { status: 400 })
    }
    
    const log: string[] = []
    
    // 1. Buscar campanha
    log.push(`[1] Buscando campanha ${campaign_id}...`)
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single()
    
    if (campaignError || !campaign) {
      log.push(`[ERRO] Campanha nao encontrada: ${campaignError?.message}`)
      return NextResponse.json({ success: false, log, error: "Campanha nao encontrada" })
    }
    
    log.push(`[1] Campanha encontrada: "${campaign.name}" status=${campaign.status}`)
    log.push(`[1] audience_type=${campaign.audience_type} audience=${campaign.audience}`)
    
    // 2. Buscar bot
    log.push(`[2] Buscando bot ${campaign.bot_id}...`)
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("id, name, token")
      .eq("id", campaign.bot_id)
      .single()
    
    if (botError || !bot) {
      log.push(`[ERRO] Bot nao encontrado: ${botError?.message}`)
      return NextResponse.json({ success: false, log, error: "Bot nao encontrado" })
    }
    
    log.push(`[2] Bot encontrado: "${bot.name}"`)
    log.push(`[2] Token valido: ${bot.token?.length > 20 && bot.token?.includes(":")}`)
    
    // 3. Buscar nodes
    log.push(`[3] Buscando nodes da campanha...`)
    const { data: nodes, error: nodesError } = await supabase
      .from("campaign_nodes")
      .select("*")
      .eq("campaign_id", campaign_id)
      .order("position", { ascending: true })
    
    if (nodesError) {
      log.push(`[ERRO] Erro ao buscar nodes: ${nodesError.message}`)
    }
    
    log.push(`[3] Nodes encontrados: ${nodes?.length || 0}`)
    
    if (nodes && nodes.length > 0) {
      nodes.forEach((n, i) => {
        const config = n.config as Record<string, unknown>
        const medias = config?.medias as string[] | undefined
        const mediaInfo = medias ? `${medias.length} midia(s)` : (config?.media_url ? "1 midia (legacy)" : "nenhuma")
        log.push(`[3]   Node ${i}: type=${n.type} position=${n.position}`)
        log.push(`[3]   Node ${i}: text="${(config?.text as string)?.substring(0, 50) || 'VAZIO'}"`)
        log.push(`[3]   Node ${i}: medias=${mediaInfo}`)
        log.push(`[3]   Node ${i}: buttons=${config?.buttons ? "configurado" : "nenhum"}`)
      })
    } else {
      log.push(`[ERRO] NENHUM NODE ENCONTRADO - Esta e a causa do problema!`)
      log.push(`[INFO] Voce precisa configurar uma mensagem na campanha antes de ativar`)
    }
    
    // 4. Buscar usuarios alvo
    log.push(`[4] Buscando usuarios alvo...`)
    
    let targetUsers: { telegram_user_id: string; chat_id: number | null }[] = []
    
    if (campaign.audience_type === "imported") {
      const { data: importedUsers } = await supabase
        .from("bot_users")
        .select("telegram_user_id, chat_id")
        .eq("bot_id", campaign.bot_id)
        .eq("source", "imported")
      
      targetUsers = importedUsers || []
      log.push(`[4] Usuarios importados: ${targetUsers.length}`)
    } else {
      // Buscar todos usuarios do bot
      const { data: allUsers } = await supabase
        .from("bot_users")
        .select("telegram_user_id, chat_id, funnel_step, is_subscriber")
        .eq("bot_id", campaign.bot_id)
      
      log.push(`[4] Total usuarios do bot: ${allUsers?.length || 0}`)
      
      // Buscar pagamentos
      const { data: payments } = await supabase
        .from("payments")
        .select("telegram_user_id, status")
        .eq("bot_id", campaign.bot_id)
      
      const paidUsers = new Set<string>()
      if (payments) {
        payments.forEach(p => {
          const status = (p.status || "").toLowerCase()
          if (["approved", "paid", "pago"].includes(status)) {
            paidUsers.add(p.telegram_user_id?.toString())
          }
        })
      }
      
      log.push(`[4] Usuarios com pagamento aprovado: ${paidUsers.size}`)
      
      // Filtrar por audience
      if (campaign.audience === "paid") {
        targetUsers = (allUsers || []).filter(u => 
          u.is_subscriber === true || paidUsers.has(u.telegram_user_id?.toString())
        ).map(u => ({ telegram_user_id: u.telegram_user_id, chat_id: u.chat_id }))
        log.push(`[4] Filtro "paid": ${targetUsers.length} usuarios`)
      } else if (campaign.audience === "started_not_continued") {
        targetUsers = (allUsers || []).filter(u => {
          const step = typeof u.funnel_step === "number" ? u.funnel_step : parseInt(String(u.funnel_step || "0"))
          return step >= 1 && step < 3 && !u.is_subscriber
        }).map(u => ({ telegram_user_id: u.telegram_user_id, chat_id: u.chat_id }))
        log.push(`[4] Filtro "started_not_continued": ${targetUsers.length} usuarios`)
      } else {
        targetUsers = (allUsers || []).map(u => ({ telegram_user_id: u.telegram_user_id, chat_id: u.chat_id }))
        log.push(`[4] Sem filtro: ${targetUsers.length} usuarios`)
      }
    }
    
    log.push(`[4] Usuarios alvo final: ${targetUsers.length}`)
    targetUsers.slice(0, 3).forEach((u, i) => {
      log.push(`[4]   User ${i}: tg_id=${u.telegram_user_id} chat_id=${u.chat_id}`)
    })
    
    // 5. Verificar se pode enviar
    const canSend = campaign.status === "ativa" && 
                    bot.token?.length > 20 && 
                    (nodes?.length || 0) > 0 && 
                    targetUsers.length > 0
    
    log.push(`[5] Pode enviar: ${canSend}`)
    
    if (!canSend) {
      log.push(`[5] Motivos:`)
      if (campaign.status !== "ativa") log.push(`[5]   - Status: ${campaign.status} (precisa ser "ativa")`)
      if (!bot.token || bot.token.length <= 20) log.push(`[5]   - Token do bot invalido`)
      if (!nodes || nodes.length === 0) log.push(`[5]   - Sem nodes/mensagens configuradas`)
      if (targetUsers.length === 0) log.push(`[5]   - Sem usuarios alvo`)
    }
    
    // Se action inclui "reset", limpar estados
    if (action === "reset" || action === "reset_and_execute") {
      log.push(`[6] Resetando estados dos usuarios...`)
      
      // Deletar estados anteriores
      const { error: deleteStateError, count: deletedStates } = await supabase
        .from("campaign_user_state")
        .delete()
        .eq("campaign_id", campaign_id)
      
      if (deleteStateError) {
        log.push(`[6] Erro ao deletar estados: ${deleteStateError.message}`)
      } else {
        log.push(`[6] Estados deletados: ${deletedStates || 'ok'}`)
      }
      
      // Deletar sends anteriores
      const { error: deleteSendsError, count: deletedSends } = await supabase
        .from("campaign_sends")
        .delete()
        .eq("campaign_id", campaign_id)
      
      if (deleteSendsError) {
        log.push(`[6] Erro ao deletar sends: ${deleteSendsError.message}`)
      } else {
        log.push(`[6] Sends deletados: ${deletedSends || 'ok'}`)
      }
      
      log.push(`[6] Reset completo!`)
    }
    
    // Se action inclui "execute", tentar executar
    if ((action === "execute" || action === "reset_and_execute") && canSend) {
      log.push(`[7] Executando envio...`)
      
      // Simular chamada ao execute
      const baseUrl = req.headers.get("origin") || "http://localhost:3000"
      try {
        const execRes = await fetch(`${baseUrl}/api/campaigns/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaign_id }),
        })
        const execData = await execRes.json()
        log.push(`[7] Resultado execute: ${JSON.stringify(execData)}`)
      } catch (err) {
        log.push(`[7] Erro ao chamar execute: ${String(err)}`)
      }
    }
    
    return NextResponse.json({
      success: canSend,
      campaign_id,
      campaign_name: campaign.name,
      status: campaign.status,
      nodes_count: nodes?.length || 0,
      target_users_count: targetUsers.length,
      can_send: canSend,
      log,
    })
    
  } catch (error) {
    return NextResponse.json({ error: "Erro interno", details: String(error) }, { status: 500 })
  }
}

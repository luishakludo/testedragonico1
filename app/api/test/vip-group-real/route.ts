import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

// Criar link de convite unico para grupo VIP (limite de 1 uso)
async function createVipInviteLink(botToken: string, chatId: string): Promise<{ success: boolean; inviteLink?: string; error?: string; details?: unknown }> {
  console.log(`[TEST] createVipInviteLink - chatId: ${chatId}`)
  
  try {
    const requestBody = {
      chat_id: chatId,
      member_limit: 1,
      name: `VIP Test - ${Date.now()}`,
    }
    console.log(`[TEST] Request body:`, JSON.stringify(requestBody))
    
    const res = await fetch(`https://api.telegram.org/bot${botToken}/createChatInviteLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    })
    
    const data = await res.json()
    console.log(`[TEST] Telegram response:`, JSON.stringify(data))
    
    if (data.ok && data.result?.invite_link) {
      return { success: true, inviteLink: data.result.invite_link }
    }
    
    return { 
      success: false, 
      error: data.description || "Failed to create invite link",
      details: data
    }
  } catch (error) {
    return { 
      success: false, 
      error: String(error),
      details: error
    }
  }
}

// Testar envio de mensagem
async function sendTelegramMessage(botToken: string, chatId: number, text: string): Promise<{ success: boolean; error?: string; details?: unknown }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML"
      }),
    })
    const data = await res.json()
    if (data.ok) {
      return { success: true }
    }
    return { success: false, error: data.description, details: data }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

// POST /api/test/vip-group-real
// Teste REAL que executa o codigo real com dados do banco
export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const results: Record<string, unknown> = {
    test_info: {
      description: "Teste REAL do fluxo de entrega de grupo VIP",
      executed_at: new Date().toISOString(),
      environment: "real",
    }
  }

  try {
    const body = await req.json()
    const { bot_id, flow_id, telegram_user_id } = body

    if (!bot_id && !flow_id) {
      return NextResponse.json({ 
        error: "Informe bot_id ou flow_id para testar" 
      }, { status: 400 })
    }

    // 1. Buscar o bot
    let bot = null
    if (bot_id) {
      const { data } = await supabase
        .from("bots")
        .select("id, token, name, username")
        .eq("id", bot_id)
        .single()
      bot = data
    }

    // 2. Buscar flow
    let flow = null
    let flowIdToUse = flow_id
    
    if (flow_id) {
      const { data } = await supabase
        .from("flows")
        .select("id, name, config, bot_id")
        .eq("id", flow_id)
        .single()
      flow = data
      
      // Se nao tem bot, pega do flow
      if (!bot && flow?.bot_id) {
        const { data: flowBot } = await supabase
          .from("bots")
          .select("id, token, name, username")
          .eq("id", flow.bot_id)
          .single()
        bot = flowBot
      }
    } else if (bot) {
      // Busca flow pelo bot_id
      const { data } = await supabase
        .from("flows")
        .select("id, name, config, bot_id")
        .eq("bot_id", bot.id)
        .limit(1)
        .single()
      flow = data
      flowIdToUse = flow?.id
    }

    results.bot = bot ? {
      id: bot.id,
      name: bot.name,
      username: bot.username,
      token_found: !!bot.token,
      token_preview: bot.token ? `${bot.token.substring(0, 15)}...` : null
    } : { error: "Bot nao encontrado" }

    results.flow = flow ? {
      id: flow.id,
      name: flow.name,
      config_keys: flow.config ? Object.keys(flow.config) : []
    } : { error: "Flow nao encontrado" }

    if (!bot?.token) {
      return NextResponse.json({
        ...results,
        error: "Bot token nao encontrado"
      }, { status: 400 })
    }

    if (!flow?.config) {
      return NextResponse.json({
        ...results,
        error: "Flow config nao encontrado"
      }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flowConfig = flow.config as Record<string, any>

    // 3. Analisar configuracao de entregaveis
    const deliverables = flowConfig.deliverables || []
    const mainDeliverableId = flowConfig.mainDeliverableId
    
    results.deliverables_config = {
      total_deliverables: deliverables.length,
      main_deliverable_id: mainDeliverableId || "NAO DEFINIDO",
      deliverables: deliverables.map((d: { id: string; name: string; type: string; vipGroupChatId?: string; vipGroupName?: string }) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        vipGroupChatId: d.vipGroupChatId || null,
        vipGroupName: d.vipGroupName || null
      }))
    }

    // 4. Buscar o entregavel principal
    let mainDeliverable = null
    if (mainDeliverableId && deliverables.length > 0) {
      mainDeliverable = deliverables.find((d: { id: string }) => d.id === mainDeliverableId)
    }
    
    // Se nao tem mainDeliverableId, buscar primeiro do tipo vip_group
    if (!mainDeliverable) {
      mainDeliverable = deliverables.find((d: { type: string }) => d.type === "vip_group")
    }

    results.main_deliverable = mainDeliverable ? {
      found: true,
      id: mainDeliverable.id,
      name: mainDeliverable.name,
      type: mainDeliverable.type,
      vipGroupChatId: mainDeliverable.vipGroupChatId || "NAO CONFIGURADO",
      vipGroupName: mainDeliverable.vipGroupName || "NAO CONFIGURADO"
    } : {
      found: false,
      error: "Nenhum entregavel principal encontrado"
    }

    // 5. Testar criacao de link VIP (se for tipo vip_group)
    if (mainDeliverable?.type === "vip_group" && mainDeliverable?.vipGroupChatId) {
      console.log(`[TEST] Testando criacao de link para grupo: ${mainDeliverable.vipGroupChatId}`)
      
      const inviteResult = await createVipInviteLink(bot.token, mainDeliverable.vipGroupChatId)
      
      results.invite_link_test = {
        vip_group_chat_id: mainDeliverable.vipGroupChatId,
        ...inviteResult
      }

      // 6. Se conseguiu criar link e tem telegram_user_id, testar envio de mensagem
      if (inviteResult.success && telegram_user_id) {
        const messageResult = await sendTelegramMessage(
          bot.token,
          parseInt(telegram_user_id),
          `<b>TESTE DE ENTREGA VIP</b>\n\nSeu link de acesso: ${inviteResult.inviteLink}\n\nEste e apenas um teste!`
        )
        
        results.message_test = {
          telegram_user_id,
          ...messageResult
        }
      }
    } else {
      results.invite_link_test = {
        skipped: true,
        reason: mainDeliverable?.type !== "vip_group" 
          ? `Tipo de entregavel nao e vip_group (e: ${mainDeliverable?.type})` 
          : "vipGroupChatId nao configurado"
      }
    }

    // 7. Verificar sistema legado (fallback)
    if (flowConfig.delivery) {
      results.legacy_delivery = {
        type: flowConfig.delivery.type,
        vipGroupId: flowConfig.delivery.vipGroupId || "NAO CONFIGURADO",
        vipGroupName: flowConfig.delivery.vipGroupName || null,
        has_medias: (flowConfig.delivery.medias?.length || 0) > 0,
        has_link: !!flowConfig.delivery.link
      }
    }

    // 8. Resumo
    const hasVipConfig = mainDeliverable?.type === "vip_group" && mainDeliverable?.vipGroupChatId
    const legacyHasVip = flowConfig.delivery?.type === "vip_group" && flowConfig.delivery?.vipGroupId
    
    results.diagnosis = {
      vip_configured_new_system: hasVipConfig,
      vip_configured_legacy_system: legacyHasVip,
      problem_detected: !hasVipConfig && !legacyHasVip 
        ? "VIP GROUP NAO CONFIGURADO - Configure o chat_id do grupo no entregavel" 
        : null,
      recommendation: !mainDeliverableId && deliverables.length > 0
        ? "Configure mainDeliverableId no flow para indicar qual entregavel deve ser entregue"
        : null
    }

    return NextResponse.json(results)

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json({
      ...results,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : null
    }, { status: 500 })
  }
}

// GET - Listar bots e flows disponiveis para teste
export async function GET() {
  const supabase = getSupabaseAdmin()
  
  try {
    // Listar bots
    const { data: bots } = await supabase
      .from("bots")
      .select("id, name, username, token")
      .limit(10)

    // Listar flow_bots (vinculo entre flows e bots)
    const { data: flowBots } = await supabase
      .from("flow_bots")
      .select("flow_id, bot_id")
      .limit(20)

    // Listar flows que tem entregavel vip_group
    const { data: flows } = await supabase
      .from("flows")
      .select("id, name, bot_id, config")
      .limit(20)

    const flowsWithVip = flows?.filter(f => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config = f.config as Record<string, any> | null
      const deliverables = config?.deliverables || []
      const hasVipDeliverable = deliverables.some((d: { type: string }) => d.type === "vip_group")
      const hasLegacyVip = config?.delivery?.type === "vip_group"
      return hasVipDeliverable || hasLegacyVip
    }).map(f => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config = f.config as Record<string, any> | null
      const deliverables = config?.deliverables || []
      const vipDeliverable = deliverables.find((d: { type: string }) => d.type === "vip_group")
      return {
        id: f.id,
        name: f.name,
        bot_id: f.bot_id,
        vip_chat_id: vipDeliverable?.vipGroupChatId || config?.delivery?.vipGroupId || "NAO_CONFIGURADO"
      }
    })

    // Diagnostico
    const botsCount = bots?.length || 0
    const flowsWithoutBot = flows?.filter(f => !f.bot_id).length || 0
    const flowBotsCount = flowBots?.length || 0

    return NextResponse.json({
      usage: "POST com { bot_id, flow_id, telegram_user_id } para testar",
      
      diagnostico: {
        problema_principal: botsCount === 0 
          ? "CRITICO: Nenhum bot cadastrado na tabela 'bots'. Os bots precisam estar salvos para entregar grupo VIP."
          : flowsWithoutBot > 0 
            ? `AVISO: ${flowsWithoutBot} flow(s) sem bot_id vinculado`
            : "OK",
        bots_cadastrados: botsCount,
        flow_bots_vinculos: flowBotsCount,
        flows_sem_bot: flowsWithoutBot,
        solucao: botsCount === 0 
          ? "Cadastre um bot via dashboard ou API antes de testar entrega VIP"
          : "Vincule um bot ao flow usando POST /api/fluxo/[flowId]/vincular-bot"
      },
      
      bots: bots?.map(b => ({
        id: b.id,
        name: b.name,
        username: b.username,
        has_token: !!b.token
      })) || [],
      
      flow_bots: flowBots || [],
      
      flows_with_vip: flowsWithVip || [],
      
      all_flows: flows?.map(f => ({ id: f.id, name: f.name, bot_id: f.bot_id })) || []
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

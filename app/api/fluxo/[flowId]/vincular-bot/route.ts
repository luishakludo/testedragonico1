import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

const supabase = getSupabaseAdmin()

/**
 * API para vincular um bot ao fluxo
 * 
 * GET: Lista bots disponiveis e o bot atual vinculado
 * POST: Vincula um bot ao fluxo
 * DELETE: Remove vinculo do bot
 * 
 * Acesse: /api/fluxo/[flowId]/vincular-bot
 */

// GET - Ver bots e vinculo atual
export async function GET(
  request: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { flowId } = await params
    
    // Buscar fluxo
    const { data: flow, error } = await supabase
      .from("flows")
      .select("id, name, bot_id, user_id")
      .eq("id", flowId)
      .single()
    
    if (error || !flow) {
      return NextResponse.json({ 
        error: "Fluxo nao encontrado",
        flow_id: flowId 
      }, { status: 404 })
    }
    
    // Buscar bot vinculado (por flow.bot_id)
    let botVinculado = null
    if (flow.bot_id) {
      const { data: bot } = await supabase
        .from("bots")
        .select("id, name, token, status")
        .eq("id", flow.bot_id)
        .single()
      
      if (bot) {
        // Validar bot no Telegram para pegar username
        try {
          const telegramRes = await fetch(`https://api.telegram.org/bot${bot.token}/getMe`)
          const telegramData = await telegramRes.json()
          botVinculado = {
            id: bot.id,
            name: bot.name,
            status: bot.status,
            username: telegramData.ok ? telegramData.result.username : null
          }
        } catch {
          botVinculado = {
            id: bot.id,
            name: bot.name,
            status: bot.status,
            username: null
          }
        }
      }
    }
    
    // Buscar tambem por flow_bots
    const { data: flowBots } = await supabase
      .from("flow_bots")
      .select("bot_id")
      .eq("flow_id", flowId)
    
    let botsViaFlowBots: string[] = []
    if (flowBots && flowBots.length > 0) {
      botsViaFlowBots = flowBots.map(fb => fb.bot_id)
    }
    
    // Buscar todos os bots do usuario
    const { data: allBots } = await supabase
      .from("bots")
      .select("id, name, token, status")
      .eq("user_id", flow.user_id)
    
    // Validar cada bot no Telegram
    const botsDisponiveis = await Promise.all((allBots || []).map(async (bot) => {
      try {
        const telegramRes = await fetch(`https://api.telegram.org/bot${bot.token}/getMe`)
        const telegramData = await telegramRes.json()
        return {
          id: bot.id,
          name: bot.name,
          status: bot.status,
          username: telegramData.ok ? telegramData.result.username : null,
          ja_vinculado_aqui: bot.id === flow.bot_id || botsViaFlowBots.includes(bot.id)
        }
      } catch {
        return {
          id: bot.id,
          name: bot.name,
          status: bot.status,
          username: null,
          ja_vinculado_aqui: bot.id === flow.bot_id || botsViaFlowBots.includes(bot.id)
        }
      }
    }))
    
    return NextResponse.json({
      flow_id: flowId,
      flow_name: flow.name,
      vinculo_atual: {
        tem_vinculo: !!botVinculado || botsViaFlowBots.length > 0,
        bot: botVinculado,
        via_flow_bots: botsViaFlowBots
      },
      bots_disponiveis: botsDisponiveis,
      instrucoes: {
        vincular: `POST /api/fluxo/${flowId}/vincular-bot com body: { "bot_id": "UUID_DO_BOT" }`,
        desvincular: `DELETE /api/fluxo/${flowId}/vincular-bot`
      }
    })
  } catch (err) {
    return NextResponse.json({ 
      error: "Erro interno", 
      details: err instanceof Error ? err.message : "Erro desconhecido" 
    }, { status: 500 })
  }
}

// POST - Vincular bot ao fluxo
export async function POST(
  request: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { flowId } = await params
    const body = await request.json()
    const { bot_id } = body
    
    if (!bot_id) {
      return NextResponse.json({ 
        error: "bot_id e obrigatorio",
        exemplo: { bot_id: "UUID_DO_BOT" }
      }, { status: 400 })
    }
    
    // Buscar fluxo
    const { data: flow, error: flowError } = await supabase
      .from("flows")
      .select("id, name, user_id")
      .eq("id", flowId)
      .single()
    
    if (flowError || !flow) {
      return NextResponse.json({ 
        error: "Fluxo nao encontrado",
        flow_id: flowId 
      }, { status: 404 })
    }
    
    // Buscar bot
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("id, name, token, status, user_id")
      .eq("id", bot_id)
      .single()
    
    if (botError || !bot) {
      return NextResponse.json({ 
        error: "Bot nao encontrado",
        bot_id: bot_id 
      }, { status: 404 })
    }
    
    // Verificar se bot pertence ao mesmo usuario
    if (bot.user_id !== flow.user_id) {
      return NextResponse.json({ 
        error: "Este bot nao pertence ao mesmo usuario do fluxo"
      }, { status: 403 })
    }
    
    // Verificar se o bot ja esta vinculado a outro fluxo
    const { data: existingFlowBot } = await supabase
      .from("flow_bots")
      .select("flow_id, flows:flow_id(name)")
      .eq("bot_id", bot_id)
      .single()
    
    if (existingFlowBot && existingFlowBot.flow_id !== flowId) {
      const flowName = (existingFlowBot as any).flows?.name || "outro fluxo"
      return NextResponse.json({ 
        error: "Bot ja vinculado",
        message: `Este bot ja esta vinculado ao fluxo "${flowName}". Um bot so pode estar vinculado a um fluxo por vez.`,
        current_flow_id: existingFlowBot.flow_id,
        current_flow_name: flowName
      }, { status: 409 })
    }
    
    // Verificar tambem pelo campo bot_id na tabela flows
    const { data: existingFlow } = await supabase
      .from("flows")
      .select("id, name")
      .eq("bot_id", bot_id)
      .neq("id", flowId)
      .single()
    
    if (existingFlow) {
      return NextResponse.json({ 
        error: "Bot ja vinculado",
        message: `Este bot ja esta vinculado ao fluxo "${existingFlow.name}". Um bot so pode estar vinculado a um fluxo por vez.`,
        current_flow_id: existingFlow.id,
        current_flow_name: existingFlow.name
      }, { status: 409 })
    }
    
    // Validar bot no Telegram
    let botUsername = null
    try {
      const telegramRes = await fetch(`https://api.telegram.org/bot${bot.token}/getMe`)
      const telegramData = await telegramRes.json()
      if (telegramData.ok) {
        botUsername = telegramData.result.username
      }
    } catch {
      // Continua mesmo sem validar
    }
    
    // Atualizar fluxo com bot_id
    const { error: updateError } = await supabase
      .from("flows")
      .update({ 
        bot_id: bot_id,
        updated_at: new Date().toISOString()
      })
      .eq("id", flowId)
    
    if (updateError) {
      return NextResponse.json({ 
        error: "Erro ao vincular bot",
        details: updateError.message 
      }, { status: 500 })
    }
    
    // Tambem inserir na tabela flow_bots (se existir)
    try {
      // Primeiro remover vinculos anteriores deste fluxo na flow_bots
      await supabase
        .from("flow_bots")
        .delete()
        .eq("flow_id", flowId)
      
      // Inserir novo vinculo
      await supabase
        .from("flow_bots")
        .insert({
          flow_id: flowId,
          bot_id: bot_id,
          created_at: new Date().toISOString()
        })
    } catch {
      // Ignora se tabela nao existir
    }
    
    return NextResponse.json({
      sucesso: true,
      mensagem: "Bot vinculado com sucesso!",
      flow_id: flowId,
      flow_name: flow.name,
      bot: {
        id: bot.id,
        name: bot.name,
        username: botUsername,
        status: bot.status
      },
      verificar: `/api/fluxo/${flowId}`,
      proximo_passo: "Agora ative o Order Bump: POST /api/fluxo/" + flowId + "/order-bump"
    })
  } catch (err) {
    return NextResponse.json({ 
      error: "Erro interno", 
      details: err instanceof Error ? err.message : "Erro desconhecido" 
    }, { status: 500 })
  }
}

// DELETE - Desvincular bot
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { flowId } = await params
    
    // Remover bot_id do fluxo
    const { error: updateError } = await supabase
      .from("flows")
      .update({ 
        bot_id: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", flowId)
    
    if (updateError) {
      return NextResponse.json({ 
        error: "Erro ao desvincular bot",
        details: updateError.message 
      }, { status: 500 })
    }
    
    // Remover da flow_bots tambem
    try {
      await supabase
        .from("flow_bots")
        .delete()
        .eq("flow_id", flowId)
    } catch {
      // Ignora se tabela nao existir
    }
    
    return NextResponse.json({
      sucesso: true,
      mensagem: "Bot desvinculado com sucesso!",
      flow_id: flowId,
      verificar: `/api/fluxo/${flowId}`
    })
  } catch (err) {
    return NextResponse.json({ 
      error: "Erro interno", 
      details: err instanceof Error ? err.message : "Erro desconhecido" 
    }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

const supabase = getSupabaseAdmin()

/**
 * API para corrigir automaticamente os problemas do fluxo
 * 
 * GET: Mostra diagnostico e o que sera corrigido
 * POST: Executa a correcao automatica
 * 
 * Acesse: /api/fluxo/[flowId]/corrigir
 * 
 * Acoes:
 * 1. Vincula o primeiro bot disponivel ao fluxo (se nao tiver vinculo)
 * 2. Ativa o Order Bump com valores padrao (se estiver desativado)
 */

// GET - Diagnostico
export async function GET(
  request: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { flowId } = await params
    
    // Buscar fluxo
    const { data: flow, error } = await supabase
      .from("flows")
      .select("id, name, config, bot_id, user_id")
      .eq("id", flowId)
      .single()
    
    if (error || !flow) {
      return NextResponse.json({ 
        error: "Fluxo nao encontrado",
        flow_id: flowId 
      }, { status: 404 })
    }
    
    const config = flow.config || {}
    const orderBump = config.orderBump || {}
    const orderBumpInicial = orderBump.inicial || orderBump
    
    // Verificar bot vinculado
    let botVinculado = null
    if (flow.bot_id) {
      const { data: bot } = await supabase
        .from("bots")
        .select("id, name, token")
        .eq("id", flow.bot_id)
        .single()
      
      if (bot) {
        try {
          const telegramRes = await fetch(`https://api.telegram.org/bot${bot.token}/getMe`)
          const telegramData = await telegramRes.json()
          botVinculado = {
            id: bot.id,
            name: bot.name,
            username: telegramData.ok ? telegramData.result.username : null
          }
        } catch {
          botVinculado = { id: bot.id, name: bot.name, username: null }
        }
      }
    }
    
    // Buscar bots disponiveis
    const { data: botsDisponiveis } = await supabase
      .from("bots")
      .select("id, name, token, status")
      .eq("user_id", flow.user_id)
      .eq("status", "active")
    
    // Diagnostico
    const problemas = []
    const correcoes = []
    
    // Problema 1: Sem bot vinculado
    if (!botVinculado) {
      problemas.push({
        codigo: "SEM_BOT",
        descricao: "Fluxo nao esta vinculado a nenhum bot"
      })
      
      if (botsDisponiveis && botsDisponiveis.length > 0) {
        correcoes.push({
          acao: "VINCULAR_BOT",
          descricao: `Vincular bot "${botsDisponiveis[0].name}" ao fluxo`,
          bot_id: botsDisponiveis[0].id
        })
      } else {
        correcoes.push({
          acao: "CRIAR_BOT_NECESSARIO",
          descricao: "Nenhum bot disponivel. Crie um bot primeiro em /bots"
        })
      }
    }
    
    // Problema 2: Order Bump desativado
    const obEnabled = orderBumpInicial.enabled === true
    const obPrice = orderBumpInicial.price || 0
    
    if (!obEnabled || obPrice <= 0) {
      problemas.push({
        codigo: "ORDER_BUMP_DESATIVADO",
        descricao: "Order Bump esta desativado ou sem preco",
        detalhes: {
          enabled: obEnabled,
          price: obPrice,
          name: orderBumpInicial.name || ""
        }
      })
      
      correcoes.push({
        acao: "ATIVAR_ORDER_BUMP",
        descricao: "Ativar Order Bump com valores padrao",
        valores: {
          enabled: true,
          name: "Order Bump Test",
          price: 10,
          description: "Adicional especial para seu pedido!"
        }
      })
    }
    
    return NextResponse.json({
      flow_id: flowId,
      flow_name: flow.name,
      diagnostico: {
        status: problemas.length === 0 ? "OK" : "PROBLEMAS_ENCONTRADOS",
        problemas: problemas,
        correcoes_propostas: correcoes
      },
      estado_atual: {
        bot_vinculado: botVinculado,
        order_bump: {
          enabled: obEnabled,
          name: orderBumpInicial.name || "",
          price: obPrice
        }
      },
      bots_disponiveis: (botsDisponiveis || []).map(b => ({ id: b.id, name: b.name })),
      instrucoes: problemas.length > 0 
        ? `Execute POST /api/fluxo/${flowId}/corrigir para aplicar as correcoes automaticamente`
        : "Nenhuma correcao necessaria. Sistema funcionando corretamente."
    })
  } catch (err) {
    return NextResponse.json({ 
      error: "Erro interno", 
      details: err instanceof Error ? err.message : "Erro desconhecido" 
    }, { status: 500 })
  }
}

// POST - Executar correcao automatica
export async function POST(
  request: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { flowId } = await params
    
    // Parametros opcionais
    let body: { bot_id?: string; order_bump?: { name?: string; price?: number; description?: string } } = {}
    try {
      body = await request.json()
    } catch {
      // Body vazio e ok
    }
    
    // Buscar fluxo
    const { data: flow, error } = await supabase
      .from("flows")
      .select("id, name, config, bot_id, user_id")
      .eq("id", flowId)
      .single()
    
    if (error || !flow) {
      return NextResponse.json({ 
        error: "Fluxo nao encontrado",
        flow_id: flowId 
      }, { status: 404 })
    }
    
    const correcoes_aplicadas = []
    let newBotId = flow.bot_id
    let newConfig = { ...(flow.config || {}) }
    
    // ========================================
    // CORRECAO 1: Vincular bot
    // ========================================
    if (!flow.bot_id) {
      // Buscar bot especificado ou primeiro disponivel
      let botToLink = null
      
      if (body.bot_id) {
        const { data: bot } = await supabase
          .from("bots")
          .select("id, name, token")
          .eq("id", body.bot_id)
          .eq("user_id", flow.user_id)
          .single()
        
        botToLink = bot
      } else {
        // Buscar primeiro bot ativo
        const { data: bots } = await supabase
          .from("bots")
          .select("id, name, token")
          .eq("user_id", flow.user_id)
          .eq("status", "active")
          .limit(1)
        
        botToLink = bots?.[0]
      }
      
      if (botToLink) {
        newBotId = botToLink.id
        
        // Validar no Telegram
        let username = null
        try {
          const res = await fetch(`https://api.telegram.org/bot${botToLink.token}/getMe`)
          const data = await res.json()
          if (data.ok) username = data.result.username
        } catch {}
        
        correcoes_aplicadas.push({
          acao: "BOT_VINCULADO",
          bot_id: botToLink.id,
          bot_name: botToLink.name,
          bot_username: username
        })
        
        // Tambem inserir na flow_bots
        try {
          await supabase.from("flow_bots").delete().eq("flow_id", flowId)
          await supabase.from("flow_bots").insert({
            flow_id: flowId,
            bot_id: botToLink.id,
            created_at: new Date().toISOString()
          })
        } catch {}
      } else {
        correcoes_aplicadas.push({
          acao: "BOT_NAO_DISPONIVEL",
          erro: "Nenhum bot disponivel para vincular. Crie um bot primeiro."
        })
      }
    }
    
    // ========================================
    // CORRECAO 2: Ativar Order Bump
    // ========================================
    const currentOrderBump = newConfig.orderBump || {}
    const currentInicial = currentOrderBump.inicial || currentOrderBump
    
    const obEnabled = currentInicial.enabled === true
    const obPrice = currentInicial.price || 0
    
    if (!obEnabled || obPrice <= 0) {
      // Valores do body ou padrao
      const obName = body.order_bump?.name || currentInicial.name || "Order Bump Test"
      const obPriceNew = body.order_bump?.price || (obPrice > 0 ? obPrice : 10)
      const obDesc = body.order_bump?.description || currentInicial.description || "Adicional especial para seu pedido!"
      
      const newInicial = {
        enabled: true,
        name: obName,
        price: obPriceNew,
        description: obDesc,
        acceptText: currentInicial.acceptText || "ADICIONAR",
        rejectText: currentInicial.rejectText || "NAO QUERO",
        ctaMessage: currentInicial.ctaMessage || "",
        deliveryType: currentInicial.deliveryType || "same",
        medias: currentInicial.medias || [],
      }
      
      newConfig.orderBump = {
        ...currentOrderBump,
        enabled: true,
        name: obName,
        price: obPriceNew,
        inicial: newInicial
      }
      
      correcoes_aplicadas.push({
        acao: "ORDER_BUMP_ATIVADO",
        valores: {
          enabled: true,
          name: obName,
          price: obPriceNew,
          description: obDesc
        }
      })
    }
    
    // ========================================
    // SALVAR NO BANCO
    // ========================================
    const { error: updateError } = await supabase
      .from("flows")
      .update({
        bot_id: newBotId,
        config: newConfig,
        updated_at: new Date().toISOString()
      })
      .eq("id", flowId)
    
    if (updateError) {
      return NextResponse.json({ 
        error: "Erro ao salvar correcoes",
        details: updateError.message 
      }, { status: 500 })
    }
    
    // Verificar estado final
    const orderBumpFinal = newConfig.orderBump?.inicial || newConfig.orderBump || {}
    
    return NextResponse.json({
      sucesso: true,
      mensagem: "Correcoes aplicadas com sucesso!",
      flow_id: flowId,
      flow_name: flow.name,
      correcoes_aplicadas: correcoes_aplicadas,
      estado_final: {
        bot_vinculado: !!newBotId,
        order_bump: {
          enabled: orderBumpFinal.enabled,
          name: orderBumpFinal.name,
          price: orderBumpFinal.price
        }
      },
      verificar: `/api/fluxo/${flowId}`,
      testar_no_telegram: newBotId 
        ? "Envie /start para o bot vinculado para testar o fluxo completo"
        : "Vincule um bot manualmente primeiro"
    })
  } catch (err) {
    return NextResponse.json({ 
      error: "Erro interno", 
      details: err instanceof Error ? err.message : "Erro desconhecido" 
    }, { status: 500 })
  }
}

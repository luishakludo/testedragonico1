import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

const supabase = getSupabaseAdmin()

/**
 * API para ativar/configurar Order Bump de um fluxo
 * 
 * GET: Retorna a configuracao atual do order bump
 * POST: Ativa o order bump com os dados fornecidos
 * PATCH: Atualiza parcialmente o order bump
 * 
 * Acesse: /api/fluxo/[flowId]/order-bump
 */

// GET - Ver configuracao atual
export async function GET(
  request: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { flowId } = await params
    
    // Buscar fluxo
    const { data: flow, error } = await supabase
      .from("flows")
      .select("id, name, config")
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
    
    return NextResponse.json({
      flow_id: flowId,
      flow_name: flow.name,
      order_bump: {
        enabled: orderBumpInicial.enabled || false,
        name: orderBumpInicial.name || "",
        price: orderBumpInicial.price || 0,
        description: orderBumpInicial.description || "",
        acceptText: orderBumpInicial.acceptText || "ADICIONAR",
        rejectText: orderBumpInicial.rejectText || "NAO QUERO",
        ctaMessage: orderBumpInicial.ctaMessage || "",
        deliveryType: orderBumpInicial.deliveryType || "same",
        medias: orderBumpInicial.medias || [],
      },
      raw_config: orderBump,
      analise: {
        enabled: orderBumpInicial.enabled === true,
        tem_nome: !!(orderBumpInicial.name),
        tem_preco: (orderBumpInicial.price || 0) > 0,
        vai_funcionar: orderBumpInicial.enabled === true && (orderBumpInicial.price || 0) > 0
      }
    })
  } catch (err) {
    return NextResponse.json({ 
      error: "Erro interno", 
      details: err instanceof Error ? err.message : "Erro desconhecido" 
    }, { status: 500 })
  }
}

// POST - Ativar Order Bump
export async function POST(
  request: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { flowId } = await params
    const body = await request.json()
    
    // Valores padrao
    const orderBumpData = {
      enabled: body.enabled !== undefined ? body.enabled : true,
      name: body.name || "Order Bump Test",
      price: body.price || 10,
      description: body.description || "Adicional especial para seu pedido!",
      acceptText: body.acceptText || "ADICIONAR",
      rejectText: body.rejectText || "NAO QUERO",
      ctaMessage: body.ctaMessage || "",
      deliveryType: body.deliveryType || "same",
      medias: body.medias || [],
    }
    
    // Buscar fluxo atual
    const { data: flow, error: fetchError } = await supabase
      .from("flows")
      .select("id, name, config")
      .eq("id", flowId)
      .single()
    
    if (fetchError || !flow) {
      return NextResponse.json({ 
        error: "Fluxo nao encontrado",
        flow_id: flowId 
      }, { status: 404 })
    }
    
    // Montar novo config
    const currentConfig = flow.config || {}
    const newConfig = {
      ...currentConfig,
      orderBump: {
        ...(currentConfig.orderBump || {}),
        enabled: orderBumpData.enabled,
        name: orderBumpData.name,
        price: orderBumpData.price,
        inicial: {
          enabled: orderBumpData.enabled,
          name: orderBumpData.name,
          price: orderBumpData.price,
          description: orderBumpData.description,
          acceptText: orderBumpData.acceptText,
          rejectText: orderBumpData.rejectText,
          ctaMessage: orderBumpData.ctaMessage,
          deliveryType: orderBumpData.deliveryType,
          medias: orderBumpData.medias,
        }
      }
    }
    
    // Atualizar no banco
    const { error: updateError } = await supabase
      .from("flows")
      .update({ 
        config: newConfig,
        updated_at: new Date().toISOString()
      })
      .eq("id", flowId)
    
    if (updateError) {
      return NextResponse.json({ 
        error: "Erro ao atualizar fluxo",
        details: updateError.message 
      }, { status: 500 })
    }
    
    return NextResponse.json({
      sucesso: true,
      mensagem: "Order Bump ativado com sucesso!",
      flow_id: flowId,
      flow_name: flow.name,
      order_bump: newConfig.orderBump,
      verificar: `/api/fluxo/${flowId}`,
      proximo_passo: "Agora vincule um bot ao fluxo: POST /api/fluxo/" + flowId + "/vincular-bot"
    })
  } catch (err) {
    return NextResponse.json({ 
      error: "Erro interno", 
      details: err instanceof Error ? err.message : "Erro desconhecido" 
    }, { status: 500 })
  }
}

// PATCH - Atualizar parcialmente
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { flowId } = await params
    const body = await request.json()
    
    // Buscar fluxo atual
    const { data: flow, error: fetchError } = await supabase
      .from("flows")
      .select("id, name, config")
      .eq("id", flowId)
      .single()
    
    if (fetchError || !flow) {
      return NextResponse.json({ 
        error: "Fluxo nao encontrado",
        flow_id: flowId 
      }, { status: 404 })
    }
    
    // Merge com config atual
    const currentConfig = flow.config || {}
    const currentOrderBump = currentConfig.orderBump || {}
    const currentInicial = currentOrderBump.inicial || {}
    
    // Atualizar apenas os campos fornecidos
    const updatedInicial = {
      ...currentInicial,
      ...(body.enabled !== undefined && { enabled: body.enabled }),
      ...(body.name && { name: body.name }),
      ...(body.price !== undefined && { price: body.price }),
      ...(body.description && { description: body.description }),
      ...(body.acceptText && { acceptText: body.acceptText }),
      ...(body.rejectText && { rejectText: body.rejectText }),
      ...(body.ctaMessage && { ctaMessage: body.ctaMessage }),
      ...(body.deliveryType && { deliveryType: body.deliveryType }),
      ...(body.medias && { medias: body.medias }),
    }
    
    const newConfig = {
      ...currentConfig,
      orderBump: {
        ...currentOrderBump,
        enabled: updatedInicial.enabled,
        name: updatedInicial.name,
        price: updatedInicial.price,
        inicial: updatedInicial
      }
    }
    
    // Atualizar no banco
    const { error: updateError } = await supabase
      .from("flows")
      .update({ 
        config: newConfig,
        updated_at: new Date().toISOString()
      })
      .eq("id", flowId)
    
    if (updateError) {
      return NextResponse.json({ 
        error: "Erro ao atualizar fluxo",
        details: updateError.message 
      }, { status: 500 })
    }
    
    return NextResponse.json({
      sucesso: true,
      mensagem: "Order Bump atualizado!",
      flow_id: flowId,
      order_bump: newConfig.orderBump,
      verificar: `/api/fluxo/${flowId}`
    })
  } catch (err) {
    return NextResponse.json({ 
      error: "Erro interno", 
      details: err instanceof Error ? err.message : "Erro desconhecido" 
    }, { status: 500 })
  }
}

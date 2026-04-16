import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

// GET: Cria um fluxo de teste com mensagem de boas-vindas
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params // botId aqui e o ID numerico do Telegram
  const supabase = getSupabase()
  
  const result: Record<string, unknown> = {
    botId,
    timestamp: new Date().toISOString(),
  }

  try {
    // 1. Buscar bot pelo token (que comeca com o botId)
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("*")
      .like("token", `${botId}:%`)
      .single()

    if (botError || !bot) {
      return NextResponse.json({ 
        ...result, 
        error: "Bot nao encontrado", 
        botError: botError?.message 
      })
    }

    result.bot = { id: bot.id, name: bot.name, user_id: bot.user_id }

    // 2. Verificar se ja existe fluxo para este bot
    const { data: existingFlows } = await supabase
      .from("flows")
      .select("id, name, status, is_primary")
      .eq("bot_id", bot.id)

    result.existingFlows = existingFlows || []

    // 3. Se nao tem fluxo, criar um
    if (!existingFlows || existingFlows.length === 0) {
      const { data: newFlow, error: flowError } = await supabase
        .from("flows")
        .insert({
          bot_id: bot.id,
          user_id: bot.user_id,
          name: "Fluxo de Boas-vindas",
          status: "ativo",
          category: "inicial",
          is_primary: true,
          flow_type: "basic",
        })
        .select()
        .single()

      if (flowError) {
        // Tentar sem as colunas opcionais
        const { data: newFlow2, error: flowError2 } = await supabase
          .from("flows")
          .insert({
            bot_id: bot.id,
            user_id: bot.user_id,
            name: "Fluxo de Boas-vindas",
            status: "ativo",
          })
          .select()
          .single()

        if (flowError2) {
          return NextResponse.json({ 
            ...result, 
            error: "Erro ao criar fluxo", 
            flowError: flowError?.message,
            flowError2: flowError2?.message 
          })
        }

        result.createdFlow = newFlow2

        // Criar nodes basicos
        const flowId = newFlow2.id
        await createBasicNodes(supabase, flowId)
        
      } else {
        result.createdFlow = newFlow

        // Criar nodes basicos
        const flowId = newFlow.id
        await createBasicNodes(supabase, flowId)
      }

      result.nodesCreated = true
    } else {
      // Verificar se tem nodes
      const flowId = existingFlows[0].id
      const { data: nodes } = await supabase
        .from("flow_nodes")
        .select("*")
        .eq("flow_id", flowId)

      result.existingNodes = nodes || []

      // Se nao tem nodes, criar
      if (!nodes || nodes.length === 0) {
        await createBasicNodes(supabase, flowId)
        result.nodesCreated = true
      }
    }

    // 4. Buscar tudo de novo para confirmar
    const { data: finalFlows } = await supabase
      .from("flows")
      .select("*")
      .eq("bot_id", bot.id)

    const { data: finalNodes } = await supabase
      .from("flow_nodes")
      .select("*")
      .eq("flow_id", finalFlows?.[0]?.id)

    result.finalFlows = finalFlows
    result.finalNodes = finalNodes
    result.success = true

    return NextResponse.json(result)

  } catch (err) {
    return NextResponse.json({ 
      ...result, 
      error: "Erro interno", 
      details: String(err) 
    })
  }
}

async function createBasicNodes(supabase: ReturnType<typeof getSupabase>, flowId: string) {
  // Node 1: Trigger
  const { error: triggerError } = await supabase.from("flow_nodes").insert({
    flow_id: flowId,
    type: "trigger",
    label: "Usuario inicia bot",
    config: { subVariant: "start" },
    position: 0,
  })
  
  if (triggerError) {
    console.error("[test-flow] Erro ao inserir trigger node:", triggerError.message, triggerError.code)
  }

  // Node 2: Mensagem de boas-vindas
  const { error: msgError } = await supabase.from("flow_nodes").insert({
    flow_id: flowId,
    type: "message",
    label: "Ola! Seja bem-vindo ao nosso bot!",
    config: {
      text: "Ola! Seja bem-vindo ao nosso bot! Como posso ajudar?",
      media_url: "",
      media_type: "",
      buttons: "",
      subVariant: "",
    },
    position: 1,
  })
  
  if (msgError) {
    console.error("[test-flow] Erro ao inserir message node:", msgError.message, msgError.code)
  }
}

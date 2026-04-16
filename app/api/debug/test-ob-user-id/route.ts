import { getSupabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

// API para testar se o sistema consegue encontrar o user_id correto para Order Bumps
// GET /api/debug/test-ob-user-id?botId=XXX&flowId=YYY
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const botId = searchParams.get("botId") || "65f4a521-b310-4638-bfb3-522895406e30"
  const flowId = searchParams.get("flowId") || "bd37e11c-705a-4bf5-81a0-ccefdd2fcad0"
  
  const supabase = getSupabaseAdmin()
  
  // Simular a logica do Order Bump callback
  let ownerUserId: string | null = null
  const steps: string[] = []
  
  // 1. Tentar buscar do bot
  const { data: botData, error: botError } = await supabase
    .from("bots")
    .select("id, name, user_id")
    .eq("id", botId)
    .single()
  
  steps.push(`1. Bot ${botId}: ${botData ? `user_id=${botData.user_id}` : `ERROR: ${botError?.message}`}`)
  
  if (botData?.user_id) {
    ownerUserId = botData.user_id
    steps.push(`   -> ENCONTRADO via bot: ${ownerUserId}`)
  } else {
    steps.push(`   -> Bot sem user_id, tentando via flow...`)
    
    // 2. Tentar buscar do flow
    const { data: flowData, error: flowError } = await supabase
      .from("flows")
      .select("id, name, bot_id, user_id")
      .eq("id", flowId)
      .single()
    
    steps.push(`2. Flow ${flowId}: ${flowData ? `user_id=${flowData.user_id}, bot_id=${flowData.bot_id}` : `ERROR: ${flowError?.message}`}`)
    
    if (flowData?.user_id) {
      ownerUserId = flowData.user_id
      steps.push(`   -> ENCONTRADO via flow.user_id: ${ownerUserId}`)
    } else if (flowData?.bot_id) {
      // 3. Tentar buscar do bot do flow
      const { data: flowBotData, error: flowBotError } = await supabase
        .from("bots")
        .select("id, name, user_id")
        .eq("id", flowData.bot_id)
        .single()
      
      steps.push(`3. Bot do flow ${flowData.bot_id}: ${flowBotData ? `user_id=${flowBotData.user_id}` : `ERROR: ${flowBotError?.message}`}`)
      
      if (flowBotData?.user_id) {
        ownerUserId = flowBotData.user_id
        steps.push(`   -> ENCONTRADO via bot do flow: ${ownerUserId}`)
      }
    }
  }
  
  // Verificar se o user_id encontrado tem gateway configurado
  let gateway = null
  if (ownerUserId) {
    const { data: gatewayData } = await supabase
      .from("user_gateways")
      .select("id, gateway, is_active")
      .eq("user_id", ownerUserId)
      .eq("is_active", true)
      .limit(1)
      .single()
    
    gateway = gatewayData
    steps.push(`4. Gateway para user ${ownerUserId}: ${gateway ? `OK (${gateway.gateway})` : "NAO ENCONTRADO"}`)
  }
  
  return NextResponse.json({
    teste: "Simulacao de busca de user_id para Order Bump",
    parametros: { botId, flowId },
    resultado: {
      user_id_encontrado: ownerUserId,
      tem_gateway: !!gateway,
      sucesso: !!(ownerUserId && gateway)
    },
    passos: steps,
    conclusao: ownerUserId && gateway 
      ? "SUCESSO - Order Bump vai funcionar corretamente!"
      : ownerUserId && !gateway
        ? "PROBLEMA - user_id encontrado mas sem gateway configurado"
        : "PROBLEMA - Nao foi possivel encontrar user_id. O flow precisa ter bot_id ou user_id configurado"
  })
}

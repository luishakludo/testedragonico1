import { getSupabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = getSupabaseAdmin()
  
  // Bot ID do pagamento recente
  const botId = "3246f547-dadc-437b-adb1-43d7eb4b9445"
  
  // 1. Buscar bot
  const { data: bot } = await supabase
    .from("bots")
    .select("id, name, token")
    .eq("id", botId)
    .single()
  
  // 2. Buscar fluxos associados a esse bot via flow_bots
  const { data: flowBots } = await supabase
    .from("flow_bots")
    .select("flow_id, bot_id")
    .eq("bot_id", botId)
  
  // 3. Para cada flow_id, buscar o fluxo e config de upsell
  const flowsInfo = await Promise.all(
    (flowBots || []).map(async (fb) => {
      const { data: flow } = await supabase
        .from("flows")
        .select("id, name, config")
        .eq("id", fb.flow_id)
        .single()
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config = flow?.config as Record<string, any>
      const upsellConfig = config?.upsell
      
      return {
        flow_id: fb.flow_id,
        flow_name: flow?.name,
        upsell_enabled: upsellConfig?.enabled || false,
        upsell_sequences: upsellConfig?.sequences?.length || 0,
        upsell_config: upsellConfig
      }
    })
  )
  
  // 4. Buscar todos os fluxos com upsell habilitado
  const { data: allFlows } = await supabase
    .from("flows")
    .select("id, name, config, bot_id")
  
  const flowsWithUpsell = (allFlows || []).filter(f => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = f.config as Record<string, any>
    return config?.upsell?.enabled && config?.upsell?.sequences?.length > 0
  }).map(f => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = f.config as Record<string, any>
    return {
      id: f.id,
      name: f.name,
      bot_id: f.bot_id,
      upsell_sequences: config?.upsell?.sequences?.length || 0
    }
  })
  
  // 5. Buscar upsells agendados
  const { data: scheduledUpsells } = await supabase
    .from("scheduled_messages")
    .select("*")
    .eq("message_type", "upsell")
    .order("created_at", { ascending: false })
    .limit(10)
  
  return NextResponse.json({
    bot: bot ? { id: bot.id, name: bot.name } : null,
    fluxosAssociadosAoBot: flowsInfo,
    todosFluxosComUpsellHabilitado: flowsWithUpsell,
    upsellsAgendados: scheduledUpsells,
    problema: flowsInfo.every(f => !f.upsell_enabled) 
      ? "NENHUM FLUXO ASSOCIADO A ESSE BOT TEM UPSELL HABILITADO"
      : flowsInfo.some(f => f.upsell_enabled)
        ? "Tem fluxo com upsell habilitado"
        : "Verificar config"
  })
}

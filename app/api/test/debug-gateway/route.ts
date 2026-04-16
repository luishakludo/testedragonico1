import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  const supabase = getSupabase()
  const { searchParams } = request.nextUrl
  const botId = searchParams.get("botId")
  
  // Buscar bot
  const { data: bot } = await supabase
    .from("bots")
    .select("id, user_id, name, token")
    .eq("id", botId || "")
    .single()
  
  // Buscar todos os gateways
  const { data: allGateways } = await supabase
    .from("user_gateways")
    .select("id, user_id, gateway_name, is_active, created_at")
  
  // Buscar gateway do usuario do bot
  let gatewayForBot = null
  if (bot?.user_id) {
    const { data } = await supabase
      .from("user_gateways")
      .select("*")
      .eq("user_id", bot.user_id)
      .eq("is_active", true)
      .single()
    gatewayForBot = data
  }
  
  return NextResponse.json({
    bot: bot ? {
      id: bot.id,
      name: bot.name,
      user_id: bot.user_id,
      has_token: !!bot.token
    } : null,
    gatewayForBot: gatewayForBot ? {
      id: gatewayForBot.id,
      user_id: gatewayForBot.user_id,
      gateway_name: gatewayForBot.gateway_name,
      is_active: gatewayForBot.is_active,
      has_access_token: !!gatewayForBot.access_token
    } : null,
    allGateways: allGateways?.map(g => ({
      id: g.id,
      user_id: g.user_id,
      gateway_name: g.gateway_name,
      is_active: g.is_active
    }))
  })
}

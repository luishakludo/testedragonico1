import { NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

export async function GET() {
  const supabase = getSupabase()
  
  // Listar todos os bots
  const { data: bots } = await supabase
    .from("bots")
    .select("id, name, username, user_id")
    .limit(20)
  
  // Listar todos os gateways
  const { data: gateways } = await supabase
    .from("user_gateways")
    .select("id, user_id, bot_id, gateway_name, is_active")
    .limit(20)
  
  // Listar usuarios
  const { data: users } = await supabase
    .from("users")
    .select("id, email")
    .limit(10)
  
  return NextResponse.json({
    bots: bots || [],
    gateways: gateways || [],
    users: users || [],
  })
}

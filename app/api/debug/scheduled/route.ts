import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

export async function GET() {
  const supabase = getSupabaseAdmin()
  
  // Buscar ultimas 20 mensagens agendadas
  const { data: messages, error } = await supabase
    .from("scheduled_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20)
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  // Buscar contagem por status e tipo
  const { data: stats } = await supabase
    .from("scheduled_messages")
    .select("status, message_type")
  
  const statusCount: Record<string, number> = {}
  const typeCount: Record<string, number> = {}
  
  if (stats) {
    for (const s of stats) {
      statusCount[s.status] = (statusCount[s.status] || 0) + 1
      typeCount[s.message_type] = (typeCount[s.message_type] || 0) + 1
    }
  }
  
  return NextResponse.json({
    total: stats?.length || 0,
    statusCount,
    typeCount,
    recentMessages: messages?.map(m => ({
      id: m.id,
      type: m.message_type,
      status: m.status,
      scheduled_for: m.scheduled_for,
      created_at: m.created_at,
      telegram_user_id: m.telegram_user_id,
      metadata_keys: Object.keys(m.metadata || {})
    }))
  })
}

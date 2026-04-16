import { NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

// Endpoint para sincronizar user_flow_state -> bot_users
// Acesse: /api/sync-bot-users
export async function GET() {
  const supabase = getSupabase()
  const results: Record<string, unknown> = {}

  try {
    // Pegar todos os registros do user_flow_state (usuarios reais que interagiram)
    const { data: states, error: statesErr } = await supabase
      .from("user_flow_state")
      .select("bot_id, telegram_user_id, chat_id, created_at")

    if (statesErr) {
      return NextResponse.json({ error: "Failed to read user_flow_state", details: statesErr })
    }

    results.total_states = states?.length || 0

    if (!states || states.length === 0) {
      return NextResponse.json({ message: "No user_flow_state entries found", results })
    }

    // Para cada estado, verificar se ja existe em bot_users e criar se nao existir
    const synced: string[] = []
    const skipped: string[] = []
    const errors: string[] = []

    for (const state of states) {
      // Verificar se ja existe
      const { data: existing } = await supabase
        .from("bot_users")
        .select("id")
        .eq("bot_id", state.bot_id)
        .eq("telegram_user_id", state.telegram_user_id)
        .maybeSingle()

      if (existing) {
        skipped.push(`user ${state.telegram_user_id} already exists`)
        continue
      }

      // Inserir novo usuario
      const { error: insErr } = await supabase
        .from("bot_users")
        .insert({
          bot_id: state.bot_id,
          telegram_user_id: state.telegram_user_id,
          chat_id: state.chat_id,
          first_name: null,
          last_name: null,
          username: null,
          funnel_step: 1,
          is_subscriber: false,
          last_activity: state.created_at,
        })

      if (insErr) {
        errors.push(`user ${state.telegram_user_id}: ${insErr.message}`)
      } else {
        synced.push(`user ${state.telegram_user_id} synced`)
      }
    }

    results.synced = synced
    results.skipped = skipped
    results.errors = errors

    // Verificar resultado final
    const { data: finalUsers } = await supabase
      .from("bot_users")
      .select("id, telegram_user_id, funnel_step")

    results.final_bot_users = finalUsers

    return NextResponse.json({ success: true, results })
  } catch (err) {
    return NextResponse.json({ error: "Fatal error", details: String(err) })
  }
}

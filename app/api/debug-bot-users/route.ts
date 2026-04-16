import { NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

export async function GET() {
  const supabase = getSupabase()
  const results: Record<string, unknown> = {}

  // 1. Ler todos os bots
  const { data: botsData, error: botsErr } = await supabase
    .from("bots")
    .select("id, name, token, status")
  results.bots = { count: botsData?.length || 0, data: botsData, error: botsErr?.message || null }

  // 2. Ler bot_users
  const { data: usersData, error: usersErr } = await supabase
    .from("bot_users")
    .select("*")
    .order("created_at", { ascending: false })
  results.bot_users = { count: usersData?.length || 0, data: usersData, error: usersErr?.message || null }

  // 3. Ler user_flow_state
  const { data: stateData, error: stateErr } = await supabase
    .from("user_flow_state")
    .select("*")
    .order("created_at", { ascending: false })
  results.user_flow_state = { count: stateData?.length || 0, data: stateData, error: stateErr?.message || null }

  // 4. Limpar qualquer RLS_TEST que ficou pra tras
  const { error: cleanErr } = await supabase
    .from("bot_users")
    .delete()
    .eq("telegram_user_id", 99999999)
  results.cleaned_test_users = cleanErr ? cleanErr.message : "ok"

  // 5. Comparar: usuarios no flow_state que NAO estao em bot_users
  if (stateData && usersData) {
    const userKeys = new Set(usersData.map((u) => `${u.bot_id}_${u.telegram_user_id}`))
    const missing = stateData.filter((s) => !userKeys.has(`${s.bot_id}_${s.telegram_user_id}`))
    results.missing_from_bot_users = {
      count: missing.length,
      users: missing.map((m) => ({ bot_id: m.bot_id, telegram_user_id: m.telegram_user_id })),
      hint: missing.length > 0
        ? "Estes usuarios estao no user_flow_state mas NAO na bot_users. Provavelmente RLS esta bloqueando o insert."
        : "Todos os usuarios do flow_state estao na bot_users. OK!",
    }
  }

  return NextResponse.json(results, { status: 200 })
}

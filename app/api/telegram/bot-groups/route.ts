import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

// GET /api/telegram/bot-groups?bot_id=xxx
// Get all groups where the bot is a member/admin (from our database)
export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  const botId = req.nextUrl.searchParams.get("bot_id")

  if (!botId) {
    return NextResponse.json({ error: "bot_id required" }, { status: 400 })
  }

  try {
    const { data: groups, error } = await supabase
      .from("bot_groups")
      .select("*")
      .eq("bot_id", botId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching bot_groups:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Format for the UI
    const formattedGroups = (groups || []).map(g => ({
      id: String(g.chat_id),
      title: g.title,
      type: g.chat_type,
      isAdmin: g.is_admin,
      canInvite: g.can_invite
    }))

    return NextResponse.json({ 
      success: true, 
      groups: formattedGroups 
    })
  } catch (error: any) {
    console.error("[v0] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

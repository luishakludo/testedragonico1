import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

// POST /api/vip-groups/generate-invite
// Generate a one-time invite link for a VIP group
export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  
  try {
    const body = await req.json()
    const { flow_id, user_telegram_id, payment_id } = body

    if (!flow_id) {
      return NextResponse.json({ error: "flow_id is required" }, { status: 400 })
    }

    // Get the VIP group for this flow
    const { data: vipGroup, error: vipError } = await supabase
      .from("vip_groups")
      .select("*")
      .eq("flow_id", flow_id)
      .single()

    if (vipError || !vipGroup) {
      return NextResponse.json({ error: "VIP group not configured for this flow" }, { status: 404 })
    }

    // Get the bot token from flow_bots
    const { data: flowBot } = await supabase
      .from("flow_bots")
      .select("bot_id")
      .eq("flow_id", flow_id)
      .limit(1)
      .single()

    if (!flowBot) {
      return NextResponse.json({ error: "No bot linked to this flow" }, { status: 400 })
    }

    const { data: bot } = await supabase
      .from("bots")
      .select("token")
      .eq("id", flowBot.bot_id)
      .single()

    if (!bot?.token) {
      return NextResponse.json({ error: "Bot token not found" }, { status: 400 })
    }

    // Generate invite link using Telegram API
    // createChatInviteLink creates a unique invite link
    const telegramRes = await fetch(
      `https://api.telegram.org/bot${bot.token}/createChatInviteLink`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: vipGroup.telegram_group_id,
          name: `VIP-${Date.now()}`,
          member_limit: 1, // One-time use
          expire_date: Math.floor(Date.now() / 1000) + 86400, // Expires in 24 hours
        }),
      }
    )

    const telegramData = await telegramRes.json()

    if (!telegramData.ok) {
      console.error("[generate-invite] Telegram error:", telegramData)
      return NextResponse.json({ 
        error: telegramData.description || "Failed to generate invite link" 
      }, { status: 400 })
    }

    const inviteLink = telegramData.result.invite_link

    // Save invite to database (optional tracking)
    await supabase.from("vip_invites").insert({
      vip_group_id: vipGroup.id,
      flow_id,
      user_telegram_id: user_telegram_id || null,
      payment_id: payment_id || null,
      invite_link: inviteLink,
      expires_at: new Date(Date.now() + 86400000).toISOString(), // 24h
      status: "pending",
    })

    return NextResponse.json({
      success: true,
      invite_link: inviteLink,
      group_name: vipGroup.group_name,
      expires_in: "24 hours",
    })
  } catch (error: any) {
    console.error("[generate-invite] Error:", error)
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 })
  }
}

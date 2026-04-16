import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

// GET /api/vip-groups?flow_id=xxx
// Get VIP group for a flow
export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  const flowId = req.nextUrl.searchParams.get("flow_id")

  if (!flowId) {
    return NextResponse.json({ error: "flow_id is required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("vip_groups")
    .select("*")
    .eq("flow_id", flowId)
    .single()

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ vipGroup: data || null })
}

// POST /api/vip-groups
// Set VIP group for a flow
export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  
  try {
    const body = await req.json()
    const { flow_id, telegram_group_id, group_name, group_type } = body

    if (!flow_id || !telegram_group_id) {
      return NextResponse.json({ error: "flow_id and telegram_group_id are required" }, { status: 400 })
    }

    // Check if flow exists
    const { data: flow, error: flowError } = await supabase
      .from("flows")
      .select("id, user_id")
      .eq("id", flow_id)
      .single()

    if (flowError || !flow) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 })
    }

    // Upsert VIP group (replace if exists)
    const { data, error } = await supabase
      .from("vip_groups")
      .upsert({
        flow_id,
        telegram_group_id,
        group_name: group_name || "Grupo VIP",
        group_type: group_type || "supergroup",
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "flow_id"
      })
      .select()
      .single()

    if (error) {
      console.error("[vip-groups] Error upserting:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, vipGroup: data })
  } catch (error: any) {
    console.error("[vip-groups] Error:", error)
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 })
  }
}

// DELETE /api/vip-groups?flow_id=xxx
// Remove VIP group from flow
export async function DELETE(req: NextRequest) {
  const supabase = getSupabase()
  const flowId = req.nextUrl.searchParams.get("flow_id")

  if (!flowId) {
    return NextResponse.json({ error: "flow_id is required" }, { status: 400 })
  }

  const { error } = await supabase
    .from("vip_groups")
    .delete()
    .eq("flow_id", flowId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

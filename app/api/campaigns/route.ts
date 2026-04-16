import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  try {
    const { searchParams } = new URL(req.url)
    const botId = searchParams.get("bot_id")

    if (!botId) {
      return NextResponse.json({ error: "bot_id is required" }, { status: 400 })
    }

    const { data: campaigns, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("bot_id", botId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[campaigns] Error fetching:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch nodes for each campaign
    const campaignIds = (campaigns || []).map((c: { id: string }) => c.id)
    let allNodes: { id: string; campaign_id: string; type: string; label: string; config: Record<string, unknown>; position: number }[] = []

    if (campaignIds.length > 0) {
      const { data: nodes } = await supabase
        .from("campaign_nodes")
        .select("*")
        .in("campaign_id", campaignIds)
        .order("position", { ascending: true })

      allNodes = (nodes as typeof allNodes) || []
    }

    // Group nodes by campaign_id
    const nodesByCampaign: Record<string, typeof allNodes> = {}
    for (const node of allNodes) {
      if (!nodesByCampaign[node.campaign_id]) nodesByCampaign[node.campaign_id] = []
      nodesByCampaign[node.campaign_id].push(node)
    }

    // Fetch sent counts from campaign_sends
    let sendCounts: Record<string, number> = {}
    if (campaignIds.length > 0) {
      const { data: sends } = await supabase
        .from("campaign_sends")
        .select("campaign_id")
        .in("campaign_id", campaignIds)
        .eq("status", "sent")
      
      if (sends) {
        for (const send of sends) {
          sendCounts[send.campaign_id] = (sendCounts[send.campaign_id] || 0) + 1
        }
      }
    }

    // Calculate target_count for each campaign based on audience
    // Uses same logic as /api/campaigns/execute
    const targetCounts: Record<string, number> = {}
    for (const campaign of (campaigns || [])) {
      const c = campaign as { id: string; bot_id: string; audience_type?: string; audience?: string }
      let targetCount = 0
      
      console.log("[v0] Campaign:", c.id, "bot_id:", c.bot_id, "audience_type:", c.audience_type, "audience:", c.audience)
      
      if (c.audience_type === "imported") {
        // For imported campaigns, count users with source = 'imported'
        const { data: importedUsers } = await supabase
          .from("bot_users")
          .select("id")
          .eq("bot_id", c.bot_id)
          .eq("source", "imported")
        
        targetCount = importedUsers?.length || 0
        console.log("[v0] Imported users count:", targetCount)
      } else {
        // For start campaigns, get all bot_users and filter by audience
        const { data: allBotUsers, error: botUsersError } = await supabase
          .from("bot_users")
          .select("id, telegram_user_id, funnel_step, is_subscriber")
          .eq("bot_id", c.bot_id)
        
        console.log("[v0] bot_users for bot_id:", c.bot_id, "count:", allBotUsers?.length, "error:", botUsersError?.message)
        
        if (allBotUsers && allBotUsers.length > 0) {
          if (!c.audience) {
            // No audience filter = all bot users
            targetCount = allBotUsers.length
            console.log("[v0] No audience filter, all users:", targetCount)
          } else {
            // Get payments using same logic as execute route (telegram_user_id + bot_id)
            const { data: allPayments } = await supabase
              .from("payments")
              .select("telegram_user_id, status")
              .eq("bot_id", c.bot_id)
            
            // Create sets for payment status
            const pendingPaymentUsers = new Set<string>()
            const paidUsers = new Set<string>()
            
            if (allPayments) {
              for (const payment of allPayments) {
                const tgId = payment.telegram_user_id?.toString()
                if (!tgId) continue
                
                const status = (payment.status || "").toLowerCase()
                if (status === "pending" || status === "aguardando" || status === "pix_gerado") {
                  pendingPaymentUsers.add(tgId)
                }
                if (status === "approved" || status === "paid" || status === "pago") {
                  paidUsers.add(tgId)
                }
              }
            }
            
            console.log("[v0] Payment stats - pending:", pendingPaymentUsers.size, "paid:", paidUsers.size)
            
            // Filter based on audience (same logic as execute)
            for (const user of allBotUsers) {
              const tgId = user.telegram_user_id?.toString() || ""
              const funnelStep = typeof user.funnel_step === "string" 
                ? parseInt(user.funnel_step, 10) 
                : (user.funnel_step || 1)
              const hasPaid = paidUsers.has(tgId)
              const hasPending = pendingPaymentUsers.has(tgId)
              
              if (c.audience === "paid" && hasPaid) {
                targetCount++
              } else if (c.audience === "not_paid" && !hasPaid && (funnelStep > 1 || hasPending)) {
                targetCount++
              } else if (c.audience === "started_not_continued" && !hasPaid && !hasPending && funnelStep === 1) {
                targetCount++
              }
            }
            console.log("[v0] Filtered by audience '", c.audience, "' count:", targetCount)
          }
        } else {
          console.log("[v0] No bot_users found for bot_id:", c.bot_id)
        }
      }
      
      targetCounts[c.id] = targetCount
      console.log("[v0] Final target_count for campaign", c.id, ":", targetCount)
    }

    const result = (campaigns || []).map((c: Record<string, unknown>) => ({
      ...c,
      nodes: nodesByCampaign[c.id as string] || [],
      sent_count: sendCounts[c.id as string] || 0,
      target_count: targetCounts[c.id as string] || 0,
    }))

    return NextResponse.json({ campaigns: result })
  } catch (err) {
    console.error("[campaigns] Unexpected error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  try {
    const body = await req.json()
    const { bot_id, user_id, name, campaign_type, audience_type, audience, nodes } = body as {
      bot_id: string
      user_id: string
      name: string
      campaign_type: "basic" | "complete"
      audience_type?: "start" | "imported"
      audience?: string | null
      nodes: { type: string; label: string; config: Record<string, unknown>; position: number }[]
    }

    if (!bot_id || !user_id || !name || !campaign_type) {
      return NextResponse.json({ error: "Campos obrigatorios faltando" }, { status: 400 })
    }

    // Create campaign
    const { data: campaign, error: campError } = await supabase
      .from("campaigns")
      .insert({
        bot_id,
        user_id,
        name,
        campaign_type,
        audience_type: audience_type || null,
        audience: audience || null,
        status: "rascunho",
      })
      .select()
      .single()

    if (campError || !campaign) {
      console.error("[campaigns] Error creating:", campError)
      return NextResponse.json({ error: campError?.message || "Erro ao criar campanha" }, { status: 500 })
    }

    // Create nodes
    if (nodes && nodes.length > 0) {
      const nodeRows = nodes.map((n, i) => ({
        campaign_id: campaign.id,
        type: n.type,
        label: n.label || "",
        config: n.config || {},
        position: n.position ?? i,
      }))

      const { error: nodesError } = await supabase
        .from("campaign_nodes")
        .insert(nodeRows)

      if (nodesError) {
        console.error("[campaigns] Error creating nodes:", nodesError)
        // Rollback campaign
        await supabase.from("campaigns").delete().eq("id", campaign.id)
        return NextResponse.json({ error: nodesError.message }, { status: 500 })
      }
    }

    // Return campaign with nodes array (empty if no nodes created)
    return NextResponse.json({ campaign: { ...campaign, nodes: [] } })
  } catch (err) {
    console.error("[campaigns] Unexpected error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = getSupabase()
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    // Nodes are cascade deleted
    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("[campaigns] Error deleting:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[campaigns] Unexpected error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const supabase = getSupabase()
  try {
    const body = await req.json()
    const { id, status } = body as { id: string; status: string }

    if (!id || !status) {
      return NextResponse.json({ error: "id and status are required" }, { status: 400 })
    }

    const validStatuses = ["rascunho", "ativa", "pausada", "concluida"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Status invalido" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("campaigns")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[campaigns] Error updating:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // When campaign is activated, trigger execution immediately
    if (status === "ativa") {
      const baseUrl = req.headers.get("x-forwarded-proto") && req.headers.get("x-forwarded-host")
        ? `${req.headers.get("x-forwarded-proto")}://${req.headers.get("x-forwarded-host")}`
        : req.headers.get("origin") || new URL(req.url).origin

      console.log("[campaigns] Ativando campanha:", id, "baseUrl:", baseUrl)

      // Fire-and-forget: trigger execution in background
      fetch(`${baseUrl}/api/campaigns/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: id }),
      }).then(async (res) => {
        const result = await res.json()
        console.log("[campaigns] Execute result:", JSON.stringify(result))
      }).catch((err) => {
        console.error("[campaigns] Error triggering execution:", err)
      })
    }

    return NextResponse.json({ campaign: data })
  } catch (err) {
    console.error("[campaigns] Unexpected error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

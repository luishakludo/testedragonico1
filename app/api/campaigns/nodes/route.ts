import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  
  try {
    const body = await req.json()
    const { campaign_id, type, label, config, position } = body as {
      campaign_id: string
      type: "message" | "delay"
      label: string
      config: Record<string, unknown>
      position: number
    }

    console.log("[campaign_nodes] POST recebido:", { campaign_id, type, label, position })
    console.log("[campaign_nodes] Config:", JSON.stringify(config))

    if (!campaign_id || !type) {
      console.log("[campaign_nodes] Erro: campos obrigatorios faltando")
      return NextResponse.json({ error: "campaign_id and type are required" }, { status: 400 })
    }

    // Check if node already exists at this position for this campaign
    const { data: existing, error: existingError } = await supabase
      .from("campaign_nodes")
      .select("id")
      .eq("campaign_id", campaign_id)
      .eq("position", position)
      .single()

    console.log("[campaign_nodes] Node existente:", existing, existingError?.message)

    if (existing) {
      // Update existing node
      console.log("[campaign_nodes] Atualizando node existente:", existing.id)
      const { data: node, error } = await supabase
        .from("campaign_nodes")
        .update({
          type,
          label: label || "",
          config: config || {},
        })
        .eq("id", existing.id)
        .select()
        .single()

      if (error) {
        console.error("[campaign_nodes] Error updating:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      console.log("[campaign_nodes] Node atualizado com sucesso:", node?.id)
      return NextResponse.json({ node, updated: true })
    }

    // Create new node
    console.log("[campaign_nodes] Criando novo node...")
    const { data: node, error } = await supabase
      .from("campaign_nodes")
      .insert({
        campaign_id,
        type,
        label: label || "",
        config: config || {},
        position: position ?? 0,
      })
      .select()
      .single()

    if (error) {
      console.error("[campaign_nodes] Error creating:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("[campaign_nodes] Node criado com sucesso:", node?.id)
    return NextResponse.json({ node, created: true })
  } catch (err) {
    console.error("[campaign_nodes] Unexpected error:", err)
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

    const { error } = await supabase
      .from("campaign_nodes")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("[campaign_nodes] Error deleting:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[campaign_nodes] Unexpected error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

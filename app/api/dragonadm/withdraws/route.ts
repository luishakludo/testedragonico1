import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

// GET - List all withdraws for admin
export async function GET() {
  try {
    // Buscar saques
    const { data: withdraws, error } = await supabaseAdmin
      .from("referral_withdraws")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Admin withdraws - Error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Buscar users separadamente para evitar problemas de join
    const userIds = [...new Set(withdraws?.map(w => w.user_id) || [])]
    
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id, name, email")
      .in("id", userIds)

    // Combinar dados
    const withdrawsWithUsers = withdraws?.map(w => ({
      ...w,
      user: users?.find(u => u.id === w.user_id) || null
    })) || []

    return NextResponse.json({ withdraws: withdrawsWithUsers })
  } catch (err) {
    console.error("[v0] Admin withdraws error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

// PUT - Update withdraw status
export async function PUT(request: NextRequest) {
  try {
    const { id, status, admin_notes } = await request.json()

    if (!id || !status) {
      return NextResponse.json({ error: "ID e status obrigatorios" }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from("referral_withdraws")
      .update({
        status,
        admin_notes: admin_notes || null,
        processed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[v0] Admin update withdraw - Error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, withdraw: data })
  } catch (err) {
    console.error("[v0] Admin update withdraw error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

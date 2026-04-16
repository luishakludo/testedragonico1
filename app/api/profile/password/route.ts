import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// POST /api/profile/password — change user password
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, currentPassword, newPassword } = body

    if (!email || !currentPassword || !newPassword) {
      return NextResponse.json({ error: "Todos os campos sao obrigatorios" }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "A nova senha deve ter pelo menos 6 caracteres" }, { status: 400 })
    }

    // Verify current password by signing in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    })

    if (signInError) {
      return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 })
    }

    // Update the password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Password change error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

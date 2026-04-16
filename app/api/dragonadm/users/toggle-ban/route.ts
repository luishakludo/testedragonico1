import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const { userId, banned } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: "userId e obrigatorio" }, { status: 400 })
    }

    const { error } = await supabase
      .from("profiles")
      .update({ banned })
      .eq("id", userId)

    if (error) {
      console.error("Erro ao atualizar usuario:", error)
      return NextResponse.json({ error: "Erro ao atualizar usuario" }, { status: 500 })
    }

    return NextResponse.json({ success: true, banned })
  } catch (error) {
    console.error("Erro ao banir/desbanir usuario:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

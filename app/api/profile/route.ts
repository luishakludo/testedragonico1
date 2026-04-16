import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// GET /api/profile?userId=xxx — fetch user profile from public.users
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId")
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 })
    }

    // Query basic fields that always exist
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, phone, created_at")
      .eq("id", userId)
      .single()

    if (error) {
      console.error("[v0] Profile GET DB error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Try to find avatar in storage by checking common extensions
    let avatarUrl: string | null = null
    const extensions = ["png", "jpg", "jpeg", "gif", "webp"]
    for (const ext of extensions) {
      const path = `avatars/${userId}.${ext}`
      const { data: files } = await supabase.storage.from("flow-media").list("avatars", {
        search: `${userId}.${ext}`,
      })
      if (files && files.length > 0) {
        const { data: urlData } = supabase.storage.from("flow-media").getPublicUrl(path)
        avatarUrl = urlData.publicUrl + "?t=" + Date.now()
        break
      }
    }

    // Also try avatar_url column if it exists
    if (!avatarUrl) {
      try {
        const { data: withAvatar } = await supabase
          .from("users")
          .select("avatar_url")
          .eq("id", userId)
          .single()
        if (withAvatar?.avatar_url) {
          avatarUrl = withAvatar.avatar_url
        }
      } catch {
        // Column might not exist, ignore
      }
    }

    return NextResponse.json({ ...data, avatar_url: avatarUrl })
  } catch (err) {
    console.error("[v0] Profile GET error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

// PATCH /api/profile — update name
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, name } = body

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 })
    }

    if (!name) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("users")
      .update({ name })
      .eq("id", userId)
      .select("id, name, email, phone, created_at")
      .single()

    if (error) {
      console.error("[v0] Profile PATCH error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error("[v0] Profile PATCH error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

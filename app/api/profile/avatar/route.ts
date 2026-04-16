import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// POST /api/profile/avatar — upload avatar image
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const userId = formData.get("userId") as string | null

    console.log("[v0] Avatar upload request - userId:", userId, "file:", file?.name, "size:", file?.size)

    if (!file || !userId) {
      return NextResponse.json({ error: "Arquivo e userId obrigatorios" }, { status: 400 })
    }

    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: "Use JPG, PNG, GIF ou WEBP" }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Maximo 5MB" }, { status: 400 })
    }

    const ext = file.name.split(".").pop() || "jpg"
    const filePath = `avatars/${userId}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // Delete any old avatar files for this user first
    const { data: existingFiles } = await supabase.storage.from("flow-media").list("avatars")
    if (existingFiles) {
      const userFiles = existingFiles.filter((f) => f.name.startsWith(userId))
      if (userFiles.length > 0) {
        await supabase.storage.from("flow-media").remove(userFiles.map((f) => `avatars/${f.name}`))
        console.log("[v0] Removed old avatars:", userFiles.map((f) => f.name))
      }
    }

    // Upload to flow-media bucket (avatars folder)
    const { error: uploadError } = await supabase.storage
      .from("flow-media")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      console.error("[v0] Avatar upload error:", uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from("flow-media").getPublicUrl(filePath)
    const publicUrl = urlData.publicUrl

    console.log("[v0] Avatar uploaded successfully:", publicUrl)

    // Try to update avatar_url column if it exists (non-blocking)
    try {
      await supabase.from("users").update({ avatar_url: publicUrl }).eq("id", userId)
    } catch {
      // Column might not exist yet, that's fine
      console.log("[v0] avatar_url column update skipped (may not exist)")
    }

    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    console.error("[v0] Avatar route error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

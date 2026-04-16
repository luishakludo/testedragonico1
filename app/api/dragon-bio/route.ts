import { NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

// GET - Listar todos os sites do usuário
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    
    if (!userId) {
      return NextResponse.json({ error: "userId é obrigatório" }, { status: 400 })
    }

    const supabase = getSupabase()
    
    const { data: sites, error } = await supabase
      .from("dragon_bio_sites")
      .select(`
        *,
        dragon_bio_links (*)
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ sites })
  } catch (error: any) {
    console.error("Erro ao buscar sites:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Criar novo site
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId, nome, slug, userEmail, userName, presell_type } = body

    if (!userId || !nome || !slug) {
      return NextResponse.json({ error: "userId, nome e slug são obrigatórios" }, { status: 400 })
    }

    const supabase = getSupabase()

    // Verificar/garantir que usuário existe na tabela users
    const { error: userError } = await supabase
      .from("users")
      .upsert({
        id: userId,
        name: userName || nome,
        email: userEmail || "",
        phone: "",
        banned: false
      }, { onConflict: "id", ignoreDuplicates: true })

    if (userError) {
      console.error("Erro ao verificar/criar usuário:", userError)
    }

    // Verificar se slug já existe
    const { data: existing } = await supabase
      .from("dragon_bio_sites")
      .select("id")
      .eq("slug", slug)
      .single()

    if (existing) {
      return NextResponse.json({ error: "Essa slug já está em uso" }, { status: 400 })
    }

    // Criar site com configurações padrão
    const siteData: any = {
      user_id: userId,
      nome,
      slug,
      template: "minimal",
      profile_name: nome,
      profile_bio: "Sua bio aqui",
      profile_image: null,
    }

    // Se for presell, adicionar presell_type
    if (presell_type) {
      siteData.presell_type = presell_type
    }

    const { data: site, error } = await supabase
      .from("dragon_bio_sites")
      .insert(siteData)
      .select()
      .single()

    if (error) throw error

    // Criar links padrão apenas se NAO for presell
    if (!presell_type) {
      const defaultLinks = [
        { site_id: site.id, title: "Instagram", url: "https://instagram.com", order_index: 0 },
        { site_id: site.id, title: "YouTube", url: "https://youtube.com", order_index: 1 },
        { site_id: site.id, title: "Twitter", url: "https://twitter.com", order_index: 2 },
      ]
      await supabase.from("dragon_bio_links").insert(defaultLinks)
    }

    return NextResponse.json({ site })
  } catch (error: any) {
    console.error("Erro ao criar site:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Deletar site
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const siteId = searchParams.get("siteId")

    if (!siteId) {
      return NextResponse.json({ error: "siteId é obrigatório" }, { status: 400 })
    }

    const supabase = getSupabase()

    // Deletar links primeiro (cascade deveria fazer isso, mas por segurança)
    await supabase.from("dragon_bio_links").delete().eq("site_id", siteId)

    // Deletar site
    const { error } = await supabase
      .from("dragon_bio_sites")
      .delete()
      .eq("id", siteId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Erro ao deletar site:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

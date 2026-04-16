import { NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

// GET - Buscar site específico
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getSupabase()

    const { data: site, error } = await supabase
      .from("dragon_bio_sites")
      .select(`
        *,
        dragon_bio_links (*)
      `)
      .eq("id", id)
      .single()

    if (error) throw error

    return NextResponse.json({ site })
  } catch (error: any) {
    console.error("Erro ao buscar site:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Atualizar site
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { nome, slug, template, profile_name, profile_bio, profile_image, links, page_data, presell_type, colors, background_image_mobile, background_image_desktop, pixel_config } = body

    const supabase = getSupabase()

    // Atualizar site
    const updateData: any = { updated_at: new Date().toISOString() }
    if (nome !== undefined) updateData.nome = nome
    if (slug !== undefined) updateData.slug = slug
    if (template !== undefined) updateData.template = template
    if (profile_name !== undefined) updateData.profile_name = profile_name
    if (profile_bio !== undefined) updateData.profile_bio = profile_bio
    if (profile_image !== undefined) updateData.profile_image = profile_image
    if (page_data !== undefined) updateData.page_data = page_data
    if (presell_type !== undefined) updateData.presell_type = presell_type
    if (colors !== undefined) updateData.colors = colors
    if (background_image_mobile !== undefined) updateData.background_image_mobile = background_image_mobile
    if (background_image_desktop !== undefined) updateData.background_image_desktop = background_image_desktop
    if (pixel_config !== undefined) updateData.pixel_config = pixel_config

    const { data: site, error: siteError } = await supabase
      .from("dragon_bio_sites")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (siteError) throw siteError

    // Atualizar links se fornecidos
    if (links !== undefined) {
      // Deletar links antigos
      await supabase.from("dragon_bio_links").delete().eq("site_id", id)

      // Inserir novos links
      if (links.length > 0) {
        const linksToInsert = links.map((link: any) => ({
          site_id: id,
          title: link.title,
          url: link.url,
          type: link.type || "button",
          image: link.image || null
        }))

        const { error: linksError } = await supabase
          .from("dragon_bio_links")
          .insert(linksToInsert)

        if (linksError) {
          console.error("Erro ao inserir links:", linksError)
          // Se der erro por coluna inexistente, tentar sem type e image
          const basicLinks = links.map((link: any) => ({
            site_id: id,
            title: link.title,
            url: link.url
          }))
          const { error: basicError } = await supabase
            .from("dragon_bio_links")
            .insert(basicLinks)
          if (basicError) throw basicError
        }
      }
    }

    // Buscar site atualizado com links
    const { data: updatedSite } = await supabase
      .from("dragon_bio_sites")
      .select(`
        *,
        dragon_bio_links (*)
      `)
      .eq("id", id)
      .single()

    return NextResponse.json({ site: updatedSite })
  } catch (error: any) {
    console.error("Erro ao atualizar site:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

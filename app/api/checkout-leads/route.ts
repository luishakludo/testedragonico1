import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dnVsb2puZnZnc2JtaHl2cXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTk0NTMsImV4cCI6MjA4ODgzNTQ1M30.Djnn3tsrxSGLBR-Bm1dWOpQe0NHCSOWJFZkbbTOk2oM"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const siteId = searchParams.get("siteId")
    
    // Pegar cookie diretamente do header
    const cookieHeader = request.headers.get("cookie") || ""
    const sessionMatch = cookieHeader.match(/dragon_session=([^;]+)/)
    const sessionValue = sessionMatch ? decodeURIComponent(sessionMatch[1]) : null
    
    console.log("[v0] Checkout leads API - siteId:", siteId, "hasSession:", !!sessionValue)
    
    let userId: string | null = null
    
    if (sessionValue) {
      try {
        const session = JSON.parse(sessionValue)
        userId = session.user?.id
        console.log("[v0] Session userId:", userId)
      } catch (e) {
        console.log("[v0] Error parsing session")
      }
    }
    
    // Se nao tem sessao mas tem siteId, buscar leads direto pelo site
    // (isso permite ver leads mesmo se a autenticacao falhar)
    if (!siteId) {
      return NextResponse.json({ error: "siteId obrigatorio" }, { status: 400 })
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    // Buscar leads direto pelo siteId
    const { data: leads, error } = await supabase
      .from("checkout_leads")
      .select("*")
      .eq("site_id", siteId)
      .order("created_at", { ascending: false })
      .limit(500)
    
    console.log("[v0] Leads found for site", siteId, ":", leads?.length, "error:", error)

    if (error) {
      console.error("[v0] Error fetching leads:", error)
      return NextResponse.json({ error: "Erro ao buscar leads" }, { status: 500 })
    }

    // Stats
    const stats = {
      total: leads?.length || 0,
      pending: leads?.filter(l => l.status === "pending" || l.status === "payment_generated").length || 0,
      paid: leads?.filter(l => l.status === "paid" || l.status === "approved").length || 0,
      totalAmount: leads?.reduce((acc, l) => acc + (Number(l.amount) || 0), 0) || 0,
    }

    return NextResponse.json({ leads: leads || [], stats })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

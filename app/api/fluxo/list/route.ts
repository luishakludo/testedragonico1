import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

/**
 * API para listar fluxos do usuario
 * 
 * Endpoint: GET /api/fluxo/list?userId={userId}
 * 
 * Retorna lista de fluxos do usuario para uso em filtros
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get("userId")
  
  if (!userId) {
    return NextResponse.json({
      error: "userId e obrigatorio",
      flows: []
    }, { status: 400 })
  }
  
  const supabase = getSupabase()
  
  try {
    // Buscar fluxos do usuario
    const { data: flows, error } = await supabase
      .from("flows")
      .select("id, name, bot_id, status")
      .eq("user_id", userId)
      .order("name", { ascending: true })
    
    if (error) {
      console.error("[API /api/fluxo/list] Erro ao buscar fluxos:", error)
      return NextResponse.json({
        error: "Erro ao buscar fluxos",
        details: error.message,
        flows: []
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      flows: flows || [],
      total: flows?.length || 0
    })
    
  } catch (err) {
    console.error("[API /api/fluxo/list] Erro:", err)
    return NextResponse.json({
      error: "Erro interno",
      flows: []
    }, { status: 500 })
  }
}

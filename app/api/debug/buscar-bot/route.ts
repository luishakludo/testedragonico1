import { getSupabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

// GET /api/debug/buscar-bot?nome=NOVOVIP18BOT
// Busca o bot pelo nome/username e retorna todos os IDs necessarios
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const nome = searchParams.get("nome")
  
  if (!nome) {
    return NextResponse.json({
      erro: "Passa o nome do bot na URL",
      exemplo: "/api/debug/buscar-bot?nome=NOVOVIP18BOT"
    })
  }
  
  const supabase = getSupabaseAdmin()
  
  // Buscar bot pelo nome ou username (case insensitive)
  const { data: bots, error: botError } = await supabase
    .from("bots")
    .select("id, name, username, user_id, token")
    .or(`name.ilike.%${nome}%,username.ilike.%${nome}%`)
    .limit(5)
  
  if (botError || !bots || bots.length === 0) {
    return NextResponse.json({
      erro: "Bot nao encontrado",
      busca: nome,
      error: botError?.message
    })
  }
  
  // Para cada bot encontrado, buscar os flows
  const resultado = await Promise.all(bots.map(async (bot) => {
    // Buscar flows deste bot
    const { data: flows } = await supabase
      .from("flows")
      .select("id, name, is_active, user_id")
      .eq("bot_id", bot.id)
      .order("is_active", { ascending: false })
    
    // Buscar pagamentos recentes deste bot
    const { data: pagamentos } = await supabase
      .from("payments")
      .select("id, user_id, product_type, status, amount, created_at")
      .eq("bot_id", bot.id)
      .order("created_at", { ascending: false })
      .limit(5)
    
    // Contar order bumps
    const { count: obCount } = await supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("bot_id", bot.id)
      .eq("product_type", "order_bump")
    
    return {
      bot: {
        id: bot.id,
        nome: bot.name,
        username: bot.username,
        user_id: bot.user_id,
        tem_user_id: !!bot.user_id
      },
      flows: flows?.map(f => ({
        id: f.id,
        nome: f.name,
        ativo: f.is_active,
        user_id: f.user_id
      })) || [],
      pagamentos_recentes: pagamentos?.map(p => ({
        id: p.id,
        user_id: p.user_id,
        tipo: p.product_type,
        status: p.status,
        valor: p.amount,
        data: p.created_at
      })) || [],
      total_order_bumps: obCount || 0
    }
  }))
  
  return NextResponse.json({
    busca: nome,
    total_encontrado: resultado.length,
    bots: resultado,
    
    // IDS PRONTOS PRA COPIAR
    ids_para_teste: resultado.map(r => ({
      bot_id: r.bot.id,
      flow_id: r.flows[0]?.id || null,
      user_id: r.bot.user_id || r.flows[0]?.user_id || null,
      url_teste: `/api/debug/test-ob-user-id?botId=${r.bot.id}&flowId=${r.flows[0]?.id || ""}`
    }))
  })
}

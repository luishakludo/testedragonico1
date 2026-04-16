import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  try {
    console.log("[v0] DragonAdmin Users API - Starting fetch with admin client")
    
    // Buscar todos os usuarios - usando admin client para bypassar RLS
    const { data: usersData, error: usersError } = await supabaseAdmin
      .from("users")
      .select("*")
      .order("created_at", { ascending: false })

    console.log("[v0] DragonAdmin Users - users count:", usersData?.length, "error:", usersError?.message || "none")
    console.log("[v0] DragonAdmin Users - user IDs:", usersData?.map(u => u.id))

    if (usersError) {
      console.error("Erro ao buscar users:", usersError)
      return NextResponse.json({ error: "Erro ao buscar usuarios" }, { status: 500 })
    }

    // Buscar todos os bots
    const { data: allBots, error: botsError } = await supabaseAdmin
      .from("bots")
      .select("id, name, username, is_active, created_at, user_id")
    
    console.log("[v0] DragonAdmin Users - bots count:", allBots?.length, "bots user_ids:", allBots?.map(b => b.user_id), "error:", botsError?.message || "none")

    // Buscar todas as gateways
    const { data: allGateways, error: gatewaysError } = await supabaseAdmin
      .from("payment_gateways")
      .select("id, gateway_name, is_active, created_at, user_id")
    
    console.log("[v0] DragonAdmin Users - gateways count:", allGateways?.length, "gateways user_ids:", allGateways?.map(g => g.user_id), "error:", gatewaysError?.message || "none")

    // Buscar todos os referrals (incluindo comissoes)
    const { data: allReferrals } = await supabaseAdmin
      .from("referrals")
      .select(`
        id,
        referrer_id,
        referred_id,
        commission_amount,
        created_at,
        referred:referred_id (
          id,
          email,
          name,
          created_at
        )
      `)
    
    // Buscar saques de afiliados
    const { data: allWithdraws } = await supabaseAdmin
      .from("referral_withdraws")
      .select("user_id, amount, status")
      .in("status", ["approved", "paid"])

    // Buscar pagamentos por usuario (para stats)
    const { data: allPayments } = await supabaseAdmin
      .from("payments")
      .select("user_id, amount, status")
      .eq("status", "approved")



    // Buscar starts por bot
    const { data: allStarts } = await supabaseAdmin
      .from("telegram_users")
      .select("bot_id")

    // Mapear bots por user_id para contar starts
    const botsByUser: Record<string, string[]> = {}
    allBots?.forEach(bot => {
      if (!botsByUser[bot.user_id]) {
        botsByUser[bot.user_id] = []
      }
      botsByUser[bot.user_id].push(bot.id)
    })

    // Contar starts por user
    const startsByBot: Record<string, number> = {}
    allStarts?.forEach(start => {
      if (!startsByBot[start.bot_id]) {
        startsByBot[start.bot_id] = 0
      }
      startsByBot[start.bot_id]++
    })

    // Montar resposta com dados agregados
    const users = usersData?.map(user => {
      const userBots = allBots?.filter(b => b.user_id === user.id) || []
      const userGateways = allGateways?.filter(g => g.user_id === user.id) || []
      const userReferrals = allReferrals?.filter(r => r.referrer_id === user.id) || []
      const userPayments = allPayments?.filter(p => p.user_id === user.id) || []

      // Calcular total de starts dos bots do usuario
      const userBotIds = userBots.map(b => b.id)
      const totalStarts = userBotIds.reduce((acc, botId) => acc + (startsByBot[botId] || 0), 0)

      // Calcular saldo de afiliado baseado em referrals, adjustments e withdraws
      const userReferralCommissions = allReferrals?.filter(r => r.referrer_id === user.id) || []
      const totalReferralEarnings = userReferralCommissions.reduce((acc, r) => acc + (Number(r.commission_amount) || 0), 0)
      const userWithdraws = allWithdraws?.filter(w => w.user_id === user.id) || []
      const totalWithdrawn = userWithdraws.reduce((acc, w) => acc + (Number(w.amount) || 0), 0)
      
      // Incluir ajuste manual do admin (affiliate_balance_adjustment)
      const affiliateBalanceAdjustment = Number(user.affiliate_balance_adjustment) || 0
      const affiliateBalance = affiliateBalanceAdjustment - totalWithdrawn

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        banned: user.banned || false,
        created_at: user.created_at,
        bots: userBots.map(b => ({
          id: b.id,
          name: b.name,
          username: b.username,
          is_active: b.is_active,
          created_at: b.created_at,
        })),
        gateways: userGateways.map(g => ({
          id: g.id,
          gateway_name: g.gateway_name,
          is_active: g.is_active,
          created_at: g.created_at,
        })),
        referrals: userReferrals.map(r => ({
          id: r.id,
          email: (r.referred as any)?.email || "",
          name: (r.referred as any)?.name || "",
          created_at: (r.referred as any)?.created_at || r.created_at,
        })),
        stats: {
          totalStarts,
          totalPayments: userPayments.length,
          totalRevenue: userPayments.reduce((acc, p) => acc + (p.amount || 0), 0),
        },
        affiliateBalance,
        totalReferralEarnings,
        totalWithdrawn,
      }
    })

    console.log("[v0] DragonAdmin Users - returning users:", users?.length)
    return NextResponse.json({ users })
  } catch (error) {
    console.error("[v0] DragonAdmin Users - Error:", error)
    return NextResponse.json({ error: "Erro ao buscar usuarios" }, { status: 500 })
  }
}

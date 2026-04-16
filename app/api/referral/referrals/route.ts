import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// GET: Return list of referred users for a user
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 })
  }

  try {
    const { data: referrals, error } = await supabase
      .from("referrals")
      .select("id, coupon_code, created_at, referred_id")
      .eq("referrer_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!referrals || referrals.length === 0) {
      return NextResponse.json({ referrals: [] })
    }

    // Get user details for each referred user
    const referredIds = referrals.map((r) => r.referred_id)
    const { data: users } = await supabase
      .from("users")
      .select("id, name, email, phone, banned, created_at")
      .in("id", referredIds)

    const usersMap = new Map(users?.map((u) => [u.id, u]) || [])

    const result = referrals.map((r) => {
      const user = usersMap.get(r.referred_id)
      return {
        id: r.id,
        referred_id: r.referred_id,
        name: user?.name || "Usuario",
        email: user?.email || "",
        phone: user?.phone || "",
        banned: user?.banned || false,
        user_created_at: user?.created_at || r.created_at,
        referral_date: r.created_at,
        coupon_code: r.coupon_code,
      }
    })

    return NextResponse.json({ referrals: result })
  } catch (err) {
    console.error("[v0] Referrals GET error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

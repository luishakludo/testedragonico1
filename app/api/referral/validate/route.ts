import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// GET: Validate if a coupon code exists
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")?.toLowerCase()

  if (!code) {
    return NextResponse.json({ valid: false, error: "Cupom nao informado" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("referral_coupons")
    .select("coupon_code, user_id")
    .eq("coupon_code", code)
    .single()

  if (error || !data) {
    return NextResponse.json({ valid: false })
  }

  return NextResponse.json({ valid: true, coupon_code: data.coupon_code })
}

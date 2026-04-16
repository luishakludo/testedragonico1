import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// POST: Track a referral after user registration
// RLS policies allow anon role to INSERT into referrals table directly
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { referredId, couponCode } = body

    if (!referredId || !couponCode) {
      return NextResponse.json(
        { error: "referredId and couponCode are required" },
        { status: 400 }
      )
    }

    const normalizedCode = couponCode.trim().toLowerCase()

    // Look up the coupon to find the referrer
    const { data: couponData, error: couponError } = await supabase
      .from("referral_coupons")
      .select("user_id, coupon_code")
      .eq("coupon_code", normalizedCode)
      .single()

    if (couponError || !couponData) {
      console.error("[v0] Coupon lookup error:", couponError)
      return NextResponse.json(
        { error: "Cupom nao encontrado" },
        { status: 404 }
      )
    }

    // Don't allow self-referral
    if (couponData.user_id === referredId) {
      return NextResponse.json(
        { error: "Auto-indicacao nao permitida" },
        { status: 400 }
      )
    }

    // Insert the referral directly - RLS policies allow anon INSERT
    const { error: insertError } = await supabase
      .from("referrals")
      .insert({
        referrer_id: couponData.user_id,
        referred_id: referredId,
        coupon_code: couponData.coupon_code,
      })

    if (insertError) {
      console.error("[v0] Insert referral error:", insertError)
      // If it's a unique constraint violation, the referral already exists
      if (insertError.code === "23505") {
        return NextResponse.json({ success: true, message: "Indicacao ja registrada" })
      }
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[v0] Track referral error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

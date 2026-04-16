import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// GET: Return the current user's coupon
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("referral_coupons")
    .select("coupon_code, created_at")
    .eq("user_id", userId)
    .single()

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ coupon: data || null })
}

// PUT: Update an existing coupon
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const userId = body.userId
    const couponCode = body.coupon_code?.trim()?.toLowerCase()

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 })
    }

    if (!couponCode || couponCode.length < 3 || couponCode.length > 20) {
      return NextResponse.json(
        { error: "O cupom deve ter entre 3 e 20 caracteres" },
        { status: 400 }
      )
    }

    if (!/^[a-z0-9-]+$/.test(couponCode)) {
      return NextResponse.json(
        { error: "O cupom deve conter apenas letras, numeros e hifens" },
        { status: 400 }
      )
    }

    // Check if new code is already taken by someone else
    const { data: taken } = await supabase
      .from("referral_coupons")
      .select("id, user_id")
      .eq("coupon_code", couponCode)
      .single()

    if (taken && taken.user_id !== userId) {
      return NextResponse.json(
        { error: "Este cupom ja esta em uso" },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from("referral_coupons")
      .update({ coupon_code: couponCode })
      .eq("user_id", userId)
      .select("coupon_code, created_at")
      .single()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Este cupom ja esta em uso" },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ coupon: data })
  } catch (err) {
    console.error("[v0] Coupon PUT error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

// POST: Create a new coupon for the user
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const userId = body.userId
    const couponCode = body.coupon_code?.trim()?.toLowerCase()

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 })
    }

    if (!couponCode || couponCode.length < 3 || couponCode.length > 20) {
      return NextResponse.json(
        { error: "O cupom deve ter entre 3 e 20 caracteres" },
        { status: 400 }
      )
    }

    if (!/^[a-z0-9-]+$/.test(couponCode)) {
      return NextResponse.json(
        { error: "O cupom deve conter apenas letras, numeros e hifens" },
        { status: 400 }
      )
    }

    // Check if user already has a coupon
    const { data: existing } = await supabase
      .from("referral_coupons")
      .select("id")
      .eq("user_id", userId)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: "Voce ja possui um cupom" },
        { status: 400 }
      )
    }

    // Create the coupon
    const { data, error } = await supabase
      .from("referral_coupons")
      .insert({
        user_id: userId,
        coupon_code: couponCode,
      })
      .select("coupon_code, created_at")
      .single()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Este cupom ja esta em uso" },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ coupon: data })
  } catch (err) {
    console.error("[v0] Coupon POST error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

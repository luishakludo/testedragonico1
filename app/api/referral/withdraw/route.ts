import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const { userId, amount, name, cpf, pixKey } = await request.json()
    console.log("[v0] Withdraw API - Request:", { userId, amount, name, cpf, pixKey })

    if (!userId || !amount || !name || !cpf || !pixKey) {
      return NextResponse.json(
        { error: "Todos os campos sao obrigatorios" },
        { status: 400 }
      )
    }

    if (amount < 10) {
      return NextResponse.json(
        { error: "Valor minimo de R$ 10,00" },
        { status: 400 }
      )
    }

    // Buscar saldo do usuario (affiliate_balance_adjustment)
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("affiliate_balance_adjustment")
      .eq("id", userId)
      .single()

    if (userError) {
      console.error("[v0] Withdraw API - Error fetching user:", userError)
      return NextResponse.json(
        { error: "Erro ao buscar dados do usuario" },
        { status: 500 }
      )
    }

    const affiliateBalanceAdjustment = Number(userData?.affiliate_balance_adjustment) || 0
    console.log("[v0] Withdraw API - affiliateBalanceAdjustment:", affiliateBalanceAdjustment)

    // Buscar saques aprovados
    const { data: approvedWithdraws } = await supabase
      .from("referral_withdraws")
      .select("amount")
      .eq("user_id", userId)
      .eq("status", "approved")

    const totalWithdrawn = approvedWithdraws?.reduce((acc, w) => acc + Number(w.amount), 0) || 0

    // Buscar saques pendentes
    const { data: pendingWithdraws } = await supabase
      .from("referral_withdraws")
      .select("amount")
      .eq("user_id", userId)
      .eq("status", "pending")

    const pendingAmount = pendingWithdraws?.reduce((acc, w) => acc + Number(w.amount), 0) || 0

    // Saldo disponivel = ajuste admin - saques aprovados - saques pendentes
    const availableBalance = affiliateBalanceAdjustment - totalWithdrawn - pendingAmount
    console.log("[v0] Withdraw API - availableBalance:", availableBalance, "amount:", amount)

    if (amount > availableBalance) {
      return NextResponse.json(
        { error: "Saldo insuficiente" },
        { status: 400 }
      )
    }

    // Criar solicitacao de saque como PENDING
    const { data, error } = await supabase
      .from("referral_withdraws")
      .insert({
        user_id: userId,
        amount,
        name,
        cpf,
        pix_key: pixKey,
        status: "pending",
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Withdraw API - Error creating withdraw:", error)
      return NextResponse.json(
        { error: "Erro ao criar solicitacao de saque: " + error.message },
        { status: 500 }
      )
    }

    console.log("[v0] Withdraw API - Success! Created:", data)
    return NextResponse.json({ success: true, withdraw: data })
  } catch (error) {
    console.error("[v0] Withdraw error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}

// GET - List user's withdraws
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId")

  if (!userId) {
    return NextResponse.json({ error: "userId obrigatorio" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("referral_withdraws")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: "Erro ao buscar saques" }, { status: 500 })
  }

  return NextResponse.json({ withdraws: data })
}

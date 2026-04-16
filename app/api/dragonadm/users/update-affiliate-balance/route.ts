import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const { userId, amount, type } = await request.json()
    console.log("[v0] update-affiliate-balance - Received:", { userId, amount, type })

    if (!userId || amount === undefined || !type) {
      console.log("[v0] update-affiliate-balance - Missing data")
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
    }

    const numAmount = Number(amount)
    if (isNaN(numAmount) || numAmount < 0) {
      return NextResponse.json({ error: "Valor invalido" }, { status: 400 })
    }

    // Buscar usuario atual com saldo de ajuste
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, affiliate_balance_adjustment")
      .eq("id", userId)
      .single()

    if (userError || !user) {
      console.log("[v0] update-affiliate-balance - User not found:", userError?.message)
      return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 })
    }
    console.log("[v0] update-affiliate-balance - User found:", { id: user.id, adjustment: user.affiliate_balance_adjustment })

    // Buscar saques aprovados
    const { data: withdraws } = await supabaseAdmin
      .from("referral_withdraws")
      .select("amount")
      .eq("user_id", userId)
      .in("status", ["approved", "paid"])
    
    const totalWithdrawn = withdraws?.reduce((acc, w) => acc + (Number(w.amount) || 0), 0) || 0
    const currentAdjustment = Number(user.affiliate_balance_adjustment) || 0
    const currentBalance = currentAdjustment - totalWithdrawn

    let newAdjustment = currentAdjustment

    if (type === "set") {
      // Para definir um saldo especifico: novoSaldo = novoAjuste - totalSacado
      // novoAjuste = novoSaldo + totalSacado
      newAdjustment = numAmount + totalWithdrawn
    } else if (type === "add") {
      newAdjustment = currentAdjustment + numAmount
    } else if (type === "subtract") {
      newAdjustment = currentAdjustment - numAmount
    } else {
      return NextResponse.json({ error: "Tipo de operacao invalido" }, { status: 400 })
    }

    // Atualizar o campo affiliate_balance_adjustment na tabela users
    console.log("[v0] update-affiliate-balance - Updating to newAdjustment:", newAdjustment)
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from("users")
      .update({ affiliate_balance_adjustment: newAdjustment })
      .eq("id", userId)
      .select()

    console.log("[v0] update-affiliate-balance - Update result:", { data: updateData, error: updateError?.message })

    if (updateError) {
      console.log("[v0] update-affiliate-balance - Update error:", updateError.message)
      return NextResponse.json({ error: "Erro ao atualizar: " + updateError.message }, { status: 500 })
    }

    const newBalance = newAdjustment - totalWithdrawn

    console.log("[v0] update-affiliate-balance - Success! newBalance:", newBalance)
    return NextResponse.json({ 
      success: true, 
      previousBalance: currentBalance,
      newBalance: newBalance,
      adjustment: newAdjustment - currentAdjustment
    })
  } catch (error) {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

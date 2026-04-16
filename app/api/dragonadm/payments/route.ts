import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET() {
  try {
    // Buscar todos os pagamentos com info do usuario
    const { data: payments, error } = await supabase
      .from("payments")
      .select(`
        id,
        amount,
        status,
        created_at,
        user_id,
        profiles:user_id (
          email
        )
      `)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Erro ao buscar pagamentos:", error)
      return NextResponse.json({ error: "Erro ao buscar pagamentos" }, { status: 500 })
    }

    const formattedPayments = payments?.map(payment => ({
      id: payment.id,
      amount: payment.amount,
      status: payment.status,
      created_at: payment.created_at,
      user_email: (payment.profiles as any)?.email || null,
    }))

    return NextResponse.json({ payments: formattedPayments })
  } catch (error) {
    console.error("Erro ao buscar pagamentos:", error)
    return NextResponse.json({ error: "Erro ao buscar pagamentos" }, { status: 500 })
  }
}

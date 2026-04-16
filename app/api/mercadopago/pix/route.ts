import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dnVsb2puZnZnc2JtaHl2cXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTk0NTMsImV4cCI6MjA4ODgzNTQ1M30.Djnn3tsrxSGLBR-Bm1dWOpQe0NHCSOWJFZkbbTOk2oM"

export async function POST(request: NextRequest) {
  try {
    const { accessToken, amount, description, payer, siteId, userId } = await request.json()

    console.log("[v0] PIX API called - amount:", amount, "siteId:", siteId, "userId:", userId, "hasPayer:", !!payer)

    if (!accessToken || !amount) {
      return NextResponse.json(
        { error: "accessToken e amount sao obrigatorios" },
        { status: 400 }
      )
    }

    // Salvar lead no banco se tiver dados do formulario
    const payerName = payer?.name || "Cliente"
    let leadId: string | null = null
    
    if (payer && (payer.email || payer.name || payer.cpf)) {
      try {
        // Usar service role para bypass RLS
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        const { data: leadData, error: leadError } = await supabase.from("checkout_leads").insert({
          site_id: siteId || null,
          email: payer.email || null,
          name: payer.name || null,
          cpf: payer.cpf || null,
          phone: payer.phone || null,
          amount: amount,
          status: "pending",
          created_at: new Date().toISOString(),
        }).select("id").single()
        
        if (leadError) {
          console.error("[v0] Error saving lead:", leadError)
        } else {
          leadId = leadData?.id
          console.log("[v0] Lead saved:", leadId)
        }
      } catch (err) {
        console.error("[v0] Error saving lead:", err)
      }
    }

    // URL de notificacao para webhook
    const notificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://dragonteste.onrender.com"}/api/payments/webhook/mercadopago`
    console.log("[v0] Notification URL:", notificationUrl)

    // Criar pagamento PIX via Mercado Pago (sem enviar dados do payer - igual ao bot)
    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "X-Idempotency-Key": `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: description || "Pagamento PIX",
        payment_method_id: "pix",
        payer: {
          email: "cliente@checkout.com",
        },
        notification_url: notificationUrl,
      }),
    })

    console.log("[v0] Mercado Pago response status:", response.status)

    if (!response.ok) {
      const errorData = await response.json()
      console.error("[v0] Mercado Pago error:", JSON.stringify(errorData))
      return NextResponse.json(
        { error: errorData.message || errorData.cause?.[0]?.description || "Erro ao criar pagamento" },
        { status: response.status }
      )
    }

    const paymentData = await response.json()
    console.log("[v0] Payment created:", paymentData.id, paymentData.status)

    // Extrair dados do PIX
    const pixData = paymentData.point_of_interaction?.transaction_data

    if (!pixData) {
      return NextResponse.json(
        { error: "Dados do PIX nao encontrados" },
        { status: 500 }
      )
    }

    // Salvar pagamento na tabela payments se tiver userId (para aparecer em Vendas)
    console.log("[v0] Saving payment - userId:", userId)
    if (userId) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        const paymentInsert = {
          user_id: userId,
          amount: amount,
          status: "pending",
          payment_method: "pix",
          gateway: "mercadopago",
          external_payment_id: String(paymentData.id),
          description: description || "Checkout PIX",
          product_name: description || "Checkout",
          product_type: "checkout",
          telegram_user_name: payerName,
          pix_code: pixData.qr_code,
          qr_code: pixData.qr_code_base64,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        console.log("[v0] Payment insert data:", JSON.stringify(paymentInsert))
        
        const { data: insertedPayment, error: paymentError } = await supabase
          .from("payments")
          .insert(paymentInsert)
          .select()
          .single()
        
        if (paymentError) {
          console.error("[v0] Payment insert error:", paymentError)
        } else {
          console.log("[v0] Payment saved:", insertedPayment?.id)
        }
        
        // Atualizar lead com payment_id
        if (leadId) {
          await supabase.from("checkout_leads").update({
            payment_id: String(paymentData.id),
            status: "payment_generated"
          }).eq("id", leadId)
        }
      } catch (err) {
        console.error("[v0] Error saving payment:", err)
      }
    } else {
      console.log("[v0] No userId provided, payment not saved to DB")
    }

    return NextResponse.json({
      success: true,
      paymentId: paymentData.id,
      status: paymentData.status,
      qrCode: pixData.qr_code_base64,
      qrCodeUrl: pixData.ticket_url,
      copyPaste: pixData.qr_code,
      ticketUrl: pixData.ticket_url,
      leadId: leadId,
    })
  } catch (error) {
    console.error("Erro ao processar PIX:", error)
    return NextResponse.json(
      { error: "Erro interno ao processar pagamento" },
      { status: 500 }
    )
  }
}

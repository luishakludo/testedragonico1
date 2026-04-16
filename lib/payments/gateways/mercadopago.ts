import { v4 as uuidv4 } from "uuid"

export interface CreatePixPaymentInput {
  accessToken: string
  amount: number
  description: string
  payerEmail?: string
  notificationUrl?: string
}

export interface PixPaymentResult {
  success: boolean
  paymentId: string
  qrCode: string
  qrCodeUrl: string
  copyPaste: string
  status: string
  error?: string
}

export async function createPixPayment(input: CreatePixPaymentInput): Promise<PixPaymentResult> {
  const { accessToken, amount, description, payerEmail = "cliente@email.com", notificationUrl } = input

  // URL de notificacao padrao
  const webhookUrl = notificationUrl || `${process.env.NEXT_PUBLIC_APP_URL || "https://dragonteste.onrender.com"}/api/payments/webhook/mercadopago`

  try {
    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": uuidv4(),
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: description,
        payment_method_id: "pix",
        payer: {
          email: payerEmail,
        },
        notification_url: webhookUrl,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("Mercado Pago API error:", errorData)
      return {
        success: false,
        paymentId: "",
        qrCode: "",
        qrCodeUrl: "",
        copyPaste: "",
        status: "error",
        error: errorData.message || `Erro na API: ${response.status}`,
      }
    }

    const data = await response.json()

    const qrCode = data.point_of_interaction?.transaction_data?.qr_code
    if (!qrCode) {
      return {
        success: false,
        paymentId: "",
        qrCode: "",
        qrCodeUrl: "",
        copyPaste: "",
        status: "error",
        error: "Nao foi possivel gerar o QR Code",
      }
    }

    // Gera URL do QR Code usando servico externo
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}`

    return {
      success: true,
      paymentId: String(data.id),
      qrCode: qrCode,
      qrCodeUrl: qrCodeUrl,
      copyPaste: qrCode, // O codigo copia e cola e o proprio qrCode
      status: data.status || "pending",
    }
  } catch (error) {
    console.error("Error creating Mercado Pago payment:", error)
    return {
      success: false,
      paymentId: "",
      qrCode: "",
      qrCodeUrl: "",
      copyPaste: "",
      status: "error",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    }
  }
}

export async function checkPaymentStatus(accessToken: string, paymentId: string): Promise<string> {
  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      return "error"
    }

    const data = await response.json()
    return data.status || "unknown"
  } catch {
    return "error"
  }
}

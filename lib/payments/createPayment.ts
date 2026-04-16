import { createPixPayment as mercadoPagoCreatePix, checkPaymentStatus as mercadoPagoCheckStatus } from "./gateways/mercadopago"

export interface CreatePaymentInput {
  gateway: string
  accessToken: string
  amount: number
  description: string
  payerEmail?: string
}

export interface PaymentResult {
  success: boolean
  paymentId: string
  qrCode: string
  qrCodeUrl: string
  copyPaste: string
  status: string
  error?: string
}

export async function createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
  const { gateway, accessToken, amount, description, payerEmail } = input

  switch (gateway) {
    case "mercadopago":
      return mercadoPagoCreatePix({
        accessToken,
        amount,
        description,
        payerEmail,
      })

    // Adicionar outros gateways aqui no futuro
    // case "stripe":
    //   return stripeCreatePayment(...)
    // case "pagseguro":
    //   return pagseguroCreatePix(...)

    default:
      return {
        success: false,
        paymentId: "",
        qrCode: "",
        qrCodeUrl: "",
        copyPaste: "",
        status: "error",
        error: `Gateway '${gateway}' nao suportado`,
      }
  }
}

export async function checkPaymentStatus(gateway: string, accessToken: string, paymentId: string): Promise<string> {
  switch (gateway) {
    case "mercadopago":
      return mercadoPagoCheckStatus(accessToken, paymentId)

    default:
      return "error"
  }
}

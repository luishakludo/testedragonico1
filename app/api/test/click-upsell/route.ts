import { getSupabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

// Funcao para gerar pagamento PIX (copiada do webhook)
async function generatePaymentDirect(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  botToken: string,
  chatId: string,
  telegramUserId: string,
  botId: string,
  botUserId: string,
  amount: number,
  description: string,
  productType: "upsell" | "downsell"
) {
  // Buscar credenciais do MercadoPago
  const { data: integration } = await supabase
    .from("integrations")
    .select("credentials")
    .eq("user_id", botUserId)
    .eq("type", "mercadopago")
    .single()

  if (!integration?.credentials) {
    await sendMessage(botToken, chatId, "Erro: Integracao MercadoPago nao configurada.")
    return { success: false, error: "No MP credentials" }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const credentials = integration.credentials as Record<string, any>
  const accessToken = credentials.access_token

  // Criar pagamento no MercadoPago
  const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      transaction_amount: amount,
      description: description,
      payment_method_id: "pix",
      payer: {
        email: `user${telegramUserId}@telegram.com`,
      },
    }),
  })

  const mpData = await mpResponse.json()

  if (!mpResponse.ok || !mpData.id) {
    await sendMessage(botToken, chatId, "Erro ao gerar pagamento. Tente novamente.")
    return { success: false, error: mpData }
  }

  const pixCopyPaste = mpData.point_of_interaction?.transaction_data?.qr_code
  const qrCodeBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64

  // Salvar pagamento no banco
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      bot_id: botId,
      user_id: telegramUserId,
      amount: amount,
      external_id: String(mpData.id),
      product_type: productType,
      payment_method: "pix",
      qr_code: qrCodeBase64 || null,
      copy_paste: pixCopyPaste || null,
      status: "pending",
    })
    .select()
    .single()

  if (paymentError) {
    return { success: false, error: paymentError }
  }

  // Enviar QR Code para o usuario
  if (qrCodeBase64) {
    // Enviar imagem do QR Code
    const imageBuffer = Buffer.from(qrCodeBase64, "base64")
    const formData = new FormData()
    formData.append("chat_id", chatId)
    formData.append("photo", new Blob([imageBuffer], { type: "image/png" }), "qrcode.png")
    formData.append("caption", `💰 *${description}*\n\n📋 Valor: R$ ${amount.toFixed(2)}\n\n👆 Escaneie o QR Code ou copie o codigo abaixo:`)
    formData.append("parse_mode", "Markdown")

    await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: "POST",
      body: formData,
    })
  }

  // Enviar codigo PIX copia e cola
  if (pixCopyPaste) {
    await sendMessage(botToken, chatId, `\`${pixCopyPaste}\`\n\n_Clique para copiar o codigo PIX_`, "Markdown")
  }

  return { success: true, payment, mpData }
}

async function sendMessage(botToken: string, chatId: string, text: string, parseMode?: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
    }),
  })
}

export async function GET() {
  const logs: string[] = []
  const log = (msg: string) => {
    console.log(msg)
    logs.push(msg)
  }

  try {
    const supabase = getSupabaseAdmin()
    const targetUserId = "5099610171"

    log("=== SIMULANDO CLIQUE NO BOTAO DE UPSELL ===")
    log("")
    log(`Usuario: ${targetUserId}`)

    // 1. Buscar fluxo com upsell
    const { data: flows } = await supabase
      .from("flows")
      .select("id, name, config, bot_id")
      .not("config", "is", null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flowWithUpsell = flows?.find((f) => {
      const config = f.config as Record<string, any>
      return config?.upsell?.enabled && config?.upsell?.sequences?.length > 0
    })

    if (!flowWithUpsell) {
      return NextResponse.json({ success: false, error: "Nenhum fluxo com upsell encontrado" })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = flowWithUpsell.config as Record<string, any>
    const upsellSeq = config.upsell.sequences[0]
    const plan = upsellSeq.plans?.[0]
    const price = plan?.price || 0.01

    log(`Fluxo: ${flowWithUpsell.name}`)
    log(`Preco do plano: R$ ${price}`)

    // 2. Buscar bot
    let botId = flowWithUpsell.bot_id
    if (!botId) {
      const { data: flowBot } = await supabase
        .from("flow_bots")
        .select("bot_id")
        .eq("flow_id", flowWithUpsell.id)
        .limit(1)
        .single()
      botId = flowBot?.bot_id
    }

    if (!botId) {
      const { data: anyBot } = await supabase.from("bots").select("id").limit(1).single()
      botId = anyBot?.id
    }

    const { data: bot } = await supabase.from("bots").select("id, token, user_id").eq("id", botId).single()

    if (!bot) {
      return NextResponse.json({ success: false, error: "Bot nao encontrado" })
    }

    log(`Bot ID: ${bot.id}`)
    log("")
    log("=== GERANDO PAGAMENTO PIX ===")

    // 3. Gerar pagamento diretamente
    const result = await generatePaymentDirect(
      supabase,
      bot.token,
      targetUserId,
      targetUserId,
      bot.id,
      bot.user_id,
      price,
      "Oferta Especial - Upsell",
      "upsell"
    )

    if (result.success) {
      log("")
      log("SUCESSO! Pagamento gerado e QR Code enviado!")
      log(`Payment ID: ${result.payment?.id}`)
      log(`MP ID: ${result.mpData?.id}`)
    } else {
      log("")
      log(`ERRO: ${JSON.stringify(result.error)}`)
    }

    return NextResponse.json({
      success: result.success,
      logs,
      payment: result.payment,
      mpId: result.mpData?.id,
    })
  } catch (error) {
    log(`ERRO: ${error}`)
    return NextResponse.json({ success: false, logs, error: String(error) })
  }
}

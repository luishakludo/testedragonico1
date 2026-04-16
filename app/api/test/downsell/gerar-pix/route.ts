import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
import { createPixPayment } from "@/lib/payments/gateways/mercadopago"

// API de teste que gera PIX de downsell de verdade e tenta salvar no banco
// Acesse: /api/test/downsell/gerar-pix
export async function GET() {
  const supabase = getSupabaseAdmin()
  const logs: string[] = []
  const log = (msg: string) => logs.push(`[${new Date().toISOString()}] ${msg}`)

  try {
    // 1. Buscar um bot ativo com gateway configurado
    log("Buscando bot com gateway ativo...")
    const { data: bots, error: botsError } = await supabase
      .from("bots")
      .select("id, name, user_id, token")
      .limit(10)

    if (botsError || !bots?.length) {
      return NextResponse.json({ erro: "Nenhum bot encontrado", logs })
    }

    log(`Encontrados ${bots.length} bots`)

    // Buscar gateway ativo para algum desses bots
    let selectedBot = null
    let gateway = null

    for (const bot of bots) {
      const { data: gw } = await supabase
        .from("user_gateways")
        .select("*")
        .eq("user_id", bot.user_id)
        .eq("is_active", true)
        .limit(1)
        .single()

      if (gw?.access_token) {
        selectedBot = bot
        gateway = gw
        log(`Bot "${bot.name}" tem gateway ativo: ${gw.gateway_name}`)
        break
      }
    }

    if (!selectedBot || !gateway) {
      return NextResponse.json({
        erro: "Nenhum bot com gateway ativo encontrado",
        bots_verificados: bots.map((b) => ({ id: b.id, name: b.name, user_id: b.user_id })),
        logs,
      })
    }

    // 2. Dados simulados do downsell
    const telegramUserId = "123456789"
    const telegramUsername = "teste_usuario"
    const telegramFirstName = "Usuario"
    const telegramLastName = "Teste"
    const price = 19.9
    const planName = "Oferta Especial Downsell"

    log(`Gerando PIX de R$ ${price} para ${planName}...`)

    // 3. Gerar PIX real
    const pixResult = await createPixPayment({
      accessToken: gateway.access_token,
      amount: price,
      description: `Pagamento - ${planName}`,
      payerEmail: "teste@teste.com",
    })

    log(`Resultado createPixPayment: success=${pixResult.success}, paymentId=${pixResult.paymentId}`)

    if (!pixResult.success) {
      return NextResponse.json({
        erro: "Falha ao gerar PIX",
        pixResult,
        bot: { id: selectedBot.id, name: selectedBot.name },
        gateway: { id: gateway.id, name: gateway.gateway_name },
        logs,
      })
    }

    // 4. Salvar no banco IGUAL o downsell faz
    log("Salvando pagamento no banco...")
    log(
      `user_id: ${selectedBot.user_id}, bot_id: ${selectedBot.id}, amount: ${price}, product_type: downsell`
    )

    const paymentData = {
      user_id: selectedBot.user_id,
      bot_id: selectedBot.id,
      telegram_user_id: String(telegramUserId),
      telegram_username: telegramUsername || null,
      telegram_first_name: telegramFirstName || null,
      telegram_last_name: telegramLastName || null,
      amount: price,
      status: "pending",
      payment_method: "pix",
      gateway: gateway.gateway_name || "mercadopago",
      external_payment_id: String(pixResult.paymentId),
      description: `Pagamento - ${planName}`,
      product_name: planName,
      product_type: "downsell",
      qr_code: pixResult.qrCode,
      qr_code_url: pixResult.qrCodeUrl,
      copy_paste: pixResult.copyPaste,
      pix_code: pixResult.copyPaste || pixResult.qrCode,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    log(`Dados para insert: ${JSON.stringify(paymentData, null, 2)}`)

    const { data: savedPayment, error: saveError } = await supabase
      .from("payments")
      .insert(paymentData)
      .select()
      .single()

    if (saveError) {
      log(`ERRO ao salvar: ${saveError.message}`)
      log(`Detalhes do erro: ${JSON.stringify(saveError)}`)
      return NextResponse.json({
        erro: "Falha ao salvar pagamento no banco",
        saveError: {
          message: saveError.message,
          details: saveError.details,
          hint: saveError.hint,
          code: saveError.code,
        },
        paymentData,
        pixResult,
        bot: { id: selectedBot.id, name: selectedBot.name, user_id: selectedBot.user_id },
        gateway: { id: gateway.id, name: gateway.gateway_name },
        logs,
      })
    }

    log(`Pagamento salvo com sucesso! ID: ${savedPayment?.id}`)

    // 5. Verificar se aparece na listagem
    log("Verificando se aparece na listagem...")
    const { data: checkPayment } = await supabase
      .from("payments")
      .select("id, user_id, bot_id, amount, status, product_type, product_name, created_at")
      .eq("id", savedPayment?.id)
      .single()

    return NextResponse.json({
      sucesso: true,
      mensagem: "PIX gerado e pagamento salvo com sucesso!",
      pix: {
        paymentId: pixResult.paymentId,
        qrCodeUrl: pixResult.qrCodeUrl,
        copyPaste: pixResult.copyPaste?.substring(0, 50) + "...",
        status: pixResult.status,
      },
      pagamento_salvo: savedPayment,
      verificacao_listagem: checkPayment,
      bot: { id: selectedBot.id, name: selectedBot.name, user_id: selectedBot.user_id },
      gateway: { id: gateway.id, name: gateway.gateway_name },
      logs,
    })
  } catch (error) {
    log(`Erro geral: ${error instanceof Error ? error.message : String(error)}`)
    return NextResponse.json({
      erro: "Erro inesperado",
      message: error instanceof Error ? error.message : String(error),
      logs,
    })
  }
}

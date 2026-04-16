import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
import { createPixPayment } from "@/lib/payments/gateways/mercadopago"

// API para debugar todo o fluxo do downsell - simula EXATAMENTE o callback ds_
// Acesse: /api/test/downsell/debug-fluxo
export async function GET() {
  const logs: string[] = []
  const log = (msg: string) => {
    console.log(msg)
    logs.push(msg)
  }

  try {
    const supabase = getSupabaseAdmin()
    
    // ========== STEP 1: Buscar um bot ativo ==========
    log("STEP 1: Buscando bot ativo...")
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("id, name, token, user_id")
      .not("token", "is", null)
      .limit(1)
      .single()

    if (botError || !bot) {
      return NextResponse.json({
        success: false,
        error: "Nenhum bot encontrado",
        logs
      })
    }
    log(`STEP 1 OK: Bot encontrado - id=${bot.id}, name=${bot.name}, user_id=${bot.user_id}`)

    const botUuid = bot.id
    const botOwnerId = bot.user_id

    // ========== STEP 2: Simular dados do callback ds_ ==========
    log("STEP 2: Simulando dados do callback ds_...")
    const callbackData = "ds_abc12345_0_990" // shortMsgId=abc12345, planIndex=0, price=9.90
    const parts = callbackData.replace("ds_", "").split("_")
    const shortMsgId = parts[0] || ""
    const planIndex = parseInt(parts[1]) || 0
    const priceInCents = parseInt(parts[2]) || 0
    const price = priceInCents / 100
    
    log(`STEP 2 OK: callbackData=${callbackData}, shortMsgId=${shortMsgId}, planIndex=${planIndex}, price=${price}`)

    // ========== STEP 3: Buscar scheduled_message (pode nao existir) ==========
    log("STEP 3: Buscando scheduled_message...")
    const { data: scheduledMsg, error: scheduledMsgError } = await supabase
      .from("scheduled_messages")
      .select("*")
      .like("id", `%${shortMsgId}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (scheduledMsgError) {
      log(`STEP 3 AVISO: scheduled_message nao encontrada (normal em teste) - ${scheduledMsgError.message}`)
    } else {
      log(`STEP 3 OK: scheduled_message encontrada - id=${scheduledMsg?.id}`)
    }

    // ========== STEP 4: Buscar flow_id ==========
    log("STEP 4: Buscando flow_id...")
    let flowId = scheduledMsg?.flow_id || ""
    
    if (!flowId) {
      const { data: botFlow } = await supabase
        .from("flows")
        .select("id")
        .eq("bot_id", botUuid)
        .limit(1)
        .single()
      
      if (botFlow?.id) {
        flowId = botFlow.id
        log(`STEP 4 OK: flow_id encontrado via flows.bot_id - ${flowId}`)
      } else {
        const { data: flowBot } = await supabase
          .from("flow_bots")
          .select("flow_id")
          .eq("bot_id", botUuid)
          .limit(1)
          .single()
        
        if (flowBot?.flow_id) {
          flowId = flowBot.flow_id
          log(`STEP 4 OK: flow_id encontrado via flow_bots - ${flowId}`)
        } else {
          log("STEP 4 AVISO: flow_id nao encontrado (pode dar problema)")
        }
      }
    }

    // ========== STEP 5: Definir dados do plano ==========
    log("STEP 5: Definindo dados do plano...")
    const msgMetadata = scheduledMsg?.metadata as Record<string, unknown> | null
    const plans = (msgMetadata?.plans as Array<{ id: string; buttonText: string; price: number }>) || []
    const selectedPlan = plans[planIndex]
    const planName = selectedPlan?.buttonText || "Oferta Especial (Teste)"
    
    log(`STEP 5 OK: planName=${planName}, price=${price}`)

    // ========== STEP 6: Buscar user_id do bot owner ==========
    log("STEP 6: Verificando bot owner...")
    const { data: botOwner } = await supabase
      .from("bots")
      .select("user_id")
      .eq("id", botUuid)
      .single()

    if (!botOwner?.user_id) {
      return NextResponse.json({
        success: false,
        error: "STEP 6 ERRO: Bot owner nao encontrado",
        logs
      })
    }
    log(`STEP 6 OK: botOwner.user_id=${botOwner.user_id}`)

    // ========== STEP 7: Buscar gateway ==========
    log("STEP 7: Buscando gateway...")
    const { data: gateway, error: gwError } = await supabase
      .from("user_gateways")
      .select("*")
      .eq("user_id", botOwner.user_id)
      .eq("is_active", true)
      .limit(1)
      .single()

    log(`STEP 7: Gateway lookup - user_id=${botOwner.user_id}, found=${!!gateway}, has_token=${!!gateway?.access_token}, error=${gwError?.message || "none"}`)

    if (!gateway?.access_token) {
      return NextResponse.json({
        success: false,
        error: "STEP 7 ERRO: Gateway nao encontrado ou sem access_token",
        gatewayError: gwError?.message,
        logs
      })
    }
    log(`STEP 7 OK: Gateway encontrado - ${gateway.gateway_name}`)

    // ========== STEP 8: Gerar PIX ==========
    log("STEP 8: Gerando PIX...")
    const pixResult = await createPixPayment({
      accessToken: gateway.access_token,
      amount: price,
      description: `Pagamento - ${planName}`,
      payerEmail: "teste@teste.com",
    })

    if (!pixResult.success) {
      return NextResponse.json({
        success: false,
        error: `STEP 8 ERRO: Falha ao gerar PIX - ${pixResult.error}`,
        logs
      })
    }
    log(`STEP 8 OK: PIX gerado - paymentId=${pixResult.paymentId}`)

    // ========== STEP 9: Salvar pagamento (IGUAL ao plano normal) ==========
    log("STEP 9: Salvando pagamento no banco...")
    
    // Dados simulados do usuario Telegram
    const telegramUserId = 123456789
    const userUsername = "teste_user"
    const userFirstName = "Teste"
    const userLastName = "Usuario"

    const paymentData = {
      user_id: botOwner.user_id,
      bot_id: botUuid,
      telegram_user_id: String(telegramUserId),
      telegram_username: userUsername || null,
      telegram_first_name: userFirstName || null,
      telegram_last_name: userLastName || null,
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
    
    log(`STEP 9: Dados do insert: ${JSON.stringify(paymentData, null, 2)}`)

    const { data: savedPayment, error: saveError } = await supabase
      .from("payments")
      .insert(paymentData)
      .select()
      .single()

    if (saveError) {
      return NextResponse.json({
        success: false,
        error: `STEP 9 ERRO: Falha ao salvar - ${saveError.message}`,
        errorDetails: saveError,
        paymentData,
        logs
      })
    }
    log(`STEP 9 OK: Pagamento salvo - id=${savedPayment?.id}`)

    // ========== STEP 10: Verificar se aparece na listagem ==========
    log("STEP 10: Verificando se aparece na listagem de pagamentos...")
    const { data: listedPayments, error: listError } = await supabase
      .from("payments")
      .select("id, product_type, amount, status, telegram_username, created_at")
      .eq("id", savedPayment?.id)
      .single()

    if (listError) {
      log(`STEP 10 ERRO: ${listError.message}`)
    } else {
      log(`STEP 10 OK: Pagamento listado - ${JSON.stringify(listedPayments)}`)
    }

    return NextResponse.json({
      success: true,
      message: "Fluxo completo executado com sucesso!",
      logs,
      result: {
        bot: { id: bot.id, name: bot.name, user_id: bot.user_id },
        gateway: { id: gateway.id, name: gateway.gateway_name },
        pix: { paymentId: pixResult.paymentId },
        savedPayment: savedPayment,
        listedPayment: listedPayments
      }
    })

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log(`ERRO FATAL: ${errorMsg}`)
    return NextResponse.json({
      success: false,
      error: errorMsg,
      logs
    })
  }
}

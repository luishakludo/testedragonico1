import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    tests: []
  }

  try {
    // 1. Buscar todos os bots ativos
    const { data: bots, error: botsError } = await supabase
      .from("bots")
      .select("id, name, telegram_bot_id, user_id, is_active")
      .eq("is_active", true)
      .limit(10)

    if (botsError) {
      return NextResponse.json({ error: "Erro ao buscar bots", details: botsError.message })
    }

    if (!bots || bots.length === 0) {
      return NextResponse.json({ error: "Nenhum bot ativo encontrado" })
    }

    results.total_bots = bots.length

    // 2. Para cada bot, verificar tudo
    for (const bot of bots) {
      const botTest: Record<string, unknown> = {
        bot_id: bot.id,
        bot_name: bot.name,
        telegram_bot_id: bot.telegram_bot_id,
        user_id: bot.user_id,
        checks: {}
      }

      // Check 1: Gateway do usuario
      const { data: gateway, error: gatewayError } = await supabase
        .from("user_gateways")
        .select("id, gateway_name, is_active, access_token")
        .eq("user_id", bot.user_id)
        .eq("is_active", true)
        .limit(1)
        .single()

      botTest.checks = {
        ...botTest.checks as object,
        gateway: {
          found: !!gateway,
          error: gatewayError?.message || null,
          gateway_name: gateway?.gateway_name || null,
          has_access_token: !!gateway?.access_token,
          is_active: gateway?.is_active || false
        }
      }

      // Check 2: Flow vinculado
      const { data: directFlow } = await supabase
        .from("flows")
        .select("id, name")
        .eq("bot_id", bot.id)
        .limit(1)
        .single()

      let flowId = directFlow?.id || null
      let flowName = directFlow?.name || null

      if (!flowId) {
        const { data: flowBot } = await supabase
          .from("flow_bots")
          .select("flow_id, flows(id, name)")
          .eq("bot_id", bot.id)
          .limit(1)
          .single()

        if (flowBot) {
          flowId = flowBot.flow_id
          flowName = (flowBot.flows as { name?: string })?.name || null
        }
      }

      botTest.checks = {
        ...botTest.checks as object,
        flow: {
          found: !!flowId,
          flow_id: flowId,
          flow_name: flowName
        }
      }

      // Check 3: Pagamentos existentes deste bot
      const { data: allPayments, error: paymentsError } = await supabase
        .from("payments")
        .select("id, product_type, status, amount, created_at")
        .eq("bot_id", bot.id)
        .order("created_at", { ascending: false })
        .limit(10)

      const downsellPayments = allPayments?.filter(p => p.product_type === "downsell") || []
      const otherPayments = allPayments?.filter(p => p.product_type !== "downsell") || []

      botTest.checks = {
        ...botTest.checks as object,
        payments: {
          error: paymentsError?.message || null,
          total: allPayments?.length || 0,
          downsell_count: downsellPayments.length,
          other_count: otherPayments.length,
          downsell_payments: downsellPayments,
          other_payments: otherPayments.slice(0, 3) // Apenas 3 para comparar
        }
      }

      // Check 4: Comparar campos de um pagamento normal vs downsell
      if (otherPayments.length > 0 && downsellPayments.length > 0) {
        const { data: normalPaymentFull } = await supabase
          .from("payments")
          .select("*")
          .eq("id", otherPayments[0].id)
          .single()

        const { data: downsellPaymentFull } = await supabase
          .from("payments")
          .select("*")
          .eq("id", downsellPayments[0].id)
          .single()

        if (normalPaymentFull && downsellPaymentFull) {
          const differences: Record<string, { normal: unknown; downsell: unknown }> = {}
          
          for (const key of Object.keys(normalPaymentFull)) {
            if (key === "id" || key === "created_at" || key === "updated_at" || key === "external_payment_id") continue
            
            const normalVal = normalPaymentFull[key]
            const downsellVal = downsellPaymentFull[key]
            
            // Verificar se o campo esta null/undefined no downsell mas preenchido no normal
            if ((normalVal !== null && normalVal !== undefined) && (downsellVal === null || downsellVal === undefined)) {
              differences[key] = { normal: normalVal, downsell: downsellVal }
            }
          }

          botTest.checks = {
            ...botTest.checks as object,
            field_comparison: {
              normal_payment_id: normalPaymentFull.id,
              downsell_payment_id: downsellPaymentFull.id,
              missing_in_downsell: differences,
              normal_user_id: normalPaymentFull.user_id,
              downsell_user_id: downsellPaymentFull.user_id,
              user_id_match: normalPaymentFull.user_id === downsellPaymentFull.user_id
            }
          }
        }
      }

      // Check 5: Scheduled messages de downsell
      const { data: scheduledMsgs } = await supabase
        .from("scheduled_messages")
        .select("id, message_type, status, created_at")
        .eq("bot_id", bot.id)
        .eq("message_type", "downsell")
        .order("created_at", { ascending: false })
        .limit(5)

      botTest.checks = {
        ...botTest.checks as object,
        scheduled_downsells: {
          count: scheduledMsgs?.length || 0,
          messages: scheduledMsgs || []
        }
      }

      ;(results.tests as unknown[]).push(botTest)
    }

    // 3. Buscar todos os pagamentos downsell do sistema
    const { data: allDownsells } = await supabase
      .from("payments")
      .select("id, bot_id, user_id, amount, status, product_type, created_at")
      .eq("product_type", "downsell")
      .order("created_at", { ascending: false })
      .limit(20)

    results.all_downsell_payments = {
      count: allDownsells?.length || 0,
      payments: allDownsells || []
    }

    // 4. Buscar todos os product_types distintos
    const { data: productTypes } = await supabase
      .from("payments")
      .select("product_type")
      .limit(1000)

    const uniqueTypes = [...new Set(productTypes?.map(p => p.product_type) || [])]
    results.all_product_types = uniqueTypes

    return NextResponse.json(results, { status: 200 })
  } catch (err) {
    return NextResponse.json({
      error: "Erro interno",
      message: err instanceof Error ? err.message : String(err)
    }, { status: 500 })
  }
}

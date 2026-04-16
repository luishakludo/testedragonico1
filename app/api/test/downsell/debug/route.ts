import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dnVsb2puZnZnc2JtaHl2cXRuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI1OTQ1MywiZXhwIjoyMDg4ODM1NDUzfQ.piDbcvfzUQd8orOFUn7vE1cZ5RXMBFXTd8vKqJRA-Hg"

function getDb() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

// ---------------------------------------------------------------------------
// GET /api/test/downsell/debug
// 
// Mostra informacoes de debug do sistema de downsell
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const db = getDb()
  const searchParams = request.nextUrl.searchParams
  const chatId = searchParams.get("chat")

  try {
    // 1. Buscar bots e fluxos
    const [botsRes, flowsRes, flowBotsRes] = await Promise.all([
      db.from("bots").select("id, name, token, user_id"),
      db.from("flows").select("id, name, bot_id, config"),
      db.from("flow_bots").select("flow_id, bot_id")
    ])

    const bots = botsRes.data || []
    const flows = flowsRes.data || []
    const flowBots = flowBotsRes.data || []

    // 2. Analisar fluxos com downsell
    const analise = []

    for (const flow of flows) {
      const config = (flow.config || {}) as Record<string, unknown>
      const downsell = config.downsell as {
        enabled?: boolean
        sequences?: Array<{
          id: string
          message?: string
          plans?: Array<{ id: string; buttonText: string; price: number }>
        }>
      }

      if (!downsell?.enabled) continue

      // Encontrar bot
      let botId = flow.bot_id
      if (!botId) {
        const fb = flowBots.find((fb: { flow_id: string; bot_id: string }) => fb.flow_id === flow.id)
        if (fb) botId = fb.bot_id
      }

      const bot = bots.find((b: { id: string }) => b.id === botId)

      // Verificar gateway
      let gateway = null
      let gatewaySource = ""

      if (bot?.user_id) {
        const { data: gw } = await db
          .from("user_gateways")
          .select("*")
          .eq("user_id", bot.user_id)
          .eq("is_active", true)
          .limit(1)
          .single()

        if (gw) {
          gateway = gw
          gatewaySource = "user_gateways"
        }
      }

      if (!gateway && bot?.id) {
        const { data: gw } = await db
          .from("payment_gateways")
          .select("*")
          .eq("bot_id", bot.id)
          .eq("is_active", true)
          .limit(1)
          .single()

        if (gw) {
          gateway = gw
          gatewaySource = "payment_gateways"
        }
      }

      // Gerar callbacks esperados
      const callbacksEsperados = []
      for (const seq of downsell.sequences || []) {
        for (const plan of seq.plans || []) {
          callbacksEsperados.push({
            callback_data: `ds_${seq.id}_${plan.id}_${plan.price}`,
            botao: plan.buttonText,
            preco: plan.price
          })
        }
      }

      analise.push({
        fluxo: flow.name,
        fluxo_id: flow.id,
        bot: bot?.name || "NAO ENCONTRADO",
        bot_id: bot?.id || null,
        user_id: bot?.user_id || null,
        gateway: {
          encontrado: !!gateway,
          fonte: gatewaySource,
          tipo: gateway?.gateway_name || null,
          tem_access_token: !!(gateway?.access_token || gateway?.credentials?.access_token)
        },
        sequencias: downsell.sequences?.length || 0,
        callbacks_esperados: callbacksEsperados
      })
    }

    // 3. Se passou chat, enviar mensagem de teste
    let testeMensagem = null
    if (chatId && analise.length > 0) {
      const primeiraAnalise = analise[0]
      const bot = bots.find((b: { id: string }) => b.id === primeiraAnalise.bot_id)

      if (bot?.token && primeiraAnalise.callbacks_esperados.length > 0) {
        const callback = primeiraAnalise.callbacks_esperados[0]

        // Enviar mensagem com botao de teste
        const res = await fetch(`https://api.telegram.org/bot${bot.token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `TESTE DEBUG DOWNSELL\n\nCallback que sera enviado:\n<code>${callback.callback_data}</code>\n\nClique no botao abaixo para testar:`,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [[{
                text: `${callback.botao} - R$ ${callback.preco}`,
                callback_data: callback.callback_data
              }]]
            }
          })
        })

        testeMensagem = await res.json()
      }
    }

    return NextResponse.json({
      debug: "DOWNSELL_SYSTEM",
      total_bots: bots.length,
      total_fluxos: flows.length,
      fluxos_com_downsell: analise.length,
      analise,
      teste_mensagem: testeMensagem,
      instrucao: chatId 
        ? "Clique no botao que foi enviado no Telegram e veja se o PIX e gerado"
        : "Adicione ?chat=SEU_CHAT_ID para enviar mensagem de teste"
    })

  } catch (err) {
    return NextResponse.json({
      erro: err instanceof Error ? err.message : "Erro",
      stack: err instanceof Error ? err.stack : null
    }, { status: 500 })
  }
}

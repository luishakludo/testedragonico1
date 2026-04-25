import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

/**
 * API DE TESTE DOWNSELL REAL
 * 
 * Busca dados REAIS do fluxo no Supabase e monta o payload de downsell
 * com os planos que existem no sistema.
 * 
 * Uso:
 *   GET /api/test/downsell-real                        -> Usa fluxo padrao
 *   GET /api/test/downsell-real?flowId=UUID_DO_FLUXO   -> Usa fluxo especifico
 * 
 * Retorna:
 *   - Dados do fluxo
 *   - Planos disponiveis (do banco ou config)
 *   - Configuracao de downsell
 *   - Payload pronto para Telegram
 */

// Fluxo padrao para teste (o que voce passou)
const DEFAULT_FLOW_ID = "206cbb10-efeb-4f59-a153-9c9d420b4e84"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const flowId = searchParams.get("flowId") || DEFAULT_FLOW_ID
  
  const supabase = getSupabaseAdmin()
  const logs: string[] = []
  const log = (msg: string) => {
    console.log(`[v0] ${msg}`)
    logs.push(msg)
  }

  try {
    log(`Iniciando busca do fluxo: ${flowId}`)

    // ===============================================
    // STEP 1: BUSCAR FLUXO
    // ===============================================
    const { data: flow, error: flowError } = await supabase
      .from("flows")
      .select("id, name, config, status, bot_id, user_id, created_at, updated_at")
      .eq("id", flowId)
      .single()

    if (flowError || !flow) {
      log(`ERRO: Fluxo nao encontrado - ${flowError?.message}`)
      return NextResponse.json({
        success: false,
        error: "Fluxo nao encontrado",
        flow_id: flowId,
        detalhes: flowError?.message || "Flow inexistente",
        logs
      }, { status: 404 })
    }

    log(`Fluxo encontrado: ${flow.name}`)
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = (flow.config || {}) as Record<string, any>

    // ===============================================
    // STEP 2: BUSCAR PLANOS DO BANCO (flow_plans)
    // ===============================================
    log("Buscando planos do banco (flow_plans)...")
    
    const { data: dbPlans, error: dbPlansError } = await supabase
      .from("flow_plans")
      .select("*")
      .eq("flow_id", flowId)
      .eq("is_active", true)
      .order("position", { ascending: true })

    if (dbPlansError) {
      log(`Erro ao buscar flow_plans: ${dbPlansError.message}`)
    }

    // Planos do config (fallback)
    const configPlans = config.plans || []
    
    log(`Planos no banco: ${dbPlans?.length || 0}`)
    log(`Planos no config: ${configPlans.length}`)

    // Usar planos do banco se existirem, senao do config
    const planosOriginais = (dbPlans && dbPlans.length > 0)
      ? dbPlans.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          description: p.description,
          is_active: p.is_active,
          position: p.position,
          fonte: "database (flow_plans)"
        }))
      : configPlans.map((p: { id: string; name: string; price: number; description?: string }, index: number) => ({
          id: p.id || `config_plan_${index}`,
          name: p.name,
          price: p.price,
          description: p.description || null,
          is_active: true,
          position: index,
          fonte: "config JSON"
        }))

    log(`Total de planos encontrados: ${planosOriginais.length}`)

    // ===============================================
    // STEP 3: BUSCAR CONFIG DE DOWNSELL
    // ===============================================
    const downsellConfig = config.downsell || {}
    const discountPercent = downsellConfig.discountPercent || 20
    const showPriceInButton = downsellConfig.showPriceInButton !== false
    const message = downsellConfig.message || "Oferta especial para voce!"

    log(`Downsell config - enabled: ${downsellConfig.enabled}, discount: ${discountPercent}%`)

    // ===============================================
    // STEP 4: APLICAR DESCONTO NOS PLANOS
    // ===============================================
    const planosComDesconto = planosOriginais.map((plano: { id: string; name: string; price: number; description?: string | null; is_active?: boolean; position?: number; fonte: string }) => {
      const precoOriginal = plano.price
      const desconto = precoOriginal * (discountPercent / 100)
      const precoComDesconto = precoOriginal - desconto
      
      // Texto do botao
      const buttonText = showPriceInButton 
        ? `${plano.name} - R$ ${precoComDesconto.toFixed(2).replace(".", ",")}`
        : plano.name

      return {
        ...plano,
        preco_original: precoOriginal,
        preco_original_formatado: `R$ ${precoOriginal.toFixed(2).replace(".", ",")}`,
        desconto_aplicado: discountPercent,
        valor_desconto: desconto,
        preco_com_desconto: precoComDesconto,
        preco_com_desconto_formatado: `R$ ${precoComDesconto.toFixed(2).replace(".", ",")}`,
        button_text: buttonText,
        callback_data: `ds_${flowId.substring(0, 8)}_${plano.position || 0}_${Math.round(precoComDesconto * 100)}`
      }
    })

    log(`Planos processados com desconto de ${discountPercent}%`)

    // ===============================================
    // STEP 5: BUSCAR BOT VINCULADO
    // ===============================================
    let botInfo = null
    
    if (flow.bot_id) {
      const { data: bot } = await supabase
        .from("bots")
        .select("id, name, username, telegram_bot_id, status")
        .eq("id", flow.bot_id)
        .single()
      
      if (bot) {
        botInfo = bot
        log(`Bot vinculado: ${bot.name} (@${bot.username})`)
      }
    }

    // ===============================================
    // STEP 6: MONTAR PAYLOAD TELEGRAM
    // ===============================================
    const telegramPayload = {
      method: "sendMessage",
      chat_id: "SUBSTITUIR_PELO_CHAT_ID",
      text: message,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: planosComDesconto.map((plano: { button_text: string; callback_data: string }) => ([
          {
            text: plano.button_text,
            callback_data: plano.callback_data
          }
        ]))
      }
    }

    // ===============================================
    // RESPOSTA FINAL
    // ===============================================
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      
      fluxo: {
        id: flow.id,
        name: flow.name,
        status: flow.status,
        bot_id: flow.bot_id,
        created_at: flow.created_at,
        updated_at: flow.updated_at
      },

      bot: botInfo ? {
        id: botInfo.id,
        name: botInfo.name,
        username: botInfo.username,
        telegram_link: botInfo.username ? `https://t.me/${botInfo.username}` : null
      } : null,

      downsell: {
        enabled: downsellConfig.enabled || false,
        discount_percent: discountPercent,
        show_price_in_button: showPriceInButton,
        message: message,
        config_raw: downsellConfig
      },

      planos_originais: planosOriginais,
      
      planos_com_desconto: planosComDesconto,

      telegram_payload: telegramPayload,

      resumo: {
        total_planos: planosOriginais.length,
        desconto_aplicado: `${discountPercent}%`,
        fonte_planos: planosOriginais[0]?.fonte || "nenhum",
        bot_vinculado: !!botInfo
      },

      logs,

      instrucoes: {
        como_testar: [
          "1. Copie o 'telegram_payload' acima",
          "2. Substitua 'SUBSTITUIR_PELO_CHAT_ID' pelo chat_id real",
          "3. Envie via API do Telegram usando o token do bot",
          "4. Os botoes vao aparecer com os planos e precos com desconto"
        ],
        parametros: {
          flowId: "Passe ?flowId=UUID para testar outro fluxo"
        }
      }
    })

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log(`ERRO FATAL: ${errorMsg}`)
    return NextResponse.json({
      success: false,
      error: errorMsg,
      logs
    }, { status: 500 })
  }
}

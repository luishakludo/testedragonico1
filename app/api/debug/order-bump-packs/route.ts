import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dnVsb2puZnZnc2JtaHl2cXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTk0NTMsImV4cCI6MjA4ODgzNTQ1M30.Djnn3tsrxSGLBR-Bm1dWOpQe0NHCSOWJFZkbbTOk2oM"

export async function GET() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  try {
    // 1. Buscar todos os bots (para debug - sem auth)
    const { data: bots, error: botsError } = await supabase
      .from("bots")
      .select("id, name, token")
      .limit(10)

    if (botsError) {
      return NextResponse.json({ 
        error: "Erro ao buscar bots",
        details: botsError.message 
      }, { status: 500 })
    }

    if (!bots || bots.length === 0) {
      return NextResponse.json({ 
        error: "Nenhum bot encontrado no sistema"
      }, { status: 404 })
    }

    // Analisar cada bot
    const botsAnalysis = await Promise.all(bots.map(async (bot) => {
      // 2. Buscar flow_bots para encontrar fluxos conectados
      const { data: flowBots, error: flowBotsError } = await supabase
        .from("flow_bots")
        .select("flow_id")
        .eq("bot_id", bot.id)

      // 3. Buscar flows diretamente conectados ao bot
      const { data: directFlows, error: directFlowsError } = await supabase
        .from("flows")
        .select("id, name, config, status")
        .eq("bot_id", bot.id)

      // 4. Buscar flows via flow_bots (separadamente para evitar RLS)
      let flowBotsFlows: { id: string; name: string; config: Record<string, unknown>; status: string }[] = []
      if (flowBots && flowBots.length > 0) {
        for (const fb of flowBots) {
          const { data: flowData } = await supabase
            .from("flows")
            .select("id, name, config, status")
            .eq("id", fb.flow_id)
            .single()
          if (flowData) {
            flowBotsFlows.push(flowData as typeof flowBotsFlows[0])
          }
        }
      }

      // Combinar todos os fluxos (remover duplicados)
      const allFlowsMap = new Map<string, typeof directFlows[0]>()
      for (const f of [...(directFlows || []), ...flowBotsFlows]) {
        if (!allFlowsMap.has(f.id)) {
          allFlowsMap.set(f.id, f)
        }
      }
      const allFlows = Array.from(allFlowsMap.values())
      
      // Filtrar apenas ativos (status pode ser "ativo" ou "active")
      const activeFlows = allFlows.filter(f => f.status === "ativo" || f.status === "active" || !f.status)

      // Analisar cada fluxo
      const flowsAnalysis = allFlows.map(flow => {
        const config = (flow.config || {}) as Record<string, unknown>
        const orderBump = config.orderBump as { enabled?: boolean; packs?: { enabled?: boolean; name?: string; price?: number; description?: string } } | null
        const orderBumpPacks = orderBump?.packs || null

        // NOTA: Cada tipo de order bump (inicial, upsell, downsell, packs) tem seu proprio enabled
        // Nao depende do orderBump.enabled geral - apenas do packs.enabled
        const wouldShow = !!(
          orderBumpPacks?.enabled && 
          orderBumpPacks?.price && 
          orderBumpPacks.price > 0
        )

        let reason = "OK - Order Bump SERA mostrado!"
        if (!orderBump) {
          reason = "orderBump NAO EXISTE no config"
        } else if (!orderBumpPacks) {
          reason = "orderBump.packs NAO EXISTE"
        } else if (!orderBumpPacks.enabled) {
          reason = "orderBump.packs.enabled = false"
        } else if (!orderBumpPacks.price || orderBumpPacks.price <= 0) {
          reason = `orderBump.packs.price = ${orderBumpPacks.price || 0} (precisa ser > 0)`
        }

        return {
          flowId: flow.id,
          flowName: flow.name,
          status: flow.status,
          configKeys: Object.keys(config),
          orderBump: {
            exists: !!orderBump,
            enabled: orderBump?.enabled || false,
            rawValue: orderBump
          },
          orderBumpPacks: {
            exists: !!orderBumpPacks,
            enabled: orderBumpPacks?.enabled || false,
            price: orderBumpPacks?.price || 0,
            name: orderBumpPacks?.name || null,
            rawValue: orderBumpPacks
          },
          RESULTADO: wouldShow ? "VAI MOSTRAR ORDER BUMP" : "NAO VAI MOSTRAR",
          reason
        }
      })

      // Qual fluxo seria usado (primeiro ativo)
      const activeFlow = activeFlows[0] || allFlows[0] || null
      const activeFlowAnalysis = flowsAnalysis.find(f => f.flowId === activeFlow?.id)
      
      return {
        bot: {
          id: bot.id,
          name: bot.name
        },
        resumo: {
          totalFluxos: allFlows.length,
          fluxosAtivos: activeFlows.length,
          fluxoQueSeriaUsado: activeFlow?.name || "NENHUM",
          orderBumpVaiMostrar: activeFlowAnalysis?.RESULTADO || "N/A"
        },
        debug: {
          flowBotsCount: flowBots?.length || 0,
          flowBotsError: flowBotsError?.message || null,
          directFlowsCount: directFlows?.length || 0,
          directFlowsError: directFlowsError?.message || null,
          flowBotsFlowsCount: flowBotsFlows.length
        },
        fluxos: flowsAnalysis
      }
    }))

    return NextResponse.json({
      message: "Debug Order Bump Packs",
      totalBots: bots.length,
      bots: botsAnalysis
    })

  } catch (error) {
    console.error("Debug error:", error)
    return NextResponse.json({ 
      error: "Erro ao processar",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

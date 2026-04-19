import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

// GET /api/test/media-delivery
// Acesse direto no navegador - busca automaticamente um flow com entregavel de MEDIA e mostra os dados
export async function GET() {
  const supabase = getSupabaseAdmin()
  const now = new Date()

  try {
    // Buscar todos os flows
    const { data: allFlows, error: flowsError } = await supabase
      .from("flows")
      .select("id, name, config, bot_id, user_id")
      .not("config", "is", null)
      .limit(50)

    if (flowsError || !allFlows || allFlows.length === 0) {
      return NextResponse.json({
        test_info: {
          description: "Teste de entregavel de MIDIA",
          executed_at: now.toISOString(),
        },
        error: "Nenhum flow encontrado no banco de dados",
        details: flowsError?.message
      }, { status: 404 })
    }

    // Encontrar flow com entregavel media que e o principal
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let targetFlow: any = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mediaDeliverable: any = null

    for (const flow of allFlows) {
      if (flow.config?.deliverables && flow.config?.mainDeliverableId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mainDel = flow.config.deliverables.find((d: any) => d.id === flow.config.mainDeliverableId)
        if (mainDel && mainDel.type === "media") {
          targetFlow = flow
          mediaDeliverable = mainDel
          break
        }
      }
      // Verificar qualquer media deliverable
      if (flow.config?.deliverables) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const media = flow.config.deliverables.find((d: any) => d.type === "media")
        if (media) {
          targetFlow = flow
          mediaDeliverable = media
          break
        }
      }
    }

    // Se nao encontrou com novo sistema, verificar legado
    if (!targetFlow) {
      for (const flow of allFlows) {
        if (flow.config?.delivery?.type === "media" || 
            (flow.config?.delivery?.medias && flow.config.delivery.medias.length > 0)) {
          targetFlow = flow
          mediaDeliverable = {
            type: "media",
            medias: flow.config.delivery.medias || [],
            name: "Entregavel Legado"
          }
          break
        }
      }
    }

    if (!targetFlow) {
      return NextResponse.json({
        test_info: {
          description: "Teste de entregavel de MIDIA",
          executed_at: now.toISOString(),
        },
        error: "Nenhum flow com entregavel de MEDIA encontrado",
        flows_checked: allFlows.length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        flows_summary: allFlows.map((f: any) => ({
          id: f.id,
          name: f.name,
          has_deliverables: !!f.config?.deliverables,
          mainDeliverableId: f.config?.mainDeliverableId || null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          deliverables: f.config?.deliverables?.map((d: any) => ({
            id: d.id,
            name: d.name,
            type: d.type,
            medias_count: d.medias?.length || 0,
            medias: d.medias || []
          })) || [],
          legacy_delivery: f.config?.delivery ? {
            type: f.config.delivery.type,
            medias_count: f.config.delivery.medias?.length || 0
          } : null
        }))
      }, { status: 404 })
    }

    // Buscar o bot vinculado
    let botData = null
    if (targetFlow.bot_id) {
      const { data: bot } = await supabase
        .from("bots")
        .select("id, name, token")
        .eq("id", targetFlow.bot_id)
        .single()
      botData = bot
    }

    return NextResponse.json({
      test_info: {
        description: "Teste de entregavel de MIDIA",
        executed_at: now.toISOString(),
        resultado: "SUCESSO - Flow com entregavel de media encontrado"
      },
      flow: {
        id: targetFlow.id,
        name: targetFlow.name,
        bot_id: targetFlow.bot_id,
        mainDeliverableId: targetFlow.config?.mainDeliverableId || null
      },
      bot: botData ? {
        id: botData.id,
        name: botData.name,
        has_token: !!botData.token
      } : null,
      media_deliverable: {
        id: mediaDeliverable.id,
        name: mediaDeliverable.name,
        type: mediaDeliverable.type,
        medias_count: mediaDeliverable.medias?.length || 0,
        medias: mediaDeliverable.medias || [],
        is_main: targetFlow.config?.mainDeliverableId === mediaDeliverable.id
      },
      all_deliverables: targetFlow.config?.deliverables?.map((d: { id: string; name: string; type: string; medias?: string[] }) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        medias_count: d.medias?.length || 0,
        medias: d.medias || [],
        is_main: targetFlow.config?.mainDeliverableId === d.id
      })) || [],
      raw_config: {
        mainDeliverableId: targetFlow.config?.mainDeliverableId,
        deliverables: targetFlow.config?.deliverables,
        delivery_legacy: targetFlow.config?.delivery
      }
    })

  } catch (e) {
    return NextResponse.json({
      test_info: {
        description: "Teste de entregavel de MIDIA",
        executed_at: now.toISOString(),
      },
      error: "Excecao geral",
      message: e instanceof Error ? e.message : String(e)
    }, { status: 500 })
  }
}

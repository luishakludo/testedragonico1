import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// ---------------------------------------------------------------------------
// SUPABASE DIRETO
// ---------------------------------------------------------------------------
const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dnVsb2puZnZnc2JtaHl2cXRuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI1OTQ1MywiZXhwIjoyMDg4ODM1NDUzfQ.piDbcvfzUQd8orOFUn7vE1cZ5RXMBFXTd8vKqJRA-Hg"

function getDb() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

// ---------------------------------------------------------------------------
// GET /api/test/downsell/fluxo-completo?flowId=xxx
// 
// Testa TUDO do downsell:
// 1. Puxa config do fluxo
// 2. Verifica se downsell esta configurado
// 3. Verifica entregaveis de cada sequencia
// 4. Simula o que acontece quando pagamento aprova
// 5. Verifica se marca venda corretamente
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  const db = getDb()
  const url = new URL(request.url)
  const flowId = url.searchParams.get("flowId") || "206cbb10-efeb-4f59-a153-9c9d420b4e84"
  const agora = new Date()
  const agoraBR = agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })

  const resultado: {
    teste: string
    hora: string
    flow_id: string
    etapas: Array<{
      etapa: number
      nome: string
      status: "OK" | "ERRO" | "AVISO"
      dados: unknown
      problema?: string
    }>
    resumo: {
      total_etapas: number
      etapas_ok: number
      etapas_erro: number
      etapas_aviso: number
      pronto_para_usar: boolean
      problemas_encontrados: string[]
    }
    simulacao_pagamento?: unknown
  } = {
    teste: "DOWNSELL_FLUXO_COMPLETO",
    hora: agoraBR,
    flow_id: flowId,
    etapas: [],
    resumo: {
      total_etapas: 0,
      etapas_ok: 0,
      etapas_erro: 0,
      etapas_aviso: 0,
      pronto_para_usar: false,
      problemas_encontrados: []
    }
  }

  try {
    // =========================================================================
    // ETAPA 1: BUSCAR FLUXO
    // =========================================================================
    const { data: flow, error: flowError } = await db
      .from("flows")
      .select("*")
      .eq("id", flowId)
      .single()

    if (flowError || !flow) {
      resultado.etapas.push({
        etapa: 1,
        nome: "BUSCAR_FLUXO",
        status: "ERRO",
        dados: { flowId },
        problema: flowError?.message || "Fluxo nao encontrado"
      })
      resultado.resumo.problemas_encontrados.push("Fluxo nao existe")
      return NextResponse.json(resultado)
    }

    resultado.etapas.push({
      etapa: 1,
      nome: "BUSCAR_FLUXO",
      status: "OK",
      dados: {
        nome: flow.name,
        status: flow.status,
        bot_id: flow.bot_id
      }
    })

    // =========================================================================
    // ETAPA 2: BUSCAR BOT
    // =========================================================================
    let botId = flow.bot_id
    if (!botId) {
      const { data: flowBot } = await db
        .from("flow_bots")
        .select("bot_id")
        .eq("flow_id", flowId)
        .single()
      botId = flowBot?.bot_id
    }

    const { data: bot } = await db
      .from("bots")
      .select("*")
      .eq("id", botId)
      .single()

    if (!bot || !bot.token) {
      resultado.etapas.push({
        etapa: 2,
        nome: "BUSCAR_BOT",
        status: "ERRO",
        dados: { bot_id: botId },
        problema: !bot ? "Bot nao encontrado" : "Bot sem token"
      })
      resultado.resumo.problemas_encontrados.push("Bot nao configurado corretamente")
    } else {
      resultado.etapas.push({
        etapa: 2,
        nome: "BUSCAR_BOT",
        status: "OK",
        dados: {
          nome: bot.name,
          token: "***" + bot.token.slice(-10)
        }
      })
    }

    // =========================================================================
    // ETAPA 3: VERIFICAR CONFIG DOWNSELL
    // =========================================================================
    const config = flow.config || {}
    const downsellConfig = config.downsell || {}

    if (!downsellConfig.enabled) {
      resultado.etapas.push({
        etapa: 3,
        nome: "VERIFICAR_DOWNSELL_CONFIG",
        status: "AVISO",
        dados: { enabled: false },
        problema: "Downsell esta DESATIVADO"
      })
      resultado.resumo.problemas_encontrados.push("Downsell desativado")
    } else {
      resultado.etapas.push({
        etapa: 3,
        nome: "VERIFICAR_DOWNSELL_CONFIG",
        status: "OK",
        dados: {
          enabled: true,
          useDefaultPlans: downsellConfig.useDefaultPlans || false,
          discountPercentage: downsellConfig.discountPercentage || 0,
          total_sequencias: (downsellConfig.sequences || []).length
        }
      })
    }

    // =========================================================================
    // ETAPA 4: ANALISAR CADA SEQUENCIA
    // =========================================================================
    const sequences = downsellConfig.sequences || []
    const sequenciasAnalisadas: Array<{
      index: number
      id: string
      mensagem_preview: string
      delivery_type: string
      deliverable_id: string | null
      planos: Array<{ texto: string; preco: number }>
      usa_planos_padrao: boolean
      problema?: string
    }> = []

    // Buscar entregaveis do fluxo para validar
    // IMPORTANTE: Os entregaveis ficam salvos em config.deliverables (JSON), NAO em uma tabela separada
    const deliverables = (config.deliverables || []) as Array<{ id: string; name: string; type: string }>

    const deliverableMap = new Map((deliverables || []).map(d => [d.id, d]))

    for (let i = 0; i < sequences.length; i++) {
      const seq = sequences[i]
      const seqAnalise: typeof sequenciasAnalisadas[0] = {
        index: i,
        id: seq.id,
        mensagem_preview: (seq.message || "").substring(0, 60) + ((seq.message || "").length > 60 ? "..." : ""),
        delivery_type: seq.deliveryType || "main",
        deliverable_id: seq.deliverableId || null,
        planos: (seq.plans || []).map((p: { buttonText: string; price: number }) => ({
          texto: p.buttonText,
          preco: p.price
        })),
        usa_planos_padrao: !seq.plans || seq.plans.length === 0
      }

      // Validar entregavel
      if (seq.deliveryType === "custom" && seq.deliverableId) {
        const entregavel = deliverableMap.get(seq.deliverableId)
        if (!entregavel) {
          seqAnalise.problema = `Entregavel ${seq.deliverableId} NAO EXISTE no fluxo`
          resultado.resumo.problemas_encontrados.push(`Sequencia ${i}: Entregavel nao existe`)
        }
      }

      sequenciasAnalisadas.push(seqAnalise)
    }

    resultado.etapas.push({
      etapa: 4,
      nome: "ANALISAR_SEQUENCIAS",
      status: sequenciasAnalisadas.some(s => s.problema) ? "AVISO" : "OK",
      dados: {
        total: sequenciasAnalisadas.length,
        sequencias: sequenciasAnalisadas
      }
    })

    // =========================================================================
    // ETAPA 5: VERIFICAR ENTREGAVEIS DO FLUXO
    // =========================================================================
    resultado.etapas.push({
      etapa: 5,
      nome: "LISTAR_ENTREGAVEIS",
      status: (deliverables || []).length > 0 ? "OK" : "AVISO",
      dados: {
        total: (deliverables || []).length,
        entregaveis: (deliverables || []).map(d => ({
          id: d.id,
          nome: d.name,
          tipo: d.type
        })),
        mainDeliverableId: config.mainDeliverableId || "NAO DEFINIDO",
        config_keys: Object.keys(config),
        // Info para debug: mostrar se tem delivery legado
        delivery_legado: config.delivery ? {
          type: (config.delivery as Record<string, unknown>).type,
          hasLink: !!(config.delivery as Record<string, unknown>).link,
          hasMedias: !!((config.delivery as Record<string, unknown>).medias as unknown[] | undefined)?.length,
          hasVipGroup: !!(config.delivery as Record<string, unknown>).vipGroupId
        } : null
      },
      problema: (deliverables || []).length === 0 ? "Nenhum entregavel configurado - VOCE PRECISA CRIAR UM ENTREGAVEL NA ABA 'ENTREGA' E SELECIONA-LO NA SEQUENCIA DE DOWNSELL" : undefined
    })

    // =========================================================================
    // ETAPA 6: BUSCAR PAGAMENTOS DE DOWNSELL RECENTES
    // =========================================================================
    const { data: pagamentos } = await db
      .from("payments")
      .select("*")
      .eq("product_type", "downsell")
      .order("created_at", { ascending: false })
      .limit(5)

    // Filtrar pagamentos que tem flow relacionado (via bot)
    const pagamentosDoFluxo = (pagamentos || []).filter(p => p.bot_id === botId)

    resultado.etapas.push({
      etapa: 6,
      nome: "PAGAMENTOS_DOWNSELL_RECENTES",
      status: "OK",
      dados: {
        total_geral: (pagamentos || []).length,
        deste_fluxo: pagamentosDoFluxo.length,
        pagamentos: pagamentosDoFluxo.map(p => ({
          id: p.id,
          status: p.status,
          valor: p.amount,
          produto: p.product_name,
          telegram_user: p.telegram_user_id,
          metadata: p.metadata,
          criado_em: p.created_at
        }))
      }
    })

    // =========================================================================
    // ETAPA 6.5: VERIFICAR SCHEDULED_MESSAGES PENDENTES
    // =========================================================================
    const { data: scheduledMsgs } = await db
      .from("scheduled_messages")
      .select("id, telegram_chat_id, message_type, sequence_id, status, metadata, scheduled_for")
      .eq("bot_id", botId)
      .eq("message_type", "downsell")
      .order("created_at", { ascending: false })
      .limit(5)

    resultado.etapas.push({
      etapa: 6.5,
      nome: "SCHEDULED_MESSAGES_DOWNSELL",
      status: (scheduledMsgs || []).length > 0 ? "OK" : "INFO",
      dados: {
        total: (scheduledMsgs || []).length,
        mensagens: (scheduledMsgs || []).map(m => {
          const meta = m.metadata as Record<string, unknown> | null
          return {
            id: m.id,
            chat_id: m.telegram_chat_id,
            sequence_id: m.sequence_id,
            status: m.status,
            scheduled_for: m.scheduled_for,
            // IMPORTANTE: Verificar se deliverableId e deliveryType estao no metadata
            metadata_deliverableId: meta?.deliverableId || "NAO DEFINIDO",
            metadata_deliveryType: meta?.deliveryType || "NAO DEFINIDO",
            metadata_keys: Object.keys(meta || {})
          }
        })
      },
      nota: "Se metadata_deliverableId e metadata_deliveryType estiverem vazios, o pagamento nao vai ter esses dados"
    })

    // =========================================================================
    // ETAPA 7: SIMULACAO COMPLETA - TESTAR EXATAMENTE O QUE O WEBHOOK FARIA
    // =========================================================================
    
    // Simular EXATAMENTE o que o webhook do MercadoPago faria ao receber pagamento aprovado
    const simulacaoCompleta = await Promise.all(sequences.map(async (seq: { id: string; message: string; deliveryType?: string; deliverableId?: string; useDefaultPlans?: boolean; plans?: Array<{ buttonText: string; price: number }> }, i: number) => {
      const deliveryType = seq.deliveryType || "main"
      const deliverableId = seq.deliverableId || null
      
      // SIMULAR: Logica IDENTICA ao webhook do MercadoPago (linhas 1475-1496)
      // Se deliveryType for "main" ou "global", nao passar deliverableId (usar entrega principal)
      const finalDeliverableId = (deliveryType === "main" || deliveryType === "global") ? undefined : deliverableId
      
      // SIMULAR: Validacao - Se o deliverableId nao existe nos deliverables do fluxo, usar entrega principal
      let validatedDeliverableId = finalDeliverableId
      let validacaoResultado = "OK"
      if (finalDeliverableId && deliverables.length > 0) {
        const deliverableExists = deliverables.some(d => d.id === finalDeliverableId)
        if (!deliverableExists) {
          validatedDeliverableId = undefined // Fallback para entrega principal
          validacaoResultado = `FALLBACK - ID ${finalDeliverableId} nao existe, usando principal`
        }
      }
      
      // SIMULAR: Qual entregavel seria usado (logica identica ao sendDelivery linhas 459-485)
      let entregavelFinal: { id: string; name: string; type: string } | null = null
      let fonteEntregavel = ""
      
      if (validatedDeliverableId && deliverables.length > 0) {
        // Buscar entregavel especifico
        entregavelFinal = deliverables.find(d => d.id === validatedDeliverableId) || null
        fonteEntregavel = entregavelFinal 
          ? "ENTREGAVEL_CUSTOMIZADO" 
          : "NAO_ENCONTRADO_VAI_USAR_PRINCIPAL"
      }
      
      if (!entregavelFinal && config.mainDeliverableId && deliverables.length > 0) {
        // Usar entregavel principal
        entregavelFinal = deliverables.find(d => d.id === config.mainDeliverableId) || null
        fonteEntregavel = entregavelFinal 
          ? "ENTREGAVEL_PRINCIPAL" 
          : "PRINCIPAL_NAO_ENCONTRADO_VAI_USAR_LEGADO"
      }
      
      if (!entregavelFinal && config.delivery) {
        // Fallback para sistema legado
        const delivery = config.delivery as { type?: string; link?: string; vipGroupId?: string }
        entregavelFinal = {
          id: "LEGADO",
          name: delivery.type === "vip_group" ? "Grupo VIP (legado)" : "Entrega Legado",
          type: delivery.type || "unknown"
        }
        fonteEntregavel = "SISTEMA_LEGADO"
      }
      
      return {
        sequencia: i + 1,
        sequencia_id: seq.id,
        usa_planos_padrao: seq.useDefaultPlans || false,
        planos: seq.plans?.map(p => `${p.buttonText}: R$ ${p.price}`) || "nenhum",
        config_na_sequencia: {
          deliveryType,
          deliverableId,
        },
        processamento_webhook: {
          passo_1: `deliveryType = "${deliveryType}"`,
          passo_2: `finalDeliverableId = ${finalDeliverableId ? `"${finalDeliverableId}"` : "undefined (usa principal)"}`,
          passo_3_validacao: validacaoResultado,
          passo_4: `validatedDeliverableId = ${validatedDeliverableId ? `"${validatedDeliverableId}"` : "undefined"}`,
        },
        resultado_final: {
          entregavel_usado: entregavelFinal ? `${entregavelFinal.name} (${entregavelFinal.type})` : "NENHUM - ERRO!",
          entregavel_id: entregavelFinal?.id || "NENHUM",
          fonte: fonteEntregavel,
          eh_diferente_do_principal: entregavelFinal?.id !== config.mainDeliverableId,
        },
        veredicto: entregavelFinal 
          ? (fonteEntregavel === "ENTREGAVEL_CUSTOMIZADO" 
              ? "OK - DOWNSELL VAI ENTREGAR ENTREGAVEL CUSTOMIZADO"
              : "AVISO - VAI USAR ENTREGAVEL PRINCIPAL")
          : "ERRO - NAO VAI ENTREGAR NADA"
      }
    }))

    resultado.simulacao_pagamento = simulacaoCompleta

    const todosComCustomizado = simulacaoCompleta.every(s => s.resultado_final.fonte === "ENTREGAVEL_CUSTOMIZADO")
    const algumSemEntregavel = simulacaoCompleta.some(s => s.resultado_final.entregavel_id === "NENHUM")

    resultado.etapas.push({
      etapa: 7,
      nome: "SIMULACAO_WEBHOOK_COMPLETA",
      status: algumSemEntregavel ? "ERRO" : (todosComCustomizado ? "OK" : "AVISO"),
      dados: {
        titulo: "SIMULACAO REAL - EXATAMENTE O QUE O WEBHOOK FARIA",
        total_sequencias: simulacaoCompleta.length,
        usando_entregavel_customizado: simulacaoCompleta.filter(s => s.resultado_final.fonte === "ENTREGAVEL_CUSTOMIZADO").length,
        usando_principal: simulacaoCompleta.filter(s => s.resultado_final.fonte === "ENTREGAVEL_PRINCIPAL").length,
        sem_entregavel: simulacaoCompleta.filter(s => s.resultado_final.entregavel_id === "NENHUM").length,
        detalhes: simulacaoCompleta
      },
      problema: algumSemEntregavel 
        ? "CRITICO: Algumas sequencias nao tem entregavel configurado!" 
        : (!todosComCustomizado ? "Algumas sequencias usam entrega principal ao inves de customizada" : undefined)
    })

    // =========================================================================
    // ETAPA 8: TESTE COM SCHEDULED_MESSAGE REAL
    // =========================================================================
    // Usar uma scheduled_message real para simular o fluxo completo
    const { data: scheduledMsgReal } = await db
      .from("scheduled_messages")
      .select("*")
      .eq("bot_id", botId)
      .eq("message_type", "downsell")
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (scheduledMsgReal) {
      const msgMeta = scheduledMsgReal.metadata as Record<string, unknown> | null
      const deliverableIdFromMsg = (msgMeta?.deliverableId as string) || ""
      const deliveryTypeFromMsg = (msgMeta?.deliveryType as string) || "main"
      
      // Simular EXATAMENTE o que o callback faria (linhas 2531-2540 do telegram webhook)
      const dsDeliverableIdFromMeta = deliverableIdFromMsg
      const dsDeliveryTypeFromMeta = deliveryTypeFromMsg
      
      // Simular EXATAMENTE o que o webhook do MP faria (linhas 1475-1496)
      const finalDeliverableId = (dsDeliveryTypeFromMeta === "main" || dsDeliveryTypeFromMeta === "global") 
        ? undefined 
        : dsDeliverableIdFromMeta
      
      let validatedDeliverableId = finalDeliverableId
      let validacaoResultado = "OK"
      if (finalDeliverableId && deliverables.length > 0) {
        const deliverableExists = deliverables.some(d => d.id === finalDeliverableId)
        if (!deliverableExists) {
          validatedDeliverableId = undefined
          validacaoResultado = `FALLBACK - ID ${finalDeliverableId} nao existe nos deliverables`
        }
      }
      
      // Determinar qual entregavel seria usado
      let entregavelFinal: { id: string; name: string; type: string } | null = null
      let fonteEntregavel = ""
      
      if (validatedDeliverableId) {
        entregavelFinal = deliverables.find(d => d.id === validatedDeliverableId) || null
        fonteEntregavel = entregavelFinal ? "ENTREGAVEL_CUSTOMIZADO_DO_DOWNSELL" : "NAO_ENCONTRADO"
      }
      
      if (!entregavelFinal && config.mainDeliverableId) {
        entregavelFinal = deliverables.find(d => d.id === config.mainDeliverableId) || null
        fonteEntregavel = entregavelFinal ? "ENTREGAVEL_PRINCIPAL_DO_FLUXO" : "PRINCIPAL_NAO_ENCONTRADO"
      }
      
      if (!entregavelFinal && config.delivery) {
        const delivery = config.delivery as { type?: string }
        entregavelFinal = { id: "LEGADO", name: "Sistema Legado", type: delivery.type || "unknown" }
        fonteEntregavel = "SISTEMA_LEGADO"
      }
      
      const ehCustomizado = fonteEntregavel === "ENTREGAVEL_CUSTOMIZADO_DO_DOWNSELL"
      
      resultado.etapas.push({
        etapa: 8,
        nome: "TESTE_SCHEDULED_MESSAGE_REAL",
        status: ehCustomizado ? "OK" : "AVISO",
        dados: {
          titulo: "SIMULACAO USANDO SCHEDULED_MESSAGE REAL",
          scheduled_message_id: scheduledMsgReal.id,
          scheduled_for: scheduledMsgReal.scheduled_for,
          metadata_da_msg: {
            deliverableId: deliverableIdFromMsg || "NAO DEFINIDO",
            deliveryType: deliveryTypeFromMsg,
            todas_keys: Object.keys(msgMeta || {})
          },
          processamento_callback: {
            dsDeliverableIdFromMeta,
            dsDeliveryTypeFromMeta,
          },
          processamento_webhook_mp: {
            finalDeliverableId: finalDeliverableId || "undefined (usa principal)",
            validacao: validacaoResultado,
            validatedDeliverableId: validatedDeliverableId || "undefined",
          },
          resultado_entrega: {
            entregavel: entregavelFinal ? `${entregavelFinal.name} (${entregavelFinal.type})` : "NENHUM",
            entregavel_id: entregavelFinal?.id || "NENHUM",
            fonte: fonteEntregavel,
            eh_entregavel_customizado_do_downsell: ehCustomizado,
            eh_diferente_do_principal: entregavelFinal?.id !== config.mainDeliverableId
          },
          veredicto: ehCustomizado 
            ? "SUCESSO - DOWNSELL VAI ENTREGAR O ENTREGAVEL CORRETO (CUSTOMIZADO)"
            : entregavelFinal 
              ? "AVISO - DOWNSELL VAI ENTREGAR O ENTREGAVEL PRINCIPAL (NAO O CUSTOMIZADO)"
              : "ERRO - DOWNSELL NAO VAI ENTREGAR NADA"
        },
        problema: !ehCustomizado 
          ? "O downsell nao esta usando entregavel customizado! Verifique se a sequencia tem deliverableId configurado." 
          : undefined
      })
    } else {
      resultado.etapas.push({
        etapa: 8,
        nome: "TESTE_SCHEDULED_MESSAGE_REAL",
        status: "AVISO",
        dados: { mensagem: "Nenhuma scheduled_message de downsell encontrada para testar" }
      })
    }

    // =========================================================================
    // ETAPA 9/10: VERIFICAR MENSAGENS AGENDADAS
    // =========================================================================
    const { data: agendadas } = await db
      .from("scheduled_messages")
      .select("*")
      .eq("message_type", "downsell")
      .eq("status", "pending")
      .order("scheduled_for", { ascending: true })
      .limit(10)

    // Ver quais tem o deliverableId no metadata
    const agendadasComEntregavel = (agendadas || []).filter(a => {
      const meta = a.metadata || {}
      return meta.deliverableId && meta.deliverableId !== ""
    })

    resultado.etapas.push({
      etapa: 8,
      nome: "MENSAGENS_AGENDADAS",
      status: "OK",
      dados: {
        total_pendentes: (agendadas || []).length,
        com_deliverable_id_no_metadata: agendadasComEntregavel.length,
        mensagens: (agendadas || []).map(a => ({
          id: a.id,
          sequence_index: a.sequence_index,
          agendado_para: a.scheduled_for,
          metadata_deliverableId: (a.metadata || {}).deliverableId || "NAO DEFINIDO",
          metadata_deliveryType: (a.metadata || {}).deliveryType || "NAO DEFINIDO"
        }))
      }
    })

    // =========================================================================
    // ETAPA 9: DIAGNOSTICO - COMPARAR SCHEDULED_MESSAGE COM PAGAMENTO
    // =========================================================================
    // Encontrar um pagamento recente e a scheduled_message correspondente
    const ultimoPagamentoDs = pagamentosDoFluxo.find(p => p.status === "approved" || p.status === "pending")
    
    if (ultimoPagamentoDs) {
      const pagMeta = (ultimoPagamentoDs.metadata || {}) as Record<string, string>
      
      // Tentar encontrar a scheduled_message que pode ter gerado este pagamento
      // Buscar pelo sequence_index se existir
      const seqIndex = pagMeta.sequence_index ? parseInt(pagMeta.sequence_index, 10) : 0
      const seqConfig = sequences[seqIndex] as { id: string; deliveryType?: string; deliverableId?: string } | undefined
      
      resultado.etapas.push({
        etapa: 9,
        nome: "DIAGNOSTICO_PAGAMENTO_VS_SEQUENCIA",
        status: pagMeta.downsell_deliverable_id ? "OK" : "PROBLEMA",
        dados: {
          titulo: "COMPARACAO: O QUE O PAGAMENTO TEM vs O QUE A SEQUENCIA TEM",
          pagamento: {
            id: ultimoPagamentoDs.id,
            status: ultimoPagamentoDs.status,
            valor: ultimoPagamentoDs.amount,
            sequence_index_do_metadata: pagMeta.sequence_index || "NAO TEM",
            downsell_deliverable_id: pagMeta.downsell_deliverable_id || "NAO TEM <<<< PROBLEMA!",
            downsell_delivery_type: pagMeta.downsell_delivery_type || "NAO TEM",
            metadata_completo: pagMeta
          },
          sequencia_correspondente: seqConfig ? {
            id: seqConfig.id,
            deliveryType: seqConfig.deliveryType || "NAO CONFIGURADO",
            deliverableId: seqConfig.deliverableId || "NAO CONFIGURADO",
          } : "SEQUENCIA NAO ENCONTRADA",
          analise: {
            pagamento_tem_deliverable_id: !!pagMeta.downsell_deliverable_id,
            sequencia_tem_deliverable_id: !!seqConfig?.deliverableId,
            ids_sao_iguais: pagMeta.downsell_deliverable_id === seqConfig?.deliverableId,
            problema_detectado: !pagMeta.downsell_deliverable_id 
              ? "PAGAMENTO NAO TEM downsell_deliverable_id - O CALLBACK NAO SALVOU!" 
              : (pagMeta.downsell_deliverable_id !== seqConfig?.deliverableId)
                ? "IDs SAO DIFERENTES - VERIFICAR PORQUE"
                : "OK - IDs SAO IGUAIS"
          },
          solucao_se_problema: !pagMeta.downsell_deliverable_id 
            ? "O callback do Telegram (ds_buy) nao esta passando o deliverableId para o pagamento. Verificar dsDeliverableIdFromMeta no callback."
            : undefined
        }
      })
    }

    // =========================================================================
    // ETAPA 10: VERIFICAR O QUE A FUNCAO sendDelivery FARIA
    // =========================================================================
    // Simular EXATAMENTE a logica da funcao sendDelivery para este fluxo
    const mainDeliverableId = config.mainDeliverableId as string | undefined
    const mainDeliverable = mainDeliverableId 
      ? deliverables.find(d => d.id === mainDeliverableId)
      : null
    
    resultado.etapas.push({
      etapa: 10,
      nome: "LOGICA_SEND_DELIVERY",
      status: "INFO",
      dados: {
        titulo: "O QUE A FUNCAO sendDelivery FAZ",
        mainDeliverableId: mainDeliverableId || "NAO DEFINIDO",
        mainDeliverable: mainDeliverable ? `${mainDeliverable.name} (${mainDeliverable.type})` : "NAO ENCONTRADO",
        total_deliverables_no_fluxo: deliverables.length,
        tem_delivery_legado: !!config.delivery,
        fluxo_da_funcao: [
          "1. Se receber deliverableId especifico, busca esse deliverable",
          "2. Se NAO encontrar ou NAO receber, usa mainDeliverableId",
          "3. Se NAO tiver mainDeliverableId, usa sistema legado (config.delivery)",
          `4. NO SEU CASO: mainDeliverableId = ${mainDeliverableId || "NAO DEFINIDO"}`,
          `5. NO SEU CASO: mainDeliverable = ${mainDeliverable?.name || "NAO ENCONTRADO"} (tipo: ${mainDeliverable?.type || "?"})`,
        ],
        conclusao: mainDeliverable?.type === "vip_group" || mainDeliverable?.type === "channel"
          ? "O ENTREGAVEL PRINCIPAL E UM CANAL/GRUPO - POR ISSO APARECE 'ENTRAR NO CANAL' QUANDO O DOWNSELL NAO TEM deliverableId"
          : "OK"
      }
    })

    // =========================================================================
    // RESUMO FINAL
    // =========================================================================
    resultado.resumo.total_etapas = resultado.etapas.length
    resultado.resumo.etapas_ok = resultado.etapas.filter(e => e.status === "OK").length
    resultado.resumo.etapas_erro = resultado.etapas.filter(e => e.status === "ERRO").length
    resultado.resumo.etapas_aviso = resultado.etapas.filter(e => e.status === "AVISO").length
    resultado.resumo.pronto_para_usar = resultado.resumo.etapas_erro === 0

    return NextResponse.json(resultado)

  } catch (err) {
    return NextResponse.json({
      erro: true,
      mensagem: err instanceof Error ? err.message : "Erro desconhecido",
      stack: err instanceof Error ? err.stack : null
    }, { status: 500 })
  }
}

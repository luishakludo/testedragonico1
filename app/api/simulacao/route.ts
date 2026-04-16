import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

/**
 * API de Simulacao Completa
 * 
 * Endpoint: GET /api/simulacao
 * 
 * Retorna dados REAIS de producao sobre:
 * - Todos os bots cadastrados
 * - Todos os fluxos e seus planos
 * - Order Bumps configurados (inicial, packs, upsell, downsell)
 * - Estados de usuarios
 * - Pagamentos recentes
 * - Diagnosticos de configuracao
 * 
 * Query params opcionais:
 * - bot_id: Filtrar por bot especifico
 * - flow_id: Filtrar por fluxo especifico
 * - telegram_user_id: Ver estado e pagamentos de um usuario
 * - action: Simular uma acao especifica (ver_planos, select_plan, etc)
 * - plan_id: ID do plano para simulacao
 * - include_logs: Incluir logs de debug (default: false)
 */
export async function GET(request: NextRequest) {
  const supabase = getSupabase()
  const searchParams = request.nextUrl.searchParams
  
  const botId = searchParams.get("bot_id")
  const flowId = searchParams.get("flow_id")
  const telegramUserId = searchParams.get("telegram_user_id")
  const action = searchParams.get("action")
  const planId = searchParams.get("plan_id")
  const includeLogs = searchParams.get("include_logs") === "true"

  const result: Record<string, unknown> = {
    titulo: "API de Simulacao - Dados Reais de Producao",
    timestamp: new Date().toISOString(),
    versao: "2.0",
    endpoints_disponiveis: {
      listar_tudo: "/api/simulacao",
      filtrar_por_bot: "/api/simulacao?bot_id=UUID",
      filtrar_por_flow: "/api/simulacao?flow_id=UUID",
      ver_usuario: "/api/simulacao?telegram_user_id=123456789",
      simular_ver_planos: "/api/simulacao?flow_id=UUID&action=ver_planos",
      simular_selecao_plano: "/api/simulacao?flow_id=UUID&action=select_plan&plan_id=UUID",
      simular_order_bump: "/api/simulacao?flow_id=UUID&action=order_bump_accept&plan_id=UUID",
      incluir_logs: "/api/simulacao?include_logs=true"
    }
  }

  try {
    // ===============================================
    // SECAO 1: BOTS
    // ===============================================
    const botsQuery = supabase
      .from("bots")
      .select("id, name, username, telegram_bot_id, token, status, user_id, created_at")
      .order("created_at", { ascending: false })
    
    if (botId) {
      botsQuery.eq("id", botId)
    }
    
    const { data: bots, error: botsError } = await botsQuery.limit(50)
    
    if (botsError) {
      return NextResponse.json({
        ...result,
        erro: "Erro ao buscar bots",
        detalhes: botsError.message
      }, { status: 500 })
    }

    // ===============================================
    // SECAO 2: FLOWS E VINCULOS
    // ===============================================
    const flowsQuery = supabase
      .from("flows")
      .select("id, name, config, status, bot_id, user_id, created_at, updated_at")
      .order("updated_at", { ascending: false })
    
    if (flowId) {
      flowsQuery.eq("id", flowId)
    }
    
    const { data: flows, error: flowsError } = await flowsQuery.limit(50)
    
    // Buscar vinculos flow_bots
    const { data: flowBots } = await supabase
      .from("flow_bots")
      .select("id, flow_id, bot_id")

    // ===============================================
    // SECAO 3: PLANOS (da tabela flow_plans)
    // ===============================================
    const plansQuery = supabase
      .from("flow_plans")
      .select("*")
      .order("position", { ascending: true })
    
    if (flowId) {
      plansQuery.eq("flow_id", flowId)
    }
    
    const { data: dbPlans } = await plansQuery

    // ===============================================
    // SECAO 4: PROCESSAR CADA FLUXO COM DETALHES
    // ===============================================
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flowsDetalhados = flows?.map((flow: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config = (flow.config || {}) as Record<string, any>
      
      // Planos do config
      const configPlans = config.plans || []
      
      // Planos do banco para este flow
      const flowPlansFromDb = dbPlans?.filter(p => p.flow_id === flow.id) || []
      
      // Usar planos do banco se existirem, senao do config
      const planosFinais = flowPlansFromDb.length > 0 
        ? flowPlansFromDb.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            description: p.description,
            is_active: p.is_active,
            position: p.position,
            fonte: "database (flow_plans)"
          }))
        : configPlans.map((p: { id: string; name: string; price: number; description?: string }) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            description: p.description,
            is_active: true,
            position: 0,
            fonte: "config JSON"
          }))
      
      // Order Bump Config
      const orderBump = config.orderBump || {}
      const orderBumpInicial = orderBump.inicial || null
      const orderBumpPacks = orderBump.packs || null
      const orderBumpUpsell = config.upsell || null
      const orderBumpDownsell = config.downsell || null
      
      // Packs Config
      const packs = config.packs || {}
      const packsEnabled = packs.enabled
      const packsList = (packs.list || []).filter((p: { active?: boolean }) => p.active !== false)
      
      // Delivery Config
      const delivery = config.delivery || null
      const deliverables = config.deliverables || []
      const mainDeliverableId = config.mainDeliverableId
      
      // Encontrar bot vinculado
      const botVinculoDireto = flow.bot_id
      const botVinculoFlowBots = flowBots?.find(fb => fb.flow_id === flow.id)?.bot_id
      const botVinculado = botVinculoDireto || botVinculoFlowBots
      const botInfo = bots?.find(b => b.id === botVinculado)
      
      return {
        flow_id: flow.id,
        flow_name: flow.name,
        flow_status: flow.status,
        atualizado_em: flow.updated_at,
        
        // Vinculo com Bot
        vinculo_bot: {
          tem_vinculo: !!botVinculado,
          bot_id: botVinculado || null,
          bot_name: botInfo?.name || null,
          bot_username: botInfo?.username || null,
          tipo_vinculo: botVinculoDireto ? "direto (flow.bot_id)" : botVinculoFlowBots ? "indireto (flow_bots)" : "NENHUM"
        },
        
        // Planos
        planos: {
          total: planosFinais.length,
          fonte: flowPlansFromDb.length > 0 ? "database" : "config",
          lista: planosFinais.map(p => ({
            ...p,
            // Simular botao que seria mostrado no Telegram
            telegram_button: {
              text: p.name,
              callback_data: `plan_${p.id}`
            }
          }))
        },
        
        // Order Bumps
        order_bumps: {
          // Order Bump Inicial (mostrado apos selecionar plano)
          inicial: orderBumpInicial ? {
            enabled: orderBumpInicial.enabled,
            name: orderBumpInicial.name,
            price: orderBumpInicial.price,
            description: orderBumpInicial.description,
            acceptText: orderBumpInicial.acceptText || "ADICIONAR",
            rejectText: orderBumpInicial.rejectText || "NAO QUERO",
            medias: orderBumpInicial.medias || [],
            RESULTADO: orderBumpInicial.enabled && orderBumpInicial.price > 0 
              ? "VAI MOSTRAR ORDER BUMP" 
              : "NAO VAI MOSTRAR",
            motivo: !orderBumpInicial.enabled 
              ? "enabled = false" 
              : orderBumpInicial.price <= 0 
                ? "price <= 0" 
                : "OK",
            // Simular callbacks que seriam gerados
            simulacao_callbacks: planosFinais.length > 0 ? {
              exemplo_plano: planosFinais[0].name,
              preco_plano: planosFinais[0].price,
              preco_bump: orderBumpInicial.price,
              callback_aceitar: `ob_accept_${Math.round(planosFinais[0].price * 100)}_${Math.round(orderBumpInicial.price * 100)}`,
              callback_recusar: `ob_decline_${Math.round(planosFinais[0].price * 100)}_0`,
              total_se_aceitar: planosFinais[0].price + orderBumpInicial.price,
              total_se_recusar: planosFinais[0].price
            } : null
          } : {
            enabled: false,
            RESULTADO: "NAO CONFIGURADO"
          },
          
          // Order Bump de Packs
          packs: orderBumpPacks ? {
            enabled: orderBumpPacks.enabled,
            name: orderBumpPacks.name,
            price: orderBumpPacks.price,
            description: orderBumpPacks.description,
            acceptText: orderBumpPacks.acceptText || "ADICIONAR",
            rejectText: orderBumpPacks.rejectText || "NAO QUERO",
            medias: orderBumpPacks.medias || [],
            RESULTADO: orderBumpPacks.enabled && orderBumpPacks.price > 0 
              ? "VAI MOSTRAR ORDER BUMP PARA PACKS" 
              : "NAO VAI MOSTRAR"
          } : {
            enabled: false,
            RESULTADO: "NAO CONFIGURADO"
          },
          
          // Upsell
          upsell: orderBumpUpsell ? {
            enabled: orderBumpUpsell.enabled,
            sequences: orderBumpUpsell.sequences || [],
            total_upsells: (orderBumpUpsell.sequences || []).length
          } : {
            enabled: false,
            RESULTADO: "NAO CONFIGURADO"
          },
          
          // Downsell
          downsell: orderBumpDownsell ? {
            enabled: orderBumpDownsell.enabled,
            name: orderBumpDownsell.name,
            price: orderBumpDownsell.price
          } : {
            enabled: false,
            RESULTADO: "NAO CONFIGURADO"
          }
        },
        
        // Packs
        packs: {
          enabled: packsEnabled,
          buttonText: packs.buttonText || "Packs Disponiveis",
          total: packsList.length,
          lista: packsList.map((p: { id: string; name: string; price: number; emoji?: string; description?: string; previewMedias?: string[] }) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            emoji: p.emoji,
            description: p.description,
            previewMedias: p.previewMedias || [],
            telegram_button: {
              text: `${p.emoji || ""} ${p.name} - R$ ${p.price.toFixed(2).replace(".", ",")}`,
              callback_data: `buy_pack_${p.id}_${p.price}`
            }
          }))
        },
        
        // Entrega
        entrega: {
          delivery_legado: delivery,
          deliverables_novos: deliverables,
          mainDeliverableId: mainDeliverableId,
          total_entregaveis: deliverables.length
        },
        
        // Config completa (para debug)
        config_keys: Object.keys(config)
      }
    }) || []

    // ===============================================
    // SECAO 5: ESTADOS DE USUARIOS (se telegram_user_id fornecido)
    // ===============================================
    let userStates = null
    let userPayments = null
    
    if (telegramUserId) {
      const statesQuery = supabase
        .from("user_flow_state")
        .select("*")
        .eq("telegram_user_id", telegramUserId)
        .order("updated_at", { ascending: false })
        .limit(10)
      
      if (botId) {
        statesQuery.eq("bot_id", botId)
      }
      
      const { data: states } = await statesQuery
      userStates = states
      
      // Pagamentos do usuario
      const paymentsQuery = supabase
        .from("payments")
        .select("id, amount, status, product_type, product_name, description, created_at, external_payment_id")
        .eq("telegram_user_id", telegramUserId)
        .order("created_at", { ascending: false })
        .limit(20)
      
      if (botId) {
        paymentsQuery.eq("bot_id", botId)
      }
      
      const { data: payments } = await paymentsQuery
      userPayments = payments
    }

    // ===============================================
    // SECAO 6: SIMULACAO DE ACOES
    // ===============================================
    let simulacaoAcao = null
    
    if (action && flowId) {
      const flowParaSimular = flowsDetalhados.find(f => f.flow_id === flowId)
      
      if (!flowParaSimular) {
        simulacaoAcao = { erro: "Flow nao encontrado para simulacao" }
      } else {
        switch (action) {
          case "ver_planos": {
            // Simular callback "ver_planos"
            const planos = flowParaSimular.planos.lista
            simulacaoAcao = {
              acao: "ver_planos",
              descricao: "Usuario clicou em Ver Planos",
              resposta_bot: {
                tipo: "MESSAGE_WITH_BUTTONS",
                texto: "Escolha seu plano:",
                botoes: planos.map(p => ({
                  text: p.name,
                  callback_data: `plan_${p.id}`
                }))
              },
              proximo_passo: "Clicar em um plano ira disparar o callback plan_{id}"
            }
            break
          }
          
          case "select_plan": {
            // Simular selecao de plano
            const plano = flowParaSimular.planos.lista.find(p => p.id === planId)
            const orderBumpInicial = flowParaSimular.order_bumps.inicial
            
            if (!plano) {
              simulacaoAcao = { erro: "Plano nao encontrado", planId }
            } else {
              const temOrderBump = orderBumpInicial.enabled && orderBumpInicial.price > 0
              
              simulacaoAcao = {
                acao: "select_plan",
                descricao: `Usuario selecionou plano: ${plano.name}`,
                plano_selecionado: plano,
                order_bump_sera_mostrado: temOrderBump,
                fluxo_esperado: temOrderBump ? [
                  {
                    passo: 1,
                    tipo: "SALVAR_ESTADO",
                    descricao: "Salvar estado do usuario com metadata do order bump",
                    dados: {
                      status: "waiting_order_bump",
                      metadata: {
                        main_amount: plano.price,
                        order_bump_name: orderBumpInicial.name,
                        order_bump_price: orderBumpInicial.price,
                        main_description: plano.name
                      }
                    }
                  },
                  {
                    passo: 2,
                    tipo: "ENVIAR_MEDIAS",
                    descricao: "Enviar midias do order bump (se houver)",
                    medias: orderBumpInicial.medias || []
                  },
                  {
                    passo: 3,
                    tipo: "ENVIAR_MENSAGEM",
                    texto: orderBumpInicial.description || `Deseja adicionar ${orderBumpInicial.name} por apenas R$ ${orderBumpInicial.price}?`,
                    botoes: [
                      { text: orderBumpInicial.acceptText, callback_data: orderBumpInicial.simulacao_callbacks?.callback_aceitar },
                      { text: orderBumpInicial.rejectText, callback_data: orderBumpInicial.simulacao_callbacks?.callback_recusar }
                    ]
                  }
                ] : [
                  {
                    passo: 1,
                    tipo: "GERAR_PIX",
                    descricao: "Gerar pagamento PIX direto (sem order bump)",
                    valor: plano.price
                  }
                ]
              }
            }
            break
          }
          
          case "order_bump_accept": {
            // Simular aceite do order bump
            const plano = flowParaSimular.planos.lista.find(p => p.id === planId)
            const orderBumpInicial = flowParaSimular.order_bumps.inicial
            
            if (!plano || !orderBumpInicial.enabled) {
              simulacaoAcao = { erro: "Plano ou order bump nao encontrado" }
            } else {
              const totalComBump = plano.price + orderBumpInicial.price
              
              simulacaoAcao = {
                acao: "order_bump_accept",
                descricao: "Usuario aceitou o order bump",
                callback_recebido: orderBumpInicial.simulacao_callbacks?.callback_aceitar,
                calculo: {
                  preco_plano: plano.price,
                  preco_order_bump: orderBumpInicial.price,
                  total_final: totalComBump
                },
                fluxo_esperado: [
                  {
                    passo: 1,
                    tipo: "ATUALIZAR_ESTADO",
                    descricao: "Atualizar estado para payment_pending"
                  },
                  {
                    passo: 2,
                    tipo: "ENVIAR_MENSAGEM",
                    texto: `Otimo! Gerando pagamento PIX...\n\nValor: R$ ${totalComBump.toFixed(2).replace(".", ",")}`
                  },
                  {
                    passo: 3,
                    tipo: "GERAR_PIX",
                    descricao: "Chamar API do Mercado Pago para gerar PIX",
                    valor: totalComBump,
                    descricao_pagamento: `${plano.name} + ${orderBumpInicial.name}`
                  },
                  {
                    passo: 4,
                    tipo: "ENVIAR_QR_CODE",
                    descricao: "Enviar foto do QR Code"
                  },
                  {
                    passo: 5,
                    tipo: "ENVIAR_CODIGO_PIX",
                    descricao: "Enviar codigo copia-cola do PIX"
                  },
                  {
                    passo: 6,
                    tipo: "SALVAR_PAGAMENTO",
                    descricao: "Salvar pagamento no banco com status pending"
                  }
                ]
              }
            }
            break
          }
          
          case "order_bump_decline": {
            // Simular recusa do order bump
            const plano = flowParaSimular.planos.lista.find(p => p.id === planId)
            const orderBumpInicial = flowParaSimular.order_bumps.inicial
            
            if (!plano) {
              simulacaoAcao = { erro: "Plano nao encontrado" }
            } else {
              simulacaoAcao = {
                acao: "order_bump_decline",
                descricao: "Usuario recusou o order bump",
                callback_recebido: orderBumpInicial.simulacao_callbacks?.callback_recusar,
                calculo: {
                  preco_plano: plano.price,
                  preco_order_bump: 0,
                  total_final: plano.price
                },
                fluxo_esperado: [
                  {
                    passo: 1,
                    tipo: "GERAR_PIX",
                    descricao: "Gerar pagamento PIX apenas do plano",
                    valor: plano.price,
                    descricao_pagamento: plano.name
                  }
                ]
              }
            }
            break
          }
          
          default:
            simulacaoAcao = {
              erro: "Acao desconhecida",
              acoes_disponiveis: ["ver_planos", "select_plan", "order_bump_accept", "order_bump_decline"]
            }
        }
      }
    }

    // ===============================================
    // SECAO 7: DIAGNOSTICOS
    // ===============================================
    const diagnosticos = {
      total_bots: bots?.length || 0,
      total_flows: flows?.length || 0,
      total_planos_db: dbPlans?.length || 0,
      total_vinculos_flow_bots: flowBots?.length || 0,
      
      flows_sem_vinculo: flowsDetalhados.filter(f => !f.vinculo_bot.tem_vinculo).map(f => ({
        flow_id: f.flow_id,
        flow_name: f.flow_name,
        problema: "Flow nao esta vinculado a nenhum bot!"
      })),
      
      flows_com_order_bump_ativo: flowsDetalhados.filter(f => 
        f.order_bumps.inicial.enabled && f.order_bumps.inicial.price > 0
      ).map(f => ({
        flow_id: f.flow_id,
        flow_name: f.flow_name,
        order_bump_name: f.order_bumps.inicial.name,
        order_bump_price: f.order_bumps.inicial.price
      })),
      
      flows_com_packs: flowsDetalhados.filter(f => f.packs.enabled && f.packs.total > 0).map(f => ({
        flow_id: f.flow_id,
        flow_name: f.flow_name,
        total_packs: f.packs.total
      }))
    }

    // ===============================================
    // SECAO 8: LOGS (se solicitado)
    // ===============================================
    let logs = null
    if (includeLogs) {
      // Buscar logs recentes do debug_logs se existir
      const { data: recentLogs } = await supabase
        .from("debug_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50)
      
      logs = recentLogs
    }

    // ===============================================
    // RESPOSTA FINAL
    // ===============================================
    return NextResponse.json({
      ...result,
      
      // Resumo
      resumo: {
        total_bots: bots?.length || 0,
        total_flows: flowsDetalhados.length,
        filtros_aplicados: {
          bot_id: botId || null,
          flow_id: flowId || null,
          telegram_user_id: telegramUserId || null,
          action: action || null
        }
      },
      
      // Dados completos
      bots: bots?.map(b => ({
        id: b.id,
        name: b.name,
        username: b.username,
        telegram_bot_id: b.telegram_bot_id,
        status: b.status,
        // Encontrar flows vinculados
        flows_vinculados: flowsDetalhados.filter(f => f.vinculo_bot.bot_id === b.id).map(f => ({
          flow_id: f.flow_id,
          flow_name: f.flow_name
        }))
      })),
      
      flows: flowsDetalhados,
      
      // Dados do usuario (se solicitado)
      usuario: telegramUserId ? {
        telegram_user_id: telegramUserId,
        estados: userStates,
        pagamentos: userPayments
      } : null,
      
      // Simulacao de acao (se solicitado)
      simulacao: simulacaoAcao,
      
      // Diagnosticos
      diagnosticos,
      
      // Logs (se solicitado)
      logs: includeLogs ? logs : undefined,
      
      // Dicas de debug
      dicas: {
        se_order_bump_nao_aparece: [
          "Verifique se orderBump.inicial.enabled = true no config do flow",
          "Verifique se orderBump.inicial.price > 0",
          "Verifique se o flow esta vinculado a um bot",
          "Use /api/simulacao?flow_id=XXX para ver detalhes do flow"
        ],
        se_planos_nao_aparecem: [
          "Verifique se existem planos na tabela flow_plans para este flow",
          "Ou verifique se existem planos no config.plans do flow"
        ],
        para_debugar_usuario: [
          "Use /api/simulacao?telegram_user_id=XXX para ver estado e pagamentos",
          "Verifique se o estado tem status=waiting_order_bump apos selecionar plano"
        ]
      }
    })

  } catch (error) {
    console.error("[simulacao] Erro:", error)
    return NextResponse.json({
      ...result,
      erro: "Erro interno",
      detalhes: error instanceof Error ? error.message : "Erro desconhecido"
    }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

/**
 * API de Fluxo Especifico
 * 
 * Endpoint: GET /api/fluxo/{flowId}
 * 
 * Retorna dados COMPLETOS e ATUAIS do fluxo especifico:
 * - Informacoes do fluxo
 * - Planos disponiveis (fonte: database ou config)
 * - Order Bumps configurados (inicial, packs, upsell, downsell)
 * - Packs disponiveis
 * - Vinculo com bot
 * - Simulacao de callbacks do Telegram
 * 
 * Exemplo: /api/fluxo/56a5b1f3-2b54-4f8f-b9ec-77a2acc491f3
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ flowId: string }> }
) {
  const { flowId } = await params
  const supabase = getSupabase()

  if (!flowId) {
    return NextResponse.json({
      erro: "Flow ID e obrigatorio",
      exemplo: "/api/fluxo/56a5b1f3-2b54-4f8f-b9ec-77a2acc491f3"
    }, { status: 400 })
  }

  try {
    // ===============================================
    // BUSCAR FLUXO
    // ===============================================
    const { data: flow, error: flowError } = await supabase
      .from("flows")
      .select("id, name, config, status, bot_id, user_id, created_at, updated_at")
      .eq("id", flowId)
      .single()

    if (flowError || !flow) {
      return NextResponse.json({
        erro: "Fluxo nao encontrado",
        flow_id: flowId,
        detalhes: flowError?.message || "Flow inexistente"
      }, { status: 404 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = (flow.config || {}) as Record<string, any>
    
    // DEBUG: Ver exatamente o que esta no banco
    console.log("[API /api/fluxo] Config RAW do banco:", JSON.stringify(config, null, 2))

    // ===============================================
    // BUSCAR PLANOS DO BANCO (flow_plans)
    // ===============================================
    const { data: dbPlans } = await supabase
      .from("flow_plans")
      .select("*")
      .eq("flow_id", flowId)
      .eq("is_active", true)
      .order("position", { ascending: true })

    // Planos do config (fallback)
    const configPlans = config.plans || []

    // Usar planos do banco se existirem, senao do config
    // IMPORTANTE: Incluir order_bumps de cada plano!
    const planosFinais = (dbPlans && dbPlans.length > 0)
      ? dbPlans.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          description: p.description,
          is_active: p.is_active,
          position: p.position,
          fonte: "database (flow_plans)",
          created_at: p.created_at,
          // ORDER BUMPS ESPECIFICOS DO PLANO (do banco)
          order_bumps: p.order_bumps || []
        }))
      : configPlans.map((p: { id: string; name: string; price: number; description?: string; order_bumps?: Array<{ id: string; name: string; price: number; enabled?: boolean; description?: string; acceptText?: string; rejectText?: string }> }, index: number) => ({
          id: p.id || `config_plan_${index}`,
          name: p.name,
          price: p.price,
          description: p.description || null,
          is_active: true,
          position: index,
          fonte: "config JSON",
          // ORDER BUMPS ESPECIFICOS DO PLANO (do config)
          order_bumps: p.order_bumps || []
        }))

    // ===============================================
    // BUSCAR BOT VINCULADO
    // ===============================================
    let botInfo = null
    let tipoVinculo = "NENHUM"
    let debugBotSearch = {
      flow_bot_id_raw: flow.bot_id,
      flow_bot_id_type: typeof flow.bot_id,
      flow_bot_id_truthy: !!flow.bot_id,
      busca_direta: null as string | null,
      busca_flow_bots: null as string | null,
      bot_encontrado: false
    }

    // Verificar vinculo direto (flow.bot_id)
    // IMPORTANTE: Verificar se bot_id existe e nao e string vazia
    const temBotIdValido = flow.bot_id && flow.bot_id.trim && flow.bot_id.trim() !== ""
    
    if (temBotIdValido) {
      debugBotSearch.busca_direta = `Buscando bot com id: ${flow.bot_id}`
      
      const { data: bot, error: botError } = await supabase
        .from("bots")
        .select("id, name, username, telegram_bot_id, status, token")
        .eq("id", flow.bot_id)
        .single()
      
      if (botError) {
        debugBotSearch.busca_direta = `ERRO: ${botError.message}`
      } else if (bot) {
        debugBotSearch.busca_direta = `ENCONTRADO: ${bot.name}`
        debugBotSearch.bot_encontrado = true
        
        // Validar bot no Telegram para pegar username atualizado
        let telegramUsername = bot.username
        if (bot.token) {
          try {
            const telegramRes = await fetch(`https://api.telegram.org/bot${bot.token}/getMe`)
            const telegramData = await telegramRes.json()
            if (telegramData.ok) {
              telegramUsername = telegramData.result.username
            }
          } catch {
            // Manter username do banco
          }
        }
        
        botInfo = {
          id: bot.id,
          name: bot.name,
          username: telegramUsername,
          telegram_bot_id: bot.telegram_bot_id,
          status: bot.status
        }
        tipoVinculo = "direto (flow.bot_id)"
      } else {
        debugBotSearch.busca_direta = `Bot com id ${flow.bot_id} NAO existe na tabela bots`
      }
    } else {
      debugBotSearch.busca_direta = `flow.bot_id esta vazio ou nulo: "${flow.bot_id}"`
    }

    // Se nao tem vinculo direto, verificar flow_bots
    if (!botInfo) {
      const { data: flowBot, error: flowBotError } = await supabase
        .from("flow_bots")
        .select("bot_id")
        .eq("flow_id", flowId)
        .limit(1)
        .single()

      if (flowBotError) {
        debugBotSearch.busca_flow_bots = `Nenhum registro em flow_bots: ${flowBotError.message}`
      } else if (flowBot?.bot_id) {
        debugBotSearch.busca_flow_bots = `Encontrado em flow_bots: ${flowBot.bot_id}`
        
        const { data: bot } = await supabase
          .from("bots")
          .select("id, name, username, telegram_bot_id, status, token")
          .eq("id", flowBot.bot_id)
          .single()

        if (bot) {
          debugBotSearch.bot_encontrado = true
          
          // Validar bot no Telegram
          let telegramUsername = bot.username
          if (bot.token) {
            try {
              const telegramRes = await fetch(`https://api.telegram.org/bot${bot.token}/getMe`)
              const telegramData = await telegramRes.json()
              if (telegramData.ok) {
                telegramUsername = telegramData.result.username
              }
            } catch {
              // Manter username do banco
            }
          }
          
          botInfo = {
            id: bot.id,
            name: bot.name,
            username: telegramUsername,
            telegram_bot_id: bot.telegram_bot_id,
            status: bot.status
          }
          tipoVinculo = "indireto (flow_bots)"
        }
      }
    }

    // ===============================================
    // PROCESSAR ORDER BUMPS
    // ===============================================
    const orderBump = config.orderBump || {}
    
    // Order Bump Inicial pode estar em diferentes lugares:
    // 1. config.orderBump.inicial (nova estrutura)
    // 2. config.orderBump direto com enabled/name/price (estrutura intermediaria)
    // 3. dentro de cada plano (estrutura legada)
    
    let orderBumpInicial = orderBump.inicial || null
    
    // Se nao tem inicial mas tem dados no orderBump raiz, usar esses
    if (!orderBumpInicial && (orderBump.enabled !== undefined || orderBump.name || orderBump.price > 0)) {
      orderBumpInicial = {
        enabled: orderBump.enabled || false,
        name: orderBump.name || "",
        price: orderBump.price || 0,
        description: orderBump.description || "",
        acceptText: orderBump.acceptText || "ADICIONAR",
        rejectText: orderBump.rejectText || "NAO QUERO",
        medias: orderBump.medias || []
      }
    }
    
    const orderBumpPacks = orderBump.packs || null
    const upsell = config.upsell || null
    const downsell = config.downsell || null

    // Calcular callbacks simulados para cada plano
    const planosComCallbacks = planosFinais.map(plano => {
      const planoPriceCents = Math.round(plano.price * 100)
      const bumpPriceCents = orderBumpInicial?.price ? Math.round(orderBumpInicial.price * 100) : 0
      
      // ORDER BUMPS DO PLANO (prioridade sobre global!)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const planOrderBumps = (plano.order_bumps || []) as Array<any>
      const activePlanOrderBumps = planOrderBumps.filter((ob: { enabled?: boolean; price?: number }) => 
        ob.enabled && ob.price && ob.price > 0
      )
      
      // LOGICA DE PRIORIDADE:
      // 1. Se plano tem order_bumps proprios -> usar eles
      // 2. Se nao tem -> usar order bump global (se ativo)
      const usarOrderBumpsDoPlano = activePlanOrderBumps.length > 0
      const usarOrderBumpGlobal = !usarOrderBumpsDoPlano && orderBumpInicial?.enabled && orderBumpInicial?.price > 0

      return {
        ...plano,
        
        // MOSTRAR ORDER BUMPS DO PLANO
        order_bumps_do_plano: {
          total_configurados: planOrderBumps.length,
          total_ativos: activePlanOrderBumps.length,
          lista: activePlanOrderBumps.map((ob: { id: string; name: string; price: number; description?: string; acceptText?: string; rejectText?: string }, idx: number) => {
            const bumpPriceCentsLocal = Math.round(ob.price * 100)
            return {
              id: ob.id || `bump_${idx}`,
              name: ob.name,
              price: ob.price,
              description: ob.description,
              acceptText: ob.acceptText || "ADICIONAR",
              rejectText: ob.rejectText || "NAO QUERO",
              telegram_callbacks: {
                aceitar: `ob_multi_${planoPriceCents}_${bumpPriceCentsLocal}_${idx}`,
                recusar: `ob_decline_${planoPriceCents}_0`
              }
            }
          }),
          vai_usar: usarOrderBumpsDoPlano,
          motivo: usarOrderBumpsDoPlano 
            ? `PLANO TEM ${activePlanOrderBumps.length} ORDER BUMP(S) PROPRIO(S) - VAI MOSTRAR!` 
            : "Plano nao tem order bumps proprios"
        },
        
        telegram: {
          botao_selecionar: {
            text: plano.name,
            callback_data: `plan_${plano.id}`
          },
          
          // Order Bump que SERA MOSTRADO (prioridade: plano > global)
          order_bump_que_sera_mostrado: usarOrderBumpsDoPlano 
            ? {
                fonte: "PLAN_SPECIFIC",
                total: activePlanOrderBumps.length,
                bumps: activePlanOrderBumps.map((ob: { name: string; price: number }, idx: number) => ({
                  name: ob.name,
                  price: ob.price,
                  callback_aceitar: `ob_multi_${planoPriceCents}_${Math.round(ob.price * 100)}_${idx}`,
                  callback_recusar: `ob_decline_${planoPriceCents}_0`
                }))
              }
            : usarOrderBumpGlobal 
              ? {
                  fonte: "GLOBAL_CONFIG",
                  total: 1,
                  bumps: [{
                    name: orderBumpInicial?.name,
                    price: orderBumpInicial?.price,
                    callback_aceitar: `ob_accept_${planoPriceCents}_${bumpPriceCents}`,
                    callback_recusar: `ob_decline_${planoPriceCents}_0`
                  }]
                }
              : null,
          
          // Se tiver order bump GLOBAL (fallback quando plano nao tem)
          order_bump_global_callbacks: usarOrderBumpGlobal ? {
            aceitar: {
              callback_data: `ob_accept_${planoPriceCents}_${bumpPriceCents}`,
              valor_total: plano.price + (orderBumpInicial?.price || 0),
              descricao: `${plano.name} + ${orderBumpInicial?.name}`
            },
            recusar: {
              callback_data: `ob_decline_${planoPriceCents}_0`,
              valor_total: plano.price,
              descricao: plano.name
            }
          } : null
        }
      }
    })

    // ===============================================
    // PROCESSAR ORDER BUMP INICIAL
    // ===============================================
    
    // Verificar se o order bump esta realmente ativo
    const obInicialEnabled = orderBumpInicial?.enabled === true
    const obInicialPrice = orderBumpInicial?.price || 0
    const obInicialVaiMostrar = obInicialEnabled && obInicialPrice > 0
    
    const orderBumpInicialProcessado = {
      // Dados RAW (como esta salvo)
      raw_config: orderBump,
      raw_inicial: orderBumpInicial,
      
      // Dados processados
      configurado: !!orderBumpInicial,
      enabled: obInicialEnabled,
      name: orderBumpInicial?.name || "",
      price: obInicialPrice,
      description: orderBumpInicial?.description || "",
      acceptText: orderBumpInicial?.acceptText || "ADICIONAR",
      rejectText: orderBumpInicial?.rejectText || "NAO QUERO",
      medias: orderBumpInicial?.medias || [],
      
      // Analise detalhada
      analise: {
        vai_mostrar: obInicialVaiMostrar,
        checklist: {
          "1_tem_orderBump_no_config": !!orderBump && Object.keys(orderBump).length > 0,
          "2_tem_inicial": !!orderBumpInicial,
          "3_enabled_true": obInicialEnabled,
          "4_price_maior_que_zero": obInicialPrice > 0,
          "5_tem_nome": !!(orderBumpInicial?.name),
        },
        motivo: !orderBumpInicial 
          ? "PROBLEMA: orderBump.inicial nao existe no config"
          : !obInicialEnabled 
            ? "PROBLEMA: Order Bump desabilitado (enabled = false). Va em /fluxos/{id} e ative o Order Bump."
            : obInicialPrice <= 0 
              ? "PROBLEMA: Preco invalido (price <= 0). Configure um preco maior que zero."
              : !orderBumpInicial?.name
                ? "AVISO: Nome nao configurado, mas vai funcionar."
                : "OK: Order Bump configurado corretamente! Sera exibido apos selecao de plano."
      },
      
      // Exemplo de como vai aparecer
      exemplo_mensagem: obInicialVaiMostrar ? {
        texto: orderBumpInicial?.description || `Aproveite! Adicione ${orderBumpInicial?.name} por apenas R$ ${obInicialPrice.toFixed(2).replace(".", ",")}!`,
        botoes: [
          { text: orderBumpInicial?.acceptText || "ADICIONAR", callback_data: "ob_accept_{plan_price}_{bump_price}" },
          { text: orderBumpInicial?.rejectText || "NAO QUERO", callback_data: "ob_decline_{plan_price}_0" }
        ]
      } : null,
      
      // INSTRUCOES PARA CORRIGIR
      como_ativar: !obInicialVaiMostrar ? {
        passo_1: "Acesse /fluxos/" + flowId,
        passo_2: "Va na aba 'Order Bump'",
        passo_3: "Ative o switch 'Habilitar Order Bump'",
        passo_4: "Configure nome, preco e descricao",
        passo_5: "Clique em 'Salvar Alteracoes'"
      } : null
    }

    // ===============================================
    // PROCESSAR ORDER BUMP PACKS
    // ===============================================
    const orderBumpPacksProcessado = orderBumpPacks ? {
      configurado: true,
      enabled: orderBumpPacks.enabled,
      name: orderBumpPacks.name,
      price: orderBumpPacks.price,
      description: orderBumpPacks.description,
      acceptText: orderBumpPacks.acceptText || "ADICIONAR",
      rejectText: orderBumpPacks.rejectText || "NAO QUERO",
      medias: orderBumpPacks.medias || [],
      analise: {
        vai_mostrar: orderBumpPacks.enabled && orderBumpPacks.price > 0,
        motivo: !orderBumpPacks.enabled 
          ? "Order Bump Packs desabilitado" 
          : !orderBumpPacks.price || orderBumpPacks.price <= 0 
            ? "Preco invalido" 
            : "Configuracao OK - Sera exibido apos selecao de pack"
      }
    } : {
      configurado: false,
      enabled: false,
      analise: {
        vai_mostrar: false,
        motivo: "Order Bump Packs nao configurado"
      }
    }

    // ===============================================
    // PROCESSAR PACKS
    // ===============================================
    const packs = config.packs || {}
    const packsEnabled = packs.enabled === true
    const packsList = (packs.list || []).filter((p: { active?: boolean }) => p.active !== false)

    const packsProcessados = {
      enabled: packsEnabled,
      buttonText: packs.buttonText || "Ver Packs",
      total: packsList.length,
      lista: packsList.map((pack: { id: string; name: string; price: number; emoji?: string; description?: string; previewMedias?: string[] }) => {
        const packPriceCents = Math.round(pack.price * 100)
        const bumpPacksPriceCents = orderBumpPacks?.price ? Math.round(orderBumpPacks.price * 100) : 0

        return {
          id: pack.id,
          name: pack.name,
          price: pack.price,
          emoji: pack.emoji,
          description: pack.description,
          previewMedias: pack.previewMedias || [],
          telegram: {
            botao_comprar: {
              text: `${pack.emoji || ""} ${pack.name} - R$ ${pack.price.toFixed(2).replace(".", ",")}`,
              callback_data: `buy_pack_${pack.id}_${pack.price}`
            },
            order_bump_callbacks: orderBumpPacks?.enabled && orderBumpPacks?.price > 0 ? {
              aceitar: {
                callback_data: `ob_pack_accept_${packPriceCents}_${bumpPacksPriceCents}`,
                valor_total: pack.price + orderBumpPacks.price
              },
              recusar: {
                callback_data: `ob_pack_decline_${packPriceCents}_0`,
                valor_total: pack.price
              }
            } : null
          }
        }
      })
    }

    // ===============================================
    // PROCESSAR UPSELL/DOWNSELL
    // ===============================================
    const upsellProcessado = upsell ? {
      configurado: true,
      enabled: upsell.enabled,
      sequences: (upsell.sequences || []).map((seq: { id: string; name: string; price: number; triggerAfterMinutes?: number }) => ({
        id: seq.id,
        name: seq.name,
        price: seq.price,
        triggerAfterMinutes: seq.triggerAfterMinutes
      })),
      total_sequences: (upsell.sequences || []).length
    } : {
      configurado: false,
      enabled: false
    }

    const downsellProcessado = downsell ? {
      configurado: true,
      enabled: downsell.enabled,
      name: downsell.name,
      price: downsell.price,
      description: downsell.description
    } : {
      configurado: false,
      enabled: false
    }

    // ===============================================
    // MONTAR RESPOSTA FINAL
    // ===============================================
    const response = {
      titulo: "Dados Completos do Fluxo",
      timestamp: new Date().toISOString(),
      
      // Informacoes do fluxo
      fluxo: {
        id: flow.id,
        name: flow.name,
        status: flow.status || "active",
        created_at: flow.created_at,
        updated_at: flow.updated_at
      },

      // Vinculo com bot
      bot: {
        vinculado: !!botInfo,
        tipo_vinculo: tipoVinculo,
        
        // DEBUG: Mostra exatamente o que foi buscado
        debug: debugBotSearch,
        
        dados: botInfo ? {
          id: botInfo.id,
          name: botInfo.name,
          username: botInfo.username,
          telegram_bot_id: botInfo.telegram_bot_id,
          status: botInfo.status,
          telegram_link: botInfo.username ? `https://t.me/${botInfo.username}` : null
        } : null,
        
        // PROBLEMA CRITICO SE NAO TIVER BOT
        problema: !botInfo ? {
          titulo: "FLUXO SEM BOT VINCULADO!",
          descricao: "Este fluxo NAO esta vinculado a nenhum bot do Telegram. Os callbacks do Order Bump NAO vao funcionar porque nao ha bot para processar as mensagens.",
          impacto: [
            "Order Bump nao vai aparecer para usuarios",
            "Callbacks como ob_accept, ob_decline nao serao processados",
            "Fluxo de venda esta incompleto"
          ],
          causa_provavel: debugBotSearch.flow_bot_id_raw 
            ? `O fluxo tem bot_id="${debugBotSearch.flow_bot_id_raw}" mas o bot NAO foi encontrado na tabela bots. Verifique se o UUID esta correto.`
            : "O campo bot_id esta NULO ou VAZIO na tabela flows. Voce precisa vincular um bot a este fluxo."
        } : null,
        
        // COMO RESOLVER
        como_vincular: !botInfo ? {
          opcao_1_api: {
            titulo: "Via API (Recomendado)",
            passo_1: `GET /api/fluxo/${flowId}/vincular-bot para ver bots disponiveis`,
            passo_2: `POST /api/fluxo/${flowId}/vincular-bot com body: { "bot_id": "UUID_DO_BOT" }`,
            passo_3: `GET /api/fluxo/${flowId} para verificar se vinculou`
          },
          opcao_2_interface: {
            titulo: "Via Interface",
            passo_1: "Acesse /fluxos/" + flowId,
            passo_2: "Na aba 'Configuracoes' ou 'Bot', selecione um bot",
            passo_3: "Clique em Salvar"
          },
          opcao_3_criar_bot: {
            titulo: "Se nao tem bot ainda",
            passo_1: "Acesse /bots e crie um novo bot",
            passo_2: "Fale com @BotFather no Telegram para criar o token",
            passo_3: "Cadastre o bot na plataforma",
            passo_4: "Volte e vincule ao fluxo"
          }
        } : null,
        
        // Endpoint direto para vincular
        endpoint_vincular: `/api/fluxo/${flowId}/vincular-bot`
      },

      // Planos
      planos: {
        fonte: (dbPlans && dbPlans.length > 0) ? "database (flow_plans)" : "config JSON",
        total: planosComCallbacks.length,
        lista: planosComCallbacks
      },

      // Order Bumps
      order_bumps: {
        inicial: orderBumpInicialProcessado,
        packs: orderBumpPacksProcessado,
        upsell: upsellProcessado,
        downsell: downsellProcessado,
        // Resumo rapido
        resumo: {
          order_bump_inicial_ativo: orderBumpInicialProcessado.analise?.vai_mostrar || false,
          order_bump_packs_ativo: orderBumpPacksProcessado.analise?.vai_mostrar || false,
          upsell_ativo: upsellProcessado.enabled || false,
          downsell_ativo: downsellProcessado.enabled || false
        }
      },

      // Packs
      packs: packsProcessados,

      // Entrega
      entrega: {
        delivery_legado: config.delivery || null,
        deliverables: config.deliverables || [],
        mainDeliverableId: config.mainDeliverableId || null
      },

      // Fluxo completo simulado (como o bot se comportara)
      simulacao_fluxo: (() => {
        // Verificar se algum plano tem order bumps ativos
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const algumPlanoTemBumps = planosComCallbacks.some((p: any) => 
          p.order_bumps_do_plano?.total_ativos > 0
        )
        const temOrderBumpGlobal = obInicialVaiMostrar
        const temAlgumOrderBump = algumPlanoTemBumps || temOrderBumpGlobal
        const fonteOrderBump = algumPlanoTemBumps ? "PLANO" : (temOrderBumpGlobal ? "GLOBAL" : "NENHUM")
        
        return {
          passo_1_inicio: {
            descricao: "Usuario envia /start ou mensagem inicial",
            acao: "Bot mostra mensagem de boas vindas"
          },
          passo_2_ver_planos: {
            descricao: "Usuario clica em Ver Planos",
            callback: "ver_planos",
            resposta: {
              tipo: "MESSAGE_WITH_INLINE_KEYBOARD",
              botoes: planosComCallbacks.map(p => ({
                text: p.name,
                callback_data: p.telegram.botao_selecionar.callback_data
              }))
            }
          },
          passo_3_selecionar_plano: {
            descricao: "Usuario seleciona um plano",
            
            // CORRECAO: Verificar AMBAS as fontes de order bump (plano E global)
            order_bump_existe: temAlgumOrderBump,
            order_bump_fonte: fonteOrderBump,
            order_bump_sera_mostrado: temAlgumOrderBump, // TRUE se existe, independente do bot
            order_bump_vai_funcionar: temAlgumOrderBump && !!botInfo, // FALSE se nao tem bot
            
            // ALERTA se tem order bump mas nao tem bot
            alerta: (temAlgumOrderBump && !botInfo) ? {
              tipo: "ERRO_CRITICO",
              mensagem: "TEM ORDER BUMP CONFIGURADO, MAS NAO TEM BOT VINCULADO!",
              explicacao: "O order bump existe e esta ativo, mas sem bot vinculado os callbacks nao serao processados.",
              impacto: "Usuario vai selecionar plano mas o order bump NAO vai aparecer porque nao ha bot para mostrar.",
              solucao: "Vincule um bot a este fluxo ANTES de testar."
            } : null,
            
            se_order_bump_ativo: temAlgumOrderBump ? {
              passo: "3a - Mostrar Order Bump",
              fonte: fonteOrderBump,
              vai_funcionar: !!botInfo,
              mensagem: fonteOrderBump === "PLANO" 
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ? `Order bump do plano selecionado (${planosComCallbacks.filter((p: any) => p.order_bumps_do_plano?.total_ativos > 0).length} planos tem bumps)`
                : orderBumpInicialProcessado.exemplo_mensagem
            } : {
              passo: "3a - Gerar PIX direto",
              descricao: "Sem order bump configurado, vai direto para pagamento"
            }
          },
          passo_4_pagamento: {
            descricao: "Gerar PIX e aguardar pagamento",
            acao: "Bot envia QR Code e codigo copia-cola"
          },
          passo_5_confirmacao: {
            descricao: "Webhook do Mercado Pago confirma pagamento",
            acao: "Bot envia mensagem de sucesso e deliverables"
          }
        }
      })(),

      // Debug info
      debug: {
        config_keys: Object.keys(config),
        total_planos_config: configPlans.length,
        total_planos_db: dbPlans?.length || 0,
        // CONFIG COMPLETO SALVO NO BANCO (para debug)
        CONFIG_RAW_DO_BANCO: config
      },
      
      // ===============================================
      // DIAGNOSTICO RAPIDO
      // ===============================================
      // IMPORTANTE: Order bumps podem vir de 3 fontes:
      // 1. Plan-level order bumps (plans[].order_bumps[]) - MAIOR PRIORIDADE
      // 2. Order bump global (config.orderBump.inicial) - FALLBACK
      // 3. Nenhum - vai direto para pagamento
      diagnostico: (() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const algumPlanoTemOrderBumps = planosComCallbacks.some((p: any) => 
          p.order_bumps_do_plano?.total_ativos > 0
        )
        const orderBumpVaiFuncionar = !!botInfo && (algumPlanoTemOrderBumps || obInicialVaiMostrar)
        const temAlgumOrderBump = algumPlanoTemOrderBumps || obInicialVaiMostrar
        
        return {
          status_geral: (!!botInfo && temAlgumOrderBump) ? "OK" : "PROBLEMAS_DETECTADOS",
          problemas: [
            ...(!botInfo ? ["FLUXO_SEM_BOT: Este fluxo nao esta vinculado a nenhum bot. Vincule um bot primeiro."] : []),
            ...(!temAlgumOrderBump ? ["ORDER_BUMP_INATIVO: Nenhum order bump configurado (nem global, nem nos planos)."] : []),
          ],
          checklist: {
            "fluxo_existe": true,
            "fluxo_ativo": flow.status === "active" || flow.status === "ativo" || !flow.status,
            "tem_planos": planosComCallbacks.length > 0,
            "bot_vinculado": !!botInfo,
            "order_bump_global_enabled": obInicialEnabled,
            "order_bump_global_price_ok": obInicialPrice > 0,
            "algum_plano_tem_order_bumps": algumPlanoTemOrderBumps,
            "tem_algum_order_bump_ativo": temAlgumOrderBump,
            "order_bump_vai_funcionar": orderBumpVaiFuncionar
          },
          order_bump_info: {
            fonte_principal: algumPlanoTemOrderBumps ? "PLAN_LEVEL" : (obInicialVaiMostrar ? "GLOBAL" : "NENHUM"),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            planos_com_bumps: planosComCallbacks
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .filter((p: any) => p.order_bumps_do_plano?.total_ativos > 0)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((p: any) => ({
                plano: p.name,
                total_bumps: p.order_bumps_do_plano.total_ativos
              })),
            global_ativo: obInicialVaiMostrar
          },
          proximos_passos: [
            ...(!botInfo ? ["1. Vincular um bot: Acesse /bots e vincule este fluxo"] : []),
            ...(!temAlgumOrderBump ? ["2. Adicionar Order Bumps: Configure order bumps nos planos ou ative o global"] : []),
            ...(!!botInfo && temAlgumOrderBump ? ["Tudo OK! Teste o bot no Telegram."] : [])
          ]
        }
      })()
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error("[API /api/fluxo] Erro:", error)
    return NextResponse.json({
      erro: "Erro interno ao processar fluxo",
      detalhes: error instanceof Error ? error.message : "Erro desconhecido"
    }, { status: 500 })
  }
}

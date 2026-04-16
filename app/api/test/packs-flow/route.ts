import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// Simula o fluxo completo de Packs
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const botId = searchParams.get("botId")
  const action = searchParams.get("action") || "show_packs"
  const packId = searchParams.get("packId")

  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    action,
    botId,
    steps: []
  }

  try {
    // STEP 1: Buscar o bot
    if (!botId) {
      // Listar TODOS os bots disponiveis para o usuario escolher
      const { data: allBots, error: botError } = await supabase
        .from("bots")
        .select("id, name, user_id, created_at")
        .order("created_at", { ascending: false })

      if (botError || !allBots || allBots.length === 0) {
        return NextResponse.json({
          error: "Nenhum bot encontrado",
          details: botError?.message
        }, { status: 404 })
      }

      // Retorna lista de bots para o usuario escolher
      return NextResponse.json({
        message: "Passe o botId na URL para testar um bot especifico",
        exemplo: `/api/test/packs-flow?botId=SEU_BOT_ID`,
        botsDisponiveis: allBots.map(b => ({
          id: b.id,
          name: b.name,
          user_id: b.user_id,
          url_teste: `/api/test/packs-flow?botId=${b.id}`
        })),
        totalBots: allBots.length
      })
    } else {
      // Buscar o bot especifico
      const { data: bot, error: botError } = await supabase
        .from("bots")
        .select("id, name, user_id")
        .eq("id", botId)
        .single()
      
      if (botError || !bot) {
        return NextResponse.json({
          error: "Bot nao encontrado com esse ID",
          botId,
          details: botError?.message
        }, { status: 404 })
      }
      
      results.bot = { id: bot.id, name: bot.name, user_id: bot.user_id }
      results.botId = botId
      ;(results.steps as string[]).push("STEP 1: Bot encontrado - " + bot.name + " (user: " + bot.user_id + ")")
    }

    // STEP 2: Buscar flows vinculados via flow_bots (relacao many-to-many)
    const { data: flowBots, error: flowBotsError } = await supabase
      .from("flow_bots")
      .select(`
        flow_id,
        flows:flow_id (
          id,
          name,
          status,
          config,
          created_at
        )
      `)
      .eq("bot_id", results.botId)
    
    results.flowBotsRaw = flowBots
    results.flowBotsError = flowBotsError?.message
    ;(results.steps as string[]).push(`STEP 2: Encontrados ${flowBots?.length || 0} vinculos flow_bots para este bot`)
    
    // Extrair flows dos vinculos
    const allFlows = flowBots?.map((fb: any) => fb.flows).filter(Boolean) || []
    results.allFlowsForBot = allFlows.map((f: any) => ({ id: f.id, name: f.name, status: f.status }))
    ;(results.steps as string[]).push(`STEP 2b: ${allFlows.length} flows encontrados`)
    
    // Buscar flow ativo
    const activeFlow = allFlows.find((f: any) => f.status === "ativo")

    if (!activeFlow) {
      return NextResponse.json({
        error: "Nenhum flow ativo encontrado para este bot",
        details: flowBotsError?.message,
        botId: results.botId,
        allFlowsForBot: allFlows.map((f: any) => ({ id: f.id, name: f.name, status: f.status })),
        message: "Voce tem flows vinculados mas nenhum esta com status='ativo'. Verifique a lista acima e ative um flow.",
        steps: results.steps
      }, { status: 404 })
    }
    
    const flow = activeFlow

    results.flow = { id: flow.id, name: flow.name }
    ;(results.steps as string[]).push("STEP 2: Flow ativo encontrado - " + flow.name)

    // STEP 3: Verificar config de packs
    const flowConfig = (flow.config as Record<string, unknown>) || {}
    results.fullConfig = flowConfig
    ;(results.steps as string[]).push("STEP 3: Config do flow carregado")

    // STEP 4: Extrair packs config
    const packsConfig = flowConfig.packs as { 
      enabled?: boolean
      buttonText?: string
      list?: Array<{ 
        id: string
        name: string
        emoji?: string
        price: number
        description?: string
        previewMedias?: string[]
        buttonText?: string
        active?: boolean 
      }> 
    } | undefined

    results.packsConfig = packsConfig
    ;(results.steps as string[]).push("STEP 4: Packs config extraido")

    if (!packsConfig) {
      return NextResponse.json({
        error: "Packs NAO configurado no flow",
        message: "O campo 'packs' nao existe no config do flow. Voce precisa habilitar e salvar Packs na pagina de edicao do fluxo.",
        flowConfig,
        steps: results.steps
      }, { status: 400 })
    }

    if (!packsConfig.enabled) {
      return NextResponse.json({
        error: "Packs esta DESABILITADO",
        message: "O campo 'packs.enabled' esta false. Voce precisa habilitar Packs na pagina de edicao do fluxo.",
        packsConfig,
        steps: results.steps
      }, { status: 400 })
    }

    ;(results.steps as string[]).push("STEP 5: Packs esta HABILITADO")

    // STEP 6: Verificar lista de packs
    const packsList = packsConfig.list || []
    const activePacksList = packsList.filter(p => p.active !== false)

    results.packsListTotal = packsList.length
    results.packsListActive = activePacksList.length
    results.packsList = activePacksList
    ;(results.steps as string[]).push(`STEP 6: ${activePacksList.length} packs ativos de ${packsList.length} total`)

    if (activePacksList.length === 0) {
      return NextResponse.json({
        error: "Nenhum pack ativo",
        message: "Voce tem packs configurados mas nenhum esta ativo. Verifique se os packs estao com 'active: true'.",
        packsList,
        steps: results.steps
      }, { status: 400 })
    }

    // SIMULAR ACAO
    if (action === "show_packs") {
      // Simula o que seria enviado quando clica em "Packs Disponiveis"
      const packButtons = activePacksList.map(pack => [{
        text: `${pack.emoji || "📦"} ${pack.name} - R$ ${pack.price.toFixed(2).replace(".", ",")}`,
        callback_data: `pack_${pack.id}`
      }])

      packButtons.push([{
        text: "Voltar aos Planos",
        callback_data: "back_to_plans"
      }])

      results.simulatedResponse = {
        message: "Escolha um pack:",
        inline_keyboard: packButtons
      }
      ;(results.steps as string[]).push("SIMULACAO: Botoes de packs gerados com sucesso!")
    }

    if (action === "select_pack" && packId) {
      // Simula selecao de um pack especifico
      const selectedPack = activePacksList.find(p => p.id === packId)

      if (!selectedPack) {
        return NextResponse.json({
          error: "Pack nao encontrado",
          packId,
          availablePacks: activePacksList.map(p => ({ id: p.id, name: p.name })),
          steps: results.steps
        }, { status: 404 })
      }

      results.selectedPack = selectedPack

      // Simula o que seria enviado
      const description = selectedPack.description || `Pack ${selectedPack.name}`
      const priceText = `R$ ${selectedPack.price.toFixed(2).replace(".", ",")}`
      const buttonText = selectedPack.buttonText || "Comprar Pack"

      results.simulatedResponse = {
        medias: selectedPack.previewMedias || [],
        message: `${selectedPack.emoji || "📦"} <b>${selectedPack.name}</b>\n\n${description}\n\n<b>Valor:</b> ${priceText}`,
        inline_keyboard: [
          [{ text: buttonText, callback_data: `buy_pack_${selectedPack.id}_${selectedPack.price}` }],
          [{ text: "Voltar aos Packs", callback_data: "show_packs" }]
        ]
      }
      ;(results.steps as string[]).push("SIMULACAO: Pack selecionado e resposta gerada!")
    }

    if (action === "buy_pack" && packId) {
      // Simula compra de pack
      const selectedPack = activePacksList.find(p => p.id === packId)

      if (!selectedPack) {
        return NextResponse.json({
          error: "Pack nao encontrado para compra",
          packId,
          steps: results.steps
        }, { status: 404 })
      }

      // Buscar gateway de pagamento
      const { data: gateway, error: gwError } = await supabase
        .from("payment_gateways")
        .select("*")
        .eq("bot_id", results.botId)
        .eq("is_active", true)
        .single()

      if (!gateway) {
        return NextResponse.json({
          error: "Gateway de pagamento NAO configurado",
          message: "Voce precisa configurar um gateway de pagamento (MercadoPago) para este bot.",
          gwError: gwError?.message,
          steps: results.steps
        }, { status: 400 })
      }

      results.gateway = {
        id: gateway.id,
        name: gateway.gateway_name,
        hasAccessToken: !!gateway.credentials?.access_token
      }
      ;(results.steps as string[]).push("STEP 7: Gateway de pagamento encontrado - " + gateway.gateway_name)

      results.simulatedPayment = {
        amount: selectedPack.price,
        description: `Pack - ${selectedPack.name}`,
        externalReference: `pack_${selectedPack.id}_TELEGRAM_USER_ID_${Date.now()}`,
        message: "PIX seria gerado aqui com QR Code e codigo copia-cola"
      }
      ;(results.steps as string[]).push("SIMULACAO: Pagamento seria gerado com sucesso!")
    }

    return NextResponse.json({
      success: true,
      message: "Fluxo de Packs verificado com sucesso!",
      ...results
    })

  } catch (error) {
    return NextResponse.json({
      error: "Erro ao processar",
      details: error instanceof Error ? error.message : "Erro desconhecido",
      steps: results.steps
    }, { status: 500 })
  }
}

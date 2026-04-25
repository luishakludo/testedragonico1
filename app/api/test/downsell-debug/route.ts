import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

// API de debug para verificar o estado completo do downsell
// GET /api/test/downsell-debug?flowId=206cbb10-efeb-4f59-a153-9c9d420b4e84

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const flowId = searchParams.get("flowId") || "206cbb10-efeb-4f59-a153-9c9d420b4e84"
  
  const supabase = getSupabaseAdmin()
  
  const debug: Record<string, unknown> = {
    flowId,
    timestamp: new Date().toISOString(),
  }
  
  try {
    // 1. Buscar o flow e sua config de downsell
    const { data: flow, error: flowError } = await supabase
      .from("flows")
      .select("id, name, config, status")
      .eq("id", flowId)
      .single()
    
    if (flowError) {
      debug.flowError = flowError.message
    } else {
      const config = flow?.config as Record<string, unknown> || {}
      debug.flow = {
        id: flow?.id,
        name: flow?.name,
        status: flow?.status,
        hasDownsellConfig: !!config.downsell,
        downsellEnabled: (config.downsell as Record<string, unknown>)?.enabled,
        downsellSequences: ((config.downsell as Record<string, unknown>)?.sequences as unknown[])?.length || 0,
      }
      debug.downsellConfigFull = config.downsell
    }
    
    // 2. Buscar planos do fluxo na tabela flow_plans
    const { data: flowPlans, error: plansError } = await supabase
      .from("flow_plans")
      .select("id, name, price, position, is_active")
      .eq("flow_id", flowId)
      .order("position", { ascending: true })
    
    if (plansError) {
      debug.flowPlansError = plansError.message
    } else {
      debug.flowPlans = flowPlans || []
      debug.flowPlansCount = flowPlans?.length || 0
    }
    
    // 3. Buscar planos do JSON config (legado)
    const config = flow?.config as Record<string, unknown> || {}
    const welcomeConfig = config.welcome as Record<string, unknown> || {}
    const plansFromConfig = welcomeConfig.plans as unknown[] || []
    debug.plansFromConfigJson = plansFromConfig
    debug.plansFromConfigJsonCount = plansFromConfig.length
    
    // 4. Buscar mensagens agendadas deste fluxo (ultimas 10)
    const { data: scheduledMessages, error: scheduledError } = await supabase
      .from("scheduled_messages")
      .select("*")
      .eq("flow_id", flowId)
      .order("created_at", { ascending: false })
      .limit(10)
    
    if (scheduledError) {
      debug.scheduledMessagesError = scheduledError.message
    } else {
      debug.scheduledMessages = scheduledMessages?.map(msg => ({
        id: msg.id,
        status: msg.status,
        message_type: msg.message_type,
        sequence_id: msg.sequence_id,
        scheduled_for: msg.scheduled_for,
        sent_at: msg.sent_at,
        created_at: msg.created_at,
        telegram_user_id: msg.telegram_user_id,
        telegram_chat_id: msg.telegram_chat_id,
        // IMPORTANTE: O que ta salvo no metadata
        metadata_plans: (msg.metadata as Record<string, unknown>)?.plans,
        metadata_plans_count: ((msg.metadata as Record<string, unknown>)?.plans as unknown[])?.length || 0,
        metadata_message: (msg.metadata as Record<string, unknown>)?.message,
        metadata_medias: (msg.metadata as Record<string, unknown>)?.medias,
        metadata_useDefaultPlans: (msg.metadata as Record<string, unknown>)?.useDefaultPlans,
        metadata_discountPercent: (msg.metadata as Record<string, unknown>)?.discountPercent,
        metadata_showPriceInButton: (msg.metadata as Record<string, unknown>)?.showPriceInButton,
        error_message: msg.error_message,
      })) || []
      debug.scheduledMessagesCount = scheduledMessages?.length || 0
    }
    
    // 5. Verificar se existe algum bot vinculado a este fluxo
    const { data: flowBots, error: flowBotsError } = await supabase
      .from("flow_bots")
      .select("bot_id, bots(id, name, token)")
      .eq("flow_id", flowId)
    
    if (flowBotsError) {
      debug.flowBotsError = flowBotsError.message
    } else {
      debug.flowBots = flowBots?.map(fb => ({
        bot_id: fb.bot_id,
        bot_name: (fb.bots as Record<string, unknown>)?.name,
        has_token: !!(fb.bots as Record<string, unknown>)?.token,
      })) || []
    }
    
    // 6. Analise do problema
    const problems: string[] = []
    const warnings: string[] = []
    
    // Verificar se flow existe
    if (!flow) {
      problems.push("CRITICO: Flow nao encontrado no banco de dados")
    }
    
    // Verificar se downsell esta habilitado
    const downsell = config.downsell as Record<string, unknown> | undefined
    if (!downsell?.enabled) {
      problems.push("Downsell NAO esta habilitado no flow config")
    }
    
    // Verificar se tem sequencias de downsell
    const sequences = (downsell?.sequences as unknown[]) || []
    if (sequences.length === 0) {
      problems.push("Nenhuma sequencia de downsell configurada")
    }
    
    // Verificar se tem planos na tabela flow_plans
    if (!flowPlans || flowPlans.length === 0) {
      problems.push("PROBLEMA PRINCIPAL: Nenhum plano encontrado na tabela flow_plans!")
      problems.push("-> A opcao 'Usar planos do Boas-Vindas' (useDefaultPlans=true) busca planos DESTA tabela")
      problems.push("-> Os planos precisam ser salvos na tabela flow_plans para aparecerem no downsell")
      
      if (plansFromConfig.length > 0) {
        warnings.push(`Existem ${plansFromConfig.length} planos no JSON config, mas NAO na tabela flow_plans`)
        warnings.push("-> O sistema usa a tabela flow_plans, nao o JSON config")
      }
    }
    
    // Verificar mensagens agendadas
    if (scheduledMessages && scheduledMessages.length > 0) {
      const lastMsg = scheduledMessages[0]
      const metadata = lastMsg.metadata as Record<string, unknown>
      if (!metadata?.plans || (metadata.plans as unknown[]).length === 0) {
        problems.push("Mensagens agendadas estao SEM planos no metadata!")
        problems.push("-> Isso significa que os botoes NAO vao aparecer no Telegram")
        problems.push("-> Causa provavel: flow_plans estava vazio quando o downsell foi agendado")
      } else {
        const plans = metadata.plans as unknown[]
        debug.lastScheduledMsgPlansDetail = plans
      }
    } else {
      warnings.push("Nenhuma mensagem agendada encontrada para este fluxo")
    }
    
    // Verificar se sequences tem useDefaultPlans
    for (let i = 0; i < sequences.length; i++) {
      const seq = sequences[i] as Record<string, unknown>
      if (seq.useDefaultPlans === false && (!seq.plans || (seq.plans as unknown[]).length === 0)) {
        warnings.push(`Sequencia ${i}: useDefaultPlans=false mas nenhum plano personalizado configurado`)
      }
    }
    
    debug.problems = problems
    debug.problemsCount = problems.length
    debug.warnings = warnings
    debug.warningsCount = warnings.length
    
    // Conclusao
    if (problems.length === 0) {
      debug.conclusion = "Tudo parece estar configurado corretamente. O downsell deveria funcionar."
    } else {
      debug.conclusion = "Problemas encontrados! Veja a lista de 'problems' acima."
      
      // Sugestao de correcao
      if (!flowPlans || flowPlans.length === 0) {
        debug.howToFix = [
          "1. Va na aba 'Planos' do seu fluxo",
          "2. Adicione os planos (nome, preco)",
          "3. Salve os planos",
          "4. Os planos serao salvos na tabela flow_plans",
          "5. Agora o downsell vai conseguir buscar os planos automaticamente",
          "OU",
          "Se os planos ja existem na interface mas nao na tabela flow_plans, pode haver um bug no salvamento."
        ]
      }
    }
    
    return NextResponse.json(debug, { status: 200 })
    
  } catch (error) {
    return NextResponse.json({
      error: "Erro ao debugar downsell",
      details: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 })
  }
}

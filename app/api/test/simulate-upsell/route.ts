import { getSupabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

// Funcao para calcular delay em ms
function calculateDelayMs(value: number, unit: "minutes" | "hours" | "days"): number {
  switch (unit) {
    case "minutes":
      return value * 60 * 1000
    case "hours":
      return value * 60 * 60 * 1000
    case "days":
      return value * 24 * 60 * 60 * 1000
    default:
      return value * 60 * 1000
  }
}

export async function GET() {
  const logs: string[] = []
  const log = (msg: string) => {
    console.log(msg)
    logs.push(msg)
  }

  try {
    const supabase = getSupabaseAdmin()
    
    log("=== SIMULACAO DE PAGAMENTO APROVADO COM UPSELL ===")
    log("")

    // 1. Buscar um fluxo que tenha upsell habilitado
    log("1. Buscando fluxo com upsell habilitado...")
    const { data: flows, error: flowsError } = await supabase
      .from("flows")
      .select("id, name, config, bot_id")
      .not("config", "is", null)
      .limit(50)

    if (flowsError) {
      log(`ERRO ao buscar fluxos: ${flowsError.message}`)
      return NextResponse.json({ success: false, logs, error: flowsError.message })
    }

    log(`   Encontrados ${flows?.length || 0} fluxos`)

    // Filtrar fluxos com upsell habilitado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flowsWithUpsell = flows?.filter((f: any) => {
      const config = f.config as Record<string, unknown> | null
      const upsellConfig = config?.upsell as { enabled?: boolean; sequences?: unknown[] } | undefined
      return upsellConfig?.enabled && (upsellConfig?.sequences?.length || 0) > 0
    }) || []

    log(`   Fluxos com upsell habilitado: ${flowsWithUpsell.length}`)

    if (flowsWithUpsell.length === 0) {
      log("")
      log("PROBLEMA ENCONTRADO: Nenhum fluxo tem upsell habilitado!")
      log("Verifique se voce habilitou o upsell na aba de configuracoes do fluxo.")
      
      // Mostrar config dos primeiros fluxos para debug
      log("")
      log("Config dos primeiros 3 fluxos:")
      flows?.slice(0, 3).forEach((f: { id: string; name: string; config: unknown }) => {
        const config = f.config as Record<string, unknown> | null
        log(`   - ${f.name} (${f.id}):`)
        log(`     upsell: ${JSON.stringify(config?.upsell || "NAO CONFIGURADO")}`)
      })

      return NextResponse.json({ 
        success: false, 
        logs, 
        problema: "Nenhum fluxo tem upsell habilitado",
        sugestao: "Habilite o upsell na aba de configuracoes do fluxo"
      })
    }

    // Usar primeiro fluxo com upsell
    const flowToTest = flowsWithUpsell[0]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flowConfig = flowToTest.config as Record<string, any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upsellConfig = flowConfig?.upsell as { enabled?: boolean; sequences?: any[] }
    const upsellSequences = upsellConfig?.sequences || []

    log("")
    log(`2. Usando fluxo: ${flowToTest.name} (${flowToTest.id})`)
    log(`   Bot ID do fluxo: ${flowToTest.bot_id || "NULL"}`)
    
    // Se o fluxo nao tem bot_id, buscar na tabela flow_bots
    let botId = flowToTest.bot_id
    if (!botId) {
      log("   Bot ID nulo no fluxo, buscando na tabela flow_bots...")
      const { data: flowBot } = await supabase
        .from("flow_bots")
        .select("bot_id")
        .eq("flow_id", flowToTest.id)
        .limit(1)
        .single()
      
      if (flowBot?.bot_id) {
        botId = flowBot.bot_id
        log(`   Encontrado bot via flow_bots: ${botId}`)
      } else {
        // Buscar qualquer bot ativo
        log("   Nenhum bot em flow_bots, buscando qualquer bot ativo...")
        const { data: anyBot } = await supabase
          .from("bots")
          .select("id, name")
          .limit(1)
          .single()
        
        if (anyBot?.id) {
          botId = anyBot.id
          log(`   Usando bot: ${anyBot.name} (${anyBot.id})`)
        } else {
          log("   ERRO: Nenhum bot encontrado no sistema!")
          return NextResponse.json({
            success: false,
            logs,
            problema: "Nenhum bot encontrado para testar",
            sugestao: "Crie um bot primeiro"
          })
        }
      }
    }
    
    log(`   Bot ID final: ${botId}`)
    log(`   Upsell habilitado: ${upsellConfig?.enabled}`)
    log(`   Sequencias de upsell: ${upsellSequences.length}`)

    // Mostrar detalhes das sequencias
    log("")
    log("3. Detalhes das sequencias de upsell:")
    upsellSequences.forEach((seq, i) => {
      log(`   Sequencia ${i + 1}:`)
      log(`     - sendDelayValue: ${seq.sendDelayValue || "NAO DEFINIDO"}`)
      log(`     - sendDelayUnit: ${seq.sendDelayUnit || "NAO DEFINIDO"}`)
      log(`     - message: ${seq.message?.substring(0, 50) || "SEM MENSAGEM"}...`)
      log(`     - medias: ${seq.medias?.length || 0}`)
      log(`     - plans: ${seq.plans?.length || 0}`)
    })

    // 4. Buscar um usuario de teste
    log("")
    log("4. Buscando usuario para teste...")
    const { data: testUser } = await supabase
      .from("bot_users")
      .select("telegram_user_id, first_name, bot_id")
      .eq("bot_id", botId)
      .limit(1)
      .single()

    if (!testUser) {
      log("   Nenhum usuario encontrado para este bot. Usando ID ficticio.")
    } else {
      log(`   Usuario: ${testUser.first_name} (${testUser.telegram_user_id})`)
    }

    const testChatId = testUser?.telegram_user_id || "123456789"
    const testBotId = botId

    // 5. Simular o agendamento do upsell (igual ao webhook faz)
    log("")
    log("5. SIMULANDO AGENDAMENTO DE UPSELL (igual webhook faz)...")
    
    let cumulativeDelayMs = 0
    const scheduledItems: { sequenceIndex: number; scheduledFor: string; delayMs: number }[] = []
    
    for (let i = 0; i < upsellSequences.length; i++) {
      const upsellSeq = upsellSequences[i]
      
      const seqDelayMs = calculateDelayMs(
        upsellSeq.sendDelayValue || 1,
        upsellSeq.sendDelayUnit || "minutes"
      )
      cumulativeDelayMs += seqDelayMs
      
      const scheduledFor = new Date(Date.now() + cumulativeDelayMs).toISOString()
      
      log(`   Sequencia ${i}: delay=${seqDelayMs}ms, agendado para: ${scheduledFor}`)
      
      // Inserir na tabela scheduled_messages
      const { error: insertError } = await supabase
        .from("scheduled_messages")
        .insert({
          bot_id: testBotId,
          flow_id: flowToTest.id,
          telegram_user_id: String(testChatId),
          telegram_chat_id: String(testChatId),
          message_type: "upsell",
          sequence_id: upsellSeq.id || `seq-${i}`,
          sequence_index: i,
          scheduled_for: scheduledFor,
          status: "pending",
          metadata: {
            message: upsellSeq.message || "",
            medias: upsellSeq.medias || [],
            plans: upsellSeq.plans || [],
            deliveryType: upsellSeq.deliveryType || "global",
            deliverableId: upsellSeq.deliverableId,
            is_test: true // Marcar como teste
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      
      if (insertError) {
        log(`   ERRO ao agendar sequencia ${i}: ${insertError.message}`)
      } else {
        log(`   OK - Sequencia ${i} agendada com sucesso!`)
        scheduledItems.push({ sequenceIndex: i, scheduledFor, delayMs: seqDelayMs })
      }
    }

    // 6. Verificar mensagens agendadas
    log("")
    log("6. Verificando mensagens agendadas na tabela...")
    const { data: scheduled, error: schedError } = await supabase
      .from("scheduled_messages")
      .select("*")
      .eq("bot_id", testBotId)
      .eq("telegram_user_id", String(testChatId))
      .eq("message_type", "upsell")
      .eq("status", "pending")
      .order("scheduled_for", { ascending: true })

    if (schedError) {
      log(`   ERRO ao buscar agendados: ${schedError.message}`)
    } else {
      log(`   Total de upsells pendentes: ${scheduled?.length || 0}`)
      scheduled?.slice(0, 5).forEach((s) => {
        log(`   - ID ${s.id}: agendado para ${s.scheduled_for}, status: ${s.status}`)
      })
    }

    // 7. Resumo
    log("")
    log("=== RESUMO ===")
    log(`Fluxo testado: ${flowToTest.name}`)
    log(`Sequencias de upsell configuradas: ${upsellSequences.length}`)
    log(`Upsells agendados neste teste: ${scheduledItems.length}`)
    log("")
    log("O cron /api/cron/process-scheduled-messages vai enviar as mensagens quando chegar a hora.")
    log("Verifique se o cron esta configurado no vercel.json")

    return NextResponse.json({
      success: true,
      logs,
      resumo: {
        fluxo: flowToTest.name,
        fluxoId: flowToTest.id,
        upsellHabilitado: upsellConfig?.enabled,
        sequenciasConfiguradas: upsellSequences.length,
        upsellsAgendados: scheduledItems.length,
        agendamentos: scheduledItems
      }
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido"
    log(`ERRO GERAL: ${errorMessage}`)
    return NextResponse.json({ success: false, logs, error: errorMessage })
  }
}

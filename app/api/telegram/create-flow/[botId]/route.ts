import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://izvulojnfvgsbmhyvqtn.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dnVsb2puZnZnc2JtaHl2cXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTk0NTMsImV4cCI6MjA4ODgzNTQ1M30.Djnn3tsrxSGLBR-Bm1dWOpQe0NHCSOWJFZkbbTOk2oM"
  )
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const supabase = getSupabase()
  const { botId } = await params
  const url = new URL(req.url)
  const welcomeMessage = url.searchParams.get("msg") || "Ola! Bem-vindo ao nosso bot!"

  const logs: string[] = []
  logs.push("========== CRIANDO FLUXO PARA BOT ==========")
  logs.push(`botId: ${botId}`)
  logs.push(`welcomeMessage: ${welcomeMessage}`)

  try {
    // 1. Buscar bot
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("*")
      .ilike("token", `${botId}:%`)
      .single()

    if (botError || !bot) {
      return NextResponse.json({
        success: false,
        error: "Bot nao encontrado",
        logs
      })
    }

    logs.push(`Bot encontrado: ${bot.name} (UUID: ${bot.id})`)

    // 2. Verificar se ja tem fluxo
    const { data: existingFlows } = await supabase
      .from("flows")
      .select("*")
      .eq("bot_id", bot.id)

    if (existingFlows && existingFlows.length > 0) {
      logs.push(`Ja existe ${existingFlows.length} fluxo(s) para este bot`)
      
      // Atualizar o primeiro fluxo com a mensagem de boas-vindas
      const { error: updateError } = await supabase
        .from("flows")
        .update({
          welcome_message: welcomeMessage,
          is_primary: true,
          status: "ativo",
          updated_at: new Date().toISOString()
        })
        .eq("id", existingFlows[0].id)

      if (updateError) {
        logs.push(`Erro ao atualizar fluxo: ${updateError.message}`)
        return NextResponse.json({
          success: false,
          error: "Erro ao atualizar fluxo existente",
          logs
        })
      }

      logs.push(`Fluxo atualizado com sucesso!`)
      return NextResponse.json({
        success: true,
        message: "Fluxo atualizado",
        flow: existingFlows[0],
        logs
      })
    }

    // 3. Criar novo fluxo
    logs.push("Criando novo fluxo...")
    logs.push(`bot.id: ${bot.id}`)
    logs.push(`bot.user_id: ${bot.user_id}`)

    const insertPayload = {
      bot_id: bot.id,
      user_id: bot.user_id,
      name: "Fluxo Principal",
      welcome_message: welcomeMessage,
      status: "ativo",
      is_primary: true,
    }
    logs.push(`Insert payload: ${JSON.stringify(insertPayload)}`)

    const { data: newFlow, error: flowError } = await supabase
      .from("flows")
      .insert(insertPayload)
      .select()
      .single()

    if (flowError) {
      logs.push(`Erro ao criar fluxo: ${flowError.message}`)
      
      // Tentar sem is_primary (coluna pode nao existir)
      const { data: newFlow2, error: flowError2 } = await supabase
        .from("flows")
        .insert({
          bot_id: bot.id,
          user_id: bot.user_id,
          name: "Fluxo Principal",
          welcome_message: welcomeMessage,
          status: "ativo",
        })
        .select()
        .single()

      if (flowError2) {
        logs.push(`Erro ao criar fluxo (tentativa 2): ${flowError2.message}`)
        return NextResponse.json({
          success: false,
          error: "Erro ao criar fluxo",
          logs
        })
      }

      logs.push(`Fluxo criado com sucesso! ID: ${newFlow2.id}`)
      return NextResponse.json({
        success: true,
        message: "Fluxo criado",
        flow: newFlow2,
        logs
      })
    }

    logs.push(`Fluxo criado com sucesso! ID: ${newFlow.id}`)

    return NextResponse.json({
      success: true,
      message: "Fluxo criado",
      flow: newFlow,
      logs
    })

  } catch (err) {
    logs.push(`Erro: ${err}`)
    return NextResponse.json({
      success: false,
      error: String(err),
      logs
    })
  }
}

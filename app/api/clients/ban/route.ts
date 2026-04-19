import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dnVsb2puZnZnc2JtaHl2cXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTk0NTMsImV4cCI6MjA4ODgzNTQ1M30.Djnn3tsrxSGLBR-Bm1dWOpQe0NHCSOWJFZkbbTOk2oM"

// Banir usuario de um grupo do Telegram
async function banChatMember(botToken: string, chatId: string, userId: string) {
  const url = `https://api.telegram.org/bot${botToken}/banChatMember`
  const body = {
    chat_id: chatId,
    user_id: userId,
  }
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.json()
}

// Desbanir usuario (para permitir retorno futuro)
async function unbanChatMember(botToken: string, chatId: string, userId: string) {
  const url = `https://api.telegram.org/bot${botToken}/unbanChatMember`
  const body = {
    chat_id: chatId,
    user_id: userId,
    only_if_banned: true,
  }
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      telegramUserId, 
      botId, 
      action = "ban", // "ban" | "remove" (remove = ban + unban)
      reason = "Manual ban from dashboard"
    } = body

    if (!telegramUserId || !botId) {
      return NextResponse.json({ 
        error: "telegramUserId e botId sao obrigatorios" 
      }, { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    // Buscar bot e seu token
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("id, token, user_id")
      .eq("id", botId)
      .single()

    if (botError || !bot?.token) {
      return NextResponse.json({ 
        error: "Bot nao encontrado ou sem token" 
      }, { status: 404 })
    }

    // Buscar flow associado ao bot para pegar os grupos VIP
    let flowConfig: Record<string, unknown> | null = null

    // Tentar buscar flow direto
    const { data: directFlow } = await supabase
      .from("flows")
      .select("id, config")
      .eq("bot_id", botId)
      .limit(1)
      .single()

    if (directFlow?.config) {
      flowConfig = directFlow.config as Record<string, unknown>
    } else {
      // Tentar buscar via flow_bots
      const { data: flowBot } = await supabase
        .from("flow_bots")
        .select("flow_id, flows:flow_id(id, config)")
        .eq("bot_id", botId)
        .limit(1)
        .single()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((flowBot as any)?.flows?.config) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        flowConfig = (flowBot as any).flows.config as Record<string, unknown>
      }
    }

    const results: { groupId: string; success: boolean; error?: string }[] = []

    // Buscar grupos VIP dos entregaveis
    if (flowConfig?.deliverables) {
      const deliverables = flowConfig.deliverables as Array<{
        id: string
        type: string
        vipGroupChatId?: string
        vipGroupName?: string
      }>

      for (const deliverable of deliverables) {
        if (deliverable.type === "vip_group" && deliverable.vipGroupChatId) {
          console.log(`[BAN] Banning user ${telegramUserId} from group ${deliverable.vipGroupChatId}`)
          
          // Banir do grupo
          const banResult = await banChatMember(bot.token, deliverable.vipGroupChatId, telegramUserId)
          
          if (banResult.ok) {
            // Se action = "remove", desbanir para permitir retorno futuro
            if (action === "remove") {
              await unbanChatMember(bot.token, deliverable.vipGroupChatId, telegramUserId)
            }
            
            results.push({ 
              groupId: deliverable.vipGroupChatId, 
              success: true 
            })
          } else {
            results.push({ 
              groupId: deliverable.vipGroupChatId, 
              success: false, 
              error: banResult.description || "Erro ao banir" 
            })
          }
        }
      }
    }

    // Atualizar bot_user para is_vip = false
    const { error: updateError } = await supabase
      .from("bot_users")
      .update({ 
        is_vip: false, 
        vip_expires_at: null,
        updated_at: new Date().toISOString()
      })
      .eq("telegram_user_id", telegramUserId)
      .eq("bot_id", botId)

    if (updateError) {
      console.error("[BAN] Error updating bot_user:", updateError)
    }

    // Registrar acao de banimento
    await supabase.from("ban_logs").insert({
      telegram_user_id: telegramUserId,
      bot_id: botId,
      action,
      reason,
      groups_affected: results.map(r => r.groupId),
      success: results.every(r => r.success),
      created_at: new Date().toISOString()
    }).catch(() => {
      // Tabela pode nao existir ainda, ignorar erro
    })

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      message: `Usuario ${action === "remove" ? "removido" : "banido"} de ${successCount} grupo(s)`,
      results,
      summary: {
        total: results.length,
        success: successCount,
        failed: failCount
      }
    })

  } catch (error) {
    console.error("[BAN] Error:", error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Erro interno" 
    }, { status: 500 })
  }
}

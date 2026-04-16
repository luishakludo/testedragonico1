import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"
import { registrarWebhook } from "@/lib/telegram-webhook"

// POST /api/bots/create
// Cria um novo bot e registra o webhook automaticamente
export async function POST(req: NextRequest) {
  try {
    const { userId, name, token, groupName, groupId, groupLink } = await req.json()

    if (!userId || !name || !token) {
      return NextResponse.json(
        { error: "userId, name e token sao obrigatorios" },
        { status: 400 }
      )
    }

    const supabase = getSupabase()

    // Verifica se o usuario existe
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .single()

    if (!existingUser) {
      return NextResponse.json(
        { error: "Usuario nao encontrado" },
        { status: 404 }
      )
    }

    // Verifica se ja existe um bot com esse token
    const { data: existingBot } = await supabase
      .from("bots")
      .select("id")
      .eq("token", token)
      .single()

    if (existingBot) {
      return NextResponse.json(
        { error: "Ja existe um bot com esse token" },
        { status: 400 }
      )
    }

    // Cria o bot no banco de dados
    const { data: newBot, error: insertError } = await supabase
      .from("bots")
      .insert({
        user_id: userId,
        name,
        token,
        group_name: groupName || null,
        group_id: groupId || null,
        group_link: groupLink || null,
        status: "active",
      })
      .select()
      .single()

    if (insertError) {
      console.error("[bots/create] Erro ao criar bot:", insertError)
      return NextResponse.json(
        { error: "Erro ao criar bot" },
        { status: 500 }
      )
    }

    // Registra o webhook automaticamente apos criar o bot
    const webhookResult = await registrarWebhook(token, newBot.id)

    if (!webhookResult.success) {
      console.warn(`[bots/create] Bot criado mas webhook falhou: ${webhookResult.error}`)
    }

    return NextResponse.json({
      success: true,
      bot: newBot,
      webhook: {
        registered: webhookResult.success,
        url: webhookResult.webhookUrl,
        error: webhookResult.error
      }
    })
  } catch (error: any) {
    console.error("[bots/create] Erro:", error)
    return NextResponse.json(
      { error: error.message || "Erro interno" },
      { status: 500 }
    )
  }
}

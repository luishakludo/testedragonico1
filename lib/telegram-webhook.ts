/**
 * Registra o webhook do Telegram para um bot
 * @param token - Token do bot do Telegram
 * @param botId - ID do bot no banco de dados
 * @returns Promise com resultado da operacao
 */
export async function registrarWebhook(token: string, botId: string): Promise<{
  success: boolean
  webhookUrl?: string
  error?: string
}> {
  try {
    // URL hardcoded da Render - nao depende de variavel de ambiente
    const baseUrl = "https://dragonteste.onrender.com"
    
    console.log("[v0] Registrando webhook com URL:", baseUrl)

    // Monta a URL do webhook com botId dinamico
    const webhookUrl = `${baseUrl}/api/telegram/webhook/${botId}`

    // Primeiro, deleta o webhook existente para garantir estado limpo
    await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`)

    // Registra o novo webhook
    const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: true
      })
    })

    const data = await response.json()

    if (!data.ok) {
      return {
        success: false,
        error: data.description || "Falha ao registrar webhook"
      }
    }

    console.log(`[registrarWebhook] Webhook registrado com sucesso para bot ${botId}: ${webhookUrl}`)

    return {
      success: true,
      webhookUrl
    }
  } catch (error: any) {
    console.error(`[registrarWebhook] Erro ao registrar webhook para bot ${botId}:`, error.message)
    return {
      success: false,
      error: error.message || "Erro desconhecido ao registrar webhook"
    }
  }
}

/**
 * Remove o webhook do Telegram para um bot
 * @param token - Token do bot do Telegram
 * @returns Promise com resultado da operacao
 */
export async function removerWebhook(token: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`)
    const data = await response.json()

    if (!data.ok) {
      return {
        success: false,
        error: data.description || "Falha ao remover webhook"
      }
    }

    return { success: true }
  } catch (error: any) {
    console.error("[removerWebhook] Erro:", error.message)
    return {
      success: false,
      error: error.message || "Erro desconhecido ao remover webhook"
    }
  }
}

/**
 * Verifica o status do webhook de um bot
 * @param token - Token do bot do Telegram
 * @returns Promise com informacoes do webhook
 */
export async function verificarWebhook(token: string): Promise<{
  success: boolean
  webhookUrl?: string
  pendingUpdates?: number
  error?: string
}> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
    const data = await response.json()

    if (!data.ok) {
      return {
        success: false,
        error: data.description || "Falha ao verificar webhook"
      }
    }

    return {
      success: true,
      webhookUrl: data.result.url || null,
      pendingUpdates: data.result.pending_update_count || 0
    }
  } catch (error: any) {
    console.error("[verificarWebhook] Erro:", error.message)
    return {
      success: false,
      error: error.message || "Erro desconhecido ao verificar webhook"
    }
  }
}

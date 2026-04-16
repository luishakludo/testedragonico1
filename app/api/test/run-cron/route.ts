import { getSupabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

// Funcao para enviar mensagem de upsell
async function sendUpsellMessage(
  botToken: string,
  chatId: string,
  message: string,
  medias: Array<{ type: string; url: string; caption?: string }>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plans: any[]
) {
  const logs: string[] = []
  
  try {
    // Enviar midias primeiro
    if (medias && medias.length > 0) {
      for (const media of medias) {
        logs.push(`Enviando media: ${media.type}`)
        
        let endpoint = ""
        const formData: Record<string, string> = {
          chat_id: chatId,
        }
        
        if (media.type === "photo") {
          endpoint = "sendPhoto"
          formData.photo = media.url
          if (media.caption) formData.caption = media.caption
        } else if (media.type === "video") {
          endpoint = "sendVideo"
          formData.video = media.url
          if (media.caption) formData.caption = media.caption
        } else if (media.type === "audio") {
          endpoint = "sendAudio"
          formData.audio = media.url
          if (media.caption) formData.caption = media.caption
        } else if (media.type === "document") {
          endpoint = "sendDocument"
          formData.document = media.url
          if (media.caption) formData.caption = media.caption
        }
        
        if (endpoint) {
          const mediaRes = await fetch(`https://api.telegram.org/bot${botToken}/${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData)
          })
          const mediaResult = await mediaRes.json()
          logs.push(`Media response: ${JSON.stringify(mediaResult)}`)
        }
      }
    }
    
    // Enviar mensagem de texto
    if (message) {
      logs.push(`Enviando mensagem de texto`)
      const textRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML"
        })
      })
      const textResult = await textRes.json()
      logs.push(`Text response: ${JSON.stringify(textResult)}`)
    }
    
    // Enviar botoes de plano se houver
    if (plans && plans.length > 0) {
      logs.push(`Enviando ${plans.length} planos`)
      const buttons = plans.map((plan: { name: string; price: number; paymentLink?: string }) => ([{
        text: `${plan.name} - R$ ${plan.price}`,
        url: plan.paymentLink || "#"
      }]))
      
      const planRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Escolha seu plano:",
          reply_markup: {
            inline_keyboard: buttons
          }
        })
      })
      const planResult = await planRes.json()
      logs.push(`Plans response: ${JSON.stringify(planResult)}`)
    }
    
    return { success: true, logs }
  } catch (error) {
    logs.push(`ERRO: ${error}`)
    return { success: false, logs, error: String(error) }
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
    
    log("=== EXECUTANDO CRON MANUALMENTE ===")
    log("")
    
    // Buscar mensagens de upsell pendentes
    const now = new Date().toISOString()
    log(`Horario atual: ${now}`)
    log("")
    
    const { data: pendingMessages, error: fetchError } = await supabase
      .from("scheduled_messages")
      .select("*")
      .eq("message_type", "upsell")
      .eq("status", "pending")
      .lte("scheduled_for", now)
      .order("scheduled_for", { ascending: true })
      .limit(10)
    
    if (fetchError) {
      log(`ERRO ao buscar mensagens: ${fetchError.message}`)
      return NextResponse.json({ success: false, logs, error: fetchError.message })
    }
    
    log(`Mensagens de upsell pendentes para enviar agora: ${pendingMessages?.length || 0}`)
    
    if (!pendingMessages || pendingMessages.length === 0) {
      log("")
      log("Nenhuma mensagem de upsell para enviar no momento.")
      log("")
      
      // Mostrar proximas mensagens agendadas
      const { data: nextMessages } = await supabase
        .from("scheduled_messages")
        .select("id, scheduled_for, status, telegram_chat_id")
        .eq("message_type", "upsell")
        .eq("status", "pending")
        .order("scheduled_for", { ascending: true })
        .limit(5)
      
      if (nextMessages && nextMessages.length > 0) {
        log("Proximas mensagens de upsell agendadas:")
        for (const msg of nextMessages) {
          log(`  - ${msg.id}: agendado para ${msg.scheduled_for}`)
        }
      }
      
      return NextResponse.json({ success: true, logs, mensagensEnviadas: 0 })
    }
    
    log("")
    let enviadas = 0
    
    for (const msg of pendingMessages) {
      log(`--- Processando mensagem ${msg.id} ---`)
      log(`Chat ID: ${msg.telegram_chat_id}`)
      log(`Agendado para: ${msg.scheduled_for}`)
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const metadata = msg.metadata as any
      
      // Buscar token do bot
      const { data: bot } = await supabase
        .from("bots")
        .select("token")
        .eq("id", msg.bot_id)
        .single()
      
      if (!bot?.token) {
        log(`ERRO: Bot nao encontrado para id ${msg.bot_id}`)
        await supabase
          .from("scheduled_messages")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", msg.id)
        continue
      }
      
      log(`Bot token encontrado`)
      
      // Enviar mensagem
      const result = await sendUpsellMessage(
        bot.token,
        msg.telegram_chat_id,
        metadata?.message || "",
        metadata?.medias || [],
        metadata?.plans || []
      )
      
      for (const l of result.logs) {
        log(`  ${l}`)
      }
      
      if (result.success) {
        log(`OK - Mensagem enviada com sucesso!`)
        await supabase
          .from("scheduled_messages")
          .update({ status: "sent", updated_at: new Date().toISOString() })
          .eq("id", msg.id)
        enviadas++
      } else {
        log(`ERRO ao enviar mensagem`)
        await supabase
          .from("scheduled_messages")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", msg.id)
      }
      
      log("")
    }
    
    log(`=== RESUMO ===`)
    log(`Mensagens enviadas: ${enviadas}/${pendingMessages.length}`)
    
    return NextResponse.json({ success: true, logs, mensagensEnviadas: enviadas })
    
  } catch (error) {
    log(`ERRO GERAL: ${error}`)
    return NextResponse.json({ success: false, logs, error: String(error) })
  }
}

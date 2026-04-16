import { getSupabase } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const flowId = searchParams.get("flowId")
    
    if (!flowId) {
      return NextResponse.json({ error: "flowId is required" }, { status: 400 })
    }
    
    const supabase = getSupabase()
    
    // Buscar o flow
  const { data: flow, error: flowError } = await supabase
    .from("flows")
    .select("*")
    .eq("id", flowId)
    .single()
  
  if (flowError || !flow) {
    return NextResponse.json({ 
      error: "Flow not found", 
      details: flowError?.message 
    }, { status: 404 })
  }
  
  // Simular extração de dados como o webhook faz
  const flowConfig = (flow.config as Record<string, unknown>) || {}
  
  const welcomeMsg = (flowConfig.welcomeMessage as string) || (flow.welcome_message as string) || ""
  
  // Filter out base64 - Telegram only accepts URLs
  const allMedias = (flowConfig.welcomeMedias as string[]) || []
  const welcomeMedias = allMedias.filter(m => m && !m.startsWith("data:") && (m.startsWith("http") || m.startsWith("/")))
  const base64Medias = allMedias.filter(m => m && m.startsWith("data:"))
  
  const ctaButtonText = (flowConfig.ctaButtonText as string) || "Ver Planos"
  const redirectButton = flowConfig.redirectButton as { enabled?: boolean; text?: string; url?: string } || {}
  const secondaryMsg = flowConfig.secondaryMessage as { enabled?: boolean; message?: string } || {}
  
  // Simular variaveis
  const replaceVars = (text: string) => {
    if (!text) return ""
    return text
      .replace(/\{nome\}/gi, "Usuario Teste")
      .replace(/\{username\}/gi, "@usuario_teste")
      .replace(/\{bot\.username\}/gi, "@bot_teste")
  }
  
  const finalMsg = replaceVars(welcomeMsg) || "Ola! Bem-vindo ao bot."
  
  // Simular o que seria enviado
  const simulatedMessages: Array<{
    step: number
    type: string
    content?: string
    mediaUrl?: string
    buttons?: Array<{ text: string; type: string; data?: string; url?: string }>
    warning?: string
  }> = []
  
  let step = 1
  
  // STEP 1: Midias (only valid URLs)
  if (welcomeMedias.length > 0) {
    for (const media of welcomeMedias) {
      const isVideo = media.includes(".mp4") || media.includes("video")
      simulatedMessages.push({
        step: step++,
        type: isVideo ? "VIDEO" : "PHOTO",
        mediaUrl: media
      })
    }
  }
  
  // STEP 2: Mensagem principal com botoes (SEMPRE envia)
  const buttons: Array<{ text: string; type: string; data?: string; url?: string }> = []
  
  // CTA Button
  buttons.push({ 
    text: ctaButtonText, 
    type: "callback", 
    data: "ver_planos" 
  })
  
  // Redirect Button
  if (redirectButton.enabled && redirectButton.text && redirectButton.url) {
    buttons.push({ 
      text: redirectButton.text, 
      type: "url", 
      url: redirectButton.url 
    })
  }
  
  simulatedMessages.push({
    step: step++,
    type: "MESSAGE_WITH_BUTTONS",
    content: finalMsg,
    buttons
  })
  
  // STEP 3: Mensagem secundaria
  if (secondaryMsg.enabled && secondaryMsg.message) {
    simulatedMessages.push({
      step: step++,
      type: "SECONDARY_MESSAGE",
      content: replaceVars(secondaryMsg.message)
    })
  }
  
  return NextResponse.json({
    success: true,
    flowId: flow.id,
    flowName: flow.name,
    rawData: {
      welcome_message_field: flow.welcome_message,
      config: flowConfig
    },
    extractedData: {
      welcomeMsg,
      welcomeMediasValid: welcomeMedias,
      welcomeMediasBase64Ignored: base64Medias.length,
      ctaButtonText,
      redirectButton,
      secondaryMsg
    },
    simulatedMessages,
    summary: {
      totalSteps: simulatedMessages.length,
      hasValidMedias: welcomeMedias.length > 0,
      mediasIgnoredBase64: base64Medias.length,
      hasWelcomeMessage: !!welcomeMsg.trim(),
      hasRedirectButton: redirectButton.enabled,
      hasSecondaryMessage: secondaryMsg.enabled
    },
    warnings: base64Medias.length > 0 ? [
      `${base64Medias.length} midia(s) ignorada(s) porque estao em base64. Telegram so aceita URLs publicas (http/https).`,
      "Faca upload das imagens para Supabase Storage ou outro servico e salve as URLs."
    ] : []
  }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ 
      error: "Internal error", 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 })
  }
}

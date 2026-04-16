import { getSupabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// GET /api/test/send-upsell - Envia mensagem de upsell para usuario especifico
export async function GET() {
  const logs: string[] = []
  const log = (msg: string) => {
    console.log(msg)
    logs.push(msg)
  }

  try {
    const supabase = getSupabaseAdmin()
    const targetUserId = "5099610171" // Usuario de teste
    
    log("=== TESTE DE ENVIO DE UPSELL ===")
    log("")
    log(`Usuario alvo: ${targetUserId}`)
    
    // 1. Buscar fluxo com upsell habilitado
    const { data: flows } = await supabase
      .from("flows")
      .select("id, name, config, bot_id")
      .limit(50)
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flowsWithUpsell = flows?.filter((f: any) => {
      const config = f.config as Record<string, unknown>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const upsellConfig = config?.upsell as { enabled?: boolean; sequences?: any[] }
      return upsellConfig?.enabled && (upsellConfig?.sequences?.length || 0) > 0
    }) || []
    
    if (flowsWithUpsell.length === 0) {
      return NextResponse.json({
        success: false,
        logs,
        erro: "Nenhum fluxo com upsell habilitado encontrado"
      })
    }
    
    const flowToTest = flowsWithUpsell[0]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flowConfig = flowToTest.config as Record<string, any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upsellConfig = flowConfig?.upsell as { enabled?: boolean; sequences?: any[] }
    const upsellSequences = upsellConfig?.sequences || []
    
    log(`Fluxo: ${flowToTest.name} (${flowToTest.id})`)
    log(`Sequencias de upsell: ${upsellSequences.length}`)
    
    // 2. Buscar bot
    let botId = flowToTest.bot_id
    let botToken = ""
    
    if (!botId) {
      const { data: flowBot } = await supabase
        .from("flow_bots")
        .select("bot_id")
        .eq("flow_id", flowToTest.id)
        .limit(1)
        .single()
      
      botId = flowBot?.bot_id
    }
    
    if (!botId) {
      const { data: anyBot } = await supabase
        .from("bots")
        .select("id, token")
        .limit(1)
        .single()
      
      botId = anyBot?.id
      botToken = anyBot?.token || ""
    } else {
      const { data: bot } = await supabase
        .from("bots")
        .select("token")
        .eq("id", botId)
        .single()
      
      botToken = bot?.token || ""
    }
    
    if (!botToken) {
      return NextResponse.json({
        success: false,
        logs,
        erro: "Nenhum bot encontrado"
      })
    }
    
    log(`Bot ID: ${botId}`)
    log("")
    
    // 3. Enviar a primeira sequencia de upsell
    const upsellSeq = upsellSequences[0]
    
    log("=== ENVIANDO UPSELL ===")
    log(`Mensagem: ${upsellSeq.message?.substring(0, 50)}...`)
    log(`Medias: ${upsellSeq.medias?.length || 0}`)
    log(`Planos: ${upsellSeq.plans?.length || 0}`)
    log(`DeliveryType: ${upsellSeq.deliveryType || "global"}`)
    log(`DeliverableId: ${upsellSeq.deliverableId || "N/A"}`)
    
    // Montar os botoes dos planos - USANDO O FORMATO QUE JA FUNCIONA
    // Formato: up_accept_{amount}_{upsellIndex} (mesmo handler do downsell)
    const plans = upsellSeq.plans || []
    const inlineKeyboard = plans.map((plan: { name: string; price: number }, idx: number) => {
      return [{
        text: `${plan.name} - R$ ${plan.price.toFixed(2)}`,
        callback_data: `up_accept_${plan.price}_${idx}`
      }]
    })
    
    log("")
    log("Botoes gerados:")
    inlineKeyboard.forEach((row: { text: string; callback_data: string }[], idx: number) => {
      log(`  ${idx}: ${row[0].text} -> ${row[0].callback_data}`)
    })
    
    // 4. Enviar medias primeiro (se houver)
    const medias = upsellSeq.medias || []
    for (const media of medias) {
      if (media.type === "image" && media.url) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: targetUserId,
            photo: media.url,
            caption: media.caption || ""
          })
        })
        log(`Enviada imagem: ${media.url.substring(0, 50)}...`)
      } else if (media.type === "video" && media.url) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendVideo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: targetUserId,
            video: media.url,
            caption: media.caption || ""
          })
        })
        log(`Enviado video: ${media.url.substring(0, 50)}...`)
      }
    }
    
    // 5. Enviar mensagem com botoes
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: targetUserId,
        text: upsellSeq.message || "Oferta especial para voce!",
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      })
    })
    
    const result = await response.json()
    
    if (result.ok) {
      log("")
      log("SUCESSO! Mensagem enviada.")
      log(`Message ID: ${result.result?.message_id}`)
      
      log("Botao usa formato up_accept_{price}_{index} que ja tem handler funcionando")
    } else {
      log("")
      log(`ERRO ao enviar: ${result.description}`)
    }
    
    return NextResponse.json({
      success: result.ok,
      logs,
      telegramResponse: result,
      callbackFormat: "up_accept_{price}_{index}"
    })
    
  } catch (error) {
    log(`Erro: ${error instanceof Error ? error.message : String(error)}`)
    return NextResponse.json({
      success: false,
      logs,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

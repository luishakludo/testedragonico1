import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

// ---------------------------------------------------------------------------
// Telegram helpers
// ---------------------------------------------------------------------------

async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
  replyMarkup?: object,
) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`
  const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: "HTML" }
  if (replyMarkup) body.reply_markup = replyMarkup
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function sendTelegramPhoto(
  botToken: string,
  chatId: number,
  photoUrl: string,
  caption: string,
) {
  const url = `https://api.telegram.org/bot${botToken}/sendPhoto`
  const body: Record<string, unknown> = {
    chat_id: chatId,
    photo: photoUrl,
    caption,
    parse_mode: "HTML",
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function sendTelegramVideo(
  botToken: string,
  chatId: number,
  videoUrl: string,
  caption: string,
) {
  const url = `https://api.telegram.org/bot${botToken}/sendVideo`
  const body: Record<string, unknown> = {
    chat_id: chatId,
    video: videoUrl,
    caption,
    parse_mode: "HTML",
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.json()
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Envia grupo de midias (fotos/videos) via Telegram
async function sendMediaGroup(
  botToken: string,
  chatId: number,
  mediaUrls: string[],
  caption: string
) {
  if (!mediaUrls || mediaUrls.length === 0) return null
  
  // Se for apenas 1 midia, envia individualmente
  if (mediaUrls.length === 1) {
    const url = mediaUrls[0]
    const isVideo = url.includes("/videos/") || url.match(/\.(mp4|webm|mov)($|\?)/i)
    if (isVideo) {
      return sendTelegramVideo(botToken, chatId, url, caption)
    } else {
      return sendTelegramPhoto(botToken, chatId, url, caption)
    }
  }
  
  // Preparar array de midias para sendMediaGroup
  const media = mediaUrls.map((url, index) => {
    const isVideo = url.includes("/videos/") || url.match(/\.(mp4|webm|mov)($|\?)/i)
    return {
      type: isVideo ? "video" : "photo",
      media: url,
      // Apenas a primeira midia pode ter caption
      ...(index === 0 && caption ? { caption, parse_mode: "HTML" } : {})
    }
  })
  
  const apiUrl = `https://api.telegram.org/bot${botToken}/sendMediaGroup`
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      media
    }),
  })
  
  const data = await res.json()
  if (!data.ok) {
    console.error("[v0] sendMediaGroup error:", data)
  }
  return data
}

// Criar link de convite unico para grupo VIP (limite de 1 uso)
async function createVipInviteLink(botToken: string, chatId: string): Promise<string | null> {
  console.log(`[v0] VIP: ========== createVipInviteLink INICIO ==========`)
  console.log(`[v0] VIP: chatId (grupo): ${chatId}`)
  console.log(`[v0] VIP: botToken (primeiros 10 chars): ${botToken?.substring(0, 10)}...`)
  
  try {
    const requestBody = {
      chat_id: chatId,
      member_limit: 1, // Link unico para 1 pessoa
      name: `VIP Access - ${Date.now()}`,
    }
    console.log(`[v0] VIP: Request body:`, JSON.stringify(requestBody))
    
    const res = await fetch(`https://api.telegram.org/bot${botToken}/createChatInviteLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    })
    
    console.log(`[v0] VIP: Response status: ${res.status}`)
    
    const data = await res.json()
    console.log(`[v0] VIP: Response data:`, JSON.stringify(data))
    
    if (data.ok && data.result?.invite_link) {
      console.log(`[v0] VIP: SUCESSO - Link criado: ${data.result.invite_link}`)
      console.log(`[v0] VIP: ========== createVipInviteLink FIM (sucesso) ==========`)
      return data.result.invite_link
    }
    
    console.log(`[v0] VIP: ERRO - Falha ao criar link!`)
    console.log(`[v0] VIP: error_code: ${data.error_code}`)
    console.log(`[v0] VIP: description: ${data.description}`)
    console.log(`[v0] VIP: ========== createVipInviteLink FIM (erro) ==========`)
    return null
  } catch (error) {
    console.error(`[v0] VIP: EXCECAO ao criar link:`, error)
    console.log(`[v0] VIP: ========== createVipInviteLink FIM (excecao) ==========`)
    return null
  }
}

  // Helper: Enviar Order Bump (mídias em grupo + mensagem com botões)
  // Formato padrão: Título, Descrição, Por apenas R$ X,XX
  async function sendOrderBumpOffer(params: {
  botToken: string
  chatId: number
  name: string
  description?: string
  price: number
  acceptText?: string
  rejectText?: string
  medias?: string[]
  mainAmountCents: number
  callbackPrefix?: string // Prefixo do callback (padrão: "ob")
  userFirstName?: string // Nome do usuario para substituir {nome}
  userUsername?: string // Username do usuario para substituir {username}
  }) {
  const { botToken, chatId, name, description, price, acceptText, rejectText, medias, mainAmountCents, callbackPrefix = "ob", userFirstName = "", userUsername = "" } = params
  
  // Funcao para substituir variaveis {nome} e {username}
  const replaceVars = (text: string) => {
    if (!text) return ""
    return text
      .replace(/\{nome\}/gi, userFirstName || "")
      .replace(/\{username\}/gi, userUsername ? `@${userUsername}` : "")
  }
  
  const obPriceCents = Math.round(price * 100)
  // Mensagem padrão simples: Título, Descrição, Por apenas R$ X,XX
  // Aplicar substituicao de variaveis na descricao e no nome
  const obMessage = `<b>${replaceVars(name) || "Oferta Especial"}</b>\n\n${replaceVars(description || "")}\n\n💰 Por apenas <b>R$ ${price.toFixed(2).replace(".", ",")}</b>`
  
  const obButtons = {
    inline_keyboard: [
      [
        { text: acceptText || "QUERO", callback_data: `${callbackPrefix}_accept_${mainAmountCents}_${obPriceCents}` },
        { text: rejectText || "NAO QUERO", callback_data: `${callbackPrefix}_decline_${mainAmountCents}_0` }
      ]
    ]
  }
  
  // Se tiver mídias, enviar TODAS em grupo primeiro, depois mensagem com botões
  if (medias && medias.length > 0) {
    try {
      // Enviar todas as mídias como grupo
      await sendMediaGroup(botToken, chatId, medias, "")
    } catch (e) {
      console.error("[v0] Erro ao enviar media group do Order Bump:", e)
    }
  }
  
  // Enviar mensagem com botões (sempre)
  await sendTelegramMessage(botToken, chatId, obMessage, obButtons)
}

function calculateDelayMs(value: number, unit: "minutes" | "hours" | "days"): number {
  switch (unit) {
    case "minutes": return value * 60 * 1000
    case "hours": return value * 60 * 60 * 1000
    case "days": return value * 24 * 60 * 60 * 1000
    default: return value * 60 * 1000
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendUpsellOffer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  botToken: string,
  chatId: number,
  botId: string,
  flowId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  upsell: any,
  upsellIndex: number
) {
  console.log(`[UPSELL] Sending upsell ${upsellIndex} to user ${chatId}`)
  console.log(`[UPSELL] Upsell data:`, JSON.stringify(upsell))

  // Montar botoes - mesma estrutura do downsell (apenas planos)
  const plans = upsell.plans || []
  const inlineKeyboard: { inline_keyboard: { text: string; callback_data: string }[][] } = {
    inline_keyboard: []
  }

  if (plans.length > 0) {
    // Mostrar cada plano como um botao (um por linha, igual downsell)
    // Formato: up_plan_{upsellIndex}_{planId}_{priceInCents}
    for (const plan of plans) {
      const priceInCents = Math.round((plan.price || 0) * 100)
      const buttonText = plan.buttonText || `R$ ${(plan.price || 0).toFixed(2).replace(".", ",")}`
      inlineKeyboard.inline_keyboard.push([{
        text: buttonText,
        callback_data: `up_plan_${upsellIndex}_${plan.id}_${priceInCents}`
      }])
    }
  }

  // Enviar TODAS as mídias em grupo primeiro
  const message = upsell.message || "Oferta especial para voce!"
  
  if (upsell.medias && upsell.medias.length > 0) {
    try {
      await sendMediaGroup(botToken, chatId, upsell.medias, "")
    } catch (e) {
      console.error("[v0] Erro ao enviar media group do Upsell:", e)
    }
  }
  
  // Depois enviar mensagem com botões
  await sendTelegramMessage(botToken, chatId, message, inlineKeyboard)

  // Atualizar estado - salvar info do primeiro plano se existir
  const firstPlan = plans[0]
  await supabase
    .from("user_flow_state")
    .upsert({
      bot_id: botId,
      telegram_user_id: String(chatId),
      flow_id: flowId,
      status: "waiting_upsell",
      metadata: {
        upsell_index: upsellIndex,
        upsell_price: firstPlan?.price || upsell.price,
        upsell_sequence_id: upsell.id,
        plans: plans.map((p: { id: string; buttonText: string; price: number }) => ({ id: p.id, buttonText: p.buttonText, price: p.price })),
      },
      updated_at: new Date().toISOString()
    }, { onConflict: "bot_id,telegram_user_id" })

  console.log(`[UPSELL] Upsell ${upsellIndex} sent successfully with ${plans.length} plans`)
}

// Interface para entregavel
interface Deliverable {
  id: string
  name: string
  type: "media" | "vip_group" | "link"
  medias?: string[]
  link?: string
  linkText?: string
  vipGroupChatId?: string
  vipGroupName?: string
}

// Funcao para enviar um entregavel especifico
async function sendDeliverable(
  botToken: string,
  chatId: number,
  deliverable: Deliverable,
  isOrderBump: boolean = false // Indica se e entregavel do order bump
) {
  console.log(`[v0] DELIVERY: ========== sendDeliverable INICIO ==========`)
  console.log(`[v0] DELIVERY: Deliverable name: "${deliverable.name}"`)
  console.log(`[v0] DELIVERY: Deliverable type: "${deliverable.type}"`)
  console.log(`[v0] DELIVERY: Deliverable id: "${deliverable.id}"`)
  console.log(`[v0] DELIVERY: chatId: ${chatId}`)
  console.log(`[v0] DELIVERY: isOrderBump: ${isOrderBump}`)
  console.log(`[v0] DELIVERY: Deliverable data:`, JSON.stringify(deliverable))

  // Mensagens diferentes para produto principal e order bump
  const thankYouMessage = isOrderBump 
    ? "Sua oferta especial foi liberada!" 
    : "Obrigado pela compra!"
  const accessMessage = isOrderBump 
    ? "Acesse o conteudo da sua oferta especial:" 
    : "Clique no botao abaixo para acessar:"
  const contentMessage = isOrderBump 
    ? "Seu conteudo da oferta especial foi liberado acima." 
    : "Seu conteudo foi liberado acima."
  const defaultMessage = isOrderBump 
    ? "Sua oferta especial foi liberada!" 
    : "Obrigado pela compra! Seu acesso foi liberado."

  try {
    switch (deliverable.type) {
      case "media":
        // Enviar midias
        console.log(`[v0] DELIVERY: Processando tipo MEDIA`)
        console.log(`[v0] DELIVERY: Medias count: ${deliverable.medias?.length || 0}`)
        if (deliverable.medias && deliverable.medias.length > 0) {
          // Enviar mensagem de introducao se for order bump
          if (isOrderBump) {
            await sendTelegramMessage(botToken, chatId, "Agora, acesse o conteudo da sua <b>oferta especial</b>:")
            await sleep(500)
          }
          console.log(`[v0] DELIVERY: Enviando ${deliverable.medias.length} midias...`)
          for (let i = 0; i < deliverable.medias.length; i++) {
            const mediaUrl = deliverable.medias[i]
            console.log(`[v0] DELIVERY: Enviando midia ${i + 1}/${deliverable.medias.length}: ${mediaUrl.substring(0, 50)}...`)
            if (mediaUrl.includes(".mp4") || mediaUrl.includes("video")) {
              await sendTelegramVideo(botToken, chatId, mediaUrl, "")
            } else {
              await sendTelegramPhoto(botToken, chatId, mediaUrl, "")
            }
            await sleep(500)
          }
          console.log(`[v0] DELIVERY: Todas as midias enviadas com sucesso!`)
          await sendTelegramMessage(botToken, chatId, `${thankYouMessage} ${contentMessage}`)
        } else {
          console.log(`[v0] DELIVERY: AVISO - Nenhuma midia configurada no entregavel!`)
          await sendTelegramMessage(botToken, chatId, defaultMessage)
        }
        break

      case "link":
        // Enviar link com botao
        console.log(`[v0] DELIVERY: Processando tipo LINK`)
        console.log(`[v0] DELIVERY: Link: ${deliverable.link}`)
        console.log(`[v0] DELIVERY: LinkText: ${deliverable.linkText}`)
        if (deliverable.link) {
          const buttonText = isOrderBump 
            ? (deliverable.linkText || "Acessar Oferta Especial") 
            : (deliverable.linkText || "Acessar conteudo")
          const keyboard = {
            inline_keyboard: [
              [{ text: buttonText, url: deliverable.link }]
            ]
          }
          console.log(`[v0] DELIVERY: Enviando link com botao "${buttonText}"`)
          await sendTelegramMessage(botToken, chatId, `${thankYouMessage} ${accessMessage}`, keyboard)
          console.log(`[v0] DELIVERY: Link enviado com sucesso!`)
        } else {
          console.log(`[v0] DELIVERY: AVISO - Nenhum link configurado no entregavel!`)
          await sendTelegramMessage(botToken, chatId, defaultMessage)
        }
        break

      case "vip_group":
        // Criar link de convite unico e enviar
        console.log(`[v0] DELIVERY: Processando tipo VIP_GROUP`)
        console.log(`[v0] DELIVERY: vipGroupChatId: ${deliverable.vipGroupChatId}`)
        console.log(`[v0] DELIVERY: vipGroupName: ${deliverable.vipGroupName}`)
        if (deliverable.vipGroupChatId) {
          console.log(`[v0] DELIVERY: Criando link de convite unico para grupo ${deliverable.vipGroupChatId}...`)
          const inviteLink = await createVipInviteLink(botToken, deliverable.vipGroupChatId)
          console.log(`[v0] DELIVERY: Invite link criado: ${inviteLink}`)
          if (inviteLink) {
            const groupName = deliverable.vipGroupName || (isOrderBump ? "Grupo da Oferta Especial" : "Grupo VIP")
            const keyboard = {
              inline_keyboard: [
                [{ text: `Entrar no ${groupName}`, url: inviteLink }]
              ]
            }
            const vipMessage = isOrderBump
              ? `Sua oferta especial foi liberada! Seu acesso ao <b>${groupName}</b> esta disponivel.\n\n<i>Este link e unico e pode ser usado apenas uma vez.</i>`
              : `Obrigado pela compra! Seu acesso ao <b>${groupName}</b> foi liberado.\n\n<i>Este link e unico e pode ser usado apenas uma vez.</i>`
            console.log(`[v0] DELIVERY: Enviando mensagem com link de convite para ${groupName}`)
            await sendTelegramMessage(botToken, chatId, vipMessage, keyboard)
            console.log(`[v0] DELIVERY: Link de grupo VIP enviado com sucesso!`)
          } else {
            console.log(`[v0] DELIVERY: ERRO - Falha ao criar link de convite!`)
            await sendTelegramMessage(botToken, chatId, `${thankYouMessage} Houve um problema ao gerar seu link de acesso. Entre em contato com o suporte.`)
          }
        } else {
          console.log(`[v0] DELIVERY: AVISO - Nenhum vipGroupChatId configurado!`)
          await sendTelegramMessage(botToken, chatId, defaultMessage)
        }
        break
      
      default:
        console.log(`[v0] DELIVERY: AVISO - Tipo de entregavel desconhecido: ${deliverable.type}`)
        await sendTelegramMessage(botToken, chatId, defaultMessage)
    }
  } catch (error) {
    console.error(`[v0] DELIVERY: ERRO ao enviar entregavel:`, error)
    await sendTelegramMessage(botToken, chatId, defaultMessage)
  }

  console.log(`[v0] DELIVERY: ========== sendDeliverable FIM ==========`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendDelivery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  botToken: string,
  chatId: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  flowConfig: Record<string, any> | null,
  deliverableId?: string, // ID do entregavel especifico (para upsell/downsell)
  isOrderBump: boolean = false // Indica se e entrega de order bump
) {
  console.log(`[v0] DELIVERY: ========== INICIO sendDelivery ==========`)
  console.log(`[v0] DELIVERY: chatId=${chatId}, deliverableId=${deliverableId || "main"}, isOrderBump=${isOrderBump}`)
  console.log(`[v0] DELIVERY: flowConfig existe?`, !!flowConfig)
  console.log(`[v0] DELIVERY: flowConfig.deliverables?`, flowConfig?.deliverables?.length || 0)
  console.log(`[v0] DELIVERY: flowConfig.mainDeliverableId?`, flowConfig?.mainDeliverableId || "NAO DEFINIDO")
  console.log(`[v0] DELIVERY: flowConfig.delivery?`, !!flowConfig?.delivery)
  
  // Log detalhado dos entregaveis disponiveis
  if (flowConfig?.deliverables && flowConfig.deliverables.length > 0) {
    console.log(`[v0] DELIVERY: Lista de entregaveis disponiveis:`)
    for (const d of flowConfig.deliverables) {
      console.log(`[v0] DELIVERY:   - ID: ${d.id}, Nome: ${d.name}, Tipo: ${d.type}`)
    }
  }

  // Se tiver um deliverableId especifico, buscar e usar esse entregavel
  if (deliverableId && flowConfig?.deliverables) {
    console.log(`[v0] DELIVERY: Buscando entregavel especifico com ID: ${deliverableId}`)
    const deliverable = flowConfig.deliverables.find((d: Deliverable) => d.id === deliverableId)
    if (deliverable) {
      console.log(`[v0] DELIVERY: Encontrado entregavel especifico: ${deliverable.name} (${deliverable.type})`)
      await sendDeliverable(botToken, chatId, deliverable, isOrderBump)
      console.log(`[v0] DELIVERY: ========== FIM sendDelivery (via ID especifico) ==========`)
      return
    } else {
      console.log(`[v0] DELIVERY: AVISO - Entregavel especifico ${deliverableId} NAO encontrado!`)
    }
  }

  // Se tiver mainDeliverableId configurado, usar o entregavel principal
  if (flowConfig?.mainDeliverableId && flowConfig?.deliverables) {
    console.log(`[v0] DELIVERY: Buscando entregavel principal com ID: ${flowConfig.mainDeliverableId}`)
    const mainDeliverable = flowConfig.deliverables.find((d: Deliverable) => d.id === flowConfig.mainDeliverableId)
    if (mainDeliverable) {
      console.log(`[v0] DELIVERY: Encontrado entregavel principal: ${mainDeliverable.name} (${mainDeliverable.type})`)
      await sendDeliverable(botToken, chatId, mainDeliverable, isOrderBump)
      console.log(`[v0] DELIVERY: ========== FIM sendDelivery (via mainDeliverableId) ==========`)
      return
    } else {
      console.log(`[v0] DELIVERY: AVISO - Entregavel principal ${flowConfig.mainDeliverableId} NAO encontrado nos deliverables!`)
    }
  }

  console.log(`[v0] DELIVERY: Usando sistema LEGADO de delivery (fallback)`)

  // Fallback: usar o sistema antigo de delivery (para compatibilidade)
  if (flowConfig?.delivery) {
    const delivery = flowConfig.delivery
    console.log(`[v0] DELIVERY: Sistema legado - delivery.type: ${delivery.type}`)

    // Verificar tipo de entrega do sistema antigo
    if (delivery.type === "vip_group" && delivery.vipGroupId) {
      // Grupo VIP (sistema antigo)
      console.log(`[v0] DELIVERY: Sistema legado - Tipo VIP_GROUP, vipGroupId: ${delivery.vipGroupId}`)
      const inviteLink = await createVipInviteLink(botToken, delivery.vipGroupId)
      if (inviteLink) {
        const groupName = delivery.vipGroupName || "Grupo VIP"
        const keyboard = {
          inline_keyboard: [
            [{ text: `Entrar no ${groupName}`, url: inviteLink }]
          ]
        }
        await sendTelegramMessage(
          botToken,
          chatId,
          `Obrigado pela compra! Seu acesso ao <b>${groupName}</b> foi liberado.\n\n<i>Este link e unico e pode ser usado apenas uma vez.</i>`,
          keyboard
        )
        console.log(`[v0] DELIVERY: Link VIP enviado com sucesso (sistema legado)`)
      } else {
        console.log(`[v0] DELIVERY: ERRO - Falha ao criar link VIP (sistema legado)`)
        await sendTelegramMessage(botToken, chatId, "Obrigado pela compra! Houve um problema ao gerar seu link de acesso. Entre em contato com o suporte.")
      }
      console.log(`[v0] DELIVERY: ========== FIM sendDelivery (VIP legado) ==========`)
      return
    }

    // Enviar midias de entrega (sistema antigo)
    if (delivery.medias && delivery.medias.length > 0) {
      console.log(`[v0] DELIVERY: Sistema legado - Enviando ${delivery.medias.length} midias`)
      for (const mediaUrl of delivery.medias) {
        if (mediaUrl.includes(".mp4") || mediaUrl.includes("video")) {
          await sendTelegramVideo(botToken, chatId, mediaUrl, "")
        } else {
          await sendTelegramPhoto(botToken, chatId, mediaUrl, "")
        }
        await sleep(500)
      }
      console.log(`[v0] DELIVERY: Midias enviadas com sucesso (sistema legado)`)
    }

    // Enviar link de acesso (sistema antigo)
    if (delivery.link) {
      console.log(`[v0] DELIVERY: Sistema legado - Enviando link: ${delivery.link}`)
      const buttonText = delivery.linkText || "Acessar conteudo"
      const keyboard = {
        inline_keyboard: [
          [{ text: buttonText, url: delivery.link }]
        ]
      }
      await sendTelegramMessage(botToken, chatId, "Seu acesso foi liberado! Clique no botao abaixo:", keyboard)
    } else if (!delivery.medias || delivery.medias.length === 0) {
      console.log(`[v0] DELIVERY: Sistema legado - Sem midias e sem link, enviando mensagem padrao`)
      await sendTelegramMessage(botToken, chatId, "Obrigado pela compra! Seu acesso foi liberado.")
    }
  } else {
    console.log(`[v0] DELIVERY: AVISO - Nenhum entregavel configurado! Enviando mensagem padrao.`)
    await sendTelegramMessage(botToken, chatId, "Obrigado pela compra! Seu acesso foi liberado.")
  }

  console.log(`[v0] DELIVERY: ========== FIM sendDelivery ==========`)
}

// ---------------------------------------------------------------------------
// Webhook handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  console.log("[v0] MP WEBHOOK CHAMADO!")
  try {
    const body = await request.json()
    
    console.log("[v0] MP webhook body:", JSON.stringify(body))

    // O Mercado Pago envia diferentes tipos de notificacao
    if (body.type === "payment" || body.action === "payment.updated") {
      const paymentId = body.data?.id || body.id

      if (!paymentId) {
        return NextResponse.json({ received: true })
      }

      const supabase = getSupabaseAdmin()

      // Busca o pagamento no banco pelo external_payment_id
      console.log("[v0] Buscando pagamento com external_payment_id:", String(paymentId))
      const { data: payment, error } = await supabase
        .from("payments")
        .select("*")
        .eq("external_payment_id", String(paymentId))
        .single()

      console.log("[v0] Pagamento encontrado:", payment?.id, "erro:", error?.message)

      if (error || !payment) {
        console.log("[v0] Payment not found for webhook:", paymentId, "error:", error)
        return NextResponse.json({ received: true })
      }

      // Busca o gateway para pegar o access_token
      // Gateway e global por usuario, nao por bot - precisa buscar pelo user_id do pagamento
      // Se o pagamento tem user_id, usa ele. Senao, busca o user_id do bot
      let gatewayUserId = payment.user_id
      
      if (!gatewayUserId && payment.bot_id) {
        // Busca o user_id do bot
        const { data: bot } = await supabase
          .from("bots")
          .select("user_id")
          .eq("id", payment.bot_id)
          .single()
        gatewayUserId = bot?.user_id
      }
      
      console.log("[v0] Buscando gateway para user_id:", gatewayUserId)
      const { data: gateway, error: gatewayError } = await supabase
        .from("user_gateways")
        .select("access_token")
        .eq("user_id", gatewayUserId)
        .eq("is_active", true)
        .single()
      
      console.log("[v0] Gateway encontrado:", !!gateway, "erro:", gatewayError?.message)
      
      const accessToken = gateway?.access_token
      if (!accessToken) {
        console.log("[v0] ERRO: Nenhum access_token encontrado para o bot")
        return NextResponse.json({ received: true, error: "no_access_token" })
      }
      
      if (accessToken) {
        console.log("[v0] Consultando API do MP para pagamento:", paymentId)
        const mpResponse = await fetch(
          `https://api.mercadopago.com/v1/payments/${paymentId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        )

        console.log("[v0] MP API response status:", mpResponse.status)

        if (mpResponse.ok) {
          const mpData = await mpResponse.json()
          const newStatus = mpData.status
          console.log("[v0] Status do MP:", newStatus, "status_detail:", mpData.status_detail)

          // Atualiza o status no banco
          const { error: updateError } = await supabase
            .from("payments")
            .update({
              status: newStatus,
              updated_at: new Date().toISOString(),
            })
            .eq("id", payment.id)

          console.log("[v0] Payment", paymentId, "updated to status:", newStatus, "error:", updateError?.message)

          // ========== PAGAMENTO APROVADO - DISPARAR UPSELL ==========
          if (newStatus === "approved") {
            console.log(`Payment ${paymentId} approved! User: ${payment.telegram_user_id}, Product Type: ${payment.product_type}`)

            // Buscar bot e dados do usuario
            const { data: bot } = await supabase
              .from("bots")
              .select("id, token, user_id")
              .eq("id", payment.bot_id)
              .single()

            if (bot?.token && payment.telegram_user_id) {
              const chatId = parseInt(payment.telegram_user_id)
              
              // CANCELAR todos os downsells pendentes (usuario ja pagou)
              // Cancelar por bot_id + telegram_user_id (cancela de todos os fluxos deste bot)
              const { data: cancelledDownsells } = await supabase
                .from("scheduled_messages")
                .update({ status: "cancelled" })
                .eq("bot_id", payment.bot_id)
                .eq("telegram_user_id", payment.telegram_user_id)
                .eq("message_type", "downsell")
                .eq("status", "pending")
                .select("id")
              
              console.log(`[DOWNSELL] Cancelled ${cancelledDownsells?.length || 0} pending downsells for user ${payment.telegram_user_id}`)
              
              // ATUALIZAR user_flow_state para "paid" (usado pelo cron para verificar se deve enviar downsell)
              // Incluir flow_id se disponivel no pagamento
              const userFlowStateData: Record<string, unknown> = {
                bot_id: payment.bot_id,
                telegram_user_id: payment.telegram_user_id,
                status: "paid",
                updated_at: new Date().toISOString()
              }
              
              if (payment.flow_id) {
                userFlowStateData.flow_id = payment.flow_id
              }
              
              await supabase
                .from("user_flow_state")
                .upsert(userFlowStateData, { onConflict: "bot_id,telegram_user_id" })
              
              console.log(`[PAYMENT] User ${payment.telegram_user_id} marked as paid in user_flow_state (flow_id: ${payment.flow_id || 'N/A'})`)

              // Se for pagamento do produto principal ou order bump, verificar se tem upsell
              if (payment.product_type === "main_product" || payment.product_type === "order_bump" || payment.product_type === "plan" || payment.product_type === "plan_order_bump" || payment.product_type === "pack" || payment.product_type === "pack_order_bump") {
                // Buscar fluxo vinculado ao bot
                let flowId: string | null = null
                
                // Primeiro tenta pelo bot_id direto
                const { data: directFlow } = await supabase
                  .from("flows")
                  .select("id, config")
                  .eq("bot_id", bot.id)
                  .limit(1)
                  .single()
                
                if (directFlow) {
                  flowId = directFlow.id
                } else {
                  // Busca via flow_bots
                  const { data: flowBotLink } = await supabase
                    .from("flow_bots")
                    .select("flow_id")
                    .eq("bot_id", bot.id)
                    .limit(1)
                    .single()
                  
                  if (flowBotLink) {
                    flowId = flowBotLink.flow_id
                  }
                }

                if (flowId) {
                  // Buscar config do fluxo
                  const { data: flowData } = await supabase
                    .from("flows")
                    .select("config")
                    .eq("id", flowId)
                    .single()

                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const flowConfig = flowData?.config as Record<string, any> | null
                  const upsellConfig = flowConfig?.upsell
                  const upsellSequences = upsellConfig?.sequences || []
                  
                  // Buscar planos do flow principal (para usar quando useDefaultPlans = true no upsell)
                  // Primeiro tenta da tabela flow_plans, se vazio usa o config JSON
                  const { data: mainFlowPlansForUpsellDb } = await supabase
                    .from("flow_plans")
                    .select("id, name, price")
                    .eq("flow_id", flowId)
                    .eq("is_active", true)
                    .order("position", { ascending: true })

                  // Fallback: se nao tem planos na tabela, pegar do config JSON (planos legados)
                  let mainFlowPlansForUpsell = mainFlowPlansForUpsellDb || []
                  if (mainFlowPlansForUpsell.length === 0) {
                    const configPlans = (flowConfig?.plans as Array<{ id: string; name: string; price: number; active?: boolean }>) || []
                    mainFlowPlansForUpsell = configPlans.filter(p => p.active !== false).map(p => ({
                      id: p.id,
                      name: p.name,
                      price: p.price
                    }))
                    console.log(`[UPSELL] Usando planos do config JSON (fallback):`, JSON.stringify(mainFlowPlansForUpsell))
                  }
                  const paymentMessages = flowConfig?.paymentMessages as {
                    approvedMessage?: string
                    approvedMedias?: string[]
                    accessButtonText?: string
                    accessButtonUrl?: string
                  } | undefined

                  console.log(`[v0] Flow ${flowId} config keys:`, Object.keys(flowConfig || {}))
                  console.log(`[v0] mainDeliverableId:`, flowConfig?.mainDeliverableId)
                  console.log(`[v0] deliverables count:`, flowConfig?.deliverables?.length || 0)
                  
                  // Log detalhado de cada entregavel
                  if (flowConfig?.deliverables && flowConfig.deliverables.length > 0) {
                    console.log(`[v0] ENTREGAVEIS CONFIGURADOS:`)
                    for (const del of flowConfig.deliverables) {
                      console.log(`[v0]   - ID: ${del.id}`)
                      console.log(`[v0]     Nome: ${del.name}`)
                      console.log(`[v0]     Tipo: ${del.type}`)
                      if (del.type === "media") {
                        console.log(`[v0]     Midias: ${del.medias?.length || 0} arquivos`)
                      } else if (del.type === "link") {
                        console.log(`[v0]     Link: ${del.link}`)
                        console.log(`[v0]     LinkText: ${del.linkText}`)
                      } else if (del.type === "vip_group") {
                        console.log(`[v0]     VIP Chat ID: ${del.vipGroupChatId}`)
                        console.log(`[v0]     VIP Nome: ${del.vipGroupName}`)
                      }
                    }
                  } else {
                    console.log(`[v0] AVISO: Nenhum entregavel configurado no flow!`)
                  }
                  
                  console.log(`[v0] paymentMessages:`, !!paymentMessages)
                  console.log(`[v0] UPSELL: Flow ${flowId} has ${upsellSequences.length} upsell sequences, enabled: ${upsellConfig?.enabled}`)

                  // Buscar nome do usuario para variavel {nome} e {username}
                  let userName = "Cliente"
                  let userUsername = ""
                  try {
                    const { data: userData } = await supabase
                      .from("bot_users")
                      .select("first_name, last_name, username")
                      .eq("bot_id", bot.id)
                      .eq("telegram_user_id", String(chatId))
                      .single()
                    if (userData?.first_name) {
                      userName = userData.first_name
                    }
                    if (userData?.username) {
                      userUsername = userData.username
                    }
                  } catch { /* ignore */ }

                  // Enviar midias de pagamento aprovado (se configurado)
                  if (paymentMessages?.approvedMedias && paymentMessages.approvedMedias.length > 0) {
                    console.log(`[v0] Sending ${paymentMessages.approvedMedias.length} approved medias`)
                    for (const mediaUrl of paymentMessages.approvedMedias) {
                      if (mediaUrl.includes(".mp4") || mediaUrl.includes("video")) {
                        await sendTelegramVideo(bot.token, chatId, mediaUrl, "")
                      } else {
                        await sendTelegramPhoto(bot.token, chatId, mediaUrl, "")
                      }
                      await sleep(500)
                    }
                  }

                  // Enviar mensagem de pagamento aprovado personalizada
                  const defaultApprovedMsg = `<b>Pagamento Aprovado!</b>\n\nParabens ${userName}! Seu pagamento foi confirmado.\n\nVoce ja tem acesso ao conteudo!`
                  let approvedMsg = paymentMessages?.approvedMessage || defaultApprovedMsg
                  // Substituir variaveis {nome} e {username}
                  approvedMsg = approvedMsg.replace(/\{nome\}/gi, userName)
                  approvedMsg = approvedMsg.replace(/\{username\}/gi, userUsername ? `@${userUsername}` : "")

                  // Construir botao de acesso
                  const accessButtonText = paymentMessages?.accessButtonText || "Acessar Conteudo"
                  const accessButtonUrl = paymentMessages?.accessButtonUrl

                  if (accessButtonUrl) {
                    // Tem URL de acesso configurado - enviar com botao de link
                    await sendTelegramMessage(
                      bot.token,
                      chatId,
                      approvedMsg,
                      {
                        inline_keyboard: [[{ text: accessButtonText, url: accessButtonUrl }]]
                      }
                    )
                  } else {
                    // Sem URL especifica - usar callback para acionar entregavel
                    await sendTelegramMessage(
                      bot.token,
                      chatId,
                      approvedMsg,
                      {
                        inline_keyboard: [[{ text: accessButtonText, callback_data: "access_deliverable" }]]
                      }
                    )
                  }

                  // ========== ENTREGAR PRODUTO PRINCIPAL ==========
                  // Verificar se o pagamento tem deliverableId especifico do plano no metadata
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const paymentMetadata = payment.metadata as Record<string, any> | null
                  const planDeliverableId = paymentMetadata?.plan_deliverable_id
                  const planIdFromPayment = paymentMetadata?.plan_id
                  
                  console.log(`[v0] DELIVERY: Enviando entregavel inicial para usuario ${chatId}`)
                  console.log(`[v0] DELIVERY: paymentMetadata=`, JSON.stringify(paymentMetadata))
                  console.log(`[v0] DELIVERY: planDeliverableId="${planDeliverableId}", planIdFromPayment="${planIdFromPayment}"`)
                  
                  // Se o plano tem deliverableId especifico, usar ele
                  // Senao, usar o mainDeliverableId global (que sendDelivery ja faz)
                  if (planDeliverableId && planDeliverableId !== "") {
                    console.log(`[v0] DELIVERY: Usando deliverableId ESPECIFICO do plano: ${planDeliverableId}`)
                    await sendDelivery(supabase, bot.token, chatId, flowConfig, planDeliverableId)
                  } else {
                    // Se nao tem deliverableId no metadata, tentar buscar do plano no config
                    let foundPlanDeliverableId = ""
                    
                    if (planIdFromPayment) {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const configPlans = (flowConfig?.plans as Array<Record<string, any>>) || []
                      const planFromConfig = configPlans.find(p => p.id === planIdFromPayment)
                      foundPlanDeliverableId = planFromConfig?.deliverableId || ""
                      console.log(`[v0] DELIVERY: Buscou deliverableId do plan "${planIdFromPayment}" no config: "${foundPlanDeliverableId}"`)
                    }
                    
                    if (foundPlanDeliverableId) {
                      console.log(`[v0] DELIVERY: Usando deliverableId do plano encontrado no config: ${foundPlanDeliverableId}`)
                      await sendDelivery(supabase, bot.token, chatId, flowConfig, foundPlanDeliverableId)
                    } else {
                      console.log(`[v0] DELIVERY: Usando mainDeliverableId GLOBAL (fallback)`)
                      await sendDelivery(supabase, bot.token, chatId, flowConfig)
                    }
                  }
                  
                  // ========== ENTREGAR ORDER BUMP SE HOUVER ==========
                  // Verifica se o pagamento inclui order bump e entrega o entregavel do order bump tambem
                  const orderBumpDeliverableId = paymentMetadata?.order_bump_deliverable_id
                  const orderBumpIdFromMetadata = paymentMetadata?.order_bump_id
                  const orderBumpConfigGlobal = flowConfig?.orderBump?.inicial as Record<string, unknown> | undefined
                  
                  console.log(`[v0] ORDER BUMP CHECK: product_type=${payment.product_type}`)
                  console.log(`[v0] ORDER BUMP CHECK: metadata=`, JSON.stringify(paymentMetadata))
                  console.log(`[v0] ORDER BUMP CHECK: orderBumpDeliverableId (metadata)="${orderBumpDeliverableId}"`)
                  console.log(`[v0] ORDER BUMP CHECK: orderBumpId (metadata)="${orderBumpIdFromMetadata}"`)
                  console.log(`[v0] ORDER BUMP CHECK: orderBumpConfig global=`, JSON.stringify(orderBumpConfigGlobal))
                  
                  // Determinar qual deliverableId usar para o order bump
                  // Prioridade: 1) metadata do pagamento, 2) order bump especifico do plano, 3) config global do order bump
                  let finalOrderBumpDeliverableId = ""
                  
                  if (orderBumpDeliverableId && orderBumpDeliverableId !== "") {
                    finalOrderBumpDeliverableId = orderBumpDeliverableId
                    console.log(`[v0] ORDER BUMP: Usando deliverableId do METADATA: ${finalOrderBumpDeliverableId}`)
                  } else {
                    // Buscar deliverableId do order bump especifico do plano
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const configPlans = (flowConfig?.plans as Array<Record<string, any>>) || []
                    
                    // Primeiro tentar encontrar pelo order_bump_id do metadata
                    if (orderBumpIdFromMetadata) {
                      for (const plan of configPlans) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const planOrderBumps = (plan.order_bumps as Array<Record<string, any>>) || []
                        const matchingOb = planOrderBumps.find((ob: Record<string, unknown>) => ob.id === orderBumpIdFromMetadata)
                        if (matchingOb?.deliverableId) {
                          finalOrderBumpDeliverableId = matchingOb.deliverableId as string
                          console.log(`[v0] ORDER BUMP: Encontrado deliverableId pelo order_bump_id "${orderBumpIdFromMetadata}": ${finalOrderBumpDeliverableId}`)
                          break
                        }
                      }
                    }
                    
                    // Se nao encontrou pelo ID, tentar pelo plan_id do metadata
                    if (!finalOrderBumpDeliverableId && planIdFromPayment) {
                      const planFromConfig = configPlans.find(p => p.id === planIdFromPayment)
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const planOrderBumps = (planFromConfig?.order_bumps as Array<Record<string, any>>) || []
                      if (planOrderBumps.length > 0 && planOrderBumps[0].deliverableId) {
                        finalOrderBumpDeliverableId = planOrderBumps[0].deliverableId as string
                        console.log(`[v0] ORDER BUMP: Usando deliverableId do PRIMEIRO order bump do plano "${planIdFromPayment}": ${finalOrderBumpDeliverableId}`)
                      }
                    }
                    
                    // NOVO FALLBACK: Se nao tem plan_id no metadata, buscar em TODOS os planos pelo primeiro order bump com deliverableId
                    if (!finalOrderBumpDeliverableId) {
                      for (const plan of configPlans) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const planOrderBumps = (plan.order_bumps as Array<Record<string, any>>) || []
                        if (planOrderBumps.length > 0 && planOrderBumps[0].deliverableId) {
                          finalOrderBumpDeliverableId = planOrderBumps[0].deliverableId as string
                          console.log(`[v0] ORDER BUMP: FALLBACK - Usando deliverableId do primeiro plano com order bump "${plan.name}": ${finalOrderBumpDeliverableId}`)
                          break
                        }
                      }
                    }
                    
                    // Fallback final: config global do order bump
                    if (!finalOrderBumpDeliverableId && orderBumpConfigGlobal?.deliverableId && orderBumpConfigGlobal.deliverableId !== "") {
                      finalOrderBumpDeliverableId = orderBumpConfigGlobal.deliverableId as string
                      console.log(`[v0] ORDER BUMP: Usando deliverableId do CONFIG GLOBAL: ${finalOrderBumpDeliverableId}`)
                    }
                  }
                  
                  // Se é um pagamento de order bump, entregar o entregavel do order bump
                  const isOrderBumpPayment = payment.product_type === "plan_order_bump" || payment.product_type === "order_bump" || payment.product_type === "pack_order_bump"
                  
                  console.log(`[v0] ORDER BUMP DECISION: isOrderBumpPayment=${isOrderBumpPayment}, finalDeliverableId="${finalOrderBumpDeliverableId}"`)
                  
                  if (isOrderBumpPayment && finalOrderBumpDeliverableId && finalOrderBumpDeliverableId !== "") {
                    console.log(`[v0] ORDER BUMP DELIVERY: Entregando order bump com deliverableId: ${finalOrderBumpDeliverableId}`)
                    // Passar isOrderBump=true para enviar mensagem diferenciada
                    await sendDelivery(supabase, bot.token, chatId, flowConfig, finalOrderBumpDeliverableId, true)
                  } else if (isOrderBumpPayment) {
                    // Se for pagamento de order bump mas nao tem entregavel especifico
                    const deliveryType = orderBumpConfigGlobal?.deliveryType || "same"
                    if (deliveryType === "same") {
                      console.log(`[v0] ORDER BUMP DELIVERY: deliveryType=same, order bump usa MESMO entregavel do principal (ja foi entregue acima)`)
                    } else {
                      console.log(`[v0] ORDER BUMP DELIVERY: AVISO - Order bump configurado como custom mas sem deliverableId!`)
                    }
                  }

                  // ========== MARCAR USUARIO COMO VIP ==========
                  // Apenas para produtos principais (plan, main_product), NAO para order_bump ou pack
                  const isMainProduct = payment.product_type === "main_product" || payment.product_type === "plan"
                  
                  if (isMainProduct) {
                    // Calcular data de expiracao baseado no plano (se houver)
                    let expiresAt = null
                    if (flowConfig?.subscription?.enabled && payment.metadata?.plan_days) {
                      const planDays = parseInt(payment.metadata.plan_days) || 30
                      expiresAt = new Date(Date.now() + planDays * 24 * 60 * 60 * 1000).toISOString()
                    }

                    // Atualizar bot_user como VIP
                    const { error: vipError } = await supabase
                      .from("bot_users")
                      .update({
                        is_vip: true,
                        vip_since: new Date().toISOString(),
                        vip_expires_at: expiresAt,
                        updated_at: new Date().toISOString()
                      })
                      .eq("bot_id", bot.id)
                      .eq("telegram_user_id", String(chatId))

                    if (vipError) {
                      console.log(`[VIP] Error marking user as VIP:`, vipError.message)
                    } else {
                      console.log(`[VIP] User ${chatId} marked as VIP, expires: ${expiresAt || "never"}`)
                    }
                  } else {
                    console.log(`[VIP] Skipping VIP marking for product_type: ${payment.product_type}`)
                  }

                  // Depois verificar se tem upsell para enviar - AGENDAR TODAS AS SEQUENCIAS (igual downsell)
                  // Para produto principal OU produto principal com order bump, NAO para upsell/downsell
                  const shouldScheduleUpsell = 
                    payment.product_type === "main_product" || 
                    payment.product_type === "plan" ||
                    payment.product_type === "order_bump" ||
                    payment.product_type === "plan_order_bump" ||
                    payment.product_type === "pack" ||
                    payment.product_type === "pack_order_bump"
                  console.log(`[UPSELL] product_type: ${payment.product_type}, shouldScheduleUpsell: ${shouldScheduleUpsell}`)
                  console.log(`[UPSELL] upsellConfig enabled: ${upsellConfig?.enabled}, sequences: ${upsellSequences.length}`)
                  
                  if (shouldScheduleUpsell && upsellConfig?.enabled && upsellSequences.length > 0) {
                    console.log(`[UPSELL] ========== VERIFICANDO SE JA TEM UPSELL AGENDADO ==========`)
                    
                    // VERIFICAR SE JA EXISTE UPSELL PENDENTE PARA ESTE USUARIO (evita repeticao)
                    const { data: existingUpsells } = await supabase
                      .from("scheduled_messages")
                      .select("id, sequence_index")
                      .eq("bot_id", bot.id)
                      .eq("telegram_user_id", String(chatId))
                      .eq("message_type", "upsell")
                      .eq("status", "pending")
                    
                    if (existingUpsells && existingUpsells.length > 0) {
                      console.log(`[UPSELL] JA EXISTE ${existingUpsells.length} upsell(s) pendente(s) para usuario ${chatId} - NAO AGENDANDO NOVAMENTE`)
                      console.log(`[UPSELL] IDs existentes: ${existingUpsells.map(u => u.id).join(", ")}`)
                    } else {
                      console.log(`[UPSELL] ========== AGENDANDO UPSELL ==========`)
                      console.log(`[UPSELL] Agendando ${upsellSequences.length} sequencias de upsell para usuario ${chatId}`)
                      console.log(`[UPSELL] Bot ID: ${bot.id}, Flow ID: ${flowId}`)
                    
                      // Agendar TODAS as sequencias de upsell na tabela scheduled_messages
                      let cumulativeDelayMs = 0
                    
                      for (let i = 0; i < upsellSequences.length; i++) {
                      const upsellSeq = upsellSequences[i]
                      
                      // Calcular delay para esta sequencia
                      const seqDelayMs = calculateDelayMs(
                        upsellSeq.sendDelayValue || 1,
                        upsellSeq.sendDelayUnit || "minutes"
                      )
                      cumulativeDelayMs += seqDelayMs
                      
                      const scheduledFor = new Date(Date.now() + cumulativeDelayMs).toISOString()
                      
                      // Determinar quais planos usar: se useDefaultPlans = true, usa os planos do fluxo principal com desconto
                      let plansToUseUpsell: Array<{ id: string; buttonText?: string; name?: string; price: number }> = []
                      const useDefaultPlansUpsell = upsellSeq.useDefaultPlans !== false // default true
                      const discountPercentUpsell = upsellSeq.discountPercent || 20 // default 20%

                      if (useDefaultPlansUpsell && mainFlowPlansForUpsell && mainFlowPlansForUpsell.length > 0) {
                        // Usar planos do fluxo principal com desconto aplicado
                        plansToUseUpsell = mainFlowPlansForUpsell.map(plan => {
                          const discountedPrice = plan.price * (1 - discountPercentUpsell / 100)
                          return {
                            id: plan.id,
                            buttonText: plan.name,
                            name: plan.name,
                            price: Math.round(discountedPrice * 100) / 100 // Arredondar para 2 casas decimais
                          }
                        })
                        console.log(`[UPSELL] Usando planos do fluxo principal com ${discountPercentUpsell}% desconto:`, JSON.stringify(plansToUseUpsell))
                      } else {
                        // Usar planos personalizados da sequencia
                        plansToUseUpsell = upsellSeq.plans || []
                        console.log(`[UPSELL] Usando planos personalizados da sequencia:`, JSON.stringify(plansToUseUpsell))
                      }
                      
                      // Inserir na tabela scheduled_messages (mesma estrutura do downsell)
                      const { error: insertError } = await supabase
                        .from("scheduled_messages")
                        .insert({
                          bot_id: bot.id,
                          flow_id: flowId,
                          telegram_user_id: String(chatId),
                          telegram_chat_id: String(chatId),
                          message_type: "upsell",
                          sequence_id: upsellSeq.id || `seq-${i}`,
                          sequence_index: i,
                          scheduled_for: scheduledFor,
                          status: "pending",
                          metadata: {
                            message: upsellSeq.message || "",
                            medias: upsellSeq.medias || [],
                            plans: plansToUseUpsell,
                            botToken: bot.token,
                            deliveryType: upsellSeq.deliveryType || "global",
                            deliverableId: upsellSeq.deliverableId,
                            sequence_index: i, // Indice da sequencia para usar no callback
                            // Flag para mostrar preco no botao (ex: "Mensal por R$ 20,00")
                            showPriceInButton: upsellSeq.showPriceInButton === true,
                            // Dados do usuario para substituir variaveis {NOME} e {USERNAME}
                            userFirstName: userName || "",
                            userUsername: userUsername || "",
                            // Info de desconto (para referencia)
                            useDefaultPlans: useDefaultPlansUpsell,
                            discountPercent: useDefaultPlansUpsell ? discountPercentUpsell : undefined,
                          },
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString()
                        })
                      
                      if (insertError) {
                        console.error(`[UPSELL] ERRO ao agendar upsell ${i}:`, insertError.message)
                        console.error(`[UPSELL] Detalhes do erro:`, JSON.stringify(insertError))
                      } else {
                        console.log(`[UPSELL] SUCCESS - Upsell ${i} agendado para ${scheduledFor}`)
                        console.log(`[UPSELL] Dados: message="${upsellSeq.message?.substring(0, 50)}...", plans=${upsellSeq.plans?.length || 0}`)
                      }
                    }
                    } // Fecha o else do existingUpsells check
                  } else {
                    console.log(`[UPSELL] ========== NAO AGENDOU UPSELL ==========`)
                    console.log(`[UPSELL] shouldScheduleUpsell: ${shouldScheduleUpsell}`)
                    console.log(`[UPSELL] upsellConfig?.enabled: ${upsellConfig?.enabled}`)
                    console.log(`[UPSELL] upsellSequences.length: ${upsellSequences.length}`)
                    console.log(`[UPSELL] product_type: ${payment.product_type}`)
                  }
                } else {
                  console.log(`[v0] DELIVERY: No flow found for bot ${bot.id}`)
                }
              } else if (payment.product_type === "upsell") {
                // Pagamento de upsell aprovado - verificar se tem proximo upsell
                console.log(`[UPSELL] Upsell payment approved for user ${chatId}`)
                
                // Buscar estado para ver qual upsell foi pago
                const { data: state } = await supabase
                  .from("user_flow_state")
                  .select("flow_id, metadata")
                  .eq("bot_id", bot.id)
                  .eq("telegram_user_id", String(chatId))
                  .single()

                if (state) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const metadata = state.metadata as Record<string, any> | null
                  const currentIndex = metadata?.upsell_index || 0
                  const nextIndex = currentIndex + 1

                  // Buscar config do fluxo
                  const { data: flowData } = await supabase
                    .from("flows")
                    .select("config")
                    .eq("id", state.flow_id)
                    .single()

                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const flowConfig = flowData?.config as Record<string, any> | null
                  const upsellSequences = flowConfig?.upsell?.sequences || []

                  // Verificar se tem order bump global para upsell
                  const orderBumpConfig = flowConfig?.orderBump as { 
                    upsell?: { enabled?: boolean; name?: string; price?: number; description?: string; acceptText?: string; rejectText?: string; medias?: string[] }
                    applyInicialTo?: { upsell?: boolean }
                    inicial?: { enabled?: boolean; name?: string; price?: number; description?: string; acceptText?: string; rejectText?: string; medias?: string[] }
                  } | undefined
                  
                  // Verificar se deve usar order bump do upsell ou aplicar o inicial
                  let orderBumpToUse = orderBumpConfig?.upsell
                  if (orderBumpConfig?.applyInicialTo?.upsell && orderBumpConfig?.inicial?.enabled) {
                    orderBumpToUse = orderBumpConfig.inicial
                  }
                  
                  console.log(`[UPSELL] Order bump check - upsell enabled: ${orderBumpToUse?.enabled}, price: ${orderBumpToUse?.price}`)
                  
                  // ========== ENTREGAR O PRODUTO DO UPSELL QUE FOI PAGO ==========
                  // Prioridade: 1) deliverable_id do metadata do pagamento, 2) deliverableId da sequencia do upsell
                  const paymentMetadataUp = payment.metadata as { deliverable_id?: string; upsell_sequence_index?: number } | null
                  const currentUpsell = upsellSequences[currentIndex]
                  const deliverables = (flowConfig?.deliverables as Deliverable[]) || []
                  
                  // Tentar buscar deliverableId do metadata do pagamento primeiro
                  let upsellDeliverableId = paymentMetadataUp?.deliverable_id || ""
                  
                  // Se nao tem no metadata, buscar da sequencia do upsell
                  if (!upsellDeliverableId && currentUpsell?.deliverableId) {
                    upsellDeliverableId = currentUpsell.deliverableId
                  }
                  
                  console.log(`[UPSELL] Entregando produto do upsell ${currentIndex}`)
                  console.log(`[UPSELL] deliverableId do metadata: ${paymentMetadataUp?.deliverable_id || "NENHUM"}`)
                  console.log(`[UPSELL] deliverableId da sequencia: ${currentUpsell?.deliverableId || "NENHUM"}`)
                  console.log(`[UPSELL] deliverableId FINAL: ${upsellDeliverableId || "NENHUM"}`)
                  
                  if (upsellDeliverableId) {
                    const upsellDeliverable = deliverables.find((d: Deliverable) => d.id === upsellDeliverableId)
                    
                    if (upsellDeliverable) {
                      console.log(`[UPSELL] Entregando entregavel "${upsellDeliverable.name}" (${upsellDeliverable.type})`)
                      await sendDeliverable(bot.token, chatId, upsellDeliverable, "Upsell")
                      
                      // Se for vip_group, adicionar usuario ao grupo
                      if (upsellDeliverable.type === "vip_group" && upsellDeliverable.vipGroupChatId) {
                        try {
                          const createLinkRes = await fetch(`https://api.telegram.org/bot${bot.token}/createChatInviteLink`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              chat_id: upsellDeliverable.vipGroupChatId,
                              member_limit: 1,
                              creates_join_request: false
                            })
                          })
                          const linkData = await createLinkRes.json()
                          if (linkData.ok && linkData.result?.invite_link) {
                            await sendTelegramMessage(
                              bot.token,
                              chatId,
                              `Seu acesso ao grupo VIP do Upsell:\n${linkData.result.invite_link}`
                            )
                            console.log(`[UPSELL] Link VIP enviado com sucesso`)
                          }
                        } catch (e) {
                          console.error(`[UPSELL] Erro ao criar link VIP:`, e)
                        }
                      }
                    } else {
                      console.log(`[UPSELL] Entregavel ${upsellDeliverableId} nao encontrado na lista`)
                    }
                  } else {
                    console.log(`[UPSELL] Upsell ${currentIndex} nao tem deliverableId configurado`)
                  }

                  // Se tem order bump para upsell e ainda nao foi mostrado neste ciclo
                  if (orderBumpToUse?.enabled && orderBumpToUse?.price && orderBumpToUse.price > 0 && !metadata?.order_bump_shown) {
                    console.log(`[UPSELL] Showing order bump for upsell payment`)
                    
                    // Atualizar estado para aguardar order bump
                    await supabase.from("user_flow_state").upsert({
                      bot_id: bot.id,
                      telegram_user_id: String(chatId),
                      flow_id: state.flow_id,
                      status: "waiting_order_bump",
                      metadata: {
                        ...metadata,
                        type: "upsell",
                        upsell_index: currentIndex,
                        main_amount: payment.amount,
                        order_bump_name: orderBumpToUse.name || "Oferta Especial",
                        order_bump_price: orderBumpToUse.price,
                        order_bump_shown: true,
                      },
                      updated_at: new Date().toISOString()
                    }, { onConflict: "bot_id,telegram_user_id" })
                    
                    // Enviar order bump no formato correto (imagem + caption + botões juntos)
                    // IMPORTANTE: Usar prefixo "uob" (upsell order bump) para diferenciar
                    // Quando recusado, nao deve gerar novo PIX pois o upsell ja foi pago
                    await sendOrderBumpOffer({
                      botToken: bot.token,
                      chatId,
                      name: orderBumpToUse.name || "Oferta Especial",
                      description: orderBumpToUse.description,
                      price: orderBumpToUse.price,
                      acceptText: orderBumpToUse.acceptText,
                      rejectText: orderBumpToUse.rejectText,
                      medias: orderBumpToUse.medias,
                      mainAmountCents: Math.round(orderBumpToUse.price * 100), // Usar preco do OB como base
                      callbackPrefix: "uob", // Prefixo especifico para order bump de upsell
                      userFirstName: payment.telegram_first_name || "",
                      userUsername: payment.telegram_username || ""
                    })
                    
                    return NextResponse.json({ received: true })
                  }

                  if (nextIndex < upsellSequences.length) {
                    // Tem mais upsell - enviar proximo
                    const nextUpsell = upsellSequences[nextIndex]
                    
                    if (nextUpsell.sendTiming === "immediate") {
                      await sendUpsellOffer(supabase, bot.token, chatId, bot.id, state.flow_id, nextUpsell, nextIndex)
                    } else {
                      const delayMs = calculateDelayMs(nextUpsell.sendDelayValue || 30, nextUpsell.sendDelayUnit || "minutes")
                      if (delayMs <= 60000) {
                        await sleep(delayMs)
                        await sendUpsellOffer(supabase, bot.token, chatId, bot.id, state.flow_id, nextUpsell, nextIndex)
                      }
                    }
                  } else {
                    // Acabou os upsells - enviar entrega
                    // Verificar se o ultimo upsell aceito tinha entregavel especifico
                    const lastUpsell = upsellSequences[currentIndex]
                    const upsellDeliverableId = lastUpsell?.deliveryType === "custom" ? lastUpsell?.deliverableId : undefined
                    console.log(`[UPSELL] All upsells processed, sending delivery (deliverableId: ${upsellDeliverableId || "main"})`)
                    await sendDelivery(supabase, bot.token, chatId, flowConfig, upsellDeliverableId)
                  }
                }
              } else if (payment.product_type === "downsell") {
                // ========== PAGAMENTO DE DOWNSELL APROVADO ==========
                console.log(`[DOWNSELL] Downsell payment approved for user ${chatId}`)
                
                // 1. Cancelar todos os outros downsells pendentes para este usuario
                const { data: cancelledDsDownsells } = await supabase
                  .from("scheduled_messages")
                  .update({ status: "cancelled" })
                  .eq("bot_id", bot.id)
                  .eq("telegram_user_id", payment.telegram_user_id)
                  .eq("message_type", "downsell")
                  .eq("status", "pending")
                  .select("id")
                
                console.log(`[DOWNSELL] Cancelled ${cancelledDsDownsells?.length || 0} remaining pending downsells for user ${payment.telegram_user_id}`)
                
                // 2. Atualizar user_flow_state para "paid"
                const downsellUserFlowState: Record<string, unknown> = {
                  bot_id: bot.id,
                  telegram_user_id: payment.telegram_user_id,
                  status: "paid",
                  updated_at: new Date().toISOString()
                }
                
                if (payment.flow_id) {
                  downsellUserFlowState.flow_id = payment.flow_id
                }
                
                await supabase
                  .from("user_flow_state")
                  .upsert(downsellUserFlowState, { onConflict: "bot_id,telegram_user_id" })
                
                console.log(`[DOWNSELL] User ${payment.telegram_user_id} marked as paid in user_flow_state`)
                
                // 3. Buscar fluxo vinculado para pegar config de entrega
                let downsellFlowId: string | null = payment.flow_id || null
                
                if (!downsellFlowId) {
                  // Buscar flow vinculado ao bot
                  const { data: directFlow } = await supabase
                    .from("flows")
                    .select("id, config")
                    .eq("bot_id", bot.id)
                    .limit(1)
                    .single()
                  
                  if (directFlow) {
                    downsellFlowId = directFlow.id
                  } else {
                    const { data: flowBotLink } = await supabase
                      .from("flow_bots")
                      .select("flow_id")
                      .eq("bot_id", bot.id)
                      .limit(1)
                      .single()
                    
                    if (flowBotLink) {
                      downsellFlowId = flowBotLink.flow_id
                    }
                  }
                }
                
                if (downsellFlowId) {
                  console.log(`[DOWNSELL] ========== INICIO PROCESSAMENTO ENTREGA ==========`)
                  console.log(`[DOWNSELL] flowId: ${downsellFlowId}`)
                  
                  // Buscar config do fluxo
                  const { data: dsFlowData, error: dsFlowError } = await supabase
                    .from("flows")
                    .select("config")
                    .eq("id", downsellFlowId)
                    .single()
                  
                  if (dsFlowError) {
                    console.log(`[DOWNSELL] ERRO ao buscar fluxo: ${dsFlowError.message}`)
                  }
                  
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const dsFlowConfig = dsFlowData?.config as Record<string, any> | null
                  console.log(`[DOWNSELL] dsFlowConfig existe: ${!!dsFlowConfig}`)
                  console.log(`[DOWNSELL] dsFlowConfig.deliverables count: ${dsFlowConfig?.deliverables?.length || 0}`)
                  console.log(`[DOWNSELL] dsFlowConfig.mainDeliverableId: ${dsFlowConfig?.mainDeliverableId || "NAO DEFINIDO"}`)
                  
                  if (dsFlowConfig?.deliverables?.length > 0) {
                    console.log(`[DOWNSELL] Lista de entregaveis disponeis:`)
                    for (const d of dsFlowConfig.deliverables) {
                      console.log(`[DOWNSELL]   - ${d.id}: ${d.name} (${d.type})`)
                    }
                  }
                  
                  const dsConfig = dsFlowConfig?.downsell
                  const dsConfigPix = dsFlowConfig?.downsellPix // Tambem buscar config do downsell PIX
                  const paymentMessages = dsFlowConfig?.paymentMessages as {
                    approvedMessage?: string
                    approvedMedias?: string[]
                    accessButtonText?: string
                    accessButtonUrl?: string
                  } | undefined
                  
                  // 4. Buscar nome do usuario para variaveis {nome} e {username}
                  let dsUserName = "Cliente"
                  let dsUserUsername = ""
                  try {
                    const { data: userData } = await supabase
                      .from("bot_users")
                      .select("first_name, last_name, username")
                      .eq("bot_id", bot.id)
                      .eq("telegram_user_id", String(chatId))
                      .single()
                    if (userData?.first_name) {
                      dsUserName = userData.first_name
                    }
                    if (userData?.username) {
                      dsUserUsername = userData.username
                    }
                  } catch { /* ignore */ }
                  
                  // 5. Enviar midias de pagamento aprovado (se configurado)
                  if (paymentMessages?.approvedMedias && paymentMessages.approvedMedias.length > 0) {
                    console.log(`[DOWNSELL] Sending ${paymentMessages.approvedMedias.length} approved medias`)
                    for (const mediaUrl of paymentMessages.approvedMedias) {
                      if (mediaUrl.includes(".mp4") || mediaUrl.includes("video")) {
                        await sendTelegramVideo(bot.token, chatId, mediaUrl, "")
                      } else {
                        await sendTelegramPhoto(bot.token, chatId, mediaUrl, "")
                      }
                      await sleep(500)
                    }
                  }
                  
                  // 6. Enviar mensagem de pagamento aprovado
                  const defaultDsApprovedMsg = `<b>Pagamento Aprovado!</b>\n\nParabens ${dsUserName}! Seu pagamento foi confirmado.\n\nVoce ja tem acesso ao conteudo!`
                  let dsApprovedMsg = paymentMessages?.approvedMessage || defaultDsApprovedMsg
                  // Substituir variaveis {nome} e {username}
                  dsApprovedMsg = dsApprovedMsg.replace(/\{nome\}/gi, dsUserName)
                  dsApprovedMsg = dsApprovedMsg.replace(/\{username\}/gi, dsUserUsername ? `@${dsUserUsername}` : "")
                  
                  const dsAccessButtonText = paymentMessages?.accessButtonText || "Acessar Conteudo"
                  const dsAccessButtonUrl = paymentMessages?.accessButtonUrl
                  
                  if (dsAccessButtonUrl) {
                    await sendTelegramMessage(
                      bot.token,
                      chatId,
                      dsApprovedMsg,
                      {
                        inline_keyboard: [[{ text: dsAccessButtonText, url: dsAccessButtonUrl }]]
                      }
                    )
                  } else {
                    await sendTelegramMessage(
                      bot.token,
                      chatId,
                      dsApprovedMsg,
                      {
                        inline_keyboard: [[{ text: dsAccessButtonText, callback_data: "access_deliverable" }]]
                      }
                    )
                  }
                  
                  // 7. Enviar entrega - verificar se downsell tem entregavel especifico ou usa o global
                  // PRIORIDADE 1: Usar deliverableId do metadata do pagamento (salvo quando usuario clicou para pagar)
                  const paymentMetadata = (payment as { metadata?: Record<string, string> }).metadata || {}
                  let dsDeliverableId: string | undefined = paymentMetadata.downsell_deliverable_id || undefined
                  let dsDeliveryType: string = paymentMetadata.downsell_delivery_type || ""
                  
                  console.log(`[DOWNSELL] Payment metadata:`, JSON.stringify(paymentMetadata))
                  console.log(`[DOWNSELL] Metadata - deliverableId: ${dsDeliverableId || "NAO TEM"}, deliveryType: ${dsDeliveryType || "NAO TEM"}`)
                  
                  // PRIORIDADE 2 (Fallback): Buscar da sequencia de downsell pelo preco
                  // IMPORTANTE: Buscar tanto em downsell.sequences quanto em downsellPix.sequences
                  // pois o downsell pode ter vindo de qualquer um dos dois
                  const dsSequencesNormal = ((dsConfig as { sequences?: Array<{ id: string; plans?: Array<{ price: number }>; useDefaultPlans?: boolean; deliveryType?: string; deliverableId?: string }> })?.sequences || [])
                  const dsSequencesPix = ((dsConfigPix as { sequences?: Array<{ id: string; plans?: Array<{ price: number }>; useDefaultPlans?: boolean; deliveryType?: string; deliverableId?: string }> })?.sequences || [])
                  
                  // Combinar as sequencias (priorizar PIX pois e mais comum vir de la)
                  const dsSequences = [...dsSequencesPix, ...dsSequencesNormal]
                  
                  console.log(`[DOWNSELL] Buscando sequencia pelo preco ${payment.amount} em ${dsSequences.length} sequencias (pix: ${dsSequencesPix.length}, normal: ${dsSequencesNormal.length})`)
                  
                  // Debug: mostrar todas as sequencias e seus planos
                  for (let i = 0; i < dsSequences.length; i++) {
                    const s = dsSequences[i]
                    console.log(`[DOWNSELL] Sequencia ${i}: id=${s.id}, useDefaultPlans=${s.useDefaultPlans}, deliveryType=${s.deliveryType}, deliverableId=${s.deliverableId}`)
                    console.log(`[DOWNSELL] Sequencia ${i} plans:`, JSON.stringify(s.plans || []))
                  }
                  
                  // Se ainda nao tem deliverableId do metadata, buscar da sequencia
                  // IMPORTANTE: Quando useDefaultPlans=true, os planos sao calculados com desconto na hora do agendamento
                  // mas NAO ficam salvos no config do fluxo! Por isso o metadata do pagamento e a fonte principal.
                  // Se nao tem no metadata, tentar achar pelo sequence_index salvo no metadata
                  if (!dsDeliverableId && paymentMetadata.sequence_index !== undefined) {
                    const seqIndex = parseInt(paymentMetadata.sequence_index)
                    // Buscar primeiro nas sequencias PIX, depois nas normais
                    const foundSeq = dsSequencesPix[seqIndex] || dsSequencesNormal[seqIndex]
                    if (foundSeq && foundSeq.deliveryType === "custom" && foundSeq.deliverableId) {
                      dsDeliverableId = foundSeq.deliverableId
                      dsDeliveryType = foundSeq.deliveryType
                      console.log(`[DOWNSELL] Encontrou entregavel via sequence_index ${seqIndex}: ${dsDeliverableId}`)
                    }
                  }
                  
                  // Fallback: buscar pelo preco (menos confiavel quando useDefaultPlans=true)
                  if (!dsDeliverableId) {
                    for (const seq of dsSequences) {
                      // Se usa planos padrao, os precos foram calculados com desconto
                      // Buscar em seq.plans (que pode ter sido preenchido com planos padrao)
                      const seqPlans = seq.plans || []
                      for (const plan of seqPlans) {
                        if (Math.abs(plan.price - payment.amount) < 0.01) {
                          console.log(`[DOWNSELL] Encontrou sequencia ${seq.id} com plano de preco ${plan.price}`)
                          // SEMPRE usar o entregavel da sequencia se ela tiver um configurado
                          if (seq.deliveryType === "custom" && seq.deliverableId) {
                            dsDeliverableId = seq.deliverableId
                            dsDeliveryType = seq.deliveryType
                            console.log(`[DOWNSELL] Usando entregavel da sequencia: ${dsDeliverableId}`)
                          } else if (!dsDeliveryType) {
                            dsDeliveryType = seq.deliveryType || "main"
                          }
                          break
                        }
                      }
                      if (dsDeliverableId) break
                    }
                  }
                  
                  // Se ainda nao achou e nao tem deliveryType, usar main como default
                  if (!dsDeliveryType) {
                    dsDeliveryType = "main"
                  }
                  
                  // Se deliveryType for "main" ou "global", nao passar deliverableId (usar entrega principal)
                  // "custom" = usa deliverableId especifico do downsell
                  const finalDeliverableId = (dsDeliveryType === "main" || dsDeliveryType === "global") ? undefined : dsDeliverableId
                  
                  console.log(`[DOWNSELL] Entrega - deliveryType do metadata: "${dsDeliveryType}"`)
                  console.log(`[DOWNSELL] Entrega - deliverableId do metadata: "${dsDeliverableId || 'NENHUM'}"`)
                  console.log(`[DOWNSELL] Entrega - finalDeliverableId (antes validacao): "${finalDeliverableId || 'MAIN/GLOBAL'}"`)
                  console.log(`[DOWNSELL] Entrega - dsFlowConfig.deliverables count: ${dsFlowConfig?.deliverables?.length || 0}`)
                  
                  // VALIDACAO: Se o deliverableId nao existe nos deliverables do fluxo, usar entrega principal
                  let validatedDeliverableId = finalDeliverableId
                  if (finalDeliverableId && dsFlowConfig?.deliverables) {
                    const deliverableExists = dsFlowConfig.deliverables.some((d: { id: string }) => d.id === finalDeliverableId)
                    if (!deliverableExists) {
                      console.log(`[DOWNSELL] AVISO: Entregavel ${finalDeliverableId} NAO EXISTE no fluxo! Usando entrega principal.`)
                      validatedDeliverableId = undefined // Fallback para entrega principal
                    }
                  }
                  
                  console.log(`[DOWNSELL] Entrega - validatedDeliverableId (final): "${validatedDeliverableId || 'MAIN/GLOBAL'}"`)
                  await sendDelivery(supabase, bot.token, chatId, dsFlowConfig, validatedDeliverableId)
                  
                  // 8. Marcar usuario como VIP
                  const { error: vipError } = await supabase
                    .from("bot_users")
                    .update({
                      is_vip: true,
                      vip_since: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    })
                    .eq("bot_id", bot.id)
                    .eq("telegram_user_id", String(chatId))
                  
                  if (vipError) {
                    console.log(`[DOWNSELL] Error marking user as VIP:`, vipError.message)
                  } else {
                    console.log(`[DOWNSELL] User ${chatId} marked as VIP`)
                  }
                } else {
                  console.log(`[DOWNSELL] No flow found for bot ${bot.id}, sending basic confirmation`)
                  await sendTelegramMessage(bot.token, chatId, "Pagamento aprovado! Seu acesso foi liberado.")
                }
                // ========== FIM DOWNSELL ==========
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Error processing Mercado Pago webhook:", error)
    return NextResponse.json({ received: true })
  }
}

// Mercado Pago tambem envia HEAD para verificar se o endpoint existe
export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}

export async function GET() {
  return NextResponse.json({ status: "Webhook endpoint active" })
}

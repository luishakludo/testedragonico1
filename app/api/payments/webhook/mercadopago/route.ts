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

// Criar link de convite unico para grupo VIP (limite de 1 uso)
async function createVipInviteLink(botToken: string, chatId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/createChatInviteLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        member_limit: 1, // Link unico para 1 pessoa
        name: `VIP Access - ${Date.now()}`,
      }),
    })
    const data = await res.json()
    if (data.ok && data.result?.invite_link) {
      console.log(`[VIP] Created invite link for chat ${chatId}: ${data.result.invite_link}`)
      return data.result.invite_link
    }
    console.log(`[VIP] Failed to create invite link:`, data)
    return null
  } catch (error) {
    console.error(`[VIP] Error creating invite link:`, error)
    return null
  }
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

  // Enviar midias se existirem
  if (upsell.medias && upsell.medias.length > 0) {
    for (const mediaUrl of upsell.medias) {
      if (mediaUrl.includes(".mp4") || mediaUrl.includes("video")) {
        await sendTelegramVideo(botToken, chatId, mediaUrl, "")
      } else {
        await sendTelegramPhoto(botToken, chatId, mediaUrl, "")
      }
      await sleep(500)
    }
  }

  // Montar botoes - suporte a multiplos planos
  const plans = upsell.plans || []
  const inlineKeyboard: { inline_keyboard: { text: string; callback_data: string }[][] } = {
    inline_keyboard: []
  }

  if (plans.length > 0) {
    // Se tem planos configurados, mostrar cada plano como um botao
    // Formato: up_plan_{upsellIndex}_{planId}_{priceInCents}
    const planButtons: { text: string; callback_data: string }[] = []
    
    for (const plan of plans) {
      const priceInCents = Math.round((plan.price || 0) * 100)
      const buttonText = plan.buttonText || plan.name || `R$ ${(plan.price || 0).toFixed(2).replace(".", ",")}`
      planButtons.push({
        text: buttonText,
        callback_data: `up_plan_${upsellIndex}_${plan.id}_${priceInCents}`
      })
    }

    // Colocar botoes de planos lado a lado (max 2 por linha)
    for (let i = 0; i < planButtons.length; i += 2) {
      const row = planButtons.slice(i, i + 2)
      inlineKeyboard.inline_keyboard.push(row)
    }
  } else {
    // Fallback: botao unico de aceitar (compatibilidade com formato antigo)
    inlineKeyboard.inline_keyboard.push([
      { text: upsell.acceptButtonText || "Quero essa oferta!", callback_data: `up_accept_${upsell.price}_${upsellIndex}` }
    ])
  }

  // Adicionar botao de recusar na mesma linha (se nao estiver escondido)
  if (!upsell.hideRejectButton) {
    const rejectButton = { 
      text: upsell.rejectButtonText || "Nao tenho interesse", 
      callback_data: `up_decline_${upsellIndex}` 
    }
    
    // Se tem planos e a ultima linha tem espaco, adicionar na mesma linha
    // Senao, criar nova linha
    const lastRow = inlineKeyboard.inline_keyboard[inlineKeyboard.inline_keyboard.length - 1]
    if (plans.length > 0 && lastRow && lastRow.length === 1) {
      // Adicionar ao lado do ultimo botao de plano
      lastRow.push(rejectButton)
    } else {
      // Criar nova linha para o botao de recusar
      inlineKeyboard.inline_keyboard.push([rejectButton])
    }
  }

  // Enviar mensagem
  const message = upsell.message || `Oferta especial: ${upsell.name || "Produto exclusivo"}\n\nValor: R$ ${(upsell.price || 0).toFixed(2).replace(".", ",")}`
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
        upsell_name: upsell.name,
        upsell_price: firstPlan?.price || upsell.price,
        upsell_sequence_id: upsell.id,
        plans: plans.map((p: { id: string; name: string; price: number }) => ({ id: p.id, name: p.name, price: p.price })),
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
  deliverable: Deliverable
) {
  console.log(`[DELIVERY] Sending deliverable "${deliverable.name}" (type: ${deliverable.type}) to user ${chatId}`)

  switch (deliverable.type) {
    case "media":
      // Enviar midias
      if (deliverable.medias && deliverable.medias.length > 0) {
        for (const mediaUrl of deliverable.medias) {
          if (mediaUrl.includes(".mp4") || mediaUrl.includes("video")) {
            await sendTelegramVideo(botToken, chatId, mediaUrl, "")
          } else {
            await sendTelegramPhoto(botToken, chatId, mediaUrl, "")
          }
          await sleep(500)
        }
        await sendTelegramMessage(botToken, chatId, "Obrigado pela compra! Seu conteudo foi liberado acima.")
      }
      break

    case "link":
      // Enviar link com botao
      if (deliverable.link) {
        const buttonText = deliverable.linkText || "Acessar conteudo"
        const keyboard = {
          inline_keyboard: [
            [{ text: buttonText, url: deliverable.link }]
          ]
        }
        await sendTelegramMessage(botToken, chatId, "Obrigado pela compra! Clique no botao abaixo para acessar:", keyboard)
      }
      break

    case "vip_group":
      // Criar link de convite unico e enviar
      if (deliverable.vipGroupChatId) {
        const inviteLink = await createVipInviteLink(botToken, deliverable.vipGroupChatId)
        if (inviteLink) {
          const groupName = deliverable.vipGroupName || "Grupo VIP"
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
        } else {
          await sendTelegramMessage(botToken, chatId, "Obrigado pela compra! Houve um problema ao gerar seu link de acesso. Entre em contato com o suporte.")
        }
      }
      break
  }

  console.log(`[DELIVERY] Deliverable "${deliverable.name}" sent successfully`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendDelivery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  botToken: string,
  chatId: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  flowConfig: Record<string, any> | null,
  deliverableId?: string // ID do entregavel especifico (para upsell/downsell)
) {
  console.log(`[v0] DELIVERY: ========== INICIO sendDelivery ==========`)
  console.log(`[v0] DELIVERY: chatId=${chatId}, deliverableId=${deliverableId || "main"}`)
  console.log(`[v0] DELIVERY: flowConfig existe?`, !!flowConfig)
  console.log(`[v0] DELIVERY: flowConfig.deliverables?`, flowConfig?.deliverables?.length || 0)
  console.log(`[v0] DELIVERY: flowConfig.mainDeliverableId?`, flowConfig?.mainDeliverableId || "NAO DEFINIDO")
  console.log(`[v0] DELIVERY: flowConfig.delivery?`, !!flowConfig?.delivery)

  // Se tiver um deliverableId especifico, buscar e usar esse entregavel
  if (deliverableId && flowConfig?.deliverables) {
    const deliverable = flowConfig.deliverables.find((d: Deliverable) => d.id === deliverableId)
    if (deliverable) {
      await sendDeliverable(botToken, chatId, deliverable)
      return
    }
  }

  // Se tiver mainDeliverableId configurado, usar o entregavel principal
  if (flowConfig?.mainDeliverableId && flowConfig?.deliverables) {
    const mainDeliverable = flowConfig.deliverables.find((d: Deliverable) => d.id === flowConfig.mainDeliverableId)
    if (mainDeliverable) {
      await sendDeliverable(botToken, chatId, mainDeliverable)
      return
    }
  }

  // Fallback: usar o sistema antigo de delivery (para compatibilidade)
  if (flowConfig?.delivery) {
    const delivery = flowConfig.delivery

    // Verificar tipo de entrega do sistema antigo
    if (delivery.type === "vip_group" && delivery.vipGroupId) {
      // Grupo VIP (sistema antigo)
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
      } else {
        await sendTelegramMessage(botToken, chatId, "Obrigado pela compra! Houve um problema ao gerar seu link de acesso. Entre em contato com o suporte.")
      }
      return
    }

    // Enviar midias de entrega (sistema antigo)
    if (delivery.medias && delivery.medias.length > 0) {
      for (const mediaUrl of delivery.medias) {
        if (mediaUrl.includes(".mp4") || mediaUrl.includes("video")) {
          await sendTelegramVideo(botToken, chatId, mediaUrl, "")
        } else {
          await sendTelegramPhoto(botToken, chatId, mediaUrl, "")
        }
        await sleep(500)
      }
    }

    // Enviar link de acesso (sistema antigo)
    if (delivery.link) {
      const buttonText = delivery.linkText || "Acessar conteudo"
      const keyboard = {
        inline_keyboard: [
          [{ text: buttonText, url: delivery.link }]
        ]
      }
      await sendTelegramMessage(botToken, chatId, "Seu acesso foi liberado! Clique no botao abaixo:", keyboard)
    } else if (!delivery.medias || delivery.medias.length === 0) {
      await sendTelegramMessage(botToken, chatId, "Obrigado pela compra! Seu acesso foi liberado.")
    }
  } else {
    await sendTelegramMessage(botToken, chatId, "Obrigado pela compra! Seu acesso foi liberado.")
  }

  console.log(`[DELIVERY] Delivery sent successfully`)
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
              await supabase
                .from("scheduled_messages")
                .update({ status: "cancelled" })
                .eq("bot_id", payment.bot_id)
                .eq("telegram_user_id", payment.telegram_user_id)
                .eq("message_type", "downsell")
                .eq("status", "pending")
              
              console.log(`[DOWNSELL] Cancelled pending downsells for user ${payment.telegram_user_id}`)
              
              // ATUALIZAR user_flow_state para "paid" (usado pelo cron para verificar se deve enviar downsell)
              await supabase
                .from("user_flow_state")
                .upsert({
                  bot_id: payment.bot_id,
                  telegram_user_id: payment.telegram_user_id,
                  status: "paid",
                  updated_at: new Date().toISOString()
                }, { onConflict: "bot_id,telegram_user_id" })
              
              console.log(`[PAYMENT] User ${payment.telegram_user_id} marked as paid in user_flow_state`)

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
                  const paymentMessages = flowConfig?.paymentMessages as {
                    approvedMessage?: string
                    approvedMedias?: string[]
                    accessButtonText?: string
                    accessButtonUrl?: string
                  } | undefined

                  console.log(`[v0] Flow ${flowId} config keys:`, Object.keys(flowConfig || {}))
                  console.log(`[v0] mainDeliverableId:`, flowConfig?.mainDeliverableId)
                  console.log(`[v0] deliverables count:`, flowConfig?.deliverables?.length || 0)
                  console.log(`[v0] paymentMessages:`, !!paymentMessages)
                  console.log(`[v0] UPSELL: Flow ${flowId} has ${upsellSequences.length} upsell sequences, enabled: ${upsellConfig?.enabled}`)

                  // Buscar nome do usuario para variavel {nome}
                  let userName = "Cliente"
                  try {
                    const { data: userData } = await supabase
                      .from("bot_users")
                      .select("first_name, last_name")
                      .eq("bot_id", bot.id)
                      .eq("telegram_user_id", String(chatId))
                      .single()
                    if (userData?.first_name) {
                      userName = userData.first_name
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
                  // Substituir variavel {nome}
                  approvedMsg = approvedMsg.replace(/\{nome\}/gi, userName)

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

                  // SEMPRE enviar entregavel inicial primeiro (produto principal)
                  console.log(`[v0] DELIVERY: Enviando entregavel inicial para usuario ${chatId}`)
                  await sendDelivery(supabase, bot.token, chatId, flowConfig)

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

                  // Depois verificar se tem upsell para enviar
                  if (upsellConfig?.enabled && upsellSequences.length > 0) {
                    // Pegar a primeira sequencia (indice 0)
                    const firstUpsell = upsellSequences[0]
                    
                    console.log(`[v0] UPSELL: Enviando upsell 0 apos entrega`)
                    
                    // Verificar timing
                    if (firstUpsell.sendTiming === "immediate") {
                      // Enviar imediatamente
                      await sendUpsellOffer(supabase, bot.token, chatId, bot.id, flowId, firstUpsell, 0)
                    } else {
                      // Agendar para enviar depois
                      const delayMs = calculateDelayMs(firstUpsell.sendDelayValue || 30, firstUpsell.sendDelayUnit || "minutes")
                      
                      // Salvar no estado para ser processado depois
                      await supabase
                        .from("user_flow_state")
                        .upsert({
                          bot_id: bot.id,
                          telegram_user_id: String(chatId),
                          flow_id: flowId,
                          status: "upsell_scheduled",
                          metadata: {
                            upsell_index: 0,
                            upsell_scheduled_at: new Date().toISOString(),
                            upsell_send_at: new Date(Date.now() + delayMs).toISOString(),
                          },
                          updated_at: new Date().toISOString()
                        }, { onConflict: "bot_id,telegram_user_id" })
                      
                      console.log(`[v0] UPSELL: Scheduled upsell 0 for user ${chatId} in ${delayMs}ms`)
                      
                      // Por agora, envia com delay simples (em producao usar job queue)
                      if (delayMs <= 60000) { // Max 1 minuto de delay inline
                        await sleep(delayMs)
                        await sendUpsellOffer(supabase, bot.token, chatId, bot.id, flowId, firstUpsell, 0)
                      }
                    }
                  } else {
                    console.log(`[v0] UPSELL: No upsell configured for this flow`)
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
                    
                    // Enviar midias do order bump se houver
                    if (orderBumpToUse.medias && orderBumpToUse.medias.length > 0) {
                      for (const mediaUrl of orderBumpToUse.medias) {
                        if (mediaUrl.includes(".mp4") || mediaUrl.includes("video")) {
                          await sendTelegramVideo(bot.token, chatId, mediaUrl, "")
                        } else {
                          await sendTelegramPhoto(bot.token, chatId, mediaUrl, "")
                        }
                        await sleep(500)
                      }
                    }
                    
                    // Enviar mensagem do order bump
                    const obMessage = `*${orderBumpToUse.name || "Oferta Especial"}*\n\n${orderBumpToUse.description || ""}\n\n Por apenas *R$ ${orderBumpToUse.price.toFixed(2).replace(".", ",")}*`
                    
                    await sendTelegramMessage(bot.token, chatId, obMessage, {
                      inline_keyboard: [
                        [{ text: orderBumpToUse.acceptText || "QUERO", callback_data: `ob_accept_${Math.round(payment.amount * 100)}_${Math.round(orderBumpToUse.price * 100)}` }],
                        [{ text: orderBumpToUse.rejectText || "NAO QUERO", callback_data: `ob_decline_${Math.round(payment.amount * 100)}_0` }]
                      ]
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

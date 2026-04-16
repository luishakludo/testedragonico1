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

  // Enviar mensagem
  const message = upsell.message || "Oferta especial para voce!"
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

                  // Depois verificar se tem upsell para enviar - AGENDAR TODAS AS SEQUENCIAS (igual downsell)
                  console.log(`[UPSELL DEBUG] Verificando upsell - enabled: ${upsellConfig?.enabled}, sequences: ${upsellSequences.length}`)
                  console.log(`[UPSELL DEBUG] upsellConfig:`, JSON.stringify(upsellConfig))
                  
                  if (upsellConfig?.enabled && upsellSequences.length > 0) {
                    console.log(`[UPSELL] Agendando ${upsellSequences.length} sequencias de upsell para usuario ${chatId}`)
                    
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
                      
                      // Inserir na tabela scheduled_messages (mesma estrutura do downsell)
                      const { error: insertError } = await supabase
                        .from("scheduled_messages")
                        .insert({
                          bot_id: bot.id,
                          flow_id: flowId,
                          telegram_user_id: String(chatId),
                          telegram_chat_id: chatId,
                          message_type: "upsell",
                          scheduled_for: scheduledFor,
                          status: "pending",
                          metadata: {
                            message: upsellSeq.message || "",
                            medias: upsellSeq.medias || [],
                            plans: upsellSeq.plans || [],
                            sequence_index: i,
                            botToken: bot.token,
                            deliveryType: upsellSeq.deliveryType || "global",
                            deliverableId: upsellSeq.deliverableId,
                          },
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString()
                        })
                      
                      if (insertError) {
                        console.error(`[UPSELL] Error scheduling upsell ${i}:`, insertError)
                      } else {
                        console.log(`[UPSELL] Scheduled upsell ${i} for ${scheduledFor}`)
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
              } else if (payment.product_type === "downsell") {
                // ========== PAGAMENTO DE DOWNSELL APROVADO ==========
                console.log(`[DOWNSELL] Downsell payment approved for user ${chatId}`)
                
                // 1. Cancelar todos os outros downsells pendentes para este usuario
                await supabase
                  .from("scheduled_messages")
                  .update({ status: "cancelled" })
                  .eq("bot_id", bot.id)
                  .eq("telegram_user_id", payment.telegram_user_id)
                  .eq("message_type", "downsell")
                  .eq("status", "pending")
                
                console.log(`[DOWNSELL] Cancelled remaining pending downsells for user ${payment.telegram_user_id}`)
                
                // 2. Atualizar user_flow_state para "paid"
                await supabase
                  .from("user_flow_state")
                  .upsert({
                    bot_id: bot.id,
                    telegram_user_id: payment.telegram_user_id,
                    status: "paid",
                    updated_at: new Date().toISOString()
                  }, { onConflict: "bot_id,telegram_user_id" })
                
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
                  // Buscar config do fluxo
                  const { data: dsFlowData } = await supabase
                    .from("flows")
                    .select("config")
                    .eq("id", downsellFlowId)
                    .single()
                  
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const dsFlowConfig = dsFlowData?.config as Record<string, any> | null
                  const dsConfig = dsFlowConfig?.downsell
                  const paymentMessages = dsFlowConfig?.paymentMessages as {
                    approvedMessage?: string
                    approvedMedias?: string[]
                    accessButtonText?: string
                    accessButtonUrl?: string
                  } | undefined
                  
                  // 4. Buscar nome do usuario
                  let dsUserName = "Cliente"
                  try {
                    const { data: userData } = await supabase
                      .from("bot_users")
                      .select("first_name, last_name")
                      .eq("bot_id", bot.id)
                      .eq("telegram_user_id", String(chatId))
                      .single()
                    if (userData?.first_name) {
                      dsUserName = userData.first_name
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
                  dsApprovedMsg = dsApprovedMsg.replace(/\{nome\}/gi, dsUserName)
                  
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
                  // Buscar a sequencia de downsell que foi comprada (pelo preco ou metadata)
                  const dsSequences = dsConfig?.sequences || []
                  let dsDeliverableId: string | undefined = undefined
                  
                  // Tentar encontrar a sequencia que corresponde ao preco pago
                  for (const seq of dsSequences) {
                    const seqPlans = seq.plans || []
                    for (const plan of seqPlans) {
                      if (Math.abs(plan.price - payment.amount) < 0.01) {
                        // Encontrou o plano que foi comprado
                        if (seq.deliveryType === "custom" && seq.deliverableId) {
                          dsDeliverableId = seq.deliverableId
                        }
                        break
                      }
                    }
                    if (dsDeliverableId) break
                  }
                  
                  console.log(`[DOWNSELL] Sending delivery (deliverableId: ${dsDeliverableId || "main/global"})`)
                  await sendDelivery(supabase, bot.token, chatId, dsFlowConfig, dsDeliverableId)
                  
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

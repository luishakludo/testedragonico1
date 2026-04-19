import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

// POST /api/test/vip-group-purchase
// Teste REAL do fluxo de criacao de link de grupo VIP
// Passa por todas as etapas reais para identificar onde falha
export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const now = new Date()
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const steps: any[] = []
  let overallSuccess = true
  let errorStep: string | null = null
  let errorMessage: string | null = null

  try {
    const body = await req.json()
    const { flow_id, bot_id, telegram_group_id, user_telegram_id } = body

    // Validacao de parametros
    if (!flow_id && !bot_id && !telegram_group_id) {
      return NextResponse.json({
        error: "Parametros obrigatorios faltando",
        required: "Envie pelo menos: flow_id OU bot_id OU telegram_group_id",
        example: {
          flow_id: "uuid-do-fluxo",
          bot_id: "uuid-do-bot (opcional se flow_id fornecido)",
          telegram_group_id: "-100xxx (opcional, busca do flow)",
          user_telegram_id: "123456789 (opcional, para testar envio)"
        }
      }, { status: 400 })
    }

    // ========== ETAPA 1: Buscar Flow ==========
    let flowData = null
    let flowConfig = null
    
    if (flow_id) {
      const { data, error } = await supabase
        .from("flows")
        .select("id, name, config, bot_id, user_id")
        .eq("id", flow_id)
        .single()
      
      if (error || !data) {
        steps.push({
          step: 1,
          name: "Buscar Flow",
          status: "error",
          error: error?.message || "Flow nao encontrado",
          details: { flow_id }
        })
        overallSuccess = false
        errorStep = "Buscar Flow"
        errorMessage = error?.message || "Flow nao encontrado"
      } else {
        flowData = data
        flowConfig = data.config
        steps.push({
          step: 1,
          name: "Buscar Flow",
          status: "success",
          details: {
            flow_id: data.id,
            flow_name: data.name,
            has_config: !!data.config,
            config_keys: data.config ? Object.keys(data.config) : []
          }
        })
      }
    } else {
      steps.push({
        step: 1,
        name: "Buscar Flow",
        status: "skipped",
        details: { reason: "flow_id nao fornecido" }
      })
    }

    // ========== ETAPA 2: Buscar Bot e Token ==========
    let botData = null
    let botToken = null
    const targetBotId = bot_id || flowData?.bot_id

    if (targetBotId) {
      const { data, error } = await supabase
        .from("bots")
        .select("id, name, token, username, user_id")
        .eq("id", targetBotId)
        .single()
      
      if (error || !data) {
        steps.push({
          step: 2,
          name: "Buscar Bot",
          status: "error",
          error: error?.message || "Bot nao encontrado",
          details: { bot_id: targetBotId }
        })
        overallSuccess = false
        errorStep = errorStep || "Buscar Bot"
        errorMessage = errorMessage || (error?.message || "Bot nao encontrado")
      } else {
        botData = data
        botToken = data.token
        steps.push({
          step: 2,
          name: "Buscar Bot",
          status: "success",
          details: {
            bot_id: data.id,
            bot_name: data.name,
            bot_username: data.username,
            has_token: !!data.token,
            token_preview: data.token ? `${data.token.substring(0, 15)}...` : null
          }
        })
      }
    } else if (flow_id) {
      // Tentar buscar bot via flow_bots
      const { data: flowBotLink } = await supabase
        .from("flow_bots")
        .select("bot_id")
        .eq("flow_id", flow_id)
        .limit(1)
        .single()
      
      if (flowBotLink?.bot_id) {
        const { data, error } = await supabase
          .from("bots")
          .select("id, name, token, username, user_id")
          .eq("id", flowBotLink.bot_id)
          .single()
        
        if (!error && data) {
          botData = data
          botToken = data.token
          steps.push({
            step: 2,
            name: "Buscar Bot (via flow_bots)",
            status: "success",
            details: {
              bot_id: data.id,
              bot_name: data.name,
              bot_username: data.username,
              has_token: !!data.token,
              token_preview: data.token ? `${data.token.substring(0, 15)}...` : null
            }
          })
        } else {
          steps.push({
            step: 2,
            name: "Buscar Bot (via flow_bots)",
            status: "error",
            error: error?.message || "Bot nao encontrado",
            details: { bot_id: flowBotLink.bot_id }
          })
          overallSuccess = false
          errorStep = errorStep || "Buscar Bot"
          errorMessage = errorMessage || "Bot nao encontrado via flow_bots"
        }
      } else {
        steps.push({
          step: 2,
          name: "Buscar Bot",
          status: "error",
          error: "Nenhum bot vinculado ao flow",
          details: { flow_id }
        })
        overallSuccess = false
        errorStep = errorStep || "Buscar Bot"
        errorMessage = errorMessage || "Nenhum bot vinculado ao flow"
      }
    } else {
      steps.push({
        step: 2,
        name: "Buscar Bot",
        status: "skipped",
        details: { reason: "bot_id e flow_id nao fornecidos" }
      })
    }

    // ========== ETAPA 3: Buscar Entregavel VIP Group ==========
    let vipGroupChatId = telegram_group_id
    let vipGroupName = "Grupo VIP (fornecido manualmente)"
    let deliverableInfo = null

    if (!vipGroupChatId && flowConfig?.deliverables) {
      // Buscar primeiro entregavel do tipo vip_group
      const vipDeliverable = flowConfig.deliverables.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (d: any) => d.type === "vip_group"
      )
      
      if (vipDeliverable) {
        vipGroupChatId = vipDeliverable.vipGroupChatId
        vipGroupName = vipDeliverable.vipGroupName || vipDeliverable.name
        deliverableInfo = {
          id: vipDeliverable.id,
          name: vipDeliverable.name,
          type: vipDeliverable.type,
          vipGroupChatId: vipDeliverable.vipGroupChatId,
          vipGroupName: vipDeliverable.vipGroupName
        }
        steps.push({
          step: 3,
          name: "Buscar Entregavel VIP Group",
          status: "success",
          details: {
            deliverable_found: true,
            deliverable: deliverableInfo,
            all_deliverables: flowConfig.deliverables.map(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (d: any) => ({ id: d.id, name: d.name, type: d.type })
            )
          }
        })
      } else {
        // Verificar sistema legado
        if (flowConfig?.delivery?.type === "vip_group" && flowConfig?.delivery?.vipGroupId) {
          vipGroupChatId = flowConfig.delivery.vipGroupId
          vipGroupName = flowConfig.delivery.vipGroupName || "Grupo VIP (legado)"
          steps.push({
            step: 3,
            name: "Buscar Entregavel VIP Group",
            status: "success",
            details: {
              deliverable_found: true,
              source: "sistema_legado",
              vipGroupChatId,
              vipGroupName
            }
          })
        } else {
          steps.push({
            step: 3,
            name: "Buscar Entregavel VIP Group",
            status: "error",
            error: "Nenhum entregavel do tipo vip_group configurado",
            details: {
              deliverables_count: flowConfig?.deliverables?.length || 0,
              deliverables_types: flowConfig?.deliverables?.map(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (d: any) => d.type
              ) || [],
              legacy_delivery_type: flowConfig?.delivery?.type || "none"
            }
          })
          overallSuccess = false
          errorStep = errorStep || "Buscar Entregavel VIP Group"
          errorMessage = errorMessage || "Nenhum entregavel do tipo vip_group configurado"
        }
      }
    } else if (vipGroupChatId) {
      steps.push({
        step: 3,
        name: "Buscar Entregavel VIP Group",
        status: "success",
        details: {
          source: "fornecido_manualmente",
          vipGroupChatId,
          vipGroupName
        }
      })
    } else {
      steps.push({
        step: 3,
        name: "Buscar Entregavel VIP Group",
        status: "error",
        error: "telegram_group_id nao fornecido e nenhum flow para buscar",
        details: {}
      })
      overallSuccess = false
      errorStep = errorStep || "Buscar Entregavel VIP Group"
      errorMessage = errorMessage || "Sem grupo VIP para testar"
    }

    // ========== ETAPA 4: Verificar Permissoes do Bot no Grupo (API Real do Telegram) ==========
    let botPermissions = null
    
    if (botToken && vipGroupChatId) {
      try {
        // Primeiro, obter info do bot
        const getMeRes = await fetch(
          `https://api.telegram.org/bot${botToken}/getMe`,
          { method: "GET" }
        )
        const getMeData = await getMeRes.json()
        
        if (!getMeData.ok) {
          steps.push({
            step: 4,
            name: "Verificar Bot (getMe)",
            status: "error",
            error: getMeData.description || "Token invalido",
            details: {
              telegram_response: getMeData
            }
          })
          overallSuccess = false
          errorStep = errorStep || "Verificar Bot"
          errorMessage = errorMessage || getMeData.description
        } else {
          const botInfo = getMeData.result
          
          // Verificar se bot e membro do grupo
          const getChatMemberRes = await fetch(
            `https://api.telegram.org/bot${botToken}/getChatMember`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: vipGroupChatId,
                user_id: botInfo.id
              })
            }
          )
          const getChatMemberData = await getChatMemberRes.json()
          
          if (!getChatMemberData.ok) {
            steps.push({
              step: 4,
              name: "Verificar Bot no Grupo",
              status: "error",
              error: getChatMemberData.description || "Bot nao e membro do grupo",
              details: {
                bot_id: botInfo.id,
                bot_username: botInfo.username,
                group_chat_id: vipGroupChatId,
                telegram_error_code: getChatMemberData.error_code,
                telegram_response: getChatMemberData
              }
            })
            overallSuccess = false
            errorStep = errorStep || "Verificar Bot no Grupo"
            errorMessage = errorMessage || getChatMemberData.description
          } else {
            const memberInfo = getChatMemberData.result
            const isAdmin = memberInfo.status === "administrator" || memberInfo.status === "creator"
            const canInviteUsers = memberInfo.can_invite_users === true
            
            botPermissions = {
              status: memberInfo.status,
              is_admin: isAdmin,
              can_invite_users: canInviteUsers,
              can_restrict_members: memberInfo.can_restrict_members,
              can_delete_messages: memberInfo.can_delete_messages
            }
            
            if (!isAdmin) {
              steps.push({
                step: 4,
                name: "Verificar Bot no Grupo",
                status: "error",
                error: "Bot NAO e administrador do grupo",
                details: {
                  bot_id: botInfo.id,
                  bot_username: botInfo.username,
                  bot_status: memberInfo.status,
                  permissions: botPermissions,
                  fix: "Adicione o bot como ADMINISTRADOR do grupo com permissao para convidar usuarios"
                }
              })
              overallSuccess = false
              errorStep = errorStep || "Verificar Bot no Grupo"
              errorMessage = errorMessage || "Bot nao e administrador do grupo"
            } else if (!canInviteUsers) {
              steps.push({
                step: 4,
                name: "Verificar Bot no Grupo",
                status: "error",
                error: "Bot e admin mas NAO tem permissao para convidar usuarios",
                details: {
                  bot_id: botInfo.id,
                  bot_username: botInfo.username,
                  bot_status: memberInfo.status,
                  permissions: botPermissions,
                  fix: "Edite as permissoes do bot e ative 'Convidar usuarios via link'"
                }
              })
              overallSuccess = false
              errorStep = errorStep || "Verificar Permissoes"
              errorMessage = errorMessage || "Bot sem permissao de convidar usuarios"
            } else {
              steps.push({
                step: 4,
                name: "Verificar Bot no Grupo",
                status: "success",
                details: {
                  bot_id: botInfo.id,
                  bot_username: botInfo.username,
                  bot_status: memberInfo.status,
                  permissions: botPermissions
                }
              })
            }
          }
        }
      } catch (e) {
        steps.push({
          step: 4,
          name: "Verificar Bot no Grupo",
          status: "error",
          error: `Excecao ao verificar: ${e instanceof Error ? e.message : String(e)}`,
          details: {}
        })
        overallSuccess = false
        errorStep = errorStep || "Verificar Bot no Grupo"
        errorMessage = errorMessage || `Excecao: ${e instanceof Error ? e.message : String(e)}`
      }
    } else {
      steps.push({
        step: 4,
        name: "Verificar Bot no Grupo",
        status: "skipped",
        details: {
          reason: !botToken ? "Token do bot nao disponivel" : "Chat ID do grupo nao disponivel"
        }
      })
    }

    // ========== ETAPA 5: Criar Link de Convite Unico (API Real do Telegram) ==========
    let inviteLink = null
    
    if (botToken && vipGroupChatId && overallSuccess) {
      try {
        const createLinkRes = await fetch(
          `https://api.telegram.org/bot${botToken}/createChatInviteLink`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: vipGroupChatId,
              name: `TEST-VIP-${Date.now()}`,
              member_limit: 1 // Link unico para 1 pessoa
            })
          }
        )
        const createLinkData = await createLinkRes.json()
        
        if (!createLinkData.ok) {
          steps.push({
            step: 5,
            name: "Criar Link de Convite",
            status: "error",
            error: createLinkData.description || "Falha ao criar link",
            details: {
              telegram_error_code: createLinkData.error_code,
              telegram_response: createLinkData,
              request_body: {
                chat_id: vipGroupChatId,
                name: `TEST-VIP-${Date.now()}`,
                member_limit: 1
              }
            }
          })
          overallSuccess = false
          errorStep = errorStep || "Criar Link de Convite"
          errorMessage = errorMessage || createLinkData.description
        } else {
          inviteLink = createLinkData.result.invite_link
          steps.push({
            step: 5,
            name: "Criar Link de Convite",
            status: "success",
            details: {
              invite_link: inviteLink,
              member_limit: createLinkData.result.member_limit,
              creator: createLinkData.result.creator,
              name: createLinkData.result.name,
              is_primary: createLinkData.result.is_primary,
              is_revoked: createLinkData.result.is_revoked
            }
          })
        }
      } catch (e) {
        steps.push({
          step: 5,
          name: "Criar Link de Convite",
          status: "error",
          error: `Excecao ao criar link: ${e instanceof Error ? e.message : String(e)}`,
          details: {}
        })
        overallSuccess = false
        errorStep = errorStep || "Criar Link de Convite"
        errorMessage = errorMessage || `Excecao: ${e instanceof Error ? e.message : String(e)}`
      }
    } else if (!overallSuccess) {
      steps.push({
        step: 5,
        name: "Criar Link de Convite",
        status: "skipped",
        details: {
          reason: "Etapa anterior falhou"
        }
      })
    } else {
      steps.push({
        step: 5,
        name: "Criar Link de Convite",
        status: "skipped",
        details: {
          reason: !botToken ? "Token do bot nao disponivel" : "Chat ID do grupo nao disponivel"
        }
      })
    }

    // ========== ETAPA 6: Enviar Link para Usuario (Opcional) ==========
    if (inviteLink && user_telegram_id && botToken) {
      try {
        const sendRes = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: user_telegram_id,
              text: `<b>TESTE VIP GROUP</b>\n\nLink de convite gerado com sucesso!\n\nClique no botao abaixo para entrar no grupo:\n\n<i>Este e um teste - o link expira apos 1 uso.</i>`,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [{ text: `Entrar no ${vipGroupName}`, url: inviteLink }]
                ]
              }
            })
          }
        )
        const sendData = await sendRes.json()
        
        if (!sendData.ok) {
          steps.push({
            step: 6,
            name: "Enviar Link ao Usuario",
            status: "error",
            error: sendData.description || "Falha ao enviar mensagem",
            details: {
              telegram_response: sendData
            }
          })
        } else {
          steps.push({
            step: 6,
            name: "Enviar Link ao Usuario",
            status: "success",
            details: {
              message_id: sendData.result.message_id,
              chat_id: user_telegram_id,
              link_sent: inviteLink
            }
          })
        }
      } catch (e) {
        steps.push({
          step: 6,
          name: "Enviar Link ao Usuario",
          status: "error",
          error: `Excecao: ${e instanceof Error ? e.message : String(e)}`,
          details: {}
        })
      }
    } else {
      steps.push({
        step: 6,
        name: "Enviar Link ao Usuario",
        status: "skipped",
        details: {
          reason: !user_telegram_id 
            ? "user_telegram_id nao fornecido (opcional)" 
            : !inviteLink 
              ? "Link nao foi criado (etapa anterior falhou)" 
              : "Token nao disponivel"
        }
      })
    }

    // ========== RESULTADO FINAL ==========
    return NextResponse.json({
      test_info: {
        description: "Teste REAL do fluxo de criacao de link VIP",
        executed_at: now.toISOString(),
        environment: "production",
        version: "2.0.0 (real API calls)"
      },
      parameters_received: {
        flow_id,
        bot_id,
        telegram_group_id,
        user_telegram_id
      },
      steps,
      summary: {
        total_steps: steps.length,
        successful_steps: steps.filter(s => s.status === "success").length,
        failed_steps: steps.filter(s => s.status === "error").length,
        skipped_steps: steps.filter(s => s.status === "skipped").length,
        overall_status: overallSuccess ? "SUCCESS" : "FAILED",
        error_step: errorStep,
        error_message: errorMessage,
        invite_link_created: inviteLink,
        invite_link: inviteLink
      }
    }, { status: overallSuccess ? 200 : 400 })

  } catch (error) {
    return NextResponse.json({
      test_info: {
        description: "Teste REAL do fluxo de criacao de link VIP",
        executed_at: now.toISOString(),
        environment: "production",
        version: "2.0.0"
      },
      steps,
      error: {
        message: error instanceof Error ? error.message : String(error),
        type: "unexpected_exception"
      },
      summary: {
        overall_status: "FAILED",
        error_step: "Execucao geral",
        error_message: error instanceof Error ? error.message : String(error)
      }
    }, { status: 500 })
  }
}

// GET continua retornando dados mockados para referencia
export async function GET() {
  return NextResponse.json({
    message: "Use POST para testar o fluxo real",
    usage: {
      method: "POST",
      body: {
        flow_id: "uuid-do-fluxo (recomendado - busca tudo automatico)",
        bot_id: "uuid-do-bot (opcional)",
        telegram_group_id: "-100xxx (opcional - sobrescreve o do flow)",
        user_telegram_id: "123456789 (opcional - para receber o link no Telegram)"
      },
      example_curl: `curl -X POST ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/test/vip-group-purchase -H "Content-Type: application/json" -d '{"flow_id": "seu-flow-id"}'`
    },
    what_it_tests: [
      "1. Buscar dados do Flow no banco",
      "2. Buscar Bot e Token",
      "3. Buscar Entregavel VIP Group configurado",
      "4. Verificar permissoes do Bot no grupo (API Telegram real)",
      "5. Criar link de convite unico (API Telegram real)",
      "6. Enviar link para usuario (opcional, se user_telegram_id fornecido)"
    ]
  })
}

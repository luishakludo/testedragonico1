import { NextResponse } from "next/server"

// API mockada para simular o fluxo completo de compra de grupo VIP
export async function GET() {
  // Simular delay de processamento (100-300ms)
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 200 + 100))

  const now = new Date()
  const paymentId = `MP_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`
  const inviteLinkId = `IL_${Math.random().toString(36).substring(2, 10).toUpperCase()}`
  const groupChatId = `-100${Math.floor(Math.random() * 9000000000 + 1000000000)}`
  const userId = Math.floor(Math.random() * 900000000 + 100000000)
  const botId = Math.floor(Math.random() * 9000000000 + 1000000000)

  // Resultado mockado do fluxo completo
  const mockResult = {
    test_info: {
      description: "Simulacao do fluxo completo de compra de grupo VIP",
      executed_at: now.toISOString(),
      environment: "mock",
      version: "1.0.0",
    },
    
    // ETAPA 1: Pagamento
    payment: {
      step: 1,
      name: "Processamento do Pagamento",
      status: "approved",
      details: {
        payment_id: paymentId,
        external_reference: `flow_abc123_user_${userId}`,
        amount: 97.00,
        currency: "BRL",
        payment_method: "pix",
        payer_email: "teste@exemplo.com",
        created_at: new Date(now.getTime() - 5000).toISOString(),
        approved_at: now.toISOString(),
        mercadopago_status: "approved",
        mercadopago_status_detail: "accredited",
      },
    },

    // ETAPA 2: Busca do Bot e Flow
    bot_lookup: {
      step: 2,
      name: "Busca do Bot e Configuracao",
      status: "success",
      details: {
        bot_id: `bot_${botId}`,
        bot_username: "@MeuBotVendas",
        bot_token_found: true,
        bot_token_preview: `${botId}:AAH...xxxxx (ocultado)`,
        flow_id: "flow_abc123",
        flow_name: "Fluxo de Vendas Premium",
        flow_active: true,
      },
    },

    // ETAPA 3: Busca do Entregavel
    deliverable_lookup: {
      step: 3,
      name: "Busca do Entregavel Configurado",
      status: "success",
      details: {
        deliverable_id: "del_vip_001",
        deliverable_name: "Acesso Grupo VIP Premium",
        deliverable_type: "vip_group",
        main_deliverable: true,
        vip_group_chat_id: groupChatId,
        vip_group_name: "Grupo VIP Premium - Acesso Exclusivo",
      },
    },

    // ETAPA 4: Verificacao do Bot no Grupo
    bot_permissions: {
      step: 4,
      name: "Verificacao de Permissoes do Bot",
      status: "success",
      details: {
        bot_is_member: true,
        bot_status: "administrator",
        can_invite_users: true,
        can_restrict_members: true,
        can_delete_messages: true,
        group_type: "supergroup",
        group_title: "Grupo VIP Premium - Acesso Exclusivo",
        group_member_count: 847,
      },
    },

    // ETAPA 5: Criacao do Link de Convite
    invite_link_creation: {
      step: 5,
      name: "Criacao do Link de Convite Unico",
      status: "success",
      details: {
        invite_link_id: inviteLinkId,
        invite_link: `https://t.me/+ABC123XYZ789_${inviteLinkId}`,
        member_limit: 1,
        creates_join_request: false,
        is_primary: false,
        is_revoked: false,
        name: `VIP Access - ${Date.now()}`,
        expire_date: null,
        created_at: now.toISOString(),
        telegram_api_response: {
          ok: true,
          result: {
            invite_link: `https://t.me/+ABC123XYZ789_${inviteLinkId}`,
            creator: {
              id: botId,
              is_bot: true,
              first_name: "Bot Vendas",
              username: "MeuBotVendas",
            },
            creates_join_request: false,
            is_primary: false,
            is_revoked: false,
            member_limit: 1,
          },
        },
      },
    },

    // ETAPA 6: Envio da Mensagem ao Usuario
    message_delivery: {
      step: 6,
      name: "Envio da Mensagem com Link",
      status: "success",
      details: {
        recipient_chat_id: userId,
        message_sent: true,
        message_id: Math.floor(Math.random() * 90000 + 10000),
        message_text: `Obrigado pela compra! Seu acesso ao <b>Grupo VIP Premium - Acesso Exclusivo</b> foi liberado.\n\n<i>Este link e unico e pode ser usado apenas uma vez.</i>`,
        inline_keyboard: [
          [
            {
              text: "Entrar no Grupo VIP Premium - Acesso Exclusivo",
              url: `https://t.me/+ABC123XYZ789_${inviteLinkId}`,
            },
          ],
        ],
        parse_mode: "HTML",
        sent_at: now.toISOString(),
      },
    },

    // ETAPA 7: Atualizacao do Banco de Dados
    database_update: {
      step: 7,
      name: "Atualizacao do Registro de Pagamento",
      status: "success",
      details: {
        table: "payments",
        payment_id: paymentId,
        updates: {
          status: "approved",
          approved_at: now.toISOString(),
          delivery_sent: true,
          delivery_sent_at: now.toISOString(),
          invite_link_generated: `https://t.me/+ABC123XYZ789_${inviteLinkId}`,
        },
      },
    },

    // RESUMO FINAL
    summary: {
      total_steps: 7,
      successful_steps: 7,
      failed_steps: 0,
      overall_status: "SUCCESS",
      total_processing_time_ms: Math.floor(Math.random() * 800 + 400),
      flow_completed: true,
      user_received_access: true,
      invite_link_active: true,
      notes: [
        "Pagamento processado e aprovado com sucesso",
        "Bot encontrado e token valido",
        "Entregavel tipo vip_group configurado corretamente",
        "Bot e administrador do grupo com permissoes adequadas",
        "Link de convite unico criado (limite: 1 uso)",
        "Mensagem enviada ao usuario com botao de acesso",
        "Banco de dados atualizado com status final",
      ],
    },
  }

  return NextResponse.json(mockResult, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  })
}

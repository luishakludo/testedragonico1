import { NextResponse } from "next/server"

// ---------------------------------------------------------------------------
// TEMPLATE DE MENSAGEM DE BOAS-VINDAS
// 
// Este endpoint retorna um template completo de boas-vindas que pode ser
// copiado e colado facilmente. Inclui todas as estruturas necessarias.
// ---------------------------------------------------------------------------

export async function GET() {
  const now = new Date().toISOString()

  // =========================================================================
  // CONFIGURACAO COMPLETA DE BOAS-VINDAS (para salvar no fluxo)
  // =========================================================================
  const welcomeConfig = {
    // Mensagem principal de boas-vindas
    welcomeMessage: `<b>Ola! Seja muito bem-vindo(a)!</b>

Que bom ter voce aqui!

Aqui voce vai encontrar o melhor conteudo exclusivo.

Clique no botao abaixo para ver nossos planos e garantir seu acesso!`,

    // Array de midias (imagens/videos) - aparecem antes da mensagem
    welcomeMedias: [
      // "https://exemplo.com/banner-boas-vindas.jpg"
    ],

    // Botao CTA principal
    ctaButtonText: "Ver Planos",
    
    // Botao de redirecionamento (opcional)
    redirectButton: {
      enabled: false,
      text: "Acessar Site",
      url: "https://seusite.com"
    },

    // Mensagem secundaria (opcional)
    secondaryMessage: {
      enabled: false,
      message: "Qualquer duvida, estamos a disposicao!"
    },

    // Planos disponiveis
    plans: [
      {
        id: "plan_basico",
        name: "Plano Basico",
        price: 29.90,
        duration_days: 30,
        duration_type: "monthly",
        description: "Acesso a todo conteudo por 30 dias",
        active: true,
        delivery_type: "default"
      },
      {
        id: "plan_vip",
        name: "Plano VIP",
        price: 49.90,
        duration_days: 30,
        duration_type: "monthly",
        description: "Acesso VIP com conteudo extra",
        active: true,
        delivery_type: "default"
      },
      {
        id: "plan_vitalicio",
        name: "Plano Vitalicio",
        price: 97.00,
        duration_days: 36500,
        duration_type: "lifetime",
        description: "Acesso para sempre",
        active: true,
        delivery_type: "default"
      }
    ]
  }

  // =========================================================================
  // EXEMPLO DE MENSAGEM PARA TELEGRAM
  // =========================================================================
  const telegramMessageExample = {
    // Enviar texto com botoes de planos
    sendMessage: {
      chat_id: "CHAT_ID",
      text: `<b>Bem-vindo!</b>

Escolha seu plano abaixo:`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "Basico - R$ 29,90", callback_data: "plan_basico" }],
          [{ text: "VIP - R$ 49,90", callback_data: "plan_vip" }],
          [{ text: "Vitalicio - R$ 97,00", callback_data: "plan_vitalicio" }]
        ]
      }
    },

    // Enviar foto de boas-vindas com botoes
    sendPhoto: {
      chat_id: "CHAT_ID",
      photo: "URL_DA_IMAGEM",
      caption: `<b>Bem-vindo!</b>

Clique abaixo para ver os planos:`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "Ver Planos", callback_data: "show_plans" }]
        ]
      }
    }
  }

  // =========================================================================
  // ESTRUTURA DO FLUXO COMPLETO (config)
  // =========================================================================
  const flowConfigStructure = {
    welcomeMessage: "Texto de boas-vindas...",
    welcomeMedias: ["url1", "url2"],
    ctaButtonText: "Ver Planos",
    redirectButton: {
      enabled: false,
      text: "Texto",
      url: "https://..."
    },
    secondaryMessage: {
      enabled: false,
      message: "Texto secundario"
    },
    plans: [
      {
        id: "string",
        name: "string",
        price: 0,
        duration_days: 30,
        duration_type: "monthly | yearly | lifetime",
        description: "string",
        active: true,
        delivery_type: "default | custom",
        deliverableId: "string (opcional)"
      }
    ],
    delivery: {
      type: "media | vip_group | link",
      medias: ["urls..."],
      link: "https://...",
      linkText: "Acessar",
      vipGroupId: "id_do_grupo",
      vipGroupName: "Nome do Grupo",
      vipAutoAdd: true,
      vipAutoRemoveOnExpire: true
    },
    downsell: {
      enabled: true,
      sequences: []
    },
    upsell: {
      enabled: true,
      sequences: []
    }
  }

  return NextResponse.json({
    titulo: "TEMPLATES DE BOAS-VINDAS",
    descricao: "Copie e cole essas estruturas para configurar suas mensagens",
    gerado_em: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),

    // Configuracao completa de boas-vindas
    config_boas_vindas: welcomeConfig,

    // Exemplos para API do Telegram
    exemplos_telegram_api: telegramMessageExample,

    // Estrutura completa do fluxo
    estrutura_fluxo_completo: flowConfigStructure,

    // Instrucoes
    instrucoes: {
      como_usar: [
        "1. Copie o 'config_boas_vindas' para seu fluxo",
        "2. Edite a mensagem, planos e precos",
        "3. Adicione imagens no array 'welcomeMedias' se quiser",
        "4. Configure os planos com os precos desejados",
        "5. Salve e ative o fluxo"
      ],
      dicas: [
        "Use mensagens curtas e diretas",
        "Coloque o beneficio principal logo no inicio",
        "Limite a 3-4 planos para nao confundir",
        "Use emojis com moderacao"
      ]
    }
  })
}

import { NextResponse } from "next/server"

// ---------------------------------------------------------------------------
// TEMPLATE DE MENSAGEM DE DOWNSELL
// 
// Este endpoint retorna um template completo de downsell que pode ser
// copiado e colado facilmente. Inclui todas as estruturas necessarias:
// - Mensagens de texto
// - Midias (imagens/videos)
// - Botoes de planos
// - Configuracoes de timing
// ---------------------------------------------------------------------------

export async function GET() {
  const now = new Date().toISOString()

  // =========================================================================
  // TEMPLATE COMPLETO DE SEQUENCIA DE DOWNSELL
  // =========================================================================
  const downsellTemplate = {
    // Identificador unico da sequencia
    id: `ds_${Date.now()}`,
    
    // Mensagem de texto (suporta HTML do Telegram)
    message: `<b>Espera ai!</b>

Percebi que voce ainda nao finalizou sua compra...

Tenho uma oferta <b>EXCLUSIVA</b> para voce:

Por apenas <b>R$ 19,90</b> voce leva o acesso completo!

Isso e menos que um lanche! 

<i>Essa oferta expira em breve...</i>`,
    
    // Array de midias (URLs de imagens ou videos)
    // Deixe vazio [] se nao quiser midia
    medias: [
      // Exemplo: "https://exemplo.com/imagem-oferta.jpg"
    ],
    
    // Configuracao de quando enviar
    sendTiming: "custom", // "immediate" ou "custom"
    sendDelayValue: 5,    // Valor do delay
    sendDelayUnit: "minutes", // "minutes", "hours" ou "days"
    
    // Planos/Botoes que aparecem na mensagem
    plans: [
      {
        id: `plan_${Date.now()}_1`,
        buttonText: "QUERO POR R$ 19,90",
        price: 19.90
      },
      {
        id: `plan_${Date.now()}_2`,
        buttonText: "QUERO POR R$ 29,90",
        price: 29.90
      }
    ],
    
    // Tipo de entrega ao comprar
    deliveryType: "global", // "global" (usa entrega padrao) ou "custom"
    deliverableId: null, // ID do entregavel se deliveryType = "custom"
  }

  // =========================================================================
  // CONFIGURACAO COMPLETA DE DOWNSELL (para salvar no fluxo)
  // =========================================================================
  const downsellConfig = {
    enabled: true,
    sequences: [
      // Sequencia 1 - Envia 5 minutos depois do /start
      {
        id: `ds_seq_1_${Date.now()}`,
        message: `<b>Ei, ainda esta ai?</b>

Vi que voce nao finalizou a compra...

Que tal um <b>DESCONTO ESPECIAL</b>?

Acesso completo por apenas <b>R$ 19,90</b>!

Aproveita, essa oferta e por tempo limitado!`,
        medias: [],
        sendTiming: "custom",
        sendDelayValue: 5,
        sendDelayUnit: "minutes",
        plans: [
          { id: "plan_1", buttonText: "QUERO POR R$ 19,90", price: 19.90 }
        ],
        deliveryType: "global",
        deliverableId: null
      },
      
      // Sequencia 2 - Envia 1 hora depois do /start
      {
        id: `ds_seq_2_${Date.now()}`,
        message: `<b>ULTIMA CHANCE!</b>

Essa e sua ultima oportunidade de garantir o acesso...

Por apenas <b>R$ 14,90</b> voce leva TUDO!

Mais barato que isso, impossivel!`,
        medias: [],
        sendTiming: "custom",
        sendDelayValue: 1,
        sendDelayUnit: "hours",
        plans: [
          { id: "plan_2", buttonText: "QUERO POR R$ 14,90", price: 14.90 }
        ],
        deliveryType: "global",
        deliverableId: null
      },
      
      // Sequencia 3 - Envia 1 dia depois do /start
      {
        id: `ds_seq_3_${Date.now()}`,
        message: `<b>Voce esqueceu de algo...</b>

Faz 1 dia que voce demonstrou interesse...

Preparei uma oferta <b>IRRECUSAVEL</b> para voce:

Acesso VITALICIO por apenas <b>R$ 9,90</b>!

Essa e a menor oferta que ja fizemos!`,
        medias: [],
        sendTiming: "custom",
        sendDelayValue: 1,
        sendDelayUnit: "days",
        plans: [
          { id: "plan_3", buttonText: "QUERO POR R$ 9,90", price: 9.90 }
        ],
        deliveryType: "global",
        deliverableId: null
      }
    ]
  }

  // =========================================================================
  // EXEMPLO DE MENSAGEM PARA ENVIAR DIRETO NO TELEGRAM (via API)
  // =========================================================================
  const telegramMessageExample = {
    // Para enviar texto simples com botoes
    sendMessage: {
      chat_id: "CHAT_ID_DO_USUARIO",
      text: `<b>Oferta Especial!</b>

Voce tem uma oferta exclusiva esperando...

Clique no botao abaixo para garantir seu desconto!`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "QUERO POR R$ 19,90", callback_data: "plan_PLAN_ID" },
            { text: "QUERO POR R$ 29,90", callback_data: "plan_PLAN_ID_2" }
          ]
        ]
      }
    },
    
    // Para enviar foto com botoes
    sendPhoto: {
      chat_id: "CHAT_ID_DO_USUARIO",
      photo: "URL_DA_IMAGEM",
      caption: `<b>Oferta Especial!</b>

Aproveite esse desconto exclusivo!`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "QUERO AGORA!", callback_data: "plan_PLAN_ID" }]
        ]
      }
    },
    
    // Para enviar video com botoes
    sendVideo: {
      chat_id: "CHAT_ID_DO_USUARIO",
      video: "URL_DO_VIDEO",
      caption: `<b>Veja essa oferta!</b>

Clique abaixo para garantir:`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "COMPRAR AGORA", callback_data: "plan_PLAN_ID" }]
        ]
      }
    }
  }

  // =========================================================================
  // ESTRUTURA PARA BANCO DE DADOS (scheduled_messages)
  // =========================================================================
  const scheduledMessageStructure = {
    id: "UUID_GERADO_AUTOMATICAMENTE",
    bot_id: "ID_DO_BOT",
    flow_id: "ID_DO_FLUXO",
    telegram_user_id: "ID_DO_USUARIO_TELEGRAM",
    telegram_chat_id: 123456789,
    message_type: "downsell", // ou "upsell"
    scheduled_for: "2024-01-15T14:30:00.000Z", // Data/hora para enviar
    status: "pending", // pending, sent, cancelled, failed
    metadata: {
      message: "Texto da mensagem...",
      medias: ["url1", "url2"],
      plans: [
        { id: "plan_1", buttonText: "Texto do Botao", price: 19.90 }
      ],
      sequence_index: 0,
      botToken: "TOKEN_DO_BOT"
    },
    created_at: now,
    updated_at: now
  }

  // =========================================================================
  // RESPOSTA FINAL
  // =========================================================================
  return NextResponse.json({
    titulo: "TEMPLATES DE DOWNSELL",
    descricao: "Copie e cole essas estruturas para configurar seu downsell",
    gerado_em: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),

    // Template de uma sequencia individual
    template_sequencia_individual: downsellTemplate,

    // Configuracao completa com 3 sequencias de exemplo
    config_completa_downsell: downsellConfig,

    // Exemplos de como enviar via API do Telegram
    exemplos_telegram_api: telegramMessageExample,

    // Estrutura da tabela scheduled_messages
    estrutura_banco_dados: scheduledMessageStructure,

    // Instrucoes de uso
    instrucoes: {
      como_usar: [
        "1. Copie o 'config_completa_downsell' para usar no seu fluxo",
        "2. Edite as mensagens, precos e timings conforme necessario",
        "3. Adicione URLs de imagens/videos no array 'medias' se quiser",
        "4. Salve no config do fluxo e ative o downsell",
        "5. O sistema vai agendar automaticamente quando usuario der /start"
      ],
      formatacao_texto: {
        negrito: "<b>texto</b>",
        italico: "<i>texto</i>",
        sublinhado: "<u>texto</u>",
        riscado: "<s>texto</s>",
        codigo: "<code>texto</code>",
        link: '<a href="URL">texto</a>',
        quebra_linha: "Use \\n ou pule linha normalmente"
      },
      timings_sugeridos: [
        { timing: "5 minutos", uso: "Primeiro lembrete rapido" },
        { timing: "1 hora", uso: "Segundo lembrete com desconto maior" },
        { timing: "1 dia", uso: "Ultima chance com menor preco" },
        { timing: "3 dias", uso: "Oferta final antes de desistir" }
      ]
    }
  })
}

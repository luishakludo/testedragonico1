import { NextResponse } from "next/server"

// ---------------------------------------------------------------------------
// API DE DOWNSELL MOCKADA - RETORNA DADOS DE TESTE SEM PRECISAR DE NADA
// 
// Apenas acesse GET /api/test/downsell-mock e recebe os dados prontos
// Simula planos do produto principal com desconto aplicado
// ---------------------------------------------------------------------------

export async function GET() {
  const agora = new Date()
  const agoraBR = agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })

  // Desconto padrao simulado (%)
  const descontoPadrao = 20

  // Planos mockados simulando planos reais de um produto
  const planosMock = [
    {
      id: "plan_mock_1",
      nome: "Plano Basico",
      preco_original: 47.00,
      preco_com_desconto: 47.00 * (1 - descontoPadrao / 100),
      desconto_aplicado: descontoPadrao,
      buttonText: "QUERO POR R$ 37,60",
      ativo: true
    },
    {
      id: "plan_mock_2", 
      nome: "Plano Pro",
      preco_original: 97.00,
      preco_com_desconto: 97.00 * (1 - descontoPadrao / 100),
      desconto_aplicado: descontoPadrao,
      buttonText: "QUERO POR R$ 77,60",
      ativo: true
    },
    {
      id: "plan_mock_3",
      nome: "Plano Premium",
      preco_original: 197.00,
      preco_com_desconto: 197.00 * (1 - descontoPadrao / 100),
      desconto_aplicado: descontoPadrao,
      buttonText: "QUERO POR R$ 157,60",
      ativo: true
    },
    {
      id: "plan_mock_4",
      nome: "Plano VIP",
      preco_original: 497.00,
      preco_com_desconto: 497.00 * (1 - descontoPadrao / 100),
      desconto_aplicado: descontoPadrao,
      buttonText: "QUERO POR R$ 397,60",
      ativo: true
    }
  ]

  // Formatar valores para exibicao
  const planosFormatados = planosMock.map(p => ({
    ...p,
    preco_original_formatado: `R$ ${p.preco_original.toFixed(2).replace(".", ",")}`,
    preco_com_desconto_formatado: `R$ ${p.preco_com_desconto.toFixed(2).replace(".", ",")}`,
    desconto_formatado: `${p.desconto_aplicado}%`
  }))

  // Simular configuracao de downsell completa
  const downsellConfig = {
    enabled: true,
    desconto_padrao: descontoPadrao,
    mostrar_preco_no_botao: true,
    mensagem_padrao: `<b>Espera ai!</b>

Percebi que voce ainda nao finalizou sua compra...

Tenho uma oferta <b>EXCLUSIVA</b> com ${descontoPadrao}% OFF para voce!

<i>Essa oferta expira em breve...</i>`
  }

  // Simular dados do Telegram que seriam enviados
  const telegramPayload = {
    method: "sendMessage",
    body: {
      chat_id: "MOCK_CHAT_ID",
      text: downsellConfig.mensagem_padrao,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: planosFormatados.map(p => [
          {
            text: `${p.nome} - ${p.preco_com_desconto_formatado}`,
            callback_data: `downsell_plan_${p.id}`
          }
        ])
      }
    }
  }

  // Resposta final
  return NextResponse.json({
    sucesso: true,
    tipo: "DOWNSELL_MOCK",
    gerado_em: agoraBR,
    
    // Configuracao mockada
    config: downsellConfig,
    
    // Planos com desconto
    planos: planosFormatados,
    
    // Total de planos
    total_planos: planosFormatados.length,
    
    // Exemplo de payload para Telegram
    exemplo_telegram: telegramPayload,
    
    // Inline keyboard pronta pra usar
    inline_keyboard: telegramPayload.body.reply_markup.inline_keyboard,
    
    // Instrucoes
    instrucoes: {
      uso: "Estes dados sao mockados para teste - nao precisou preencher nada!",
      para_usar_no_telegram: "Copie o campo 'exemplo_telegram' e ajuste o chat_id",
      para_puxar_planos_reais: "Use GET /api/test/downsell que puxa do banco de dados real"
    }
  })
}

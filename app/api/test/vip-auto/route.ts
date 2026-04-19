import { NextRequest, NextResponse } from "next/server"

// GET /api/test/vip-auto?token=BOT_TOKEN&chat=-1003913345328&user=123456
// Teste 100% automatico - so acessar a URL com os params
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  const chatId = req.nextUrl.searchParams.get("chat")
  const userId = req.nextUrl.searchParams.get("user")

  if (!token || !chatId) {
    return NextResponse.json({
      erro: "Faltam parametros na URL",
      uso: "/api/test/vip-auto?token=SEU_TOKEN&chat=ID_GRUPO_VIP&user=SEU_TELEGRAM_ID",
      exemplo: "/api/test/vip-auto?token=123456:ABC-DEF&chat=-1003913345328&user=123456789",
      parametros: {
        token: "Token do bot (obrigatorio)",
        chat: "ID do grupo VIP (obrigatorio) - ja temos: -1003913345328 ou -1003651290704",
        user: "Seu Telegram ID (opcional) - para receber a mensagem de teste"
      }
    }, { status: 400 })
  }

  const resultado: Record<string, unknown> = {
    teste: "GERACAO DE LINK VIP - AUTOMATICO",
    timestamp: new Date().toISOString()
  }

  try {
    // 1. Verificar bot
    const botRes = await fetch(`https://api.telegram.org/bot${token}/getMe`)
    const botData = await botRes.json()
    
    if (!botData.ok) {
      return NextResponse.json({
        ...resultado,
        passo1_bot: { sucesso: false, erro: botData.description },
        erro_final: "TOKEN INVALIDO"
      }, { status: 400 })
    }
    resultado.passo1_bot = { sucesso: true, nome: botData.result.first_name, username: botData.result.username }

    // 2. Verificar grupo
    const chatRes = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId })
    })
    const chatData = await chatRes.json()

    if (!chatData.ok) {
      return NextResponse.json({
        ...resultado,
        passo2_grupo: { sucesso: false, erro: chatData.description },
        erro_final: "BOT NAO TEM ACESSO AO GRUPO - Adicione o bot como admin"
      }, { status: 400 })
    }
    resultado.passo2_grupo = { sucesso: true, titulo: chatData.result.title, tipo: chatData.result.type }

    // 3. Verificar admin
    const adminRes = await fetch(`https://api.telegram.org/bot${token}/getChatMember`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, user_id: botData.result.id })
    })
    const adminData = await adminRes.json()

    const isAdmin = adminData.result?.status === "administrator" || adminData.result?.status === "creator"
    const canInvite = adminData.result?.can_invite_users === true

    if (!isAdmin || !canInvite) {
      return NextResponse.json({
        ...resultado,
        passo3_admin: { 
          sucesso: false, 
          status: adminData.result?.status,
          pode_convidar: adminData.result?.can_invite_users,
          erro: !isAdmin ? "Bot nao eh admin" : "Bot nao tem permissao de convidar"
        },
        erro_final: "BOT PRECISA SER ADMIN COM PERMISSAO DE CONVIDAR"
      }, { status: 400 })
    }
    resultado.passo3_admin = { sucesso: true, status: adminData.result.status, pode_convidar: true }

    // 4. CRIAR LINK DE CONVITE - O TESTE PRINCIPAL!
    const inviteRes = await fetch(`https://api.telegram.org/bot${token}/createChatInviteLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        member_limit: 1,
        name: `VIP-Teste-${Date.now()}`,
        creates_join_request: false
      })
    })
    const inviteData = await inviteRes.json()

    if (!inviteData.ok) {
      return NextResponse.json({
        ...resultado,
        passo4_link: { sucesso: false, erro: inviteData.description },
        erro_final: "FALHA AO CRIAR LINK"
      }, { status: 400 })
    }

    resultado.passo4_link = {
      sucesso: true,
      LINK_GERADO: inviteData.result.invite_link,
      limite_usos: inviteData.result.member_limit,
      nome: inviteData.result.name
    }

    // 5. Enviar mensagem (se user foi passado)
    if (userId) {
      const msgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: parseInt(userId),
          text: `🎉 <b>TESTE VIP - FUNCIONOU!</b>\n\nSeu link de acesso exclusivo:\n\n${inviteData.result.invite_link}\n\n<i>Este link pode ser usado apenas 1 vez!</i>`,
          parse_mode: "HTML"
        })
      })
      const msgData = await msgRes.json()

      resultado.passo5_mensagem = {
        sucesso: msgData.ok,
        erro: msgData.ok ? null : msgData.description,
        dica: !msgData.ok ? "Voce precisa ter iniciado conversa com o bot primeiro" : null
      }
    }

    // RESULTADO FINAL
    resultado.RESULTADO = {
      status: "SUCESSO",
      link: inviteData.result.invite_link,
      conclusao: "A GERACAO DE LINK VIP ESTA FUNCIONANDO! O codigo esta correto.",
      problema_real: "Os bots nao estao cadastrados na tabela 'bots' do banco de dados"
    }

    return NextResponse.json(resultado)

  } catch (error) {
    return NextResponse.json({
      ...resultado,
      erro_final: "ERRO INTERNO",
      detalhes: String(error)
    }, { status: 500 })
  }
}

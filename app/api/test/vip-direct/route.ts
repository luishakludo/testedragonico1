import { NextRequest, NextResponse } from "next/server"

// POST /api/test/vip-direct
// Testa DIRETO a geracao de link de convite VIP - sem depender do banco
// Passa o token do bot e o chat_id do grupo manualmente
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { bot_token, vip_group_chat_id, telegram_user_id } = body

    if (!bot_token || !vip_group_chat_id) {
      return NextResponse.json({ 
        error: "Informe bot_token e vip_group_chat_id",
        exemplo: {
          bot_token: "123456:ABC-DEF...",
          vip_group_chat_id: "-1001234567890",
          telegram_user_id: "123456789 (opcional - para testar envio)"
        }
      }, { status: 400 })
    }

    const results: Record<string, unknown> = {
      test: "Teste DIRETO de geracao de link VIP",
      timestamp: new Date().toISOString(),
      inputs: {
        bot_token_preview: `${bot_token.substring(0, 10)}...`,
        vip_group_chat_id,
        telegram_user_id: telegram_user_id || "nao informado"
      }
    }

    // PASSO 1: Verificar se o bot eh valido
    console.log("[v0] Verificando bot...")
    const botInfoRes = await fetch(`https://api.telegram.org/bot${bot_token}/getMe`)
    const botInfo = await botInfoRes.json()
    
    results.step1_bot_info = {
      success: botInfo.ok,
      bot_id: botInfo.result?.id,
      bot_username: botInfo.result?.username,
      bot_name: botInfo.result?.first_name,
      error: botInfo.ok ? null : botInfo.description
    }

    if (!botInfo.ok) {
      return NextResponse.json({
        ...results,
        error: "Token do bot invalido",
        telegram_error: botInfo.description
      }, { status: 400 })
    }

    // PASSO 2: Verificar se o bot tem acesso ao grupo
    console.log("[v0] Verificando acesso ao grupo...")
    const chatInfoRes = await fetch(`https://api.telegram.org/bot${bot_token}/getChat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: vip_group_chat_id })
    })
    const chatInfo = await chatInfoRes.json()

    results.step2_chat_info = {
      success: chatInfo.ok,
      chat_id: chatInfo.result?.id,
      chat_title: chatInfo.result?.title,
      chat_type: chatInfo.result?.type,
      error: chatInfo.ok ? null : chatInfo.description
    }

    if (!chatInfo.ok) {
      return NextResponse.json({
        ...results,
        error: "Bot nao tem acesso ao grupo",
        telegram_error: chatInfo.description,
        dica: "Adicione o bot como ADMIN do grupo com permissao de convidar usuarios"
      }, { status: 400 })
    }

    // PASSO 3: Verificar se o bot eh admin
    console.log("[v0] Verificando se bot eh admin...")
    const adminRes = await fetch(`https://api.telegram.org/bot${bot_token}/getChatMember`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        chat_id: vip_group_chat_id,
        user_id: botInfo.result.id
      })
    })
    const adminInfo = await adminRes.json()

    const isAdmin = adminInfo.result?.status === "administrator" || adminInfo.result?.status === "creator"
    const canInvite = adminInfo.result?.can_invite_users === true

    results.step3_admin_check = {
      success: isAdmin && canInvite,
      status: adminInfo.result?.status,
      can_invite_users: adminInfo.result?.can_invite_users,
      error: !isAdmin 
        ? "Bot NAO eh admin do grupo" 
        : !canInvite 
          ? "Bot eh admin mas NAO tem permissao de convidar usuarios"
          : null
    }

    if (!isAdmin || !canInvite) {
      return NextResponse.json({
        ...results,
        error: "Bot precisa ser admin com permissao de convidar usuarios",
        dica: "Va nas configuracoes do grupo > Administradores > Selecione o bot > Ative 'Convidar usuarios via link'"
      }, { status: 400 })
    }

    // PASSO 4: CRIAR O LINK DE CONVITE (o teste principal!)
    console.log("[v0] Criando link de convite...")
    const inviteRes = await fetch(`https://api.telegram.org/bot${bot_token}/createChatInviteLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: vip_group_chat_id,
        member_limit: 1, // LIMITE DE 1 USO - link unico!
        name: `VIP Test ${Date.now()}`,
        creates_join_request: false
      })
    })
    const inviteData = await inviteRes.json()

    results.step4_create_invite = {
      success: inviteData.ok,
      invite_link: inviteData.result?.invite_link,
      member_limit: inviteData.result?.member_limit,
      name: inviteData.result?.name,
      error: inviteData.ok ? null : inviteData.description
    }

    if (!inviteData.ok) {
      return NextResponse.json({
        ...results,
        error: "Falha ao criar link de convite",
        telegram_error: inviteData.description
      }, { status: 400 })
    }

    // PASSO 5: Se passou telegram_user_id, testar envio da mensagem
    if (telegram_user_id) {
      console.log("[v0] Enviando mensagem de teste...")
      const messageRes = await fetch(`https://api.telegram.org/bot${bot_token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: parseInt(telegram_user_id),
          text: `<b>TESTE DE ENTREGA VIP</b>\n\nPagamento aprovado! Aqui esta seu link de acesso exclusivo:\n\n${inviteData.result.invite_link}\n\n<i>Este link so pode ser usado 1 vez!</i>`,
          parse_mode: "HTML"
        })
      })
      const messageData = await messageRes.json()

      results.step5_send_message = {
        success: messageData.ok,
        message_id: messageData.result?.message_id,
        error: messageData.ok ? null : messageData.description,
        dica: !messageData.ok ? "O usuario precisa ter iniciado conversa com o bot primeiro" : null
      }
    }

    // RESULTADO FINAL
    results.resultado_final = {
      sucesso: true,
      link_gerado: inviteData.result.invite_link,
      mensagem: "A geracao de link VIP esta FUNCIONANDO corretamente!",
      proximo_passo: "O problema esta nos bots nao estarem cadastrados na tabela 'bots' do banco"
    }

    return NextResponse.json(results)

  } catch (error) {
    return NextResponse.json({
      error: "Erro interno",
      details: String(error)
    }, { status: 500 })
  }
}

// GET - Instrucoes de uso
export async function GET() {
  return NextResponse.json({
    descricao: "Teste DIRETO de geracao de link VIP - sem depender do banco de dados",
    uso: "POST com body JSON",
    parametros: {
      bot_token: "(obrigatorio) Token do bot do Telegram",
      vip_group_chat_id: "(obrigatorio) ID do grupo VIP (ex: -1001234567890)",
      telegram_user_id: "(opcional) ID do usuario para testar envio da mensagem"
    },
    exemplo: {
      bot_token: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
      vip_group_chat_id: "-1003913345328",
      telegram_user_id: "123456789"
    },
    o_que_testa: [
      "1. Valida o token do bot",
      "2. Verifica se bot tem acesso ao grupo",
      "3. Verifica se bot eh admin com permissao de convidar",
      "4. CRIA o link de convite com limite de 1 uso",
      "5. (opcional) Envia mensagem com link pro usuario"
    ]
  })
}

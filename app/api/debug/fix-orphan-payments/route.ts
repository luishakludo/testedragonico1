import { getSupabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

// GET /api/debug/fix-orphan-payments - Ver estado atual
// POST /api/debug/fix-orphan-payments - Executar correção

const ORPHAN_BOT_ID = "65f4a521-b310-4638-bfb3-522895406e30"
const CORRECT_USER_ID = "7db32fb5-e69a-42ff-9157-f92fc30269a1"

export async function GET() {
  const supabase = getSupabaseAdmin()
  
  // Verificar estado atual do bot
  const { data: bot, error: botError } = await supabase
    .from("bots")
    .select("id, name, user_id, created_at")
    .eq("id", ORPHAN_BOT_ID)
    .single()
  
  // Contar pagamentos órfãos deste bot
  const { data: orphanPayments, error: paymentsError } = await supabase
    .from("payments")
    .select("id, bot_id, user_id, product_type, amount, status, created_at")
    .eq("bot_id", ORPHAN_BOT_ID)
    .is("user_id", null)
    .order("created_at", { ascending: false })
    .limit(20)
  
  // Contar TODOS pagamentos com user_id null
  const { count: totalOrphanCount } = await supabase
    .from("payments")
    .select("*", { count: "exact", head: true })
    .is("user_id", null)
  
  return NextResponse.json({
    status: "diagnostico",
    bot: {
      id: bot?.id,
      name: bot?.name,
      user_id: bot?.user_id,
      problema: bot?.user_id === null ? "BOT SEM USER_ID - PRECISA CORRIGIR" : "OK",
      error: botError?.message || null
    },
    pagamentos_orfaos_deste_bot: {
      total: orphanPayments?.length || 0,
      lista: orphanPayments,
      error: paymentsError?.message || null
    },
    total_pagamentos_sem_user_id_sistema: totalOrphanCount || 0,
    correcao: {
      bot_id_alvo: ORPHAN_BOT_ID,
      user_id_correto: CORRECT_USER_ID,
      instrucao: "Faça POST para esta mesma URL para executar a correção"
    }
  })
}

export async function POST() {
  const supabase = getSupabaseAdmin()
  
  const resultados: { etapa: string; sucesso: boolean; detalhes: string; dados?: unknown }[] = []
  
  // ETAPA 1: Verificar bot atual
  const { data: botAntes } = await supabase
    .from("bots")
    .select("id, name, user_id")
    .eq("id", ORPHAN_BOT_ID)
    .single()
  
  resultados.push({
    etapa: "1. Verificar bot antes",
    sucesso: true,
    detalhes: `Bot encontrado. user_id atual: ${botAntes?.user_id || "NULL"}`,
    dados: botAntes
  })
  
  // ETAPA 2: Atualizar bot se necessário
  if (botAntes && botAntes.user_id === null) {
    const { error: updateBotError } = await supabase
      .from("bots")
      .update({ user_id: CORRECT_USER_ID })
      .eq("id", ORPHAN_BOT_ID)
    
    resultados.push({
      etapa: "2. Atualizar bot",
      sucesso: !updateBotError,
      detalhes: updateBotError 
        ? `ERRO: ${updateBotError.message}` 
        : `Bot atualizado com user_id: ${CORRECT_USER_ID}`
    })
  } else {
    resultados.push({
      etapa: "2. Atualizar bot",
      sucesso: true,
      detalhes: "Bot já tem user_id, não precisa atualizar"
    })
  }
  
  // ETAPA 3: Contar pagamentos órfãos antes
  const { count: countAntes } = await supabase
    .from("payments")
    .select("*", { count: "exact", head: true })
    .eq("bot_id", ORPHAN_BOT_ID)
    .is("user_id", null)
  
  resultados.push({
    etapa: "3. Contar pagamentos órfãos",
    sucesso: true,
    detalhes: `${countAntes || 0} pagamentos com user_id NULL deste bot`
  })
  
  // ETAPA 4: Atualizar pagamentos
  if ((countAntes || 0) > 0) {
    const { error: updatePaymentsError, count: updatedCount } = await supabase
      .from("payments")
      .update({ user_id: CORRECT_USER_ID })
      .eq("bot_id", ORPHAN_BOT_ID)
      .is("user_id", null)
      .select("*", { count: "exact", head: true })
    
    resultados.push({
      etapa: "4. Atualizar pagamentos",
      sucesso: !updatePaymentsError,
      detalhes: updatePaymentsError 
        ? `ERRO: ${updatePaymentsError.message}` 
        : `Pagamentos atualizados com user_id: ${CORRECT_USER_ID}`
    })
  } else {
    resultados.push({
      etapa: "4. Atualizar pagamentos",
      sucesso: true,
      detalhes: "Nenhum pagamento órfão para atualizar"
    })
  }
  
  // ETAPA 5: Verificação final
  const { data: botDepois } = await supabase
    .from("bots")
    .select("id, name, user_id")
    .eq("id", ORPHAN_BOT_ID)
    .single()
  
  const { count: countDepois } = await supabase
    .from("payments")
    .select("*", { count: "exact", head: true })
    .eq("bot_id", ORPHAN_BOT_ID)
    .is("user_id", null)
  
  // Buscar os pagamentos agora corrigidos
  const { data: pagamentosCorrigidos } = await supabase
    .from("payments")
    .select("id, bot_id, user_id, product_type, amount, status")
    .eq("bot_id", ORPHAN_BOT_ID)
    .eq("user_id", CORRECT_USER_ID)
    .order("created_at", { ascending: false })
    .limit(10)
  
  return NextResponse.json({
    status: "correcao_executada",
    resultados,
    verificacao_final: {
      bot: botDepois,
      pagamentos_ainda_orfaos: countDepois || 0,
      pagamentos_corrigidos: pagamentosCorrigidos?.length || 0,
      amostra_pagamentos_corrigidos: pagamentosCorrigidos
    },
    proximos_passos: [
      "1. Acesse o painel de pagamentos",
      "2. Os Order Bumps devem aparecer agora",
      "3. Se não aparecer, limpe o cache do navegador e recarregue"
    ]
  })
}

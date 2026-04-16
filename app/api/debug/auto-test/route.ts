import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dnVsb2puZnZnc2JtaHl2cXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTk0NTMsImV4cCI6MjA4ODgzNTQ1M30.Djnn3tsrxSGLBR-Bm1dWOpQe0NHCSOWJFZkbbTOk2oM"

export async function GET() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const results: string[] = []
  
  try {
    // 1. Pegar ultimos 5 pagamentos pendentes
    const { data: pendingPayments, error: pendingError } = await supabase
      .from("payments")
      .select("id, external_payment_id, bot_id, amount, status, product_type, created_at")
      .eq("status", "pending")
      .not("external_payment_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(5)
    
    if (pendingError) {
      return NextResponse.json({ error: "Erro ao buscar pagamentos: " + pendingError.message })
    }
    
    if (!pendingPayments || pendingPayments.length === 0) {
      return NextResponse.json({ 
        message: "Nenhum pagamento pendente encontrado",
        results: []
      })
    }
    
    results.push(`Encontrados ${pendingPayments.length} pagamentos pendentes`)
    
    // 2. Para cada pagamento, buscar gateway e verificar status no MP
    const updatedPayments: { id: string; oldStatus: string; newStatus: string; amount: number }[] = []
    
    for (const payment of pendingPayments) {
      results.push(`\n--- Verificando pagamento ${payment.external_payment_id} (R$ ${payment.amount}) ---`)
      
      // Buscar user_id do bot (gateway e global por usuario)
      let gatewayUserId = null
      if (payment.bot_id) {
        const { data: bot } = await supabase
          .from("bots")
          .select("user_id")
          .eq("id", payment.bot_id)
          .single()
        gatewayUserId = bot?.user_id
      }
      
      if (!gatewayUserId) {
        results.push(`ERRO: Nao foi possivel encontrar user_id do bot ${payment.bot_id}`)
        continue
      }
      
      // Buscar gateway pelo user_id (gateway e global, nao por bot)
      const { data: gateway, error: gatewayError } = await supabase
        .from("user_gateways")
        .select("access_token, gateway_name")
        .eq("user_id", gatewayUserId)
        .eq("is_active", true)
        .single()
      
      if (gatewayError || !gateway?.access_token) {
        results.push(`ERRO: Gateway nao encontrado para user_id ${gatewayUserId}`)
        continue
      }
      
      results.push(`Gateway encontrado: ${gateway.gateway_name}`)
      
      // Consultar API do Mercado Pago
      const mpResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${payment.external_payment_id}`,
        {
          headers: {
            Authorization: `Bearer ${gateway.access_token}`,
          },
        }
      )
      
      if (!mpResponse.ok) {
        results.push(`ERRO: API do MP retornou ${mpResponse.status}`)
        continue
      }
      
      const mpData = await mpResponse.json()
      const mpStatus = mpData.status
      const mpStatusDetail = mpData.status_detail
      
      results.push(`Status no MP: ${mpStatus} (${mpStatusDetail})`)
      results.push(`Status no banco: ${payment.status}`)
      
      // Se status diferente, atualizar
      if (mpStatus !== payment.status) {
        results.push(`ATUALIZANDO: ${payment.status} -> ${mpStatus}`)
        
        const { error: updateError } = await supabase
          .from("payments")
          .update({
            status: mpStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.id)
        
        if (updateError) {
          results.push(`ERRO ao atualizar: ${updateError.message}`)
        } else {
          results.push(`ATUALIZADO com sucesso!`)
          updatedPayments.push({
            id: payment.id,
            oldStatus: payment.status,
            newStatus: mpStatus,
            amount: payment.amount
          })
        }
      } else {
        results.push(`Status ja esta correto`)
      }
    }
    
    return NextResponse.json({
      message: "Verificacao concluida",
      pagamentosVerificados: pendingPayments.length,
      pagamentosAtualizados: updatedPayments.length,
      atualizacoes: updatedPayments,
      log: results
    })
    
  } catch (error) {
    return NextResponse.json({ 
      error: "Erro: " + String(error),
      log: results
    })
  }
}

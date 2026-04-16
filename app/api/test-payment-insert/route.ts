import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dnVsb2puZnZnc2JtaHl2cXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTk0NTMsImV4cCI6MjA4ODgzNTQ1M30.Djnn3tsrxSGLBR-Bm1dWOpQe0NHCSOWJFZkbbTOk2oM"

// API para testar se o insert na tabela payments funciona
// GET /api/test-payment-insert?userId=YOUR_USER_ID
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get("userId")
  
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 })
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  
  // Teste 1: Verificar se conseguimos inserir
  const testPayment = {
    user_id: userId,
    amount: 0.01,
    status: "test",
    payment_method: "test",
    gateway: "test",
    external_payment_id: `test_${Date.now()}`,
    product_type: "test",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  
  const { data: inserted, error: insertError } = await supabase
    .from("payments")
    .insert(testPayment)
    .select()
    .single()
  
  if (insertError) {
    return NextResponse.json({
      success: false,
      test: "insert",
      error: insertError,
      message: "INSERT falhou - provavelmente RLS ou schema errado"
    })
  }
  
  // Teste 2: Verificar se conseguimos ler
  const { data: readBack, error: readError } = await supabase
    .from("payments")
    .select("*")
    .eq("id", inserted.id)
    .single()
  
  // Teste 3: Deletar o registro de teste
  await supabase.from("payments").delete().eq("id", inserted.id)
  
  // Teste 4: Listar pagamentos do usuario
  const { data: userPayments, error: listError } = await supabase
    .from("payments")
    .select("id, amount, status, product_type, bot_id, user_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10)
  
  // Teste 5: Listar TODOS os pagamentos recentes (para ver se foi salvo com outro bot_id)
  const { data: allRecentPayments } = await supabase
    .from("payments")
    .select("id, amount, status, product_type, bot_id, user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(20)
  
  return NextResponse.json({
    success: true,
    tests: {
      insert: { success: !insertError, data: inserted },
      read: { success: !readError, data: readBack },
      list: { success: !listError, count: userPayments?.length || 0, data: userPayments }
    },
    allRecentPayments: allRecentPayments,
    message: "Todos os testes passaram!"
  })
}

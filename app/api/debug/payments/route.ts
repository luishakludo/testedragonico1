import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://izvulojnfvgsbmhyvqtn.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dnVsb2puZnZnc2JtaHl2cXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTk0NTMsImV4cCI6MjA4ODgzNTQ1M30.Djnn3tsrxSGLBR-Bm1dWOpQe0NHCSOWJFZkbbTOk2oM"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    // 1. Buscar todos os payments (ultimos 30)
    const { data: allPayments, error: paymentsError } = await supabase
      .from("payments")
      .select("id, bot_id, user_id, amount, status, product_type, created_at")
      .order("created_at", { ascending: false })
      .limit(30)
    
    // 2. Contar por product_type
    const typeCounts: Record<string, number> = {}
    allPayments?.forEach(p => {
      const type = p.product_type || "sem_tipo"
      typeCounts[type] = (typeCounts[type] || 0) + 1
    })
    
    // 3. Contar por status
    const statusCounts: Record<string, number> = {}
    allPayments?.forEach(p => {
      const status = p.status || "sem_status"
      statusCounts[status] = (statusCounts[status] || 0) + 1
    })
    
    // 4. Buscar estados de Order Bump pendentes
    const { data: obStates } = await supabase
      .from("user_flow_state")
      .select("bot_id, telegram_user_id, status, metadata, updated_at")
      .eq("status", "waiting_order_bump")
      .order("updated_at", { ascending: false })
      .limit(5)
    
    // 5. Buscar pagamentos com product_type contendo "order_bump"
    const orderBumpPayments = allPayments?.filter(p => 
      p.product_type?.includes("order_bump")
    ) || []
    
    // 6. Buscar pagamentos aprovados
    const approvedPayments = allPayments?.filter(p => 
      p.status === "approved"
    ) || []
    
    return NextResponse.json({
      resumo: {
        totalUltimos30: allPayments?.length || 0,
        porTipo: typeCounts,
        porStatus: statusCounts,
        orderBumpCount: orderBumpPayments.length,
        aprovadosCount: approvedPayments.length,
      },
      orderBumpPayments,
      approvedPayments: approvedPayments.slice(0, 5),
      estadosOrderBumpPendentes: obStates,
      ultimosPagamentos: allPayments?.slice(0, 10),
      error: paymentsError,
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

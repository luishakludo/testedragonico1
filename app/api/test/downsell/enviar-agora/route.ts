import { NextResponse } from "next/server"

// Endpoint para FORCAR o envio das mensagens pendentes
// Util para testar sem depender do cron externo
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dragonteste.onrender.com"
  
  try {
    // Chamar o cron diretamente
    const res = await fetch(`${baseUrl}/api/cron/process-scheduled-messages`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    })
    
    const data = await res.json()
    
    return NextResponse.json({
      sucesso: true,
      mensagem: "Cron executado manualmente",
      resultado_cron: data
    })
  } catch (error) {
    return NextResponse.json({
      sucesso: false,
      erro: error instanceof Error ? error.message : "Erro desconhecido"
    }, { status: 500 })
  }
}

export async function POST() {
  return GET()
}

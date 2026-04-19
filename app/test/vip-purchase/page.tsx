"use client"

import { useEffect, useState } from "react"

interface TestResult {
  test_info: {
    description: string
    executed_at: string
    environment: string
    version: string
  }
  payment: object
  bot_lookup: object
  deliverable_lookup: object
  bot_permissions: object
  invite_link_creation: object
  message_delivery: object
  database_update: object
  summary: {
    total_steps: number
    successful_steps: number
    failed_steps: number
    overall_status: string
    total_processing_time_ms: number
    flow_completed: boolean
    user_received_access: boolean
    invite_link_active: boolean
    notes: string[]
  }
}

export default function VipPurchaseTestPage() {
  const [result, setResult] = useState<TestResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const runTest = async () => {
      try {
        const response = await fetch("/api/test/vip-group-purchase")
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const data = await response.json()
        setResult(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido")
      } finally {
        setLoading(false)
      }
    }

    runTest()
  }, [])

  if (loading) {
    return (
      <pre
        style={{
          fontFamily: "monospace",
          fontSize: "14px",
          padding: "20px",
          backgroundColor: "#1a1a1a",
          color: "#00ff00",
          minHeight: "100vh",
          margin: 0,
        }}
      >
        {JSON.stringify(
          {
            status: "EXECUTANDO",
            message: "Simulando fluxo de compra de grupo VIP...",
            steps: [
              "1. Processando pagamento...",
              "2. Buscando bot e configuracao...",
              "3. Localizando entregavel...",
              "4. Verificando permissoes...",
              "5. Criando link de convite...",
              "6. Enviando mensagem...",
              "7. Atualizando banco de dados...",
            ],
          },
          null,
          2
        )}
      </pre>
    )
  }

  if (error) {
    return (
      <pre
        style={{
          fontFamily: "monospace",
          fontSize: "14px",
          padding: "20px",
          backgroundColor: "#1a1a1a",
          color: "#ff4444",
          minHeight: "100vh",
          margin: 0,
        }}
      >
        {JSON.stringify(
          {
            status: "ERRO",
            message: error,
            timestamp: new Date().toISOString(),
          },
          null,
          2
        )}
      </pre>
    )
  }

  return (
    <pre
      style={{
        fontFamily: "monospace",
        fontSize: "13px",
        padding: "20px",
        backgroundColor: "#0d1117",
        color: "#c9d1d9",
        minHeight: "100vh",
        margin: 0,
        lineHeight: "1.5",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {JSON.stringify(result, null, 2)}
    </pre>
  )
}

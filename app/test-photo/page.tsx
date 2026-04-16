"use client"

import { useState } from "react"

export default function TestPhotoPage() {
  const [token, setToken] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string>("")

  async function handleTest() {
    if (!token || !file) {
      setResult("ERROR: Token e arquivo sao obrigatorios")
      return
    }

    setLoading(true)
    setResult("Enviando...")

    try {
      const formData = new FormData()
      formData.append("token", token)
      formData.append("photo", file)

      // Log do que esta sendo enviado
      console.log("[TEST] Enviando FormData:")
      console.log("[TEST] - token length:", token.length)
      console.log("[TEST] - file:", file.name, file.size, file.type)

      const response = await fetch("/api/telegram/test-photo", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()
      setResult(JSON.stringify(data, null, 2))

    } catch (error) {
      setResult(`FETCH ERROR: ${String(error)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px" }}>
        Teste de Upload de Foto - Telegram
      </h1>

      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
          Token do Bot:
        </label>
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Cole o token do bot aqui"
          style={{
            width: "100%",
            padding: "10px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            fontSize: "14px",
          }}
        />
      </div>

      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
          Foto (PNG ou JPG):
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={{
            padding: "10px",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
        />
        {file && (
          <p style={{ marginTop: "5px", color: "#666" }}>
            Selecionado: {file.name} ({(file.size / 1024).toFixed(2)} KB)
          </p>
        )}
      </div>

      <button
        onClick={handleTest}
        disabled={loading || !token || !file}
        style={{
          padding: "10px 20px",
          backgroundColor: loading ? "#ccc" : "#0070f3",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: loading ? "not-allowed" : "pointer",
          fontSize: "16px",
        }}
      >
        {loading ? "Enviando..." : "Testar Upload"}
      </button>

      {result && (
        <div style={{ marginTop: "20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "10px" }}>
            Resultado:
          </h2>
          <pre
            style={{
              backgroundColor: "#f5f5f5",
              padding: "15px",
              borderRadius: "4px",
              overflow: "auto",
              maxHeight: "500px",
              fontSize: "12px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {result}
          </pre>
        </div>
      )}

      <div style={{ marginTop: "30px", padding: "15px", backgroundColor: "#fff3cd", borderRadius: "4px" }}>
        <h3 style={{ fontWeight: "bold", marginBottom: "10px" }}>Checklist:</h3>
        <ul style={{ paddingLeft: "20px" }}>
          <li>Imagem deve ser PNG ou JPG</li>
          <li>Tamanho maximo: 5MB</li>
          <li>Recomendado: imagem quadrada</li>
          <li>Token deve ser valido (do BotFather)</li>
        </ul>
      </div>
    </div>
  )
}

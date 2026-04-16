"use client"

import { useState, useEffect } from "react"
import { Copy, Check, QrCode, Loader2, Shield, ShieldCheck } from "lucide-react"

// Tipo para Checkout Direto
type CheckoutDiretoData = {
  headline?: string
  subheadline?: string
  price?: string
  pixKey?: string
  accessToken?: string
  colors?: {
    background?: string
    cardBg?: string
    text?: string
    accent?: string
  }
  backgroundImage?: string
}

// Tipo para Checkout Normal (com formulario)
type CheckoutNormalData = {
  productName?: string
  productDescription?: string
  productImage?: string
  price?: string
  originalPrice?: string
  planLabel?: string
  fields?: {
    email?: boolean
    confirmEmail?: boolean
    name?: boolean
    cpf?: boolean
    phone?: boolean
  }
  pixKey?: string
  accessToken?: string
  backgroundColor?: string
  cardColor?: string
  textColor?: string
  accentColor?: string
  buttonColor?: string
  buttonTextColor?: string
  backgroundImage?: string
  buttonText?: string
  securityText?: string
}

export function PixCheckout({ data, siteId, userId }: { data: Partial<CheckoutDiretoData & CheckoutNormalData>, siteId?: string, userId?: string }) {
  // Detectar tipo baseado nos campos presentes
  const isCheckoutDireto = !data.productName && !data.fields
  
  if (isCheckoutDireto) {
    return <CheckoutDiretoPage data={data} siteId={siteId} userId={userId} />
  }
  
  return <CheckoutNormalPage data={data} siteId={siteId} userId={userId} />
}

// ========== CHECKOUT DIRETO ==========
function CheckoutDiretoPage({ data, siteId, userId }: { data: Partial<CheckoutDiretoData>, siteId?: string, userId?: string }) {
  const [pixCode, setPixCode] = useState("")
  const [qrCodeBase64, setQrCodeBase64] = useState("")
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState("")

  const headline = data.headline || "Pagamento via PIX"
  const subheadline = data.subheadline || "Escaneie o QR Code ou copie o codigo"
  const price = data.price || "0.00"
  const colors = {
    background: data.colors?.background || "#0f172a",
    cardBg: data.colors?.cardBg || "#ffffff",
    text: data.colors?.text || "#1a1a1a",
    accent: data.colors?.accent || "#10b981"
  }

  useEffect(() => {
    generatePix()
  }, [])

  const generatePix = async () => {
    try {
      setLoading(true)
      console.log("[v0] CheckoutDireto generatePix - accessToken:", !!data.accessToken, "pixKey:", !!data.pixKey)
      console.log("[v0] CheckoutDireto data received:", JSON.stringify(data, null, 2))
      
      if (data.accessToken) {
        const priceNumber = parseFloat(price.replace(",", "."))
        const res = await fetch("/api/mercadopago/pix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken: data.accessToken,
            amount: priceNumber,
            description: headline,
            siteId: siteId,
            userId: userId,
          }),
        })

        if (res.ok) {
          const result = await res.json()
          if (result.success && result.copyPaste) {
            setPixCode(result.copyPaste)
            setQrCodeBase64(result.qrCode)
            setLoading(false)
            return
          }
        }
      }

      if (data.pixKey) {
        setPixCode(data.pixKey)
        setLoading(false)
        return
      }

      setError("PIX nao configurado")
      setLoading(false)
    } catch (err) {
      setError("Erro ao gerar PIX")
      setLoading(false)
    }
  }

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(pixCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-5"
      style={{ 
        backgroundColor: colors.background,
        backgroundImage: data.backgroundImage ? `url(${data.backgroundImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center"
      }}
    >
      {data.backgroundImage && <div className="fixed inset-0 bg-black/50" />}

      <div className="relative z-10 w-full max-w-sm">
        <div 
          className="rounded-3xl p-6 shadow-2xl"
          style={{ backgroundColor: colors.cardBg }}
        >
          {/* Header */}
          <div className="text-center mb-4">
            <div 
              className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
              style={{ backgroundColor: `${colors.accent}15` }}
            >
              <QrCode className="w-6 h-6" style={{ color: colors.accent }} />
            </div>
            <h1 className="text-lg font-bold" style={{ color: colors.text }}>
              {headline}
            </h1>
            <p className="text-xs mt-1" style={{ color: `${colors.text}80` }}>
              {subheadline}
            </p>
          </div>

          {/* Valor */}
          <div 
            className="text-center mb-5 py-3 rounded-xl"
            style={{ backgroundColor: `${colors.accent}10` }}
          >
            <p className="text-xs mb-0.5" style={{ color: `${colors.text}60` }}>Valor</p>
            <p className="text-2xl font-bold" style={{ color: colors.accent }}>
              R$ {price}
            </p>
          </div>

          {/* QR Code */}
          <div className="flex justify-center mb-5">
            <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
              {loading ? (
                <div className="w-40 h-40 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                </div>
              ) : error ? (
                <div className="w-40 h-40 flex items-center justify-center">
                  <p className="text-sm text-red-500 text-center px-4">{error}</p>
                </div>
              ) : qrCodeBase64 ? (
                <img 
                  src={`data:image/png;base64,${qrCodeBase64}`} 
                  alt="QR Code PIX"
                  className="w-40 h-40"
                />
              ) : (
                <div className="w-40 h-40 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50 rounded-xl">
                  <QrCode className="w-16 h-16 text-gray-300" />
                </div>
              )}
            </div>
          </div>

          {/* Copy Button */}
          {pixCode && !error && (
            <button
              onClick={copyToClipboard}
              className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={{ backgroundColor: colors.accent }}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copiado!" : "Copiar codigo PIX"}
            </button>
          )}

          {/* Timer */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px]" style={{ color: `${colors.text}50` }}>
              Expira em 30 minutos
            </span>
          </div>

          {/* Security */}
          <div className="flex items-center justify-center gap-1.5 mt-3" style={{ color: `${colors.text}40` }}>
            <Shield className="w-3 h-3" />
            <span className="text-[10px]">Pagamento seguro via PIX</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ========== CHECKOUT NORMAL (COM FORMULARIO) ==========
function CheckoutNormalPage({ data, siteId, userId }: { data: Partial<CheckoutNormalData>, siteId?: string, userId?: string }) {
  const [step, setStep] = useState<"form" | "pix">("form")
  const [pixCode, setPixCode] = useState("")
  const [qrCodeBase64, setQrCodeBase64] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    emailConfirm: "",
    cpf: "",
    phone: "",
  })

  const productName = data.productName || "Produto"
  const productDescription = data.productDescription || ""
  const price = data.price || "0,00"
  const originalPrice = data.originalPrice || ""
  const planLabel = data.planLabel || "Plano"
  const fields = data.fields || { email: true, name: true, cpf: true }
  const buttonText = data.buttonText || "Continuar para pagamento"
  const securityText = data.securityText || "Ambiente seguro"
  
  const bgColor = data.backgroundColor || "#f5f5f5"
  const cardColor = data.cardColor || "#ffffff"
  const textColor = data.textColor || "#1a1a1a"
  const accentColor = data.accentColor || "#10b981"
  const buttonColor = data.buttonColor || "#1a1a1a"
  const buttonTextColor = data.buttonTextColor || "#ffffff"

  const generatePix = async () => {
    try {
      setLoading(true)
      setError("")
      console.log("[v0] generatePix called, accessToken:", !!data.accessToken, "pixKey:", data.pixKey)
      
      if (data.accessToken) {
        const priceNumber = parseFloat(price.replace(",", "."))
        console.log("[v0] Calling PIX API with amount:", priceNumber)
        const res = await fetch("/api/mercadopago/pix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken: data.accessToken,
            amount: priceNumber,
            description: productName,
            payer: formData,
            siteId: siteId,
            userId: userId,
          }),
        })

        const result = await res.json()
        console.log("[v0] PIX API response:", res.status, result)

        if (res.ok && result.success && result.copyPaste) {
          setPixCode(result.copyPaste)
          setQrCodeBase64(result.qrCode)
          setStep("pix")
          setLoading(false)
          return
        } else {
          // Mostrar erro da API
          setError(result.error || "Erro ao gerar PIX")
          setLoading(false)
          return
        }
      }

      if (data.pixKey) {
        setPixCode(data.pixKey)
        setStep("pix")
        setLoading(false)
        return
      }

      setError("PIX nao configurado")
      setLoading(false)
    } catch (err) {
      console.error("[v0] PIX generation error:", err)
      setError("Erro ao gerar PIX")
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    generatePix()
  }

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(pixCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div 
      className="min-h-screen py-8 px-4"
      style={{ 
        backgroundColor: bgColor,
        backgroundImage: data.backgroundImage ? `url(${data.backgroundImage})` : undefined,
        backgroundSize: "cover"
      }}
    >
      <div className="max-w-md mx-auto">
        {step === "form" ? (
          <>
            {/* Header do Produto */}
            <div 
              className="flex items-start gap-3 mb-4 rounded-2xl p-4"
              style={{ backgroundColor: cardColor }}
            >
              {data.productImage ? (
                <img src={data.productImage} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex-shrink-0" />
              )}
              <div className="flex-1">
                <h1 className="font-bold text-base" style={{ color: textColor }}>{productName}</h1>
                {productDescription && (
                  <p className="text-xs mt-1 line-clamp-2" style={{ color: `${textColor}70` }}>
                    {productDescription}
                  </p>
                )}
              </div>
            </div>

            {/* Plano */}
            <div 
              className="rounded-2xl p-4 mb-4 border-2"
              style={{ backgroundColor: cardColor, borderColor: accentColor }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                    style={{ borderColor: accentColor }}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
                  </div>
                  <span className="font-semibold text-sm" style={{ color: textColor }}>{planLabel}</span>
                </div>
                <span 
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                >
                  Recomendado
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                {originalPrice && (
                  <span className="text-sm line-through" style={{ color: `${textColor}50` }}>R$ {originalPrice}</span>
                )}
                <span className="font-bold text-xl" style={{ color: textColor }}>R$ {price}</span>
              </div>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit}>
              <div 
                className="rounded-2xl p-4 mb-4"
                style={{ backgroundColor: cardColor }}
              >
                <div className="flex flex-col gap-4">
                  {fields.email && (
                    <div>
                      <label className="text-xs font-medium mb-1.5 block" style={{ color: textColor }}>
                        Seu e-mail
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full h-11 px-4 rounded-xl border bg-gray-50 focus:outline-none focus:ring-2 text-sm"
                        style={{ borderColor: `${textColor}15`, outlineColor: accentColor }}
                        placeholder="seu@email.com"
                      />
                    </div>
                  )}
                  {fields.confirmEmail && (
                    <div>
                      <label className="text-xs font-medium mb-1.5 block" style={{ color: textColor }}>
                        Confirme seu e-mail
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.emailConfirm}
                        onChange={(e) => setFormData(prev => ({ ...prev, emailConfirm: e.target.value }))}
                        className="w-full h-11 px-4 rounded-xl border bg-gray-50 focus:outline-none focus:ring-2 text-sm"
                        style={{ borderColor: `${textColor}15` }}
                        placeholder="Confirme seu e-mail"
                      />
                    </div>
                  )}
                  {fields.name && (
                    <div>
                      <label className="text-xs font-medium mb-1.5 block" style={{ color: textColor }}>
                        Nome completo
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full h-11 px-4 rounded-xl border bg-gray-50 focus:outline-none focus:ring-2 text-sm"
                        style={{ borderColor: `${textColor}15` }}
                        placeholder="Seu nome"
                      />
                    </div>
                  )}
                  {fields.cpf && (
                    <div>
                      <label className="text-xs font-medium mb-1.5 block" style={{ color: textColor }}>
                        CPF/CNPJ
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.cpf}
                        onChange={(e) => setFormData(prev => ({ ...prev, cpf: e.target.value }))}
                        className="w-full h-11 px-4 rounded-xl border bg-gray-50 focus:outline-none focus:ring-2 text-sm"
                        style={{ borderColor: `${textColor}15` }}
                        placeholder="000.000.000-00"
                      />
                    </div>
                  )}
                  {fields.phone && (
                    <div>
                      <label className="text-xs font-medium mb-1.5 block" style={{ color: textColor }}>
                        Celular
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full h-11 px-4 rounded-xl border bg-gray-50 focus:outline-none focus:ring-2 text-sm"
                        style={{ borderColor: `${textColor}15` }}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Resumo */}
              <div 
                className="rounded-2xl p-4 mb-4"
                style={{ backgroundColor: cardColor }}
              >
                <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: `${textColor}60` }}>
                  Resumo
                </p>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm" style={{ color: `${textColor}80` }}>{productName}</span>
                  <span className="text-sm font-medium" style={{ color: textColor }}>R$ {price}</span>
                </div>
                <div 
                  className="flex justify-between items-center pt-3 border-t"
                  style={{ borderColor: `${textColor}10` }}
                >
                  <span className="text-sm font-semibold" style={{ color: textColor }}>Total</span>
                  <span className="text-lg font-bold" style={{ color: textColor }}>R$ {price}</span>
                </div>
              </div>

              {/* Botao */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{ backgroundColor: buttonColor, color: buttonTextColor }}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : buttonText}
              </button>

              {/* Seguranca */}
              <div className="flex items-center justify-center gap-2 mt-4">
                <ShieldCheck className="w-4 h-4" style={{ color: `${textColor}40` }} />
                <span className="text-xs" style={{ color: `${textColor}40` }}>{securityText}</span>
              </div>
            </form>
          </>
        ) : (
          /* Tela do PIX */
          <div 
            className="rounded-3xl p-6"
            style={{ backgroundColor: cardColor }}
          >
            <div className="text-center mb-4">
              <div 
                className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
                style={{ backgroundColor: `${accentColor}15` }}
              >
                <QrCode className="w-6 h-6" style={{ color: accentColor }} />
              </div>
              <h1 className="text-lg font-bold" style={{ color: textColor }}>Pague com PIX</h1>
              <p className="text-xs mt-1" style={{ color: `${textColor}60` }}>
                Escaneie o QR Code ou copie o codigo
              </p>
            </div>

            <div 
              className="text-center mb-5 py-3 rounded-xl"
              style={{ backgroundColor: `${accentColor}10` }}
            >
              <p className="text-xs mb-0.5" style={{ color: `${textColor}60` }}>Valor</p>
              <p className="text-2xl font-bold" style={{ color: accentColor }}>R$ {price}</p>
            </div>

            <div className="flex justify-center mb-5">
              <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
                {error ? (
                  <div className="w-40 h-40 flex items-center justify-center">
                    <p className="text-sm text-red-500 text-center px-4">{error}</p>
                  </div>
                ) : qrCodeBase64 ? (
                  <img src={`data:image/png;base64,${qrCodeBase64}`} alt="QR Code" className="w-40 h-40" />
                ) : (
                  <div className="w-40 h-40 flex items-center justify-center bg-gray-50 rounded-xl">
                    <QrCode className="w-16 h-16 text-gray-300" />
                  </div>
                )}
              </div>
            </div>

            {pixCode && !error && (
              <button
                onClick={copyToClipboard}
                className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2"
                style={{ backgroundColor: accentColor }}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copiado!" : "Copiar codigo PIX"}
              </button>
            )}

            <div className="flex items-center justify-center gap-2 mt-4">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[10px]" style={{ color: `${textColor}50` }}>Expira em 30 minutos</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

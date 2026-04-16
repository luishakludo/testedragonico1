"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Save, Loader2, Eye, Type, Palette, Copy, Check, Activity, CreditCard, ExternalLink, Settings } from "lucide-react"
import { PixelConfigPanel, PixelConfig } from "@/components/dragon-sites/pixel-config"
import { useGateways, AVAILABLE_GATEWAYS } from "@/lib/gateway-context"
import { toast } from "sonner"
import { ImageUpload } from "@/components/image-upload"

type CheckoutDiretoData = {
  headline: string
  subheadline: string
  price: string
  pixKey: string
  accessToken: string
  colors: {
    background: string
    cardBg: string
    text: string
    accent: string
  }
  backgroundImage: string
}

const defaultData: CheckoutDiretoData = {
  headline: "Pagamento via PIX",
  subheadline: "Escaneie o QR Code ou copie o codigo para pagar",
  price: "97.00",
  pixKey: "",
  accessToken: "",
  colors: {
    background: "#0f172a",
    cardBg: "#ffffff",
    text: "#1a1a1a",
    accent: "#10b981"
  },
  backgroundImage: ""
}

export default function CheckoutDiretoEditor() {
  const params = useParams()
  const router = useRouter()
  const siteId = params?.id as string
  const { gateways, isLoading: gatewaysLoading } = useGateways()
  
  // Pegar gateway ativa
  const activeGateway = gateways.find(g => g.is_active)
  const gatewayInfo = activeGateway ? AVAILABLE_GATEWAYS.find(g => g.id === activeGateway.gateway_name) : null

  const [site, setSite] = useState<{ id: string; slug: string; nome: string } | null>(null)
  const [pageData, setPageData] = useState<CheckoutDiretoData>(defaultData)
  const [siteName, setSiteName] = useState("")
  const [siteSlug, setSiteSlug] = useState("")
  const [pixelConfig, setPixelConfig] = useState<PixelConfig>({ provider: null })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(true)
  const [copied, setCopied] = useState(false)

  // Carregar dados
  useEffect(() => {
    if (siteId) fetchSite()
  }, [siteId])

  const fetchSite = async () => {
    try {
      const res = await fetch(`/api/dragon-bio/${siteId}`)
      const data = await res.json()
      if (data.site) {
        setSite(data.site)
        setSiteName(data.site.nome || "")
        setSiteSlug(data.site.slug || "")
if (data.site.page_data) {
  setPageData({ ...defaultData, ...data.site.page_data })
  }
  if (data.site.pixel_config) {
  setPixelConfig(data.site.pixel_config)
  }
  }
  } catch (error) {
      console.error("Erro ao carregar:", error)
      toast.error("Erro ao carregar dados")
    } finally {
      setLoading(false)
    }
  }

  const updatePageData = useCallback((updates: Partial<CheckoutDiretoData>) => {
    setPageData(prev => ({ ...prev, ...updates }))
    setSaved(false)
  }, [])

  const handleSave = async () => {
    if (!site) return
    setSaving(true)
    try {
      const res = await fetch(`/api/dragon-bio/${site.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
body: JSON.stringify({
  nome: siteName,
  slug: siteSlug,
  page_data: pageData,
  pixel_config: pixelConfig
  })
      })
      if (res.ok) {
        toast.success("Salvo com sucesso!")
        setSaved(true)
      } else {
        toast.error("Erro ao salvar")
      }
    } catch (error) {
      toast.error("Erro ao salvar")
    } finally {
      setSaving(false)
    }
  }

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pageData.pixKey || "PIX_CODE_AQUI")
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar Editor */}
      <div className="w-[400px] bg-white border-r flex flex-col">
        {/* Header */}
        <div className="h-16 border-b flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/biolink")} className="rounded-xl">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="font-semibold text-sm truncate max-w-[180px]">{siteName || "Checkout Direto"}</h1>
              <p className="text-xs text-muted-foreground">/s/{siteSlug}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => window.open(`/s/${site?.slug}`, "_blank")}>
              <Eye className="w-4 h-4 mr-1" />
              Preview
            </Button>
            <Button size="sm" className="rounded-xl bg-emerald-500 hover:bg-emerald-600" onClick={handleSave} disabled={saving || saved}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              {saved ? "Salvo" : "Salvar"}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="conteudo" className="flex-1 flex flex-col">
          <div className="px-4 pt-4">
            <TabsList className="w-full bg-gray-100 rounded-lg h-10 p-1">
              <TabsTrigger value="conteudo" className="flex-1 rounded-md text-xs data-[state=active]:bg-white">
                <Type className="w-3.5 h-3.5 mr-1.5" />
                Conteudo
              </TabsTrigger>
<TabsTrigger value="visual" className="flex-1 rounded-md text-xs data-[state=active]:bg-white">
  <Palette className="w-3.5 h-3.5 mr-1.5" />
  Visual
  </TabsTrigger>
  <TabsTrigger value="pixel" className="flex-1 rounded-md text-xs data-[state=active]:bg-white">
  <Activity className="w-3.5 h-3.5 mr-1.5" />
  Pixel
  </TabsTrigger>
  </TabsList>
          </div>

          <div className="flex-1 overflow-hidden relative">
            {/* Conteudo Tab */}
            <TabsContent value="conteudo" className="absolute inset-0 p-4 m-0 overflow-y-auto data-[state=inactive]:hidden">
              <div className="flex flex-col gap-5">
                <div>
                  <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                    Titulo Principal
                  </Label>
                  <Input
                    value={pageData.headline}
                    onChange={(e) => updatePageData({ headline: e.target.value })}
                    className="h-10 text-sm"
                    placeholder="Pagamento via PIX"
                  />
                </div>

                <div>
                  <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                    Subtitulo
                  </Label>
                  <Textarea
                    value={pageData.subheadline}
                    onChange={(e) => updatePageData({ subheadline: e.target.value })}
                    className="text-sm resize-none"
                    rows={2}
                    placeholder="Escaneie o QR Code..."
                  />
                </div>

                <div>
                  <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                    Valor (R$)
                  </Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={pageData.price || ""}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.,]/g, "")
                      updatePageData({ price: val })
                    }}
                    className="h-10 text-sm"
                    placeholder="97,00"
                  />
                </div>

                {/* Gateway de Pagamento */}
                <div className="border-t pt-4">
                  <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                    Gateway de Pagamento
                  </Label>
                  
                  {gatewaysLoading ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                  ) : activeGateway && gatewayInfo ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white">
                          {activeGateway.gateway_name === "mercadopago" ? (
                            <img src="/images/mercadopago-logo.png" alt="Mercado Pago" className="w-full h-full object-cover" />
                          ) : activeGateway.gateway_name === "pushinpay" ? (
                            <img src="/images/pushinpay-logo.jpg" alt="Pushin Pay" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                              <CreditCard className="w-5 h-5 text-gray-500" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">{gatewayInfo.name}</p>
                            <span className="px-1.5 py-0.5 bg-emerald-500 text-white text-[10px] font-semibold rounded">
                              CONECTADO
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            PIX sera gerado automaticamente
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-emerald-200">
                        <button
                          type="button"
                          onClick={() => router.push("/gateways")}
                          className="w-full flex items-center justify-center gap-2 text-xs text-emerald-700 hover:text-emerald-900 transition-colors"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          Gerenciar Gateways
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border-2 border-dashed border-orange-200 bg-orange-50 p-4 text-center">
                      <CreditCard className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                      <p className="text-sm font-medium text-orange-700 mb-1">Nenhuma gateway configurada</p>
                      <p className="text-xs text-orange-500 mb-3">Configure uma gateway para gerar PIX automatico</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => router.push("/gateways")}
                        className="h-8 border-orange-300 text-orange-700 hover:bg-orange-100"
                      >
                        <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                        Configurar Gateway
                      </Button>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4">
                  <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                    Configuracoes da Pagina
                  </Label>
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="text-[10px] text-gray-400 mb-1 block">Nome</label>
                      <Input
                        value={siteName}
                        onChange={(e) => { setSiteName(e.target.value); setSaved(false) }}
                        placeholder="Checkout Direto"
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 mb-1 block">Slug (URL)</label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">/s/</span>
                        <Input
                          value={siteSlug}
                          onChange={(e) => { setSiteSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setSaved(false) }}
                          placeholder="checkout-direto"
                          className="h-9 text-sm flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Visual Tab */}
            <TabsContent value="visual" className="absolute inset-0 p-4 m-0 overflow-y-auto data-[state=inactive]:hidden">
              <div className="flex flex-col gap-5">
                <div>
                  <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                    Imagem de Fundo
                  </Label>
                  <ImageUpload
                    value={pageData.backgroundImage}
                    onChange={(url) => updatePageData({ backgroundImage: url })}
                    placeholder="Upload do fundo"
                    previewClassName="w-full h-24 rounded-lg"
                  />
                </div>

                <div className="border-t pt-4">
                  <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-3 block">
                    Cores
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-400 mb-1 block">Fundo</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={pageData.colors.background}
                          onChange={(e) => updatePageData({ colors: { ...pageData.colors, background: e.target.value } })}
                          className="w-10 h-9 rounded cursor-pointer"
                        />
                        <Input
                          value={pageData.colors.background}
                          onChange={(e) => updatePageData({ colors: { ...pageData.colors, background: e.target.value } })}
                          className="h-9 text-xs font-mono flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 mb-1 block">Card</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={pageData.colors.cardBg}
                          onChange={(e) => updatePageData({ colors: { ...pageData.colors, cardBg: e.target.value } })}
                          className="w-10 h-9 rounded cursor-pointer"
                        />
                        <Input
                          value={pageData.colors.cardBg}
                          onChange={(e) => updatePageData({ colors: { ...pageData.colors, cardBg: e.target.value } })}
                          className="h-9 text-xs font-mono flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 mb-1 block">Texto</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={pageData.colors.text}
                          onChange={(e) => updatePageData({ colors: { ...pageData.colors, text: e.target.value } })}
                          className="w-10 h-9 rounded cursor-pointer"
                        />
                        <Input
                          value={pageData.colors.text}
                          onChange={(e) => updatePageData({ colors: { ...pageData.colors, text: e.target.value } })}
                          className="h-9 text-xs font-mono flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 mb-1 block">Destaque</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={pageData.colors.accent}
                          onChange={(e) => updatePageData({ colors: { ...pageData.colors, accent: e.target.value } })}
                          className="w-10 h-9 rounded cursor-pointer"
                        />
                        <Input
                          value={pageData.colors.accent}
                          onChange={(e) => updatePageData({ colors: { ...pageData.colors, accent: e.target.value } })}
                          className="h-9 text-xs font-mono flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Pixel Tab */}
            <TabsContent value="pixel" className="absolute inset-0 p-4 m-0 overflow-y-auto data-[state=inactive]:hidden">
              <PixelConfigPanel
                config={pixelConfig}
                onChange={(config) => {
                  setPixelConfig(config)
                  setSaved(false)
                }}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Preview Panel */}
      <div className="flex-1 bg-gray-100 flex items-center justify-center p-8 overflow-hidden">
        <div className="w-[375px] h-[700px] flex-shrink-0 bg-gray-800 rounded-[50px] p-3 shadow-2xl relative overflow-hidden">
          {/* Phone notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-2xl z-20" />
          
          {/* Screen */}
          <div 
            className="w-full h-full rounded-[40px] overflow-y-auto relative"
            style={{ 
              backgroundColor: pageData.colors.background,
              backgroundImage: pageData.backgroundImage ? `url(${pageData.backgroundImage})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center"
            }}
          >
            {/* Overlay escuro se tiver imagem de fundo */}
            {pageData.backgroundImage && (
              <div className="absolute inset-0 bg-black/50" />
            )}

            {/* Content */}
            <div className="relative z-10 min-h-full flex flex-col items-center justify-center p-6">
              {/* Card Principal */}
              <div 
                className="w-full max-w-sm rounded-3xl p-6 shadow-2xl"
                style={{ backgroundColor: pageData.colors.cardBg }}
              >
                {/* Header */}
                <div className="text-center mb-6">
                  <div 
                    className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
                    style={{ backgroundColor: `${pageData.colors.accent}20` }}
                  >
                    <svg viewBox="0 0 24 24" className="w-6 h-6" style={{ color: pageData.colors.accent }} fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <path d="M7 7h10v10H7z"/>
                    </svg>
                  </div>
                  <h1 className="text-lg font-bold mb-1" style={{ color: pageData.colors.text }}>
                    {pageData.headline}
                  </h1>
                  <p className="text-xs" style={{ color: `${pageData.colors.text}80` }}>
                    {pageData.subheadline}
                  </p>
                </div>

                {/* Valor */}
                <div className="text-center mb-6 py-3 rounded-xl" style={{ backgroundColor: `${pageData.colors.accent}10` }}>
                  <p className="text-xs mb-1" style={{ color: `${pageData.colors.text}60` }}>Valor</p>
                  <p className="text-2xl font-bold" style={{ color: pageData.colors.accent }}>
                    R$ {pageData.price}
                  </p>
                </div>

                {/* QR Code Placeholder */}
                <div className="flex justify-center mb-6">
                  <div className="w-40 h-40 bg-white rounded-2xl flex items-center justify-center border-2 border-gray-100 p-3">
                    <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-100 rounded-lg flex items-center justify-center">
                      <svg viewBox="0 0 24 24" className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="7" height="7" rx="1"/>
                        <rect x="14" y="3" width="7" height="7" rx="1"/>
                        <rect x="3" y="14" width="7" height="7" rx="1"/>
                        <rect x="14" y="14" width="3" height="3"/>
                        <rect x="18" y="14" width="3" height="3"/>
                        <rect x="14" y="18" width="3" height="3"/>
                        <rect x="18" y="18" width="3" height="3"/>
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Botao Copiar */}
                <button
                  onClick={handleCopyPix}
                  className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
                  style={{ backgroundColor: pageData.colors.accent }}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copiado!" : "Copiar codigo PIX"}
                </button>

                {/* Seguranca */}
                <div className="flex items-center justify-center gap-2 mt-4 text-[10px]" style={{ color: `${pageData.colors.text}50` }}>
                  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  Pagamento seguro via PIX
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

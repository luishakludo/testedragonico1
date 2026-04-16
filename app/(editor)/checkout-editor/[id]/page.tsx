"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ImageUpload } from "@/components/image-upload"
import { 
  ChevronLeft, 
  Type,
  Palette,
  Save,
  Check,
  Loader2,
  Eye,
  Settings,
  ShieldCheck,
  Users,
  Mail,
  Phone,
  Calendar,
  Activity,
} from "lucide-react"
import { PixelConfigPanel, PixelConfig } from "@/components/dragon-sites/pixel-config"
import { useGateways, AVAILABLE_GATEWAYS } from "@/lib/gateway-context"
import { toast } from "sonner"
import { CreditCard, ExternalLink } from "lucide-react"

export type CheckoutData = {
  // Produto
  productName: string
  productDescription: string
  productImage: string
  price: string
  originalPrice: string
  planLabel: string
  // Campos do formulario
  fields: {
    email: boolean
    confirmEmail: boolean
    name: boolean
    cpf: boolean
    phone: boolean
  }
  // PIX
  pixKey: string
  accessToken: string
  // Visual
  backgroundColor: string
  cardColor: string
  textColor: string
  accentColor: string
  buttonColor: string
  buttonTextColor: string
  backgroundImage: string
  // Textos
  buttonText: string
  securityText: string
}

const defaultData: CheckoutData = {
  productName: "Meu Produto",
  productDescription: "Descricao do seu produto incrivel que vai ajudar o cliente a resolver seu problema.",
  productImage: "",
  price: "247,90",
  originalPrice: "",
  planLabel: "Plano Mensal",
  fields: {
    email: true,
    confirmEmail: true,
    name: true,
    cpf: true,
    phone: false
  },
  pixKey: "",
  accessToken: "",
  backgroundColor: "#f5f5f5",
  cardColor: "#ffffff",
  textColor: "#1a1a1a",
  accentColor: "#10b981",
  buttonColor: "#1a1a1a",
  buttonTextColor: "#ffffff",
  backgroundImage: "",
  buttonText: "Continuar para pagamento",
  securityText: "Ambiente seguro"
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function CheckoutEditorPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  const { gateways, isLoading: gatewaysLoading } = useGateways()
  
  // Pegar gateway ativa
  const activeGateway = gateways.find(g => g.is_active)
  const gatewayInfo = activeGateway ? AVAILABLE_GATEWAYS.find(g => g.id === activeGateway.gateway_name) : null
  
  const [loading, setLoading] = useState(true)
  const [site, setSite] = useState<any>(null)
  const [pageData, setPageData] = useState<CheckoutData>(defaultData)
  const [activeTab, setActiveTab] = useState("produto")
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [siteName, setSiteName] = useState("")
  const [siteSlug, setSiteSlug] = useState("")
  const [pixelConfig, setPixelConfig] = useState<PixelConfig>({ provider: null })
  const [leads, setLeads] = useState<any[]>([])
  const [leadsLoading, setLeadsLoading] = useState(false)

  const fetchLeads = async () => {
    // Usar site.id se disponivel, senao usar id do params
    const siteIdToFetch = site?.id || id
    console.log("[v0] Fetching leads for site:", siteIdToFetch, "site:", site?.id, "params:", id)
    if (!siteIdToFetch) return
    setLeadsLoading(true)
    try {
      const res = await fetch(`/api/checkout-leads?siteId=${siteIdToFetch}`, { credentials: "include" })
      const data = await res.json()
      console.log("[v0] Leads response:", data)
      if (data.leads) setLeads(data.leads)
    } catch (err) {
      console.error("[v0] Error fetching leads:", err)
    } finally {
      setLeadsLoading(false)
    }
  }

  useEffect(() => {
    fetchSite()
  }, [id])
  
  // Buscar leads quando o site for carregado
  useEffect(() => {
    if (site?.id) {
      fetchLeads()
    }
  }, [site?.id])

  const fetchSite = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/dragon-bio/${id}`)
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
      console.error("Erro ao carregar site:", error)
      toast.error("Erro ao carregar site")
    } finally {
      setLoading(false)
    }
  }

  const updatePageData = (updates: Partial<CheckoutData>) => {
    setPageData(prev => ({ ...prev, ...updates }))
    setSaved(false)
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      
      const res = await fetch(`/api/dragon-bio/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
body: JSON.stringify({
  nome: siteName,
  slug: siteSlug,
  page_data: pageData,
  pixel_config: pixelConfig,
  }),
      })

      if (!res.ok) throw new Error("Erro ao salvar")

      setSite((prev: any) => prev ? { ...prev, nome: siteName, slug: siteSlug } : prev)
      setSaved(true)
      toast.success("Alteracoes salvas!")
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error("Erro ao salvar:", error)
      toast.error("Erro ao salvar alteracoes")
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/biolink")}
            className="h-9 w-9 rounded-lg"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-semibold text-foreground text-sm">{site?.nome || "Checkout"}</h1>
            <p className="text-xs text-muted-foreground">/s/{site?.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/s/${site?.slug}`, '_blank')}
            className="h-9 px-4"
          >
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            variant="accent"
            className="h-9 px-4"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <><Check className="w-4 h-4 mr-2" /> Salvo</>
            ) : (
              <><Save className="w-4 h-4 mr-2" /> Salvar</>
            )}
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Editor Panel */}
        <div className="w-[400px] border-r border-border flex flex-col bg-card flex-shrink-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="px-4 pt-4">
              <TabsList className="w-full h-11">
                <TabsTrigger value="produto" className="flex-1 text-xs">
                  <Type className="w-3.5 h-3.5 mr-1.5" />
                  Produto
                </TabsTrigger>
                <TabsTrigger value="campos" className="flex-1 text-xs">
                  <Settings className="w-3.5 h-3.5 mr-1.5" />
                  Campos
                </TabsTrigger>
                <TabsTrigger value="visual" className="flex-1 text-xs">
                  <Palette className="w-3.5 h-3.5 mr-1.5" />
                  Visual
                </TabsTrigger>
                <TabsTrigger 
                  value="leads" 
                  className="flex-1 text-xs"
                  onClick={() => { if (leads.length === 0) fetchLeads() }}
                >
                  <Users className="w-3.5 h-3.5 mr-1.5" />
                  Leads
                  {leads.length > 0 && (
                    <span className="ml-1.5 bg-accent text-accent-foreground text-[10px] px-2 py-0.5 rounded-md font-medium">
                      {leads.length}
                    </span>
                  )}
</TabsTrigger>
  <TabsTrigger value="pixel" className="flex-1 text-xs">
  <Activity className="w-3.5 h-3.5 mr-1.5" />
  Pixel
  </TabsTrigger>
  </TabsList>
            </div>

            <div className="flex-1 min-h-0 relative">
              {/* Produto Tab */}
              <TabsContent value="produto" className="absolute inset-0 p-4 m-0 overflow-y-auto data-[state=inactive]:hidden">
                <div className="flex flex-col gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Imagem do Produto
                    </Label>
                    <ImageUpload
                      value={pageData.productImage}
                      onChange={(url) => updatePageData({ productImage: url })}
                      placeholder="Upload da imagem"
                      previewClassName="w-20 h-20 rounded-xl"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                      Nome do Produto
                    </Label>
                    <Input
                      value={pageData.productName}
                      onChange={(e) => updatePageData({ productName: e.target.value })}
                      className="h-10 text-sm"
                      placeholder="Meu Produto"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                      Descricao
                    </Label>
                    <Textarea
                      value={pageData.productDescription}
                      onChange={(e) => updatePageData({ productDescription: e.target.value })}
                      className="text-sm resize-none"
                      rows={3}
                      placeholder="Descricao do produto..."
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                      Tipo de Plano
                    </Label>
                    <Input
                      value={pageData.planLabel}
                      onChange={(e) => updatePageData({ planLabel: e.target.value })}
                      className="h-10 text-sm"
                      placeholder="Plano Mensal"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                        Preco (R$)
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
                        placeholder="247,90"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                        Preco Original
                      </Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={pageData.originalPrice || ""}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.,]/g, "")
                          updatePageData({ originalPrice: val })
                        }}
                        className="h-10 text-sm"
                        placeholder="297,90"
                      />
                    </div>
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
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                            {activeGateway.gateway_name === "mercadopago" ? (
                              <img src="/images/mercadopago-logo.png" alt="Mercado Pago" className="w-full h-full object-cover" />
                            ) : activeGateway.gateway_name === "pushinpay" ? (
                              <img src="/images/pushinpay-logo.jpg" alt="Pushin Pay" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                                <CreditCard className="w-5 h-5 text-gray-500" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-900">{gatewayInfo.name}</p>
                              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-semibold rounded">
                                ATIVO
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 truncate">
                              Token: {activeGateway.access_token.substring(0, 15)}...
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <button
                            type="button"
                            onClick={() => router.push("/gateways")}
                            className="w-full flex items-center justify-center gap-2 text-xs text-gray-600 hover:text-gray-900 transition-colors"
                          >
                            <Settings className="w-3.5 h-3.5" />
                            Gerenciar Gateways
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border-2 border-dashed border-gray-200 p-4 text-center">
                        <CreditCard className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm font-medium text-gray-600 mb-1">Nenhum gateway configurado</p>
                        <p className="text-xs text-gray-400 mb-3">Configure um gateway para receber pagamentos PIX</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => router.push("/gateways")}
                          className="h-8"
                        >
                          <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                          Configurar Gateway
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Chave PIX Manual (opcional) */}
                  <div>
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                      Chave PIX Manual (Opcional)
                    </Label>
                    <p className="text-[10px] text-gray-400 mb-2">Use apenas se quiser PIX estatico sem integracao</p>
                    <Textarea
                      value={pageData.pixKey}
                      onChange={(e) => updatePageData({ pixKey: e.target.value })}
                      className="text-sm resize-none font-mono text-xs"
                      rows={2}
                      placeholder="Cole o codigo PIX copia e cola..."
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Campos Tab */}
              <TabsContent value="campos" className="absolute inset-0 p-4 m-0 overflow-y-auto data-[state=inactive]:hidden">
                <div className="flex flex-col gap-4">
                  <div>
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                      Campos do Formulario
                    </Label>
                    <p className="text-xs text-gray-400 mb-4">Escolha quais campos o cliente deve preencher</p>
                  </div>

                  <div className="flex flex-col gap-2">
                    {[
                      { key: "email", label: "E-mail", desc: "Campo obrigatorio" },
                      { key: "confirmEmail", label: "Confirmar E-mail", desc: "Pede para digitar novamente" },
                      { key: "name", label: "Nome Completo", desc: "Nome do comprador" },
                      { key: "cpf", label: "CPF/CNPJ", desc: "Documento do comprador" },
                      { key: "phone", label: "Telefone", desc: "Celular do comprador" },
                    ].map((field) => (
                      <label key={field.key} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pageData.fields[field.key as keyof typeof pageData.fields]}
                          onChange={(e) => updatePageData({ 
                            fields: { ...pageData.fields, [field.key]: e.target.checked } 
                          })}
                          className="w-4 h-4 rounded border-gray-300 text-blue-500"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-700">{field.label}</p>
                          <p className="text-xs text-gray-400">{field.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="border-t pt-4 mt-2">
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                      Texto do Botao
                    </Label>
                    <Input
                      value={pageData.buttonText}
                      onChange={(e) => updatePageData({ buttonText: e.target.value })}
                      className="h-10 text-sm"
                      placeholder="Continuar para pagamento"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                      Texto de Seguranca
                    </Label>
                    <Input
                      value={pageData.securityText}
                      onChange={(e) => updatePageData({ securityText: e.target.value })}
                      className="h-10 text-sm"
                      placeholder="Ambiente seguro"
                    />
                  </div>

                  <div className="border-t pt-4">
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                      Nome da Pagina
                    </Label>
                    <Input
                      value={siteName}
                      onChange={(e) => { setSiteName(e.target.value); setSaved(false) }}
                      placeholder="Checkout"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                      Slug (URL)
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">/s/</span>
                      <Input
                        value={siteSlug}
                        onChange={(e) => { setSiteSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setSaved(false) }}
                        placeholder="checkout"
                        className="h-9 text-sm flex-1"
                      />
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
                      {[
                        { key: "backgroundColor", label: "Fundo" },
                        { key: "cardColor", label: "Card" },
                        { key: "textColor", label: "Texto" },
                        { key: "accentColor", label: "Destaque" },
                        { key: "buttonColor", label: "Botao" },
                        { key: "buttonTextColor", label: "Texto Botao" },
                      ].map((color) => (
                        <div key={color.key}>
                          <label className="text-[10px] text-gray-400 mb-1 block">{color.label}</label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={pageData[color.key as keyof CheckoutData] as string}
                              onChange={(e) => updatePageData({ [color.key]: e.target.value })}
                              className="w-10 h-9 rounded cursor-pointer border-0"
                            />
                            <Input
                              value={pageData[color.key as keyof CheckoutData] as string}
                              onChange={(e) => updatePageData({ [color.key]: e.target.value })}
                              className="h-9 text-xs font-mono flex-1"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Leads Tab */}
              <TabsContent value="leads" className="absolute inset-0 p-4 m-0 overflow-y-auto data-[state=inactive]:hidden">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">Leads Coletados</h3>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={fetchLeads}
                      disabled={leadsLoading}
                      className="h-8 text-xs"
                    >
                      {leadsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Atualizar"}
                    </Button>
                  </div>

                  {leadsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : leads.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">Nenhum lead coletado ainda</p>
                      <p className="text-xs text-gray-400 mt-1">Os leads aparecerão aqui quando pessoas preencherem o checkout</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {leads.map((lead) => (
                        <div 
                          key={lead.id} 
                          className="p-3 rounded-xl border border-gray-200 bg-gray-50"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                <span className="text-xs font-medium text-blue-600">
                                  {(lead.name || lead.email || "?").charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{lead.name || "Sem nome"}</p>
                                <p className="text-[10px] text-gray-500">
                                  {new Date(lead.created_at).toLocaleDateString("pt-BR", { 
                                    day: "2-digit", 
                                    month: "short", 
                                    hour: "2-digit", 
                                    minute: "2-digit" 
                                  })}
                                </p>
                              </div>
                            </div>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                              lead.status === "paid" 
                                ? "bg-green-100 text-green-700" 
                                : "bg-amber-100 text-amber-700"
                            }`}>
                              {lead.status === "paid" ? "Pago" : "Pendente"}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {lead.email && (
                              <div className="flex items-center gap-1.5 text-gray-600">
                                <Mail className="w-3 h-3 text-gray-400" />
                                <span className="truncate">{lead.email}</span>
                              </div>
                            )}
                            {lead.phone && (
                              <div className="flex items-center gap-1.5 text-gray-600">
                                <Phone className="w-3 h-3 text-gray-400" />
                                <span>{lead.phone}</span>
                              </div>
                            )}
                            {lead.cpf && (
                              <div className="flex items-center gap-1.5 text-gray-600">
                                <span className="text-[9px] text-gray-400">CPF:</span>
                                <span>{lead.cpf}</span>
                              </div>
                            )}
                            {lead.amount && (
                              <div className="flex items-center gap-1.5 text-gray-600">
                                <span className="text-[9px] text-gray-400">Valor:</span>
                                <span className="font-medium">R$ {Number(lead.amount).toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
          <div className="w-[375px] h-[700px] flex-shrink-0 bg-gray-800 rounded-[50px] p-3 shadow-2xl relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-2xl z-20" />
            
            <div 
              className="w-full h-full rounded-[40px] overflow-y-auto"
              style={{ 
                backgroundColor: pageData.backgroundColor,
                backgroundImage: pageData.backgroundImage ? `url(${pageData.backgroundImage})` : undefined,
                backgroundSize: "cover"
              }}
            >
              <div className="p-4 pt-10">
                {/* Header do Produto */}
                <div 
                  className="flex items-start gap-3 mb-4 rounded-2xl p-3"
                  style={{ backgroundColor: pageData.cardColor }}
                >
                  {pageData.productImage ? (
                    <img src={pageData.productImage} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-sm mb-0.5" style={{ color: pageData.textColor }}>
                      {pageData.productName}
                    </h2>
                    <p className="text-[10px] line-clamp-2" style={{ color: `${pageData.textColor}99` }}>
                      {pageData.productDescription}
                    </p>
                  </div>
                </div>

                {/* Plano Card */}
                <div 
                  className="rounded-2xl p-3 mb-4 border-2"
                  style={{ backgroundColor: pageData.cardColor, borderColor: pageData.accentColor }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                        style={{ borderColor: pageData.accentColor }}
                      >
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: pageData.accentColor }} />
                      </div>
                      <span className="font-semibold text-sm" style={{ color: pageData.textColor }}>
                        {pageData.planLabel}
                      </span>
                    </div>
                    <span 
                      className="text-[9px] px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: `${pageData.accentColor}20`, color: pageData.accentColor }}
                    >
                      Recomendado
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    {pageData.originalPrice && (
                      <span className="text-xs line-through" style={{ color: `${pageData.textColor}50` }}>
                        R$ {pageData.originalPrice}
                      </span>
                    )}
                    <span className="font-bold text-lg" style={{ color: pageData.textColor }}>
                      R$ {pageData.price}
                    </span>
                  </div>
                </div>

                {/* Formulario */}
                <div 
                  className="flex flex-col gap-3 mb-4 rounded-2xl p-4"
                  style={{ backgroundColor: pageData.cardColor }}
                >
                  {pageData.fields.email && (
                    <div>
                      <label className="text-[10px] font-medium mb-1.5 block" style={{ color: pageData.textColor }}>
                        Seu e-mail
                      </label>
                      <div 
                        className="h-10 rounded-xl border px-3 flex items-center text-xs"
                        style={{ borderColor: `${pageData.textColor}20`, color: `${pageData.textColor}50` }}
                      >
                        Insira seu e-mail
                      </div>
                    </div>
                  )}
                  {pageData.fields.confirmEmail && (
                    <div>
                      <label className="text-[10px] font-medium mb-1.5 block" style={{ color: pageData.textColor }}>
                        Confirme seu e-mail
                      </label>
                      <div 
                        className="h-10 rounded-xl border px-3 flex items-center text-xs"
                        style={{ borderColor: `${pageData.textColor}20`, color: `${pageData.textColor}50` }}
                      >
                        Insira novamente
                      </div>
                    </div>
                  )}
                  {pageData.fields.name && (
                    <div>
                      <label className="text-[10px] font-medium mb-1.5 block" style={{ color: pageData.textColor }}>
                        Nome completo
                      </label>
                      <div 
                        className="h-10 rounded-xl border px-3 flex items-center text-xs"
                        style={{ borderColor: `${pageData.textColor}20`, color: `${pageData.textColor}50` }}
                      >
                        Insira seu nome
                      </div>
                    </div>
                  )}
                  {pageData.fields.cpf && (
                    <div>
                      <label className="text-[10px] font-medium mb-1.5 block" style={{ color: pageData.textColor }}>
                        CPF/CNPJ
                      </label>
                      <div 
                        className="h-10 rounded-xl border px-3 flex items-center text-xs"
                        style={{ borderColor: `${pageData.textColor}20`, color: `${pageData.textColor}50` }}
                      >
                        000.000.000-00
                      </div>
                    </div>
                  )}
                  {pageData.fields.phone && (
                    <div>
                      <label className="text-[10px] font-medium mb-1.5 block" style={{ color: pageData.textColor }}>
                        Celular
                      </label>
                      <div 
                        className="h-10 rounded-xl border px-3 flex items-center gap-2 text-xs"
                        style={{ borderColor: `${pageData.textColor}20`, color: `${pageData.textColor}50` }}
                      >
                        <span className="font-medium">+55</span>
                        <span className="opacity-50">|</span>
                        <span>(00) 00000-0000</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Resumo */}
                <div 
                  className="mb-4 rounded-2xl p-4"
                  style={{ backgroundColor: pageData.cardColor }}
                >
                  <p className="text-[10px] font-semibold mb-2 uppercase tracking-wide" style={{ color: `${pageData.textColor}60` }}>
                    Resumo
                  </p>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs" style={{ color: `${pageData.textColor}80` }}>
                      {pageData.productName}
                    </span>
                    <span className="text-xs font-medium" style={{ color: pageData.textColor }}>
                      R$ {pageData.price}
                    </span>
                  </div>
                  <div 
                    className="flex justify-between items-center pt-2 border-t"
                    style={{ borderColor: `${pageData.textColor}10` }}
                  >
                    <span className="text-xs font-semibold" style={{ color: pageData.textColor }}>Total</span>
                    <span className="text-base font-bold" style={{ color: pageData.textColor }}>
                      R$ {pageData.price}
                    </span>
                  </div>
                </div>

                {/* Botao */}
                <button
                  className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all"
                  style={{ backgroundColor: pageData.buttonColor, color: pageData.buttonTextColor }}
                >
                  {pageData.buttonText}
                </button>

                {/* Seguranca */}
                <div className="flex items-center justify-center gap-2 mt-4">
                  <ShieldCheck className="w-3.5 h-3.5" style={{ color: `${pageData.textColor}40` }} />
                  <span className="text-[10px]" style={{ color: `${pageData.textColor}40` }}>
                    {pageData.securityText}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

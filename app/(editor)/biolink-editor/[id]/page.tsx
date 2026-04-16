"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { 
  ChevronLeft, 
  Plus, 
  GripVertical, 
  Trash2, 
  Image as ImageIcon,
  Type,
  Link2,
  Palette,
  Save,
  Check,
  Loader2,
  Eye,
  ExternalLink,
  Settings,
  Activity,
} from "lucide-react"
import { PixelConfigPanel, PixelConfig } from "@/components/dragon-sites/pixel-config"
import { toast } from "sonner"

// Types
export type BioLink = {
  id: string
  type: "button" | "card" // button = botao normal, card = imagem horizontal com texto
  title: string
  url: string
  image?: string // imagem para o tipo card
}

export type BioPageData = {
  profile_name: string
  profile_bio: string
  profile_image: string
  background_image_mobile?: string // Imagem de fundo para formato stories/mobile
  background_image_desktop?: string // Imagem de fundo para formato desktop
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    text: string
  }
  links: BioLink[]
}

const defaultColors = {
  primary: "#000000",
  secondary: "#ffffff",
  accent: "#3b82f6",
  background: "#0f172a",
  text: "#ffffff"
}

const colorPresets = [
  { bg: "#0f172a", btn: "#ffffff", text: "#ffffff", btnText: "#0f172a", accent: "#3b82f6" },
  { bg: "#1a1a2e", btn: "#e94560", text: "#ffffff", btnText: "#ffffff", accent: "#e94560" },
  { bg: "#ffffff", btn: "#111111", text: "#111111", btnText: "#ffffff", accent: "#3b82f6" },
  { bg: "#0d1b2a", btn: "#3a86ff", text: "#ffffff", btnText: "#ffffff", accent: "#3a86ff" },
  { bg: "#2d132c", btn: "#ee4540", text: "#ffffff", btnText: "#ffffff", accent: "#ee4540" },
  { bg: "#1b262c", btn: "#bbe1fa", text: "#ffffff", btnText: "#1b262c", accent: "#bbe1fa" },
]

// Modelos de layout pre-prontos
type ModelType = "buttons" | "photo-buttons" | "mixed"

const layoutModels: { id: ModelType; name: string; description: string; defaultLinks: BioLink[] }[] = [
  {
    id: "buttons",
    name: "Botoes",
    description: "Layout classico com botoes",
    defaultLinks: [
      { id: "1", type: "button", title: "Botao 1", url: "https://" },
      { id: "2", type: "button", title: "Botao 2", url: "https://" },
      { id: "3", type: "button", title: "Botao 3", url: "https://" },
    ],
  },
  {
    id: "photo-buttons",
    name: "Foto + Botoes",
    description: "Destaque com imagem e botoes",
    defaultLinks: [
      { id: "1", type: "card", title: "Destaque", url: "https://", image: "" },
      { id: "2", type: "button", title: "Botao 1", url: "https://" },
      { id: "3", type: "button", title: "Botao 2", url: "https://" },
    ],
  },
  {
    id: "mixed",
    name: "Misto",
    description: "Combinacao de botoes e fotos",
    defaultLinks: [
      { id: "1", type: "button", title: "Botao 1", url: "https://" },
      { id: "2", type: "card", title: "Foto 1", url: "https://", image: "" },
      { id: "3", type: "card", title: "Foto 2", url: "https://", image: "" },
      { id: "4", type: "button", title: "Botao 2", url: "https://" },
    ],
  },
]

interface PageProps {
  params: Promise<{ id: string }>
}

export default function DragonBioEditorPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [site, setSite] = useState<any>(null)
  const [pageData, setPageData] = useState<BioPageData>({
    profile_name: "",
    profile_bio: "",
    profile_image: "",
    colors: defaultColors,
    links: [],
  })
  const [activeTab, setActiveTab] = useState("visual")
  const [selectedModel, setSelectedModel] = useState<ModelType>("buttons")
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [siteName, setSiteName] = useState("")
  const [siteSlug, setSiteSlug] = useState("")
  const [pixelConfig, setPixelConfig] = useState<PixelConfig>({ provider: null })

  // Carregar dados do site
  useEffect(() => {
    fetchSite()
  }, [id])

  const fetchSite = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/dragon-bio/${id}`)
      const data = await res.json()

      if (data.site) {
        setSite(data.site)
        setSiteName(data.site.nome || "")
        setSiteSlug(data.site.slug || "")
        setPageData({
          profile_name: data.site.profile_name || "",
          profile_bio: data.site.profile_bio || "",
          profile_image: data.site.profile_image || "",
          colors: data.site.colors || defaultColors,
          links: (data.site.dragon_bio_links || []).map((link: any) => ({
            id: link.id,
            type: link.type || "button",
            title: link.title,
            url: link.url,
            image: link.image || "",
          })),
        })
        // Carregar configuracao do pixel
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

  const updatePageData = (updates: Partial<BioPageData>) => {
    setPageData(prev => ({ ...prev, ...updates }))
    setSaved(false)
  }

  const addLink = (type: "button" | "card" = "button") => {
    const newLink: BioLink = {
      id: Date.now().toString(),
      type,
      title: type === "button" ? "Novo Link" : "Titulo do Card",
      url: "https://",
      image: "",
    }
    updatePageData({ links: [...pageData.links, newLink] })
  }

  const updateLink = (linkId: string, updates: Partial<BioLink>) => {
    updatePageData({
      links: pageData.links.map(link => 
        link.id === linkId ? { ...link, ...updates } : link
      )
    })
  }

  const removeLink = (linkId: string) => {
    updatePageData({
      links: pageData.links.filter(link => link.id !== linkId)
    })
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
  profile_name: pageData.profile_name,
  profile_bio: pageData.profile_bio,
  profile_image: pageData.profile_image,
  links: pageData.links.map(link => ({
  title: link.title,
  url: link.url,
  type: link.type,
  image: link.image || null,
  })),
  pixel_config: pixelConfig,
  }),
      })

      if (!res.ok) {
        throw new Error("Erro ao salvar")
      }

      // Atualiza o site local com os novos dados
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



  const applyColorPreset = (preset: typeof colorPresets[0]) => {
    updatePageData({
      colors: {
        background: preset.bg,
        secondary: preset.btn,
        text: preset.text,
        primary: preset.btnText,
        accent: preset.accent,
      }
    })
  }

  const applyModel = (modelId: ModelType) => {
    const model = layoutModels.find(m => m.id === modelId)
    if (model) {
      setSelectedModel(modelId)
      // Gera novos IDs para os links para evitar conflitos
      const newLinks = model.defaultLinks.map((link, idx) => ({
        ...link,
        id: `${Date.now()}-${idx}`,
      }))
      updatePageData({ links: newLinks })
    }
  }

// Get background style - with optional background image
  const getBackgroundStyle = () => {
    const baseStyle: React.CSSProperties = { backgroundColor: pageData.colors.background }
    
    // Use mobile image if available (preview is in mobile format)
    if (pageData.background_image_mobile) {
      return {
        ...baseStyle,
        backgroundImage: `url(${pageData.background_image_mobile})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    }
    
    return baseStyle
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top Header */}
      <header className="h-14 border-b border-gray-200 flex items-center justify-between px-4 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/biolink")}
            className="h-8 w-8 rounded-lg text-gray-500 hover:text-gray-900"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-semibold text-gray-900 text-sm">{site?.nome || "Carregando..."}</h1>
            <p className="text-[11px] text-gray-500">/s/{site?.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/s/${site?.slug}`, '_blank')}
            className="h-9 px-3 rounded-lg text-sm"
          >
            <Eye className="w-3.5 h-3.5 mr-1.5" />
            Preview
          </Button>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="h-9 px-4 rounded-lg bg-[#111] text-white hover:bg-[#222] text-sm"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Salvando
              </span>
            ) : saved ? (
              <span className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5" />
                Salvo
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save className="w-3.5 h-3.5" />
                Salvar
              </span>
            )}
          </Button>
        </div>
      </header>

      {/* Main Content - Editor + Preview */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Panel */}
        <div className="w-[340px] border-r border-gray-200 flex flex-col bg-white flex-shrink-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="px-3 pt-4">
              <TabsList className="w-full bg-gray-100 rounded-lg h-9 p-1 grid grid-cols-5 gap-0.5">
                <TabsTrigger value="visual" className="rounded-md text-[11px] px-1 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <Palette className="w-3 h-3 mr-1" />
                  Visual
                </TabsTrigger>
                <TabsTrigger value="profile" className="rounded-md text-[11px] px-1 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <Type className="w-3 h-3 mr-1" />
                  Perfil
                </TabsTrigger>
                <TabsTrigger value="links" className="rounded-md text-[11px] px-1 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <Link2 className="w-3 h-3 mr-1" />
                  Links
                </TabsTrigger>
                <TabsTrigger value="details" className="rounded-md text-[11px] px-1 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <Settings className="w-3 h-3 mr-1" />
                  Detalhes
                </TabsTrigger>
                <TabsTrigger value="pixel" className="rounded-md text-[11px] px-1 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <Activity className="w-3 h-3 mr-1" />
                  Pixel
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 min-h-0 relative">
              {/* Visual Tab */}
              <TabsContent value="visual" className="absolute inset-0 p-4 m-0 overflow-y-auto data-[state=inactive]:hidden">
                <div className="flex flex-col gap-5">
                  {/* Models Selection */}
                  <div>
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                      Escolha um Modelo
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      {/* Modelo 1: Botoes */}
                      <button
                        onClick={() => applyModel("buttons")}
                        className={cn(
                          "relative group rounded-lg overflow-hidden border-2 transition-all",
                          selectedModel === "buttons" 
                            ? "border-[#111] ring-2 ring-[#111]/10" 
                            : "border-gray-100 hover:border-gray-200"
                        )}
                      >
                        <div className="aspect-[9/16] bg-[#0f172a]">
                          <div className="flex flex-col items-center justify-center h-full p-2">
                            <div className="w-4 h-4 rounded-full bg-white/30 mb-1" />
                            <div className="w-6 h-0.5 rounded bg-white/40 mb-0.5" />
                            <div className="w-5 h-0.5 rounded bg-white/30 mb-1.5" />
                            <div className="w-full space-y-0.5 px-1">
                              <div className="h-1.5 rounded-full bg-white/50" />
                              <div className="h-1.5 rounded-full bg-white/50" />
                              <div className="h-1.5 rounded-full bg-white/50" />
                            </div>
                          </div>
                        </div>
                        {selectedModel === "buttons" && (
                          <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#111] flex items-center justify-center">
                            <Check className="w-2 h-2 text-white" />
                          </div>
                        )}
                      </button>

                      {/* Modelo 2: Foto + Botoes */}
                      <button
                        onClick={() => applyModel("photo-buttons")}
                        className={cn(
                          "relative group rounded-lg overflow-hidden border-2 transition-all",
                          selectedModel === "photo-buttons" 
                            ? "border-[#111] ring-2 ring-[#111]/10" 
                            : "border-gray-100 hover:border-gray-200"
                        )}
                      >
                        <div className="aspect-[9/16] bg-[#0f172a]">
                          <div className="flex flex-col items-center justify-center h-full p-2">
                            <div className="w-4 h-4 rounded-full bg-white/30 mb-1" />
                            <div className="w-6 h-0.5 rounded bg-white/40 mb-0.5" />
                            <div className="w-5 h-0.5 rounded bg-white/30 mb-1.5" />
                            <div className="w-full space-y-0.5 px-1">
                              <div className="h-3 rounded bg-white/30 mb-0.5" />
                              <div className="h-1.5 rounded-full bg-white/50" />
                              <div className="h-1.5 rounded-full bg-white/50" />
                            </div>
                          </div>
                        </div>
                        {selectedModel === "photo-buttons" && (
                          <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#111] flex items-center justify-center">
                            <Check className="w-2 h-2 text-white" />
                          </div>
                        )}
                      </button>

                      {/* Modelo 3: Misto */}
                      <button
                        onClick={() => applyModel("mixed")}
                        className={cn(
                          "relative group rounded-lg overflow-hidden border-2 transition-all",
                          selectedModel === "mixed" 
                            ? "border-[#111] ring-2 ring-[#111]/10" 
                            : "border-gray-100 hover:border-gray-200"
                        )}
                      >
                        <div className="aspect-[9/16] bg-[#0f172a]">
                          <div className="flex flex-col items-center justify-center h-full p-2">
                            <div className="w-4 h-4 rounded-full bg-white/30 mb-1" />
                            <div className="w-6 h-0.5 rounded bg-white/40 mb-0.5" />
                            <div className="w-5 h-0.5 rounded bg-white/30 mb-1.5" />
                            <div className="w-full space-y-0.5 px-1">
                              <div className="h-1.5 rounded-full bg-white/50" />
                              <div className="h-3 rounded bg-white/30 mb-0.5" />
                              <div className="h-3 rounded bg-white/30 mb-0.5" />
                              <div className="h-1.5 rounded-full bg-white/50" />
                            </div>
                          </div>
                        </div>
                        {selectedModel === "mixed" && (
                          <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#111] flex items-center justify-center">
                            <Check className="w-2 h-2 text-white" />
                          </div>
                        )}
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5 text-center">
                      {layoutModels.find(m => m.id === selectedModel)?.name} - {layoutModels.find(m => m.id === selectedModel)?.description}
                    </p>
                  </div>

                  {/* Color Presets */}
                  <div>
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                      Paleta de Cores
                    </Label>
                    <div className="grid grid-cols-6 gap-1.5">
                      {colorPresets.map((preset, index) => (
                        <button
                          key={index}
                          onClick={() => applyColorPreset(preset)}
                          className={cn(
                            "aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-105",
                            pageData.colors.background === preset.bg && pageData.colors.secondary === preset.btn
                              ? "border-[#111] ring-2 ring-[#111]/10"
                              : "border-gray-100"
                          )}
                          style={{ backgroundColor: preset.bg }}
                        >
                          <div className="w-full h-full flex items-end justify-center pb-1">
                            <div 
                              className="w-3/4 h-1 rounded-full"
                              style={{ backgroundColor: preset.btn }}
                            />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Colors */}
                  <div>
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                      Cores Personalizadas
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-400">Fundo</label>
                        <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-1.5">
                          <input
                            type="color"
                            value={pageData.colors.background}
                            onChange={(e) => updatePageData({ colors: { ...pageData.colors, background: e.target.value } })}
                            className="w-5 h-5 rounded cursor-pointer border-0"
                          />
                          <Input
                            value={pageData.colors.background}
                            onChange={(e) => updatePageData({ colors: { ...pageData.colors, background: e.target.value } })}
                            className="flex-1 h-5 bg-transparent border-0 text-[10px] font-mono px-1"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-400">Botao</label>
                        <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-1.5">
                          <input
                            type="color"
                            value={pageData.colors.secondary}
                            onChange={(e) => updatePageData({ colors: { ...pageData.colors, secondary: e.target.value } })}
                            className="w-5 h-5 rounded cursor-pointer border-0"
                          />
                          <Input
                            value={pageData.colors.secondary}
                            onChange={(e) => updatePageData({ colors: { ...pageData.colors, secondary: e.target.value } })}
                            className="flex-1 h-5 bg-transparent border-0 text-[10px] font-mono px-1"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-400">Texto</label>
                        <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-1.5">
                          <input
                            type="color"
                            value={pageData.colors.text}
                            onChange={(e) => updatePageData({ colors: { ...pageData.colors, text: e.target.value } })}
                            className="w-5 h-5 rounded cursor-pointer border-0"
                          />
                          <Input
                            value={pageData.colors.text}
                            onChange={(e) => updatePageData({ colors: { ...pageData.colors, text: e.target.value } })}
                            className="flex-1 h-5 bg-transparent border-0 text-[10px] font-mono px-1"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-400">Texto Botao</label>
                        <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-1.5">
                          <input
                            type="color"
                            value={pageData.colors.primary}
                            onChange={(e) => updatePageData({ colors: { ...pageData.colors, primary: e.target.value } })}
                            className="w-5 h-5 rounded cursor-pointer border-0"
                          />
                          <Input
                            value={pageData.colors.primary}
                            onChange={(e) => updatePageData({ colors: { ...pageData.colors, primary: e.target.value } })}
                            className="flex-1 h-5 bg-transparent border-0 text-[10px] font-mono px-1"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Background Image (Optional) */}
                  <div>
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                      Imagem de Fundo (Opcional)
                    </Label>
                    <p className="text-[10px] text-gray-400 mb-2">
                      Adicione uma imagem de fundo personalizada para seu site
                    </p>
                    <div className="space-y-3">
                      {/* Mobile/Stories */}
                      <div className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-4 h-6 border border-gray-300 rounded-sm flex items-center justify-center">
                            <div className="w-2 h-4 bg-gray-200 rounded-[1px]" />
                          </div>
                          <span className="text-[10px] font-medium text-gray-600">Mobile / Stories</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {pageData.background_image_mobile ? (
                              <img src={pageData.background_image_mobile} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                          <Input
                            placeholder="URL da imagem (9:16)"
                            value={pageData.background_image_mobile || ""}
                            onChange={(e) => updatePageData({ background_image_mobile: e.target.value })}
                            className="h-8 text-xs flex-1"
                          />
                          {pageData.background_image_mobile && (
                            <button
                              onClick={() => updatePageData({ background_image_mobile: "" })}
                              className="text-gray-400 hover:text-red-500 transition-colors p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Desktop */}
                      <div className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-4 border border-gray-300 rounded-sm flex items-center justify-center">
                            <div className="w-4 h-2 bg-gray-200 rounded-[1px]" />
                          </div>
                          <span className="text-[10px] font-medium text-gray-600">Desktop</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {pageData.background_image_desktop ? (
                              <img src={pageData.background_image_desktop} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                          <Input
                            placeholder="URL da imagem (16:9)"
                            value={pageData.background_image_desktop || ""}
                            onChange={(e) => updatePageData({ background_image_desktop: e.target.value })}
                            className="h-8 text-xs flex-1"
                          />
                          {pageData.background_image_desktop && (
                            <button
                              onClick={() => updatePageData({ background_image_desktop: "" })}
                              className="text-gray-400 hover:text-red-500 transition-colors p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Profile Tab */}
              <TabsContent value="profile" className="absolute inset-0 p-4 m-0 overflow-y-auto data-[state=inactive]:hidden">
                <div className="flex flex-col gap-4">
                  {/* Profile Image */}
                  <div>
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                      Foto de Perfil
                    </Label>
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {pageData.profile_image ? (
                          <img 
                            src={pageData.profile_image} 
                            alt="Profile" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <Input
                        placeholder="URL da imagem"
                        value={pageData.profile_image}
                        onChange={(e) => updatePageData({ profile_image: e.target.value })}
                        className="flex-1 h-9 text-xs"
                      />
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                      Nome
                    </Label>
                    <Input
                      value={pageData.profile_name}
                      onChange={(e) => updatePageData({ profile_name: e.target.value })}
                      className="h-9 text-sm"
                      placeholder="Seu nome"
                    />
                  </div>

                  {/* Bio */}
                  <div>
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                      Bio
                    </Label>
                    <textarea
                      value={pageData.profile_bio}
                      onChange={(e) => updatePageData({ profile_bio: e.target.value })}
                      className="w-full h-20 px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#111]/10 focus:border-[#111]"
                      placeholder="Escreva uma bio curta"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Links Tab */}
              <TabsContent value="links" className="absolute inset-0 p-4 m-0 flex flex-col data-[state=inactive]:hidden">
                <div className="flex flex-col gap-3 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                      Seus Links ({pageData.links.length})
                    </Label>
                  </div>

                  {/* Add Link Buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addLink("button")}
                      className="flex-1 h-9 text-xs rounded-lg border-dashed"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Botao
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addLink("card")}
                      className="flex-1 h-9 text-xs rounded-lg border-dashed"
                    >
                      <ImageIcon className="w-3 h-3 mr-1" />
                      Card com Imagem
                    </Button>
                  </div>
                </div>

                {/* Lista de links com scroll proprio */}
                <div className="flex-1 overflow-y-auto mt-3 -mx-4 px-4 pb-4">
                  <div className="flex flex-col gap-2">
                    {pageData.links.map((link, index) => (
                      <div
                        key={link.id}
                        className="border border-gray-200 rounded-lg p-3 bg-white"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <GripVertical className="w-3.5 h-3.5 text-gray-300 cursor-grab" />
                          <span className={cn(
                            "text-[10px] font-medium px-1.5 py-0.5 rounded",
                            link.type === "card" 
                              ? "bg-purple-100 text-purple-700" 
                              : "bg-gray-100 text-gray-600"
                          )}>
                            {link.type === "card" ? "Card" : "Botao"}
                          </span>
                          <button
                            onClick={() => removeLink(link.id)}
                            className="ml-auto text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Input
                            placeholder="Titulo do link"
                            value={link.title}
                            onChange={(e) => updateLink(link.id, { title: e.target.value })}
                            className="h-8 text-xs"
                          />
                          <Input
                            placeholder="https://..."
                            value={link.url}
                            onChange={(e) => updateLink(link.id, { url: e.target.value })}
                            className="h-8 text-xs font-mono"
                          />
                          {link.type === "card" && (
                            <div className="flex items-center gap-2">
                              <div className="w-12 h-8 rounded bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {link.image ? (
                                  <img src={link.image} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <ImageIcon className="w-3 h-3 text-gray-400" />
                                )}
                              </div>
                              <Input
                                placeholder="URL da imagem do card"
                                value={link.image || ""}
                                onChange={(e) => updateLink(link.id, { image: e.target.value })}
                                className="h-8 text-xs flex-1"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Details Tab */}
              <TabsContent value="details" className="absolute inset-0 p-4 m-0 overflow-y-auto data-[state=inactive]:hidden">
                <div className="flex flex-col gap-5">
                  {/* Page Name */}
                  <div>
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                      Nome da Pagina
                    </Label>
                    <Input
                      value={siteName}
                      onChange={(e) => {
                        setSiteName(e.target.value)
                        setSaved(false)
                      }}
                      placeholder="Ex: Minha Bio"
                      className="h-10 text-sm"
                    />
                    <p className="text-[10px] text-gray-400 mt-1.5">
                      Nome para identificar sua pagina no painel
                    </p>
                  </div>

                  {/* Slug/URL */}
                  <div>
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                      URL da Pagina (Slug)
                    </Label>
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3">
                      <span className="text-sm text-gray-400 whitespace-nowrap">/s/</span>
                      <Input
                        value={siteSlug}
                        onChange={(e) => {
                          setSiteSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
                          setSaved(false)
                        }}
                        placeholder="minha-pagina"
                        className="flex-1 h-10 bg-transparent border-0 px-0 focus-visible:ring-0 text-sm"
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5">
                      Este e o endereco da sua pagina: {typeof window !== 'undefined' ? window.location.origin : ''}/s/{siteSlug || 'minha-pagina'}
                    </p>
                  </div>

                  {/* Quick Actions */}
                  <div className="border-t border-gray-100 pt-5 mt-2">
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-3 block">
                      Acoes Rapidas
                    </Label>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/s/${siteSlug}`, '_blank')}
                        className="justify-start h-10 text-sm"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Abrir Pagina
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const url = `${window.location.origin}/s/${siteSlug}`
                          navigator.clipboard.writeText(url)
                          toast.success("Link copiado!")
                        }}
                        className="justify-start h-10 text-sm"
                      >
                        <Link2 className="w-4 h-4 mr-2" />
                        Copiar Link
                      </Button>
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

        {/* Preview Area */}
        <div className="flex-1 bg-[#f4f5f8] flex items-center justify-center p-6 overflow-hidden">
          {/* Phone Frame */}
          <div className="relative">
            {/* Phone outer frame */}
            <div className="w-[280px] h-[580px] bg-black rounded-[40px] p-[10px] shadow-2xl">
              {/* Phone inner screen */}
              <div 
                className="w-full h-full rounded-[32px] overflow-hidden relative"
                style={getBackgroundStyle()}
              >
                {/* Dynamic Island */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full" />
                
                {/* Content */}
                <div className="h-full flex flex-col items-center pt-16 px-5 pb-6">
                  {/* Profile */}
                  <div className="flex flex-col items-center mb-6">
                    <div 
                      className="w-20 h-20 rounded-full mb-3 flex items-center justify-center overflow-hidden"
                      style={{ backgroundColor: pageData.colors.secondary + "20" }}
                    >
                      {pageData.profile_image ? (
                        <img 
                          src={pageData.profile_image} 
                          alt="Profile" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div 
                          className="w-full h-full rounded-full"
                          style={{ backgroundColor: pageData.colors.secondary + "40" }}
                        />
                      )}
                    </div>
                    <h2 
                      className="text-base font-bold mb-0.5"
                      style={{ color: pageData.colors.text }}
                    >
                      {pageData.profile_name || "Seu Nome"}
                    </h2>
                    <p 
                      className="text-xs opacity-80 text-center max-w-[200px]"
                      style={{ color: pageData.colors.text }}
                    >
                      {pageData.profile_bio || "Sua bio aqui"}
                    </p>
                  </div>

                  {/* Links */}
                  <div className="w-full flex flex-col gap-2.5 flex-1 overflow-y-auto">
                    {pageData.links.map((link) => (
                      link.type === "card" ? (
                        // Card com imagem
                        <div
                          key={link.id}
                          className="w-full rounded-xl overflow-hidden transition-all hover:scale-[1.02]"
                          style={{ backgroundColor: pageData.colors.secondary + "20" }}
                        >
                          <div 
                            className="w-full h-20 bg-cover bg-center"
                            style={{ 
                              backgroundImage: link.image ? `url(${link.image})` : undefined,
                              backgroundColor: link.image ? undefined : pageData.colors.secondary + "30"
                            }}
                          />
                          <div 
                            className="py-2 px-3 text-xs font-medium"
                            style={{ color: pageData.colors.text }}
                          >
                            {link.title}
                          </div>
                        </div>
                      ) : (
                        // Botao normal
                        <button
                          key={link.id}
                          className="w-full py-3 px-4 rounded-xl text-sm font-medium transition-all hover:scale-[1.02]"
                          style={{ 
                            backgroundColor: pageData.colors.secondary,
                            color: pageData.colors.primary,
                          }}
                        >
                          {link.title}
                        </button>
                      )
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="mt-4 pt-3">
                    <span 
                      className="text-[10px] opacity-50"
                      style={{ color: pageData.colors.text }}
                    >
                      dragon.bio
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Side buttons */}
            <div className="absolute right-[-2px] top-24 w-[3px] h-8 bg-gray-800 rounded-l" />
            <div className="absolute right-[-2px] top-36 w-[3px] h-14 bg-gray-800 rounded-l" />
            <div className="absolute left-[-2px] top-28 w-[3px] h-10 bg-gray-800 rounded-r" />
          </div>
        </div>
      </div>
    </div>
  )
}

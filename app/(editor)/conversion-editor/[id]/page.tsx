"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { 
  ChevronLeft, 
  Plus, 
  Trash2, 
  Type,
  Palette,
  Save,
  Check,
  Loader2,
  Eye,
  Settings,
  Instagram,
  Globe,
  ChevronUp,
  Lock,
  Heart,
  Image as ImageIcon,
  Video,
  Activity,
} from "lucide-react"
import { PixelConfigPanel, PixelConfig } from "@/components/dragon-sites/pixel-config"
import { toast } from "sonner"
import { ImageUpload } from "@/components/image-upload"

// Types para Privacy Page
type PrivacyPost = {
  id: string
  type: "image" | "video"
  url: string
  blur: boolean
}
export type PrivacyPageData = {
  // Profile
  username: string
  handle: string
  bio: string
  avatar: string
  coverImage: string
  isVerified: boolean
  // Stats
  stats: {
    photos: number
    videos: number
    locked: number
    likes: string
  }
  // Social Links
  socialLinks: {
    instagram?: string
    twitter?: string
    tiktok?: string
  }
  // Subscriptions
  subscriptions: {
    id: string
    name: string
    price: string
    discount?: string
  }[]
  // Colors
  colors: {
    background: string
    cardBg: string
    accent: string
    text: string
    subtext: string
  }
  // Posts preview
  postsCount: number
  mediasCount: number
  // Posts (imagens/videos com blur)
  posts: PrivacyPost[]
  // CTA URL
  ctaUrl: string
}

const defaultPrivacyData: PrivacyPageData = {
  username: "SeuNome",
  handle: "@seunome",
  bio: "Oi meus amores! Bem-vindos ao meu perfil exclusivo...",
  avatar: "",
  coverImage: "",
  isVerified: true,
  stats: {
    photos: 544,
    videos: 609,
    locked: 5,
    likes: "13.3K",
  },
  socialLinks: {
    instagram: "",
    twitter: "",
    tiktok: "",
  },
  subscriptions: [
    { id: "1", name: "1 mes", price: "R$ 35,90" },
    { id: "2", name: "3 meses (10% off)", price: "R$ 96,93", discount: "10% off" },
    { id: "3", name: "6 meses (15% off)", price: "R$ 183,09", discount: "15% off" },
  ],
  colors: {
    background: "#FFF8F0",
    cardBg: "#FFFFFF",
    accent: "#F97316",
    text: "#1F2937",
    subtext: "#6B7280",
  },
  postsCount: 352,
  mediasCount: 1153,
  posts: [],
  ctaUrl: "",
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function PrivacyEditorPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [site, setSite] = useState<any>(null)
  const [pageData, setPageData] = useState<PrivacyPageData>(defaultPrivacyData)
  const [activeTab, setActiveTab] = useState("perfil")
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [siteName, setSiteName] = useState("")
const [siteSlug, setSiteSlug] = useState("")
  const [pixelConfig, setPixelConfig] = useState<PixelConfig>({ provider: null })
  
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
if (data.site.page_data) {
  setPageData({ ...defaultPrivacyData, ...data.site.page_data })
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

  const updatePageData = (updates: Partial<PrivacyPageData>) => {
    setPageData(prev => ({ ...prev, ...updates }))
    setSaved(false)
  }

  const addSubscription = () => {
    const newSub = { id: Date.now().toString(), name: "Novo plano", price: "R$ 0,00" }
    updatePageData({ subscriptions: [...pageData.subscriptions, newSub] })
  }

  const updateSubscription = (index: number, field: string, value: string) => {
    const newSubs = [...pageData.subscriptions]
    newSubs[index] = { ...newSubs[index], [field]: value }
    updatePageData({ subscriptions: newSubs })
  }

  const removeSubscription = (index: number) => {
    updatePageData({ subscriptions: pageData.subscriptions.filter((_, i) => i !== index) })
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
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Lock className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground text-sm">{site?.nome || "Privacy"}</h1>
              <p className="text-xs text-muted-foreground">/s/{site?.slug}</p>
            </div>
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
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando
              </span>
            ) : saved ? (
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4" />
                Salvo
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                Salvar
              </span>
            )}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Panel */}
        <div className="w-[400px] border-r border-border flex flex-col bg-card flex-shrink-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="px-4 pt-4">
              <TabsList className="w-full h-11">
                <TabsTrigger value="perfil" className="flex-1 text-xs">
                  <Type className="w-3.5 h-3.5 mr-1.5" />
                  Perfil
                </TabsTrigger>
                <TabsTrigger value="posts" className="flex-1 text-xs">
                  <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                  Posts
                </TabsTrigger>
                <TabsTrigger value="planos" className="flex-1 text-xs">
                  <Lock className="w-3.5 h-3.5 mr-1.5" />
                  Planos
                </TabsTrigger>
<TabsTrigger value="visual" className="flex-1 text-xs">
  <Palette className="w-3.5 h-3.5 mr-1.5" />
  Visual
  </TabsTrigger>
  <TabsTrigger value="pixel" className="flex-1 text-xs">
  <Activity className="w-3.5 h-3.5 mr-1.5" />
  Pixel
  </TabsTrigger>
  </TabsList>
            </div>

            <div className="flex-1 min-h-0 relative">
              {/* Perfil Tab */}
              <TabsContent value="perfil" className="absolute inset-0 p-4 m-0 overflow-y-auto data-[state=inactive]:hidden">
                <div className="flex flex-col gap-5">
                  <div>
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                      Nome de Usuario
                    </Label>
                    <Input
                      value={pageData.username}
                      onChange={(e) => updatePageData({ username: e.target.value })}
                      className="h-10 text-sm font-semibold"
                      placeholder="MilaHot"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                      Handle (@)
                    </Label>
                    <Input
                      value={pageData.handle}
                      onChange={(e) => updatePageData({ handle: e.target.value })}
                      className="h-10 text-sm"
                      placeholder="@milahot"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                      Bio
                    </Label>
                    <Textarea
                      value={pageData.bio}
                      onChange={(e) => updatePageData({ bio: e.target.value })}
                      className="min-h-[80px] text-sm resize-none"
                      placeholder="Sua bio aqui..."
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={pageData.isVerified}
                      onChange={(e) => updatePageData({ isVerified: e.target.checked })}
                      className="rounded"
                    />
                    <Label className="text-sm text-gray-600">Mostrar badge verificado</Label>
                  </div>

                  <div className="border-t pt-4">
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                      Foto de Perfil (Avatar)
                    </Label>
                    <ImageUpload
                      value={pageData.avatar}
                      onChange={(url) => updatePageData({ avatar: url })}
                      placeholder="Fazer upload do avatar"
                      previewClassName="w-20 h-20 rounded-full"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                      Foto de Capa
                    </Label>
                    <ImageUpload
                      value={pageData.coverImage}
                      onChange={(url) => updatePageData({ coverImage: url })}
                      placeholder="Fazer upload da capa"
                      previewClassName="w-full h-24 rounded-lg"
                    />
                  </div>

                  <div className="border-t pt-4">
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-3 block">
                      Estatisticas
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-gray-400 mb-1 block">Fotos</label>
                        <Input
                          type="number"
                          value={pageData.stats.photos}
                          onChange={(e) => updatePageData({ stats: { ...pageData.stats, photos: parseInt(e.target.value) || 0 } })}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 mb-1 block">Videos</label>
                        <Input
                          type="number"
                          value={pageData.stats.videos}
                          onChange={(e) => updatePageData({ stats: { ...pageData.stats, videos: parseInt(e.target.value) || 0 } })}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 mb-1 block">Bloqueados</label>
                        <Input
                          type="number"
                          value={pageData.stats.locked}
                          onChange={(e) => updatePageData({ stats: { ...pageData.stats, locked: parseInt(e.target.value) || 0 } })}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 mb-1 block">Likes</label>
                        <Input
                          value={pageData.stats.likes}
                          onChange={(e) => updatePageData({ stats: { ...pageData.stats, likes: e.target.value } })}
                          className="h-9 text-sm"
                          placeholder="13.3K"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-3 block">
                      Redes Sociais
                    </Label>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Instagram className="w-4 h-4 text-gray-400" />
                        <Input
                          value={pageData.socialLinks.instagram || ""}
                          onChange={(e) => updatePageData({ socialLinks: { ...pageData.socialLinks, instagram: e.target.value } })}
                          className="h-9 text-sm flex-1"
                          placeholder="https://instagram.com/..."
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        <Input
                          value={pageData.socialLinks.twitter || ""}
                          onChange={(e) => updatePageData({ socialLinks: { ...pageData.socialLinks, twitter: e.target.value } })}
                          className="h-9 text-sm flex-1"
                          placeholder="https://twitter.com/..."
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                        </svg>
                        <Input
                          value={pageData.socialLinks.tiktok || ""}
                          onChange={(e) => updatePageData({ socialLinks: { ...pageData.socialLinks, tiktok: e.target.value } })}
                          className="h-9 text-sm flex-1"
                          placeholder="https://tiktok.com/..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Posts Tab */}
              <TabsContent value="posts" className="absolute inset-0 p-4 m-0 overflow-y-auto data-[state=inactive]:hidden">
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                      Posts Bloqueados ({(pageData.posts || []).length})
                    </Label>
                  </div>
                  <p className="text-xs text-gray-500">
                    Adicione fotos ou videos que aparecerao com blur e cadeado. Perfeito para mostrar conteudo exclusivo.
                  </p>

                  {/* Upload de novo post */}
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-4">
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-3 block">
                      Adicionar Post
                    </Label>
                    <ImageUpload
                      value=""
                      onChange={(url) => {
                        if (url) {
                          const newPost: PrivacyPost = {
                            id: Date.now().toString(),
                            type: url.includes("video") ? "video" : "image",
                            url,
                            blur: true
                          }
                          updatePageData({ posts: [...(pageData.posts || []), newPost] })
                        }
                      }}
                      accept="image/*,video/*"
                      placeholder="Clique para adicionar foto ou video"
                      previewClassName="h-32"
                      showPreview={false}
                    />
                  </div>

                  {/* Lista de posts */}
                  <div className="flex flex-col gap-3">
                    {(pageData.posts || []).map((post) => (
                      <div key={post.id} className="bg-gray-50 rounded-xl p-3">
                        <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-200 mb-2">
                          {post.type === "video" ? (
                            <video src={post.url} className="w-full h-full object-cover" muted />
                          ) : (
                            <img src={post.url} alt="" className="w-full h-full object-cover" />
                          )}
                          {/* Preview blur se ativo */}
                          {(post.blur !== false) && (
                            <div className="absolute inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center">
                              <Lock className="w-5 h-5 text-white/80" />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={post.blur !== false}
                              onChange={(e) => {
                                const updatedPosts = (pageData.posts || []).map(p => 
                                  p.id === post.id ? { ...p, blur: e.target.checked } : p
                                )
                                updatePageData({ posts: updatedPosts })
                              }}
                              className="w-4 h-4 rounded"
                            />
                            Blur ativo
                          </label>
                          <button
                            onClick={() => updatePageData({ posts: (pageData.posts || []).filter(p => p.id !== post.id) })}
                            className="text-red-500 hover:text-red-600 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Planos Tab */}
              <TabsContent value="planos" className="absolute inset-0 p-4 m-0 overflow-y-auto data-[state=inactive]:hidden">
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                      Planos de Assinatura ({pageData.subscriptions.length})
                    </Label>
                    <Button variant="outline" size="sm" onClick={addSubscription} className="h-7 text-xs">
                      <Plus className="w-3 h-3 mr-1" /> Adicionar
                    </Button>
                  </div>

                  <div className="flex flex-col gap-3">
                    {pageData.subscriptions.map((sub, index) => (
                      <div key={sub.id} className="bg-gray-50 rounded-xl p-4 relative">
                        <button
                          onClick={() => removeSubscription(index)}
                          className="absolute top-2 right-2 text-gray-400 hover:text-red-500 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="flex flex-col gap-2">
                          <div>
                            <label className="text-[10px] text-gray-400 mb-1 block">Nome do plano</label>
                            <Input
                              value={sub.name}
                              onChange={(e) => updateSubscription(index, "name", e.target.value)}
                              className="h-9 text-sm"
                              placeholder="1 mes"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400 mb-1 block">Preco</label>
                            <Input
                              value={sub.price}
                              onChange={(e) => updateSubscription(index, "price", e.target.value)}
                              className="h-9 text-sm"
                              placeholder="R$ 35,90"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-4">
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
                      URL de Redirecionamento (ao clicar em assinar)
                    </Label>
                    <Input
                      value={pageData.ctaUrl}
                      onChange={(e) => updatePageData({ ctaUrl: e.target.value })}
                      className="h-10 text-sm font-mono"
                      placeholder="https://..."
                    />
                  </div>

                  <div className="border-t pt-4">
                    <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-3 block">
                      Contagem de Posts
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-gray-400 mb-1 block">Postagens</label>
                        <Input
                          type="number"
                          value={pageData.postsCount}
                          onChange={(e) => updatePageData({ postsCount: parseInt(e.target.value) || 0 })}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 mb-1 block">Midias</label>
                        <Input
                          type="number"
                          value={pageData.mediasCount}
                          onChange={(e) => updatePageData({ mediasCount: parseInt(e.target.value) || 0 })}
                          className="h-9 text-sm"
                        />
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
                      Cores Personalizadas
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-400">Fundo</label>
                        <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-2">
                          <input
                            type="color"
                            value={pageData.colors.background}
                            onChange={(e) => updatePageData({ colors: { ...pageData.colors, background: e.target.value } })}
                            className="w-6 h-6 rounded cursor-pointer border-0"
                          />
                          <Input
                            value={pageData.colors.background}
                            onChange={(e) => updatePageData({ colors: { ...pageData.colors, background: e.target.value } })}
                            className="flex-1 h-6 bg-transparent border-0 text-[10px] font-mono px-1"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-400">Card</label>
                        <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-2">
                          <input
                            type="color"
                            value={pageData.colors.cardBg}
                            onChange={(e) => updatePageData({ colors: { ...pageData.colors, cardBg: e.target.value } })}
                            className="w-6 h-6 rounded cursor-pointer border-0"
                          />
                          <Input
                            value={pageData.colors.cardBg}
                            onChange={(e) => updatePageData({ colors: { ...pageData.colors, cardBg: e.target.value } })}
                            className="flex-1 h-6 bg-transparent border-0 text-[10px] font-mono px-1"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-400">Destaque</label>
                        <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-2">
                          <input
                            type="color"
                            value={pageData.colors.accent}
                            onChange={(e) => updatePageData({ colors: { ...pageData.colors, accent: e.target.value } })}
                            className="w-6 h-6 rounded cursor-pointer border-0"
                          />
                          <Input
                            value={pageData.colors.accent}
                            onChange={(e) => updatePageData({ colors: { ...pageData.colors, accent: e.target.value } })}
                            className="flex-1 h-6 bg-transparent border-0 text-[10px] font-mono px-1"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-400">Texto</label>
                        <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-2">
                          <input
                            type="color"
                            value={pageData.colors.text}
                            onChange={(e) => updatePageData({ colors: { ...pageData.colors, text: e.target.value } })}
                            className="w-6 h-6 rounded cursor-pointer border-0"
                          />
                          <Input
                            value={pageData.colors.text}
                            onChange={(e) => updatePageData({ colors: { ...pageData.colors, text: e.target.value } })}
                            className="flex-1 h-6 bg-transparent border-0 text-[10px] font-mono px-1"
                          />
                        </div>
                      </div>
                    </div>
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
                          placeholder="Privacy MilaHot"
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
                            placeholder="milahot"
                            className="h-9 text-sm flex-1"
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
              className="w-full h-full rounded-[40px] overflow-y-auto overflow-x-hidden"
              style={{ backgroundColor: pageData.colors.background }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 sticky top-0 z-10" style={{ backgroundColor: pageData.colors.background }}>
                <h1 className="text-xl font-bold tracking-tight" style={{ color: pageData.colors.text }}>privacy.</h1>
                <Globe className="w-5 h-5" style={{ color: pageData.colors.subtext }} />
              </div>

              {/* Cover + Avatar */}
              <div className="relative mx-4">
                <div 
                  className="h-32 rounded-2xl bg-cover bg-center"
                  style={{ 
                    backgroundColor: pageData.coverImage ? undefined : "#E5E7EB",
                    backgroundImage: pageData.coverImage ? `url(${pageData.coverImage})` : undefined
                  }}
                />
                <div className="absolute -bottom-8 left-4">
                  <div 
                    className="w-20 h-20 rounded-full border-4 bg-cover bg-center"
                    style={{ 
                      borderColor: pageData.colors.background,
                      backgroundColor: pageData.avatar ? undefined : "#D1D5DB",
                      backgroundImage: pageData.avatar ? `url(${pageData.avatar})` : undefined
                    }}
                  />
                </div>
                {/* Stats on cover */}
                <div className="absolute bottom-2 right-2 flex items-center gap-3 text-[10px]" style={{ color: pageData.colors.subtext }}>
                  <span className="flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> {pageData.stats.photos}
                  </span>
                  <span className="flex items-center gap-1">
                    <Video className="w-3 h-3" /> {pageData.stats.videos}
                  </span>
                  <span className="flex items-center gap-1">
                    <Lock className="w-3 h-3" /> {pageData.stats.locked}
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="w-3 h-3" /> {pageData.stats.likes}
                  </span>
                </div>
              </div>

              {/* Profile Info */}
              <div className="px-4 pt-10 pb-4">
                <div className="flex items-center gap-1">
                  <h2 className="text-lg font-bold" style={{ color: pageData.colors.text }}>
                    {pageData.username}
                  </h2>
                  {pageData.isVerified && (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill={pageData.colors.accent}>
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                    </svg>
                  )}
                </div>
                <p className="text-xs" style={{ color: pageData.colors.subtext }}>{pageData.handle}</p>
                <p className="text-xs mt-2 leading-relaxed" style={{ color: pageData.colors.text }}>
                  {pageData.bio.slice(0, 80)}...
                </p>
                <button className="text-xs mt-1" style={{ color: pageData.colors.accent }}>Ler mais</button>

                {/* Social Icons */}
                <div className="flex items-center gap-3 mt-4">
                  {pageData.socialLinks.instagram && (
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <Instagram className="w-4 h-4 text-gray-600" />
                    </div>
                  )}
                  {pageData.socialLinks.twitter && (
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                    </div>
                  )}
                  {pageData.socialLinks.tiktok && (
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* Subscriptions */}
              <div className="px-4 pb-4">
                <h3 className="text-sm font-semibold mb-3" style={{ color: pageData.colors.text }}>Assinaturas</h3>
                <div className="flex flex-col gap-2">
                  {pageData.subscriptions.map((sub, idx) => (
                    <button
                      key={sub.id}
                      className="flex items-center justify-between py-3 px-4 rounded-xl text-sm"
                      style={{ 
                        background: idx === 0 
                          ? `linear-gradient(90deg, ${pageData.colors.accent}30 0%, ${pageData.colors.accent}10 100%)`
                          : `linear-gradient(90deg, ${pageData.colors.accent}20 0%, ${pageData.colors.accent}05 100%)`
                      }}
                    >
                      <span className="font-medium" style={{ color: pageData.colors.text }}>{sub.name}</span>
                      <span className="font-bold" style={{ color: pageData.colors.text }}>{sub.price}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Posts Section */}
              <div className="px-4 pb-4">
                <div className="flex items-center justify-center gap-6 py-3 rounded-xl" style={{ backgroundColor: pageData.colors.cardBg }}>
                  <span className="text-xs" style={{ color: pageData.colors.accent }}>
                    <span className="font-bold">{pageData.postsCount}</span> Postagens
                  </span>
                  <span className="text-xs" style={{ color: pageData.colors.subtext }}>
                    <span className="font-bold">{pageData.mediasCount}</span> Midias
                  </span>
                </div>
              </div>

              {/* Posts com Blur - Full Width */}
              <div className="px-4 pb-6">
                {(pageData.posts || []).length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {(pageData.posts || []).map((post) => (
                      <div key={post.id} className="w-full relative rounded-xl overflow-hidden">
                        {post.type === "video" ? (
                          <video src={post.url} className="w-full h-auto" muted />
                        ) : (
                          <img src={post.url} alt="" className="w-full h-auto" />
                        )}
                        {/* Blur overlay com cadeado - apenas se blur ativo */}
                        {(post.blur !== false) && (
                          <div className="absolute inset-0 backdrop-blur-sm bg-black/10 flex items-center justify-center">
                            <Lock className="w-6 h-6 text-white/70" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div 
                    className="rounded-xl p-6 flex flex-col items-center justify-center"
                    style={{ backgroundColor: `${pageData.colors.accent}10` }}
                  >
                    <Lock className="w-8 h-8 mb-2" style={{ color: pageData.colors.subtext }} />
                    <p className="text-[10px] text-center" style={{ color: pageData.colors.subtext }}>
                      Assine para desbloquear o conteudo
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

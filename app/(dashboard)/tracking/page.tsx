"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from "@/components/ui/dialog"
import { NoBotSelected } from "@/components/no-bot-selected"
import { useBots } from "@/lib/bot-context"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"
import { useState, useEffect } from "react"
import { Zap, GitBranch, BarChart3, Globe, Plus, Facebook, Loader2 } from "lucide-react"

interface TrackingProfile {
  id: string
  name: string
  pixelId: string
  accessToken: string
  utmifyToken: string
  events: string[]
  linkedFlows: string[]
  active: boolean
}

interface Flow {
  id: string
  name: string
  status: string
}

const EVENTS = [
  { id: "PageView", label: "PageView" },
  { id: "ViewContent", label: "ViewContent" },
  { id: "Lead", label: "Lead" },
  { id: "InitiateCheckout", label: "InitiateCheckout" },
  { id: "Purchase", label: "Purchase" },
]

export default function TrackingPage() {
  const { selectedBot } = useBots()
  const { session } = useAuth()
  const [profiles, setProfiles] = useState<TrackingProfile[]>([])
  const [showPlatformDialog, setShowPlatformDialog] = useState(false)
  const [showFacebookDialog, setShowFacebookDialog] = useState(false)
  
  // Flows from database
  const [availableFlows, setAvailableFlows] = useState<Flow[]>([])
  const [isLoadingFlows, setIsLoadingFlows] = useState(false)
  
  // Form state
  const [profileName, setProfileName] = useState("")
  const [pixelId, setPixelId] = useState("")
  const [accessToken, setAccessToken] = useState("")
  const [pixelExtra, setPixelExtra] = useState(false)
  const [utmifyToken, setUtmifyToken] = useState("")
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["PageView", "ViewContent", "Lead", "InitiateCheckout", "Purchase"])
  const [selectedFlows, setSelectedFlows] = useState<string[]>([])
  
  // Fetch flows from database
  useEffect(() => {
    async function fetchFlows() {
      if (!session?.userId) return
      
      setIsLoadingFlows(true)
      const { data, error } = await supabase
        .from("flows")
        .select("id, name, status")
        .eq("user_id", session.userId)
        .order("created_at", { ascending: false })
      
      if (!error && data) {
        setAvailableFlows(data)
      }
      setIsLoadingFlows(false)
    }
    
    fetchFlows()
  }, [session?.userId])

  if (!selectedBot) {
    return <NoBotSelected />
  }

  const handleSelectPlatform = () => {
    setShowPlatformDialog(false)
    setShowFacebookDialog(true)
  }

  const handleCreateProfile = () => {
    if (!profileName.trim()) return
    
    const newProfile: TrackingProfile = {
      id: Date.now().toString(),
      name: profileName,
      pixelId,
      accessToken,
      utmifyToken,
      events: selectedEvents,
      linkedFlows: selectedFlows,
      active: true,
    }
    
    setProfiles([...profiles, newProfile])
    resetForm()
    setShowFacebookDialog(false)
  }

  const resetForm = () => {
    setProfileName("")
    setPixelId("")
    setAccessToken("")
    setPixelExtra(false)
    setUtmifyToken("")
    setSelectedEvents(["PageView", "ViewContent", "Lead", "InitiateCheckout", "Purchase"])
    setSelectedFlows([])
  }

  const toggleEvent = (eventId: string) => {
    setSelectedEvents(prev => 
      prev.includes(eventId) 
        ? prev.filter(e => e !== eventId)
        : [...prev, eventId]
    )
  }

  const toggleFlow = (flowId: string) => {
    setSelectedFlows(prev => 
      prev.includes(flowId) 
        ? prev.filter(f => f !== flowId)
        : [...prev, flowId]
    )
  }

  const toggleProfileActive = (profileId: string) => {
    setProfiles(prev => 
      prev.map(p => p.id === profileId ? { ...p, active: !p.active } : p)
    )
  }

  const activeProfiles = profiles.filter(p => p.active).length
  const linkedFlowsCount = profiles.reduce((acc, p) => acc + p.linkedFlows.length, 0)
  const totalEvents = profiles.reduce((acc, p) => acc + p.events.length, 0)

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 md:p-8 bg-background min-h-full">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Trackeamento
              </h1>
              <p className="text-sm text-muted-foreground">
                Gerencie perfis de rastreamento e vincule aos seus fluxos
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                className="text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 gap-2"
              >
                <Zap className="w-4 h-4" />
                Sincronizar
              </Button>
              <Button 
                onClick={() => setShowPlatformDialog(true)}
                className="bg-secondary hover:bg-secondary/80 text-foreground border border-border gap-2"
              >
                <Plus className="w-4 h-4" />
                Novo Perfil
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{activeProfiles}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Perfis Ativos</p>
              </div>
            </div>
            
            <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <GitBranch className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{linkedFlowsCount}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Fluxos Rastreados</p>
              </div>
            </div>
            
            <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalEvents}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total de Eventos</p>
              </div>
            </div>
          </div>

          {/* Info Banner */}
          <div className="bg-card border border-border rounded-xl p-4 mb-6 flex items-center gap-3">
            <Globe className="w-5 h-5 text-blue-400" />
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">Perfis de Trackeamento</span> permitem configurar seu Facebook Pixel, TikTok Events API, UTMify e Otimizey uma vez e reutilizar em multiplos fluxos.
            </p>
          </div>

          {/* Profiles List or Empty State */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {profiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <BarChart3 className="w-7 h-7 text-muted-foreground" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">Nenhum perfil criado</h3>
                <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                  Crie seu primeiro perfil de trackeamento para comecar a rastrear conversoes
                </p>
                <Button 
                  onClick={() => setShowPlatformDialog(true)}
                  className="bg-secondary hover:bg-secondary/80 text-foreground border border-border gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Criar Perfil
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {profiles.map((profile) => (
                  <div key={profile.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <Facebook className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">{profile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {profile.events.length} eventos | {profile.linkedFlows.length} fluxos vinculados
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-md ${
                        profile.active 
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                          : "bg-muted text-muted-foreground border border-border"
                      }`}>
                        {profile.active ? "Ativo" : "Inativo"}
                      </span>
                      <Switch 
                        checked={profile.active} 
                        onCheckedChange={() => toggleProfileActive(profile.id)}
                        className="data-[state=checked]:bg-blue-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Platform Selection Dialog */}
      <Dialog open={showPlatformDialog} onOpenChange={setShowPlatformDialog}>
        <DialogContent className="bg-card border border-border sm:max-w-lg rounded-2xl p-0">
          <DialogHeader className="p-6 pb-4">
            <div className="flex items-center gap-3">
              <Plus className="w-5 h-5 text-muted-foreground" />
              <DialogTitle className="text-foreground text-lg font-semibold">Novo Perfil de Trackeamento</DialogTitle>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Escolha a plataforma de anuncios para criar o perfil
            </p>
          </DialogHeader>
          
          <div className="px-6 pb-6">
            <div className="grid grid-cols-3 gap-3 mb-4">
              {/* Facebook - Only enabled option */}
              <button 
                onClick={handleSelectPlatform}
                className="flex flex-col items-center p-6 rounded-xl border border-border bg-secondary/50 hover:border-blue-500/50 hover:bg-secondary transition-all group"
              >
                <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center mb-3 group-hover:bg-blue-500/20 transition-colors">
                  <Facebook className="w-7 h-7 text-blue-500" />
                </div>
                <span className="text-foreground font-medium text-sm">Facebook</span>
                <span className="text-xs text-muted-foreground text-center mt-1">Pixel & Conversions API</span>
              </button>
              
              {/* TikTok - Disabled */}
              <div className="flex flex-col items-center p-6 rounded-xl border border-border bg-muted/30 opacity-40 cursor-not-allowed">
                <div className="w-14 h-14 rounded-xl bg-pink-500/10 flex items-center justify-center mb-3">
                  <svg viewBox="0 0 24 24" className="w-7 h-7 text-pink-500" fill="currentColor">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                  </svg>
                </div>
                <span className="text-muted-foreground font-medium text-sm">TikTok</span>
                <span className="text-xs text-muted-foreground/70 text-center mt-1">Events API</span>
              </div>
              
              {/* Kwai - Disabled */}
              <div className="flex flex-col items-center p-6 rounded-xl border border-border bg-muted/30 opacity-40 cursor-not-allowed">
                <div className="w-14 h-14 rounded-xl bg-orange-500/10 flex items-center justify-center mb-3">
                  <svg viewBox="0 0 24 24" className="w-7 h-7 text-orange-500" fill="currentColor">
                    <rect x="4" y="4" width="16" height="16" rx="4"/>
                  </svg>
                </div>
                <span className="text-muted-foreground font-medium text-sm">Kwai</span>
                <span className="text-xs text-muted-foreground/70 text-center mt-1">Event API</span>
              </div>
            </div>
            
            <Button 
              variant="ghost" 
              onClick={() => setShowPlatformDialog(false)}
              className="w-full bg-secondary hover:bg-secondary/80 text-muted-foreground border border-border"
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Facebook Profile Creation Dialog */}
      <Dialog open={showFacebookDialog} onOpenChange={setShowFacebookDialog}>
        <DialogContent className="bg-card border border-border sm:max-w-lg rounded-2xl p-0 max-h-[90vh] overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <Facebook className="w-5 h-5 text-blue-500" />
              <DialogTitle className="text-foreground text-lg font-semibold">Novo Perfil Facebook</DialogTitle>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Configure as credenciais do Facebook Pixel e UTMify, depois selecione os fluxos
            </p>
          </DialogHeader>
          
          <ScrollArea className="max-h-[calc(90vh-180px)]">
            <div className="p-6 space-y-6">
              {/* Profile Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Nome do Perfil *</label>
                <Input 
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Ex: Pixel Principal, Lancamentos..."
                  className="bg-input border-border text-foreground placeholder:text-muted-foreground h-11 rounded-xl focus:border-blue-500 focus:ring-blue-500/20"
                />
              </div>

              {/* Facebook Pixel Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-border"></div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Facebook Pixel</span>
                  <div className="flex-1 h-px bg-border"></div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Pixel ID</label>
                    <Input 
                      value={pixelId}
                      onChange={(e) => setPixelId(e.target.value)}
                      placeholder="Ex: 847291038475629"
                      className="bg-input border-border text-foreground placeholder:text-muted-foreground h-11 rounded-xl focus:border-blue-500 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Access Token (CAPI)</label>
                    <Input 
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder="Token para API de Conversoes"
                      className="bg-input border-border text-foreground placeholder:text-muted-foreground h-11 rounded-xl focus:border-blue-500 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground uppercase tracking-wider">Pixel Extra (Aquecimento)</span>
                  <Switch 
                    checked={pixelExtra}
                    onCheckedChange={setPixelExtra}
                    className="data-[state=checked]:bg-blue-500"
                  />
                </div>
              </div>

              {/* UTMify Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-border"></div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">UTMify</span>
                  <div className="flex-1 h-px bg-border"></div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">UTMify Token</label>
                  <Input 
                    value={utmifyToken}
                    onChange={(e) => setUtmifyToken(e.target.value)}
                    placeholder="Ex: utm_abc123xyz789"
                    className="bg-input border-border text-foreground placeholder:text-muted-foreground h-11 rounded-xl focus:border-blue-500 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* Events Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-border"></div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Eventos a Disparar</span>
                  <div className="flex-1 h-px bg-border"></div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {EVENTS.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => toggleEvent(event.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                        selectedEvents.includes(event.id)
                          ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                          : "bg-input border-border text-muted-foreground hover:border-border/80"
                      }`}
                    >
                      <Checkbox 
                        checked={selectedEvents.includes(event.id)}
                        className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 border-border"
                      />
                      <span className="text-sm font-medium">{event.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Linked Flows Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-border"></div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fluxos Vinculados</span>
                  <div className="flex-1 h-px bg-border"></div>
                </div>
                
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {isLoadingFlows ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : availableFlows.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum fluxo criado
                    </p>
                  ) : (
                    availableFlows.map((flow) => (
                      <div
                        key={flow.id}
                        onClick={() => toggleFlow(flow.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          selectedFlows.includes(flow.id)
                            ? "bg-blue-500/5 border-blue-500/30"
                            : "bg-muted/30 border-border hover:border-border/80"
                        }`}
                      >
                        <Checkbox 
                          checked={selectedFlows.includes(flow.id)}
                          className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 border-border"
                        />
                        <div>
                          <p className="text-sm font-medium text-foreground">{flow.name}</p>
                          <p className="text-xs text-muted-foreground">{flow.status === "ativo" || flow.status === "active" ? "Ativo" : "Inativo"}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
          
          {/* Footer Buttons */}
          <div className="p-6 pt-4 border-t border-border flex justify-end gap-3">
            <Button 
              variant="ghost" 
              onClick={() => {
                resetForm()
                setShowFacebookDialog(false)
              }}
              className="bg-secondary hover:bg-secondary/80 text-muted-foreground border border-border"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateProfile}
              disabled={!profileName.trim()}
              className="bg-foreground hover:bg-foreground/90 text-background font-medium"
            >
              Criar Perfil
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  )
}

"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import {
  Plus, Zap, Link2, Workflow, RotateCcw, 
  Loader2, Bot, Upload, CheckCircle2, Sparkles, Trash2, AlertTriangle
} from "lucide-react"

// Types
interface Flow {
  id: string
  user_id: string
  name: string
  flow_type: "basic" | "complete" | "n8n"
  status: "active" | "paused" | "ativo"
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface FlowBot {
  id: string
  flow_id: string
  bot_id: string
  bot?: {
    id: string
    username: string
    first_name: string
  }
}

interface FlowStats {
  linkedBots: number
  basicFlows: number
  n8nFlows: number
}

export default function FluxosPage() {
  const router = useRouter()
  const { session } = useAuth()
  const { toast } = useToast()

  // State
  const [flows, setFlows] = useState<Flow[]>([])
  const [flowBots, setFlowBots] = useState<Record<string, FlowBot[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<FlowStats>({ linkedBots: 0, basicFlows: 0, n8nFlows: 0 })

  // Flow metrics cache (leads, conversions per flow)
  const [flowMetrics, setFlowMetrics] = useState<Record<string, { leads: number; conversions: number }>>({})

  // Create flow modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newFlowName, setNewFlowName] = useState("")
  const [newFlowMode, setNewFlowMode] = useState<"basic" | "n8n">("basic")
  const [isCreating, setIsCreating] = useState(false)

  // Import flow dialog
  const [showImportDialog, setShowImportDialog] = useState(false)

  // Delete flow modal
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [flowToDelete, setFlowToDelete] = useState<Flow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Create flow handler
  const handleCreateFlow = async () => {
    if (!session?.userId) {
      toast({ title: "Erro", description: "Voce precisa estar logado", variant: "destructive" })
      return
    }
    if (!newFlowName.trim()) {
      toast({ title: "Erro", description: "Digite um nome para o fluxo", variant: "destructive" })
      return
    }


    setIsCreating(true)

    const { data, error } = await supabase
      .from("flows")
      .insert({
        user_id: session.userId,
        name: newFlowName.trim(),
        flow_type: newFlowMode === "n8n" ? "n8n" : "complete",
        status: "ativo",
        config: {},
      })
      .select()
      .single()

    if (error) {
      toast({ title: "Erro ao criar", description: error.message, variant: "destructive" })
      setIsCreating(false)
      return
    }

    toast({ title: "Fluxo criado!", description: "Redirecionando para o editor..." })
    setShowCreateModal(false)
    setNewFlowName("")
    router.push(`/fluxos/${data.id}`)
  }

  // Fetch flows
  const fetchFlows = useCallback(async () => {
    if (!session?.userId) {
      setFlows([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    
    // Fetch flows
    const { data: flowsData, error } = await supabase
      .from("flows")
      .select("*")
      .eq("user_id", session.userId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching flows:", error)
      setIsLoading(false)
      return
    }

    const fetchedFlows = (flowsData || []) as Flow[]
    setFlows(fetchedFlows)

    // Calculate stats
    const linkedBotsCount = 0 // Will be calculated from flow_bots
    const basicCount = fetchedFlows.filter(f => f.flow_type !== "n8n").length
    const n8nCount = fetchedFlows.filter(f => f.flow_type === "n8n").length
    setStats({ linkedBots: linkedBotsCount, basicFlows: basicCount, n8nFlows: n8nCount })

    // Fetch flow_bots for each flow
    const flowIds = fetchedFlows.map(f => f.id)
    
    if (flowIds.length > 0) {
      // Buscar flow_bots
      const { data: flowBotsData } = await supabase
        .from("flow_bots")
        .select("id, flow_id, bot_id")
        .in("flow_id", flowIds)

      if (flowBotsData && flowBotsData.length > 0) {
        // Buscar dados dos bots
        const botIds = [...new Set(flowBotsData.map(fb => fb.bot_id))]
        const { data: botsInfo } = await supabase
          .from("bots")
          .select("id, name, username")
          .in("id", botIds)

        const botsMap: Record<string, { id: string; name: string; username?: string }> = {}
        if (botsInfo) {
          for (const bot of botsInfo) {
            botsMap[bot.id] = bot
          }
        }

        // Agrupar por flow_id
        const grouped: Record<string, FlowBot[]> = {}
        let totalLinked = 0
        for (const fb of flowBotsData) {
          if (!grouped[fb.flow_id]) grouped[fb.flow_id] = []
          grouped[fb.flow_id].push({
            id: fb.id,
            flow_id: fb.flow_id,
            bot_id: fb.bot_id,
            bots: botsMap[fb.bot_id] || null
          } as FlowBot)
          totalLinked++
        }
        setFlowBots(grouped)
        setStats(prev => ({ ...prev, linkedBots: totalLinked }))
      }
    }

    setIsLoading(false)
  }, [session?.userId])

  // Fetch metrics (leads and conversions) for each flow based on connected bots
  const fetchFlowMetrics = useCallback(async (flowBotsMap: Record<string, FlowBot[]>) => {
    const metrics: Record<string, { leads: number; conversions: number }> = {}
    
    for (const flowId of Object.keys(flowBotsMap)) {
      const bots = flowBotsMap[flowId]
      let totalLeads = 0
      let totalConversions = 0
      
      // For each bot connected to this flow, fetch their stats
      for (const fb of bots) {
        try {
          // Fetch leads (conversations/starts) for this bot
          const convRes = await fetch(`/api/conversations?bot_id=${fb.bot_id}&period=year`)
          const convData = await convRes.json()
          totalLeads += convData?.total || 0
          
          // Fetch unique conversions (users who paid at least once)
          const payRes = await fetch(`/api/payments/list?botId=${fb.bot_id}&limit=1`)
          const payData = await payRes.json()
          totalConversions += payData?.stats?.approvedUniqueUsers || 0
        } catch {
          // Ignore errors for individual bots
        }
      }
      
      metrics[flowId] = { leads: totalLeads, conversions: totalConversions }
    }
    
    setFlowMetrics(metrics)
  }, [])

  useEffect(() => {
    fetchFlows()
  }, [fetchFlows])
  
  // Fetch metrics when flowBots change
  useEffect(() => {
    if (Object.keys(flowBots).length > 0) {
      fetchFlowMetrics(flowBots)
    }
  }, [flowBots, fetchFlowMetrics])

  // Refresh when page becomes visible (user returns from flow editor)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchFlows()
      }
    }
    
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [fetchFlows])

  // Delete flow - open modal
  const openDeleteModal = (flow: Flow) => {
    setFlowToDelete(flow)
    setShowDeleteModal(true)
  }

  // Confirm delete flow
  const confirmDeleteFlow = async () => {
    if (!flowToDelete) return
    
    setIsDeleting(true)
    
    // Delete flow_bots first
    await supabase.from("flow_bots").delete().eq("flow_id", flowToDelete.id)
    
    // Delete flow
    const { error } = await supabase.from("flows").delete().eq("id", flowToDelete.id)
    
    if (error) {
      toast({ title: "Erro", description: "Nao foi possivel excluir o fluxo", variant: "destructive" })
      setIsDeleting(false)
      return
    }
    
    toast({ title: "Fluxo excluido", description: "O fluxo foi removido com sucesso" })
    setShowDeleteModal(false)
    setFlowToDelete(null)
    setIsDeleting(false)
    fetchFlows()
  }

  // Flow card - Design escuro com verde neon
  const FlowCard = ({ flow }: { flow: Flow }) => {
    const bots = flowBots[flow.id] || []
    const isBasic = flow.flow_type !== "n8n"
    
    // Real stats from connected bots
    const metrics = flowMetrics[flow.id] || { leads: 0, conversions: 0 }
    const leads = metrics.leads
    const conversions = metrics.conversions
    const conversionRate = leads > 0 ? Math.round((conversions / leads) * 100) : 0

    return (
      <div 
        className="group bg-[#1c1c1e] border border-[#2a2a2e] rounded-2xl overflow-hidden hover:border-[#bfff00]/30 hover:shadow-lg hover:shadow-[#bfff00]/5 transition-all duration-300"
      >
        {/* Header com gradiente */}
        <div className="relative px-4 py-3.5">
          {/* Glow sutil */}
          <div 
            className="absolute top-0 left-0 right-0 h-16 pointer-events-none"
            style={{
              background: isBasic 
                ? "radial-gradient(ellipse at center top, rgba(190, 255, 0, 0.08) 0%, transparent 70%)"
                : "radial-gradient(ellipse at center top, rgba(168, 85, 247, 0.08) 0%, transparent 70%)"
            }}
          />
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                isBasic 
                  ? "bg-[#bfff00]/10 text-[#bfff00] border-[#bfff00]/20" 
                  : "bg-purple-500/10 text-purple-400 border-purple-500/20"
              }`}>
                {isBasic ? <Zap className="h-5 w-5" /> : <Workflow className="h-5 w-5" />}
              </div>
              <div>
                <h3 className="font-semibold text-white truncate max-w-[160px]">{flow.name}</h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    isBasic 
                      ? "bg-[#bfff00]/10 text-[#bfff00] border border-[#bfff00]/20" 
                      : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                  }`}>
                    {isBasic ? "BASICO" : "N8N"}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    flow.status === "active" || flow.status === "ativo"
                      ? "bg-[#bfff00]/10 text-[#bfff00]" 
                      : "bg-[#2a2a2e] text-gray-400"
                  }`}>
                    {flow.status === "active" || flow.status === "ativo" ? "Ativo" : "Pausado"}
                  </span>
                </div>
              </div>
            </div>
            
{/* Delete button */}
  <button
  className="p-2 rounded-lg bg-[#2a2a2e] hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
  onClick={() => openDeleteModal(flow)}
              title="Excluir fluxo"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        {/* Stats Grid */}
        <div className="px-4 pb-4">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-[#2a2a2e] rounded-xl py-2.5 px-2 text-center">
              <div className="text-lg font-bold text-white">{leads}</div>
              <div className="text-[10px] text-gray-500 font-medium">Leads</div>
            </div>
            <div className="bg-[#2a2a2e] rounded-xl py-2.5 px-2 text-center">
              <div className="text-lg font-bold text-white">{conversions}</div>
              <div className="text-[10px] text-gray-500 font-medium">Conv.</div>
            </div>
            <div className={`rounded-xl py-2.5 px-2 text-center ${
              conversionRate > 0 ? "bg-[#bfff00]/10" : "bg-[#2a2a2e]"
            }`}>
              <div className={`text-lg font-bold ${conversionRate > 0 ? "text-[#bfff00]" : "text-white"}`}>
                {conversionRate}%
              </div>
              <div className="text-[10px] text-gray-500 font-medium">Taxa</div>
            </div>
          </div>
          
          {/* Bots linked */}
          <div className="flex items-center justify-between pt-3 border-t border-[#2a2a2e]">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {bots.length > 0 ? (
                  bots.slice(0, 3).map((fb) => (
                    <div 
                      key={fb.id}
                      className="w-5 h-5 rounded-full bg-[#bfff00]/20 border-2 border-[#1c1c1e] flex items-center justify-center"
                    >
                      <Bot className="h-2.5 w-2.5 text-[#bfff00]" />
                    </div>
                  ))
                ) : (
                  <div className="w-5 h-5 rounded-full bg-[#2a2a2e] border-2 border-[#1c1c1e] flex items-center justify-center">
                    <Bot className="h-2.5 w-2.5 text-gray-500" />
                  </div>
                )}
              </div>
              <span className={`text-xs ${bots.length > 0 ? "text-[#bfff00]" : "text-gray-500"}`}>
                {bots.length === 0 ? "Sem bot" : `${bots.length} bot conectado`}
              </span>
            </div>
            
            <button 
              className="flex items-center gap-1 text-xs text-[#bfff00] hover:text-[#d4ff4d] font-medium transition-colors"
              onClick={() => router.push(`/fluxos/${flow.id}`)}
            >
              Editar
              <Link2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Empty state
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#2a2a2e] border border-[#3a3a3e] mb-6">
        <Workflow className="h-10 w-10 text-white" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">Nenhum fluxo configurado</h3>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        Crie seu primeiro fluxo de automacao para comecar a automatizar suas vendas e capturar leads.
      </p>
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setShowImportDialog(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#3a3a3e] bg-[#2a2a2e] hover:bg-[#3a3a3e] text-sm font-medium text-gray-300 transition-colors"
        >
          <Upload className="h-4 w-4" />
          Importar Fluxo
        </button>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#bfff00] hover:bg-[#d4ff4d] text-sm font-semibold text-[#1c1c1e] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Criar Primeiro Fluxo
        </button>
      </div>
    </div>
  )

  const maxFlows = 50
  const currentFlows = flows.length

  return (
    <div className="flex h-full flex-col bg-background">
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {/* Header - responsivo */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <h2 className="text-xl font-bold text-foreground">Fluxos</h2>
          <div className="flex items-center gap-2">
            <button 
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#3a3a3e] bg-[#2a2a2e] hover:bg-[#3a3a3e] text-sm font-medium text-gray-300 hover:text-white transition-colors"
              onClick={() => setShowImportDialog(true)}
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Importar</span>
            </button>
            <button 
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#bfff00] hover:bg-[#d4ff4d] text-sm font-semibold text-[#1c1c1e] transition-colors"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo fluxo</span>
            </button>
          </div>
        </div>

        {/* Stats Cards - full width grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {/* Bots Card */}
          <div className="flex items-center gap-3 bg-[#1c1c1e] border border-[#2a2a2e] rounded-xl px-4 py-3 hover:border-[#bfff00]/30 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-[#bfff00]/10 flex items-center justify-center">
              <svg className="h-4 w-4 text-[#bfff00]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0-6v6m18-6v6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-[#bfff00]">{stats.linkedBots}</span>
              <span className="text-xs text-gray-500">bots</span>
            </div>
          </div>
          
          {/* Basicos Card */}
          <div className="flex items-center gap-3 bg-[#1c1c1e] border border-[#2a2a2e] rounded-xl px-4 py-3 hover:border-[#bfff00]/30 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-[#bfff00]/10 flex items-center justify-center">
              <svg className="h-4 w-4 text-[#bfff00]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
              </svg>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-white">{stats.basicFlows}</span>
              <span className="text-xs text-gray-500">basicos</span>
            </div>
          </div>
          
          {/* N8N Card */}
          <div className="flex items-center gap-3 bg-[#1c1c1e] border border-[#2a2a2e] rounded-xl px-4 py-3 hover:border-orange-500/30 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <svg className="h-4 w-4 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="6" height="6" rx="1" /><rect x="16" y="2" width="6" height="6" rx="1" /><rect x="9" y="16" width="6" height="6" rx="1" /><path d="M5 8v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" /><path d="M12 13v3" />
              </svg>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-white">{stats.n8nFlows}</span>
              <span className="text-xs text-gray-500">n8n</span>
            </div>
          </div>
        </div>

        {/* Flows Grid or Empty State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-[#bfff00]" />
              <p className="text-sm text-gray-400">Carregando fluxos...</p>
            </div>
          </div>
        ) : flows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {flows.map(flow => (
              <FlowCard key={flow.id} flow={flow} />
            ))}
          </div>
        )}
      </main>

      {/* Create Flow Modal - Design escuro */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-lg bg-[#1c1c1e] border-[#2a2a2e] p-0 gap-0 overflow-hidden rounded-[20px] [&>button]:text-gray-400 [&>button]:hover:text-white">
          <div className="p-5">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-[#bfff00]/10 flex items-center justify-center border border-[#bfff00]/20">
                <Sparkles className="h-5 w-5 text-[#bfff00]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Criar Novo Fluxo</h2>
                <p className="text-xs text-gray-400">Configure seu fluxo de automacao</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Nome do Fluxo */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Nome do Fluxo
                </Label>
                <Input
                  placeholder="Ex: Boas-vindas e Vendas"
                  value={newFlowName}
                  onChange={(e) => setNewFlowName(e.target.value.slice(0, 30))}
                  className="h-11 bg-[#2a2a2e] border-[#3a3a3e] rounded-lg text-sm text-white placeholder:text-gray-500 focus:border-[#bfff00]"
                />
                <p className="text-[10px] text-gray-500">{newFlowName.length}/30 caracteres</p>
              </div>

              {/* Modo do Fluxo */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Tipo de Fluxo</Label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Basico */}
                  <button
                    type="button"
                    onClick={() => setNewFlowMode("basic")}
                    className={`relative flex flex-col p-4 rounded-xl border transition-all text-left ${
                      newFlowMode === "basic"
                        ? "border-[#bfff00] bg-[#bfff00]/5"
                        : "border-[#3a3a3e] bg-[#2a2a2e] hover:border-[#4a4a4e]"
                    }`}
                  >
                    {newFlowMode === "basic" && (
                      <CheckCircle2 className="absolute top-3 right-3 h-4 w-4 text-[#bfff00]" />
                    )}
                    <div className="flex items-center gap-2 mb-1.5">
                      <Zap className="h-4 w-4 text-[#bfff00]" />
                      <span className="font-semibold text-white text-sm">Basico</span>
                    </div>
                    <p className="text-[11px] text-gray-400">Editor visual simples</p>
                  </button>

                  {/* n8n */}
                  <button
                    type="button"
                    onClick={() => setNewFlowMode("n8n")}
                    className={`relative flex flex-col p-4 rounded-xl border transition-all text-left ${
                      newFlowMode === "n8n"
                        ? "border-purple-500 bg-purple-500/5"
                        : "border-[#3a3a3e] bg-[#2a2a2e] hover:border-[#4a4a4e]"
                    }`}
                  >
                    {newFlowMode === "n8n" && (
                      <CheckCircle2 className="absolute top-3 right-3 h-4 w-4 text-purple-500" />
                    )}
                    <div className="flex items-center gap-2 mb-1.5">
                      <Workflow className="h-4 w-4 text-purple-400" />
                      <span className="font-semibold text-white text-sm">Fluxo N8N</span>
                    </div>
                    <p className="text-[11px] text-gray-400">Blocos arrastaveis</p>
                  </button>
                </div>
              </div>

              {/* Dica */}
              <div className="rounded-lg border border-[#bfff00]/20 bg-[#bfff00]/5 p-3">
                <div className="flex items-center gap-2 mb-0.5">
                  <Bot className="h-3.5 w-3.5 text-[#bfff00]" />
                  <span className="text-xs font-medium text-[#bfff00]">Dica</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Apos criar, adicione bots na aba Bots. Um fluxo pode ter multiplos bots.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 bg-[#18181a] border-t border-[#2a2a2e] flex items-center justify-end gap-2">
            <button
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-[#2a2a2e] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateFlow}
              disabled={!newFlowName.trim() || isCreating}
              className="flex items-center gap-2 bg-[#bfff00] text-[#1c1c1e] px-5 py-2 rounded-lg font-semibold text-sm hover:bg-[#d4ff4d] disabled:opacity-50 transition-colors"
            >
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Workflow className="h-4 w-4" />}
              Criar Fluxo
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Flow Dialog - Design escuro */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-md bg-[#1c1c1e] border-[#2a2a2e] p-0 gap-0 overflow-hidden rounded-[20px] [&>button]:text-gray-400 [&>button]:hover:text-white">
          <div className="p-5">
            <h2 className="text-lg font-bold text-white mb-1">Importar Fluxo</h2>
            <p className="text-xs text-gray-400">Importe um fluxo existente</p>
          </div>
          <div className="py-8 text-center border-t border-[#2a2a2e]">
            <Upload className="h-12 w-12 mx-auto text-gray-500 mb-3" />
            <p className="text-sm text-gray-400">Funcionalidade em desenvolvimento</p>
          </div>
          <div className="px-5 py-3 bg-[#18181a] border-t border-[#2a2a2e] flex justify-end">
            <button
              onClick={() => setShowImportDialog(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-[#2a2a2e] transition-colors"
            >
              Fechar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Flow Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-[360px] bg-[#1c1c1e] border-[#2a2a2e] p-0 gap-0 overflow-hidden rounded-[20px] [&>button]:text-gray-400 [&>button]:hover:text-white">
          <div className="p-5 text-center">
            <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-white mb-1">Excluir Fluxo</h2>
            <p className="text-sm text-gray-400">
              Tem certeza que deseja excluir <span className="text-white font-medium">{flowToDelete?.name}</span>?
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Esta acao nao pode ser desfeita.
            </p>
          </div>
          <div className="px-5 py-3 bg-[#18181a] border-t border-[#2a2a2e] flex gap-2">
            <button
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeleting}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-[#2a2a2e] transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDeleteFlow}
              disabled={isDeleting}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Excluir
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

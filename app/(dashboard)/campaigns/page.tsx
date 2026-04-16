"use client"

import { useState, useEffect, useCallback } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { NoBotSelected } from "@/components/no-bot-selected"
import { ImageUpload } from "@/components/image-upload"
import { useBots } from "@/lib/bot-context"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import {
  Plus, Search, MoreVertical, Trash2, Pause, Play, Copy,
  Megaphone, Send, UserX, ShoppingCart, CheckCircle2,
  RefreshCw, Loader2, ChevronRight, Users, ChevronDown, Download, Upload, Bot,
  FileText, FileSpreadsheet, MessageSquare, Image, X, Settings, Package, CreditCard
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface CampaignNode {
  id?: string
  type: "message" | "delay"
  label: string
  config: Record<string, unknown>
  position: number
}

interface Campaign {
  id: string
  bot_id: string
  user_id: string
  name: string
  status: "rascunho" | "ativa" | "pausada" | "concluida"
  audience_type?: "start" | "imported"
  audience?: "started_not_continued" | "not_paid" | "paid" | null
  campaign_type: "basic" | "complete"
  created_at: string
  updated_at: string
  nodes: CampaignNode[]
  sent_count?: number
  target_count?: number
  open_rate?: number
}

const AUDIENCES = [
  {
    id: "started_not_continued",
    label: "Abandonou",
    description: "Iniciou mas nao continuou",
    icon: UserX,
    color: "#f59e0b",
    bgClass: "bg-amber-500/20",
    textClass: "text-amber-400",
  },
  {
    id: "not_paid",
    label: "Nao pagou",
    description: "Gerou PIX mas nao finalizou",
    icon: ShoppingCart,
    color: "#ef4444",
    bgClass: "bg-red-500/20",
    textClass: "text-red-400",
  },
  {
    id: "paid",
    label: "Pagou",
    description: "Clientes que ja compraram",
    icon: CheckCircle2,
    color: "#22c55e",
    bgClass: "bg-emerald-500/20",
    textClass: "text-emerald-400",
  },
]

interface BotUser {
  id: string
  telegram_user_id: string
  first_name?: string
  username?: string
  funnel_step?: number | string
  is_subscriber?: boolean
  payment_status?: string
  created_at: string
}

export default function CampaignsPage() {
  const { selectedBot, bots, setSelectedBot } = useBots()
  const { session } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState("todas")
  
  // Section toggle: "campanhas" ou "usuarios"
  const [activeSection, setActiveSection] = useState<"campanhas" | "usuarios">("campanhas")
  
  // Users section state
  const [expandedBots, setExpandedBots] = useState<Record<string, boolean>>({})
  const [botUsers, setBotUsers] = useState<Record<string, BotUser[]>>({})
  const [loadingBotUsers, setLoadingBotUsers] = useState<Record<string, boolean>>({})
  
  // Create Modal
  const [createOpen, setCreateOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [newName, setNewName] = useState("")
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null)
  const [audienceType, setAudienceType] = useState<"start" | "imported" | null>(null)
  const [selectedAudience, setSelectedAudience] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  
  const [deleting, setDeleting] = useState<string | null>(null)
  const [activating, setActivating] = useState<string | null>(null)
  
  // Message Configuration Modal
  const [configMessageOpen, setConfigMessageOpen] = useState(false)
  const [configCampaignId, setConfigCampaignId] = useState<string | null>(null)
  const [configCampaignBotId, setConfigCampaignBotId] = useState<string | null>(null)
  const [messageText, setMessageText] = useState("")
  const [messageMedias, setMessageMedias] = useState<string[]>([]) // ate 3 midias (URLs uploaded)
  const [messageButtons, setMessageButtons] = useState<{ type: "custom" | "plans" | "packs"; text: string; url: string }[]>([])
  const [savingMessage, setSavingMessage] = useState(false)
  const [botFlowConfig, setBotFlowConfig] = useState<{ hasPlans: boolean; hasPacks: boolean } | null>(null)
  const [loadingFlowConfig, setLoadingFlowConfig] = useState(false)
  
  // Import Modal State
  const [showImportModal, setShowImportModal] = useState(false)
  const [importBotId, setImportBotId] = useState<string | null>(null)
  const [importMode, setImportMode] = useState<"text" | "file">("text")
  const [importText, setImportText] = useState("")
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    success: boolean
    imported?: number
    skipped?: number
    duplicates?: number
    error?: string
    parseErrors?: string[]
  } | null>(null)
  
  // Cache de dados do Telegram (foto, username)
  const [telegramDataCache, setTelegramDataCache] = useState<Record<string, { 
    username?: string
    photo_url?: string | null 
  }>>({})

  const fetchCampaigns = useCallback(async () => {
    if (!selectedBot) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/campaigns?bot_id=${selectedBot.id}`)
      const data = await res.json()
      setCampaigns(data.campaigns || [])
    } catch { /* ignore */ }
    setIsLoading(false)
  }, [selectedBot])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])
  
  // Carregar dados do Telegram (foto, username) para todos os bots
  const loadTelegramData = useCallback(async (botsToLoad: typeof bots) => {
    const botsNeedingData = botsToLoad.filter(bot => !telegramDataCache[bot.id])
    if (botsNeedingData.length === 0) return
    
    const newCache: Record<string, { username?: string; photo_url?: string | null }> = { ...telegramDataCache }
    
    await Promise.all(botsNeedingData.map(async (bot) => {
      try {
        const response = await fetch("/api/telegram/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: bot.token }),
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.bot) {
            newCache[bot.id] = {
              username: data.bot.username,
              photo_url: data.bot.photo_url
            }
          }
        }
      } catch {
        // Ignora erros
      }
    }))
    
    setTelegramDataCache(newCache)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  // Carregar dados do Telegram quando bots mudam
  useEffect(() => {
    if (bots.length > 0) {
      loadTelegramData(bots)
    }
  }, [bots, loadTelegramData])

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      await fetch(`/api/campaigns?id=${id}`, { method: "DELETE" })
      setCampaigns((prev) => prev.filter((c) => c.id !== id))
    } catch { /* ignore */ }
    setDeleting(null)
  }

  const handleCreate = async () => {
    // Para imported, nao precisa de selectedAudience
    if (!newName.trim() || !selectedBot || !session?.userId) return
    if (audienceType === "start" && !selectedAudience) return
    
    setIsCreating(true)
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: selectedBotId || selectedBot.id,
          user_id: session.userId,
          name: newName,
          audience_type: audienceType,
          audience: audienceType === "start" ? selectedAudience : null,
          status: "rascunho",
          campaign_type: "basic",
          nodes: []
        }),
      })
      const data = await res.json()
      if (data.campaign) {
        // Sync selectedBot to the bot used in creation so fetchCampaigns works correctly
        const createdBotId = selectedBotId || selectedBot?.id
        const createdBot = bots.find(b => b.id === createdBotId)
        if (createdBot && createdBot.id !== selectedBot?.id) {
          setSelectedBot(createdBot)
        }
        setCampaigns((prev) => [data.campaign, ...prev])
      }
    } catch { /* ignore */ }
    
    setIsCreating(false)
    resetModal()
  }

  const resetModal = () => {
    setCreateOpen(false)
    setNewName("")
    setSelectedBotId(null)
    setAudienceType(null)
    setSelectedAudience(null)
    setStep(1)
  }

  const openConfigMessage = async (campaign: Campaign) => {
    setConfigCampaignId(campaign.id)
    setConfigCampaignBotId(campaign.bot_id)
    
    // Load existing message if any
    const messageNode = campaign.nodes.find(n => n.type === "message")
    if (messageNode) {
      const config = messageNode.config as Record<string, unknown>
      setMessageText((config.text as string) || "")
      // Load medias array
      const medias: string[] = []
      if (config.medias && Array.isArray(config.medias)) {
        medias.push(...(config.medias as string[]))
      } else if (config.media_url) {
        medias.push(config.media_url as string)
        if (config.media_url_2) medias.push(config.media_url_2 as string)
        if (config.media_url_3) medias.push(config.media_url_3 as string)
      }
      setMessageMedias(medias)
      try {
        const btns = JSON.parse((config.buttons as string) || "[]")
        setMessageButtons(btns)
      } catch { setMessageButtons([]) }
    } else {
      setMessageText("")
      setMessageMedias([])
      setMessageButtons([])
    }
    
    setConfigMessageOpen(true)
    
    // Load bot flow config to check for plans/packs
    setLoadingFlowConfig(true)
    setBotFlowConfig(null)
    try {
      // Try to find flow linked to this bot
      const { data: flow } = await supabase
        .from("flows")
        .select("config")
        .eq("bot_id", campaign.bot_id)
        .limit(1)
        .single()
      
      if (flow?.config) {
        const config = flow.config as { plans?: unknown[]; packs?: unknown[] }
        setBotFlowConfig({
          hasPlans: Array.isArray(config.plans) && config.plans.length > 0,
          hasPacks: Array.isArray(config.packs) && config.packs.length > 0
        })
      } else {
        // Try flow_bots table
        const { data: flowBot } = await supabase
          .from("flow_bots")
          .select("flow_id")
          .eq("bot_id", campaign.bot_id)
          .limit(1)
          .single()
        
        if (flowBot) {
          const { data: linkedFlow } = await supabase
            .from("flows")
            .select("config")
            .eq("id", flowBot.flow_id)
            .single()
          
          if (linkedFlow?.config) {
            const config = linkedFlow.config as { plans?: unknown[]; packs?: unknown[] }
            setBotFlowConfig({
              hasPlans: Array.isArray(config.plans) && config.plans.length > 0,
              hasPacks: Array.isArray(config.packs) && config.packs.length > 0
            })
          }
        }
      }
    } catch { /* ignore */ }
    setLoadingFlowConfig(false)
  }

  const resetConfigMessage = () => {
    setConfigMessageOpen(false)
    setConfigCampaignId(null)
    setConfigCampaignBotId(null)
    setMessageText("")
    setMessageMedias([])
    setMessageButtons([])
    setBotFlowConfig(null)
  }

  const handleSaveMessage = async () => {
    if (!configCampaignId || !messageText.trim()) return
    
    setSavingMessage(true)
    try {
      // Build the node config
      const config: Record<string, unknown> = {
        text: messageText,
      }
      if (messageMedias.length > 0) {
        config.medias = messageMedias
      }
      if (messageButtons.length > 0) {
        config.buttons = JSON.stringify(messageButtons)
      }

      console.log("[v0] Salvando mensagem - campaign_id:", configCampaignId)
      console.log("[v0] Config:", JSON.stringify(config))

      // Save the node
      const res = await fetch("/api/campaigns/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: configCampaignId,
          type: "message",
          label: "Mensagem Principal",
          config,
          position: 0
        }),
      })

      const data = await res.json()
      console.log("[v0] Resposta do save:", JSON.stringify(data))

      if (res.ok && (data.node || data.created || data.updated)) {
        console.log("[v0] Mensagem salva com sucesso!")
        // Sync selectedBot to the campaign's bot before fetching
        if (configCampaignBotId) {
          const campaignBot = bots.find(b => b.id === configCampaignBotId)
          if (campaignBot && campaignBot.id !== selectedBot?.id) {
            setSelectedBot(campaignBot)
          }
        }
        // Refresh campaigns to get updated nodes
        await fetchCampaigns()
        resetConfigMessage()
      } else {
        console.error("[v0] Erro ao salvar mensagem:", data.error || "Erro desconhecido")
        alert(`Erro ao salvar mensagem: ${data.error || "Erro desconhecido"}`)
      }
    } catch (err) {
      console.error("[v0] Erro ao salvar mensagem:", err)
      alert(`Erro ao salvar mensagem: ${String(err)}`)
    }
    setSavingMessage(false)
  }

  const handleToggleStatus = async (campaign: Campaign) => {
    // Check if campaign has a message configured
    const hasMessage = campaign.nodes.some(n => n.type === "message")
    if (!hasMessage && campaign.status !== "ativa") {
      // Open config modal instead
      openConfigMessage(campaign)
      return
    }

    const newStatus = campaign.status === "ativa" ? "pausada" : "ativa"
    setActivating(campaign.id)
    try {
      await fetch("/api/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: campaign.id, status: newStatus }),
      })
      setCampaigns((prev) =>
        prev.map((c) => (c.id === campaign.id ? { ...c, status: newStatus } : c))
      )
    } catch { /* ignore */ }
    setActivating(null)
  }

  const handleImportUsers = async () => {
    if (!importBotId || !importText.trim()) return

    setImporting(true)
    setImportResult(null)

    try {
      const res = await fetch("/api/campaigns/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botId: importBotId,
          textData: importText
        })
      })

      const data = await res.json()
      setImportResult(data)

      if (data.success && importBotId) {
        // Refresh users for this bot
        fetchBotUsers(importBotId)
      }
    } catch {
      setImportResult({ success: false, error: "Falha ao importar usuarios" })
    } finally {
      setImporting(false)
    }
  }

  const resetImportModal = () => {
    setShowImportModal(false)
    setImportBotId(null)
    setImportMode("text")
    setImportText("")
    setImportResult(null)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    
    if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
      reader.onload = (event) => {
        const text = event.target?.result as string
        // Extract numbers from CSV/TXT - assumes chat IDs are in first column or comma separated
        const ids = text
          .split(/[\n,;]/)
          .map(s => s.trim())
          .filter(s => /^-?\d+$/.test(s))
          .join(', ')
        setImportText(ids)
        setImportMode("text")
      }
      reader.readAsText(file)
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      // For Excel files, we need to use a library - show message to use CSV
      const ids = await parseExcelFile(file)
      if (ids) {
        setImportText(ids)
        setImportMode("text")
      }
    }
  }

  const parseExcelFile = async (file: File): Promise<string | null> => {
    try {
      const XLSX = await import('xlsx')
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as (string | number)[][]
      
      // Extract all numeric values (chat IDs) from the first column
      const ids: string[] = []
      jsonData.forEach((row) => {
        if (row && row[0] !== undefined) {
          const val = String(row[0]).trim()
          if (/^-?\d+$/.test(val)) {
            ids.push(val)
          }
        }
      })
      
      return ids.join(', ')
    } catch {
      setImportResult({ success: false, error: "Erro ao ler arquivo Excel. Tente exportar como CSV." })
      return null
    }
  }

  const getAudience = (id: string) => AUDIENCES.find(a => a.id === id) || AUDIENCES[0]

  // Fetch users for a bot
  const fetchBotUsers = async (botId: string) => {
    setLoadingBotUsers(prev => ({ ...prev, [botId]: true }))
    try {
      const res = await fetch(`/api/bots/${botId}/users`)
      const data = await res.json()
      setBotUsers(prev => ({ ...prev, [botId]: data.users || [] }))
    } catch { /* ignore */ }
    setLoadingBotUsers(prev => ({ ...prev, [botId]: false }))
  }

  const toggleBotExpanded = (botId: string) => {
    const isExpanding = !expandedBots[botId]
    setExpandedBots(prev => ({ ...prev, [botId]: isExpanding }))
    if (isExpanding && !botUsers[botId]) {
      fetchBotUsers(botId)
    }
  }

  const getUsersByStatus = (users: BotUser[], status: string) => {
    // payment_status calculado pela API:
    // - abandoned: funnel_step == 1 (so deu start, nao avancou)
    // - not_paid: avancou no funil mas nao pagou
    // - approved: tem pagamento aprovado
    // - subscriber: assinante ativo
    switch (status) {
      case "all": 
        return users
      case "started_not_continued": 
        // Abandonou
        return users.filter(u => u.payment_status === "abandoned")
      case "not_paid": 
        // Nao pagou
        return users.filter(u => u.payment_status === "not_paid")
      case "paid": 
        // Pagou
        return users.filter(u => u.payment_status === "approved" || u.payment_status === "paid")
      case "subscribers": 
        // Assinantes
        return users.filter(u => u.payment_status === "subscriber" || u.is_subscriber)
      default: 
        return users
    }
  }

  const exportUsers = (users: BotUser[], botName: string) => {
    const csv = [
      ["ID", "Nome", "Username", "Status", "Data"].join(","),
      ...users.map(u => [
        u.telegram_user_id,
        u.first_name || "-",
        u.username || "-",
        u.payment_status || u.funnel_step || "-",
        new Date(u.created_at).toLocaleDateString("pt-BR")
      ].join(","))
    ].join("\n")
    
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `usuarios_${botName}_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalUsers = Object.values(botUsers).reduce((acc, users) => acc + users.length, 0)

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase())
    const matchesTab = activeTab === "todas" || c.status === activeTab
    return matchesSearch && matchesTab
  })

  const stats = {
    total: campaigns.length,
    ativas: campaigns.filter(c => c.status === "ativa").length,
    enviadas: campaigns.reduce((acc, c) => acc + (c.sent_count || 0), 0),
  }

  const tabs = [
    { id: "todas", label: "Todas", count: campaigns.length },
    { id: "ativa", label: "Ativas", count: campaigns.filter(c => c.status === "ativa").length },
    { id: "pausada", label: "Pausadas", count: campaigns.filter(c => c.status === "pausada").length },
    { id: "rascunho", label: "Rascunhos", count: campaigns.filter(c => c.status === "rascunho").length },
  ]

  if (!selectedBot) {
    return <NoBotSelected />
  }

  return (
    <>
      <ScrollArea className="flex-1">
        <div className="p-4 md:p-8 bg-[#f5f5f7] min-h-[calc(100vh-60px)]">
          <div className="max-w-5xl mx-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Remarketing</h1>
                <p className="text-gray-500">Reconquiste leads com campanhas automatizadas</p>
              </div>
              <button 
                onClick={() => setCreateOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1c1c1e] text-white text-sm font-medium hover:bg-[#2a2a2e] transition-colors"
              >
                <Plus className="h-4 w-4" />
                Nova Campanha
              </button>
            </div>

            {/* Stats Cards com Glow */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {/* Total */}
              <div className="relative rounded-[20px] p-5 overflow-hidden bg-[#1c1c1e]">
                <div 
                  className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
                  style={{ background: "radial-gradient(ellipse at center bottom, rgba(190, 255, 0, 0.15) 0%, transparent 70%)" }}
                />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-400 uppercase tracking-wide">Campanhas</span>
                    <div className="w-9 h-9 rounded-xl bg-[#bfff00]/20 flex items-center justify-center">
                      <Megaphone className="h-4 w-4 text-[#bfff00]" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-white">{stats.total}</p>
                  <p className="text-sm font-medium text-gray-500 mt-1">campanhas criadas</p>
                </div>
              </div>

              {/* Ativas */}
              <div className="relative rounded-[20px] p-5 overflow-hidden bg-[#1c1c1e]">
                <div 
                  className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
                  style={{ background: "radial-gradient(ellipse at center bottom, rgba(34, 197, 94, 0.15) 0%, transparent 70%)" }}
                />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-400 uppercase tracking-wide">Ativas</span>
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                      <Play className="h-4 w-4 text-emerald-400" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-emerald-400">{stats.ativas}</p>
                  <p className="text-sm font-medium text-gray-500 mt-1">em execucao</p>
                </div>
              </div>

              {/* Enviadas */}
              <div className="relative rounded-[20px] p-5 overflow-hidden bg-[#1c1c1e]">
                <div 
                  className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
                  style={{ background: "radial-gradient(ellipse at center bottom, rgba(59, 130, 246, 0.15) 0%, transparent 70%)" }}
                />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-400 uppercase tracking-wide">Enviadas</span>
                    <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <Send className="h-4 w-4 text-blue-400" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-blue-400">{stats.enviadas}</p>
                  <p className="text-sm font-medium text-gray-500 mt-1">mensagens no total</p>
                </div>
              </div>
            </div>

            {/* Section Toggle Buttons */}
            <div className="inline-flex items-center gap-1 p-1 bg-gray-100 rounded-full mb-6">
              <button
                onClick={() => setActiveSection("campanhas")}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  activeSection === "campanhas"
                    ? "bg-[#1c1c1e] text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Megaphone className="h-4 w-4" />
                Campanhas
              </button>
              <button
                onClick={() => setActiveSection("usuarios")}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  activeSection === "usuarios"
                    ? "bg-[#1c1c1e] text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Users className="h-4 w-4" />
                Usuarios
              </button>
            </div>

            {/* CAMPANHAS SECTION */}
            {activeSection === "campanhas" && (
            <>
            {/* Search and Tabs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-4">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar campanha..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-4 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100 focus:border-gray-300 transition-all"
                />
              </div>

              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[1fr_140px_100px_100px_60px] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-200">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Campanha</span>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Publico</span>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide text-center">Enviadas</span>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide text-center">Status</span>
                <span />
              </div>

              {/* Body */}
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <Megaphone className="h-5 w-5 text-gray-400" />
                  </div>
                  <p className="text-sm font-bold text-gray-900">Nenhuma campanha encontrada</p>
                  <p className="text-xs text-gray-500 mt-1">Crie sua primeira campanha de remarketing</p>
                  <button 
                    onClick={() => setCreateOpen(true)}
                    className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-[#bfff00] text-[#1c1c1e] text-sm font-semibold hover:bg-[#d4ff4d] transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Nova Campanha
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredCampaigns.map((campaign) => {
                    const audience = getAudience(campaign.audience || "not_paid")
                    const Icon = audience.icon
                    const hasMessage = campaign.nodes.some(n => n.type === "message")
                    
                    return (
                      <div key={campaign.id} className="hover:bg-gray-50 transition-colors">
                        {/* Linha principal */}
                        <div className="grid grid-cols-[1fr_140px_100px_100px_60px] gap-4 items-center px-5 py-4">
                          {/* Nome */}
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{campaign.name}</p>
                            <p className="text-xs text-gray-500">{formatDate(campaign.created_at)}</p>
                          </div>

                          {/* Publico */}
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${audience.bgClass} ${audience.textClass} w-fit`}>
                            <Icon className="h-3 w-3" />
                            {audience.label}
                          </div>

{/* Enviadas */}
                                  <div className="text-center">
                                    <p className="text-sm font-semibold text-gray-900">
                                      {campaign.sent_count || 0}
                                      <span className="text-gray-400 font-normal">/{campaign.target_count || 0}</span>
                                    </p>
                                  </div>

                          {/* Status */}
                          <div className="flex justify-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                              campaign.status === "ativa" 
                                ? "bg-emerald-100 text-emerald-700" 
                                : campaign.status === "pausada"
                                  ? "bg-amber-100 text-amber-700"
                                  : !hasMessage
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-gray-100 text-gray-600"
                            }`}>
                              {campaign.status === "ativa" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                              {!hasMessage ? "Pendente" : campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                            </span>
                          </div>

                          {/* Acoes */}
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
                                  <MoreVertical className="h-4 w-4 text-gray-500" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem 
                                  onClick={() => openConfigMessage(campaign)}
                                  className="gap-2"
                                >
                                  <MessageSquare className="h-4 w-4" />
                                  {hasMessage ? "Editar Mensagem" : "Configurar Mensagem"}
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleToggleStatus(campaign)}
                                  disabled={!hasMessage && campaign.status !== "ativa"}
                                  className="gap-2"
                                >
                                  {activating === campaign.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : campaign.status === "ativa" ? (
                                    <>
                                      <Pause className="h-4 w-4" />
                                      Pausar
                                    </>
                                  ) : (
                                    <>
                                      <Play className="h-4 w-4" />
                                      Ativar
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem className="gap-2">
                                  <Copy className="h-4 w-4" />
                                  Duplicar
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(campaign.id)}
                                  className="gap-2 text-red-600"
                                >
                                  {deleting === campaign.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Trash2 className="h-4 w-4" />
                                      Excluir
                                    </>
                                  )}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        
                        {/* Botao grande de configurar mensagem quando nao tem */}
                        {!hasMessage && (
                          <div className="px-5 pb-4">
                            <button
                              onClick={() => openConfigMessage(campaign)}
                              className="w-full flex items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:border-orange-400 transition-all"
                            >
                              <div className="w-10 h-10 rounded-full bg-orange-200 flex items-center justify-center">
                                <MessageSquare className="h-5 w-5" />
                              </div>
                              <div className="text-left">
                                <p className="font-bold text-sm">Configurar Mensagem</p>
                                <p className="text-xs text-orange-600">Configure a mensagem antes de ativar a campanha</p>
                              </div>
                              <ChevronRight className="h-5 w-5 ml-auto" />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            </>
            )}

            {/* USUARIOS SECTION */}
            {activeSection === "usuarios" && (
            <div className="space-y-4">
              {/* Info */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-sm text-gray-600">
                  Visualize e gerencie os usuarios de cada bot. Clique em um bot para expandir e ver os publicos segmentados.
                </p>
              </div>

              {/* Bots List */}
              {bots.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                  <Bot className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-bold text-gray-900">Nenhum bot encontrado</p>
                  <p className="text-xs text-gray-500 mt-1">Crie um bot primeiro para ver os usuarios</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bots.map((bot) => {
                    const users = botUsers[bot.id] || []
                    const isExpanded = expandedBots[bot.id]
                    const isLoading = loadingBotUsers[bot.id]
                    const telegramData = telegramDataCache[bot.id]
                    
                    const audiences = [
                      { id: "all", label: "Todos", count: users.length, color: "bg-gray-100 text-gray-700" },
                      { id: "started_not_continued", label: "Abandonou", count: getUsersByStatus(users, "started_not_continued").length, color: "bg-amber-100 text-amber-700" },
                      { id: "not_paid", label: "Nao pagou", count: getUsersByStatus(users, "not_paid").length, color: "bg-red-100 text-red-700" },
                      { id: "paid", label: "Pagou", count: getUsersByStatus(users, "paid").length, color: "bg-emerald-100 text-emerald-700" },
                      { id: "subscribers", label: "Assinantes", count: getUsersByStatus(users, "subscribers").length, color: "bg-blue-100 text-blue-700" },
                    ]

                    return (
                      <div key={bot.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        {/* Bot Header */}
                        <button
                          onClick={() => toggleBotExpanded(bot.id)}
                          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {telegramData?.photo_url ? (
                              <img 
                                src={telegramData.photo_url} 
                                alt={bot.name}
                                className="w-10 h-10 rounded-xl object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-[#1c1c1e] flex items-center justify-center">
                                <Bot className="h-5 w-5 text-[#bfff00]" />
                              </div>
                            )}
                            <div className="text-left">
                              <p className="font-bold text-gray-900">{bot.name}</p>
                              <p className="text-xs text-gray-500">
                                {telegramData?.username ? `@${telegramData.username}` : "@sem_username"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-gray-600">{users.length} usuarios</span>
                            <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </div>
                        </button>

                        {/* Expanded Content */}
                        {isExpanded && (
                          <div className="border-t border-gray-100 p-4 bg-gray-50">
                            {isLoading ? (
                              <div className="flex items-center justify-center py-8">
                                <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
                              </div>
                            ) : (
                              <>
                                {/* Audiences Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
                                  {audiences.map((aud) => (
                                    <div key={aud.id} className={`rounded-xl p-3 ${aud.color}`}>
                                      <p className="text-2xl font-bold">{aud.count}</p>
                                      <p className="text-xs font-medium">{aud.label}</p>
                                    </div>
                                  ))}
                                </div>

                                {/* Actions */}
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => exportUsers(users, bot.name)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                  >
                                    <Download className="h-4 w-4" />
                                    Exportar CSV
                                  </button>
                                  <button
                                    onClick={() => {
                                      setImportBotId(bot.id)
                                      setShowImportModal(true)
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                  >
                                    <Upload className="h-4 w-4" />
                                    Importar
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveSection("campanhas")
                                      setCreateOpen(true)
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1c1c1e] text-sm font-medium text-white hover:bg-[#2a2a2e] transition-colors"
                                  >
                                    <Plus className="h-4 w-4" />
                                    Nova Campanha
                                  </button>
                                </div>

                                {/* Users Preview */}
                                {users.length > 0 && (
                                  <div className="mt-4 pt-4 border-t border-gray-200">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Ultimos usuarios</p>
                                    <div className="space-y-2">
                                      {users.slice(0, 5).map((user) => (
                                        <div key={user.id} className="flex items-center justify-between py-2 px-3 bg-white rounded-lg">
                                          <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                                              {(user.first_name || "U")[0].toUpperCase()}
                                            </div>
                                            <div>
                                              <p className="text-sm font-medium text-gray-900">{user.first_name || "Usuario"}</p>
                                              <p className="text-xs text-gray-500">{user.username ? `@${user.username}` : user.telegram_user_id}</p>
                                            </div>
                                          </div>
                                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                            user.payment_status === "paid" || user.payment_status === "approved"
                                              ? "bg-emerald-100 text-emerald-700"
                                              : user.payment_status === "pending"
                                                ? "bg-amber-100 text-amber-700"
                                                : "bg-gray-100 text-gray-600"
                                          }`}>
                                            {user.payment_status || user.funnel_step || "inicio"}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                    {users.length > 5 && (
                                      <p className="text-xs text-gray-500 text-center mt-2">E mais {users.length - 5} usuarios...</p>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Create Modal - Dark Theme */}
      <Dialog open={createOpen} onOpenChange={(open) => {
        if (!open) resetModal()
        else setCreateOpen(true)
      }}>
        <DialogContent className="sm:max-w-[400px] bg-[#1c1c1e] border-[#2a2a2e] p-0 gap-0 overflow-hidden rounded-[20px] [&>button]:text-gray-400 [&>button]:hover:text-white">
          <div className="p-5">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-[#bfff00]/10 flex items-center justify-center border border-[#bfff00]/20">
                <Megaphone className="h-6 w-6 text-[#bfff00]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Nova Campanha</h2>
                <p className="text-xs text-gray-400">Etapa {step} de {audienceType === "imported" ? 3 : 4}</p>
              </div>
            </div>

            {/* Progress */}
            <div className="flex gap-1.5 mb-5">
              <div className={`flex-1 h-1 rounded-full ${step >= 1 ? "bg-[#bfff00]" : "bg-[#2a2a2e]"}`} />
              <div className={`flex-1 h-1 rounded-full ${step >= 2 ? "bg-[#bfff00]" : "bg-[#2a2a2e]"}`} />
              <div className={`flex-1 h-1 rounded-full ${step >= 3 ? "bg-[#bfff00]" : "bg-[#2a2a2e]"}`} />
              {audienceType !== "imported" && (
                <div className={`flex-1 h-1 rounded-full ${step >= 4 ? "bg-[#bfff00]" : "bg-[#2a2a2e]"}`} />
              )}
            </div>

            {/* Step 1: Nome */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-medium text-gray-400 mb-1.5 block uppercase tracking-wide">
                    Nome da Campanha
                  </Label>
                  <Input
                    placeholder="Ex: Recuperar carrinho abandonado"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && newName.trim() && setStep(2)}
                    className="bg-[#2a2a2e] border-[#3a3a3e] text-white placeholder:text-gray-500 h-12 rounded-xl focus:border-[#bfff00] focus:ring-0 focus:bg-[#2a2a2e] [&:-webkit-autofill]:!bg-[#2a2a2e] [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_#2a2a2e_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:white]"
                    autoFocus
                    autoComplete="off"
                  />
                </div>
                
                <button
                  onClick={() => setStep(2)}
                  disabled={!newName.trim()}
                  className="w-full bg-[#bfff00] text-[#1c1c1e] py-3 rounded-xl font-bold text-sm hover:bg-[#d4ff4d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Continuar
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Step 2: Escolher Bot */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-medium text-gray-400 mb-3 block uppercase tracking-wide">
                    Selecione o Bot
                  </Label>
                  <div className="space-y-2 max-h-[280px] overflow-y-auto">
                    {bots.map((bot) => (
                      <button
                        key={bot.id}
                        onClick={() => setSelectedBotId(bot.id)}
                        className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                          selectedBotId === bot.id
                            ? "bg-[#bfff00]/10 border-[#bfff00]/50"
                            : "bg-[#2a2a2e] border-[#3a3a3e] hover:border-[#4a4a4e]"
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-[#3a3a3e] flex items-center justify-center overflow-hidden">
                          {telegramDataCache[bot.id]?.photo_url ? (
                            <img src={telegramDataCache[bot.id].photo_url!} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Bot className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{bot.name}</p>
                          <p className="text-xs text-gray-500 truncate">
                            @{telegramDataCache[bot.id]?.username || "..."}
                          </p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          selectedBotId === bot.id
                            ? "border-[#bfff00] bg-[#bfff00]"
                            : "border-gray-600"
                        }`}>
                          {selectedBotId === bot.id && (
                            <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 bg-[#2a2a2e] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#3a3a3e] transition-colors"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!selectedBotId}
                    className="flex-1 bg-[#bfff00] text-[#1c1c1e] py-3 rounded-xl font-bold text-sm hover:bg-[#d4ff4d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    Continuar
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Tipo de Publico (Start ou Importados) */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-medium text-gray-400 mb-3 block uppercase tracking-wide">
                    Tipo de Publico
                  </Label>
                  <div className="space-y-2">
                    <button
                      onClick={() => setAudienceType("start")}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                        audienceType === "start"
                          ? "bg-[#bfff00]/10 border-[#bfff00]/50"
                          : "bg-[#2a2a2e] border-[#3a3a3e] hover:border-[#4a4a4e]"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Play className="h-5 w-5 text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">Usuarios Start</p>
                        <p className="text-xs text-gray-500">Usuarios que iniciaram o bot</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        audienceType === "start"
                          ? "border-[#bfff00] bg-[#bfff00]"
                          : "border-gray-600"
                      }`}>
                        {audienceType === "start" && (
                          <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>

                    <button
                      onClick={() => setAudienceType("imported")}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                        audienceType === "imported"
                          ? "bg-[#bfff00]/10 border-[#bfff00]/50"
                          : "bg-[#2a2a2e] border-[#3a3a3e] hover:border-[#4a4a4e]"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <Upload className="h-5 w-5 text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">Usuarios Importados</p>
                        <p className="text-xs text-gray-500">Usuarios importados manualmente</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        audienceType === "imported"
                          ? "border-[#bfff00] bg-[#bfff00]"
                          : "border-gray-600"
                      }`}>
                        {audienceType === "imported" && (
                          <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(2)}
                    className="flex-1 bg-[#2a2a2e] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#3a3a3e] transition-colors"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={() => {
                      if (audienceType === "imported") {
                        handleCreate()
                      } else {
                        setStep(4)
                      }
                    }}
                    disabled={!audienceType || (audienceType === "imported" && isCreating)}
                    className="flex-1 bg-[#bfff00] text-[#1c1c1e] py-3 rounded-xl font-bold text-sm hover:bg-[#d4ff4d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {audienceType === "imported" && isCreating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : audienceType === "imported" ? (
                      "Criar Campanha"
                    ) : (
                      <>
                        Continuar
                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Filtro de Publico (somente para Start) */}
            {step === 4 && audienceType === "start" && (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-medium text-gray-400 mb-3 block uppercase tracking-wide">
                    Filtrar Publico
                  </Label>
                  <div className="space-y-2">
                    {AUDIENCES.map((audience) => {
                      const Icon = audience.icon
                      return (
                        <button
                          key={audience.id}
                          onClick={() => setSelectedAudience(audience.id)}
                          className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                            selectedAudience === audience.id
                              ? "bg-[#bfff00]/10 border-[#bfff00]/50"
                              : "bg-[#2a2a2e] border-[#3a3a3e] hover:border-[#4a4a4e]"
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${audience.bgClass}`}>
                            <Icon className={`h-5 w-5 ${audience.textClass}`} />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-white">{audience.label}</p>
                            <p className="text-xs text-gray-500">{audience.description}</p>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                            selectedAudience === audience.id
                              ? "border-[#bfff00] bg-[#bfff00]"
                              : "border-gray-600"
                          }`}>
                            {selectedAudience === audience.id && (
                              <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(3)}
                    className="flex-1 bg-[#2a2a2e] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#3a3a3e] transition-colors"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={!selectedAudience || isCreating}
                    className="flex-1 bg-[#bfff00] text-[#1c1c1e] py-3 rounded-xl font-bold text-sm hover:bg-[#d4ff4d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {isCreating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Criar Campanha"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <Dialog open={showImportModal} onOpenChange={(open) => !open && resetImportModal()}>
        <DialogContent className="sm:max-w-lg bg-[#1c1c1e] border-[#2a2a2e] p-0">
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-white">Importar Usuarios</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">Importe chat IDs do Telegram para remarketing</p>
            
            <div className="space-y-4">
              {/* Mode Toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setImportMode("text")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    importMode === "text"
                      ? "bg-[#bfff00] text-black"
                      : "bg-[#2a2a2e] text-gray-400 hover:text-white"
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  Colar Texto
                </button>
                <button
                  onClick={() => setImportMode("file")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    importMode === "file"
                      ? "bg-[#bfff00] text-black"
                      : "bg-[#2a2a2e] text-gray-400 hover:text-white"
                  }`}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Upload Excel/CSV
                </button>
              </div>

              {/* Text Mode */}
              {importMode === "text" && (
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-2 block">
                    Cole os Chat IDs dos usuarios
                  </label>
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder={"123456789, 987654321, 456789123\n\nou um por linha:\n123456789\n987654321\n456789123"}
                    rows={8}
                    className="w-full px-4 py-3 bg-[#141416] border border-[#2a2a2e] rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-[#bfff00]/50 resize-none font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Aceita IDs separados por <span className="text-gray-400">virgula</span> ou <span className="text-gray-400">um por linha</span>
                  </p>
                </div>
              )}

              {/* File Mode */}
              {importMode === "file" && (
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-2 block">
                    Selecione um arquivo Excel (.xlsx) ou CSV
                  </label>
                  <div className="border-2 border-dashed border-[#2a2a2e] rounded-xl p-6 text-center hover:border-[#bfff00]/30 transition-colors">
                    <FileSpreadsheet className="h-10 w-10 text-gray-500 mx-auto mb-3" />
                    <p className="text-sm font-medium text-white mb-1">Arraste um arquivo ou clique para selecionar</p>
                    <p className="text-xs text-gray-500 mb-4">Suporta .xlsx, .xls, .csv, .txt</p>
                    <input 
                      type="file" 
                      accept=".xlsx,.xls,.csv,.txt" 
                      className="hidden" 
                      id="import-file"
                      onChange={handleFileUpload}
                    />
                    <label 
                      htmlFor="import-file"
                      className="inline-flex px-4 py-2 rounded-lg bg-[#2a2a2e] text-gray-400 hover:text-white transition-colors text-sm cursor-pointer"
                    >
                      Selecionar Arquivo
                    </label>
                  </div>
                  {importText && (
                    <div className="mt-3 p-3 bg-[#141416] rounded-lg">
                      <p className="text-xs text-gray-400 mb-1">IDs extraidos do arquivo:</p>
                      <p className="text-xs text-[#bfff00] font-mono truncate">{importText.slice(0, 100)}{importText.length > 100 ? '...' : ''}</p>
                      <p className="text-xs text-gray-500 mt-1">{importText.split(',').filter(s => s.trim()).length} IDs encontrados</p>
                    </div>
                  )}
                </div>
              )}

              {importResult && (
                <div className={`p-4 rounded-xl ${importResult.success ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-red-500/10 border border-red-500/30"}`}>
                  {importResult.success ? (
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-emerald-400">Importacao concluida!</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {importResult.imported} importados
                          {importResult.skipped ? ` - ${importResult.skipped} ja existiam` : ""}
                          {importResult.duplicates ? ` - ${importResult.duplicates} duplicados` : ""}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <UserX className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-400">{importResult.error || "Erro na importacao"}</p>
                        {importResult.parseErrors && importResult.parseErrors.length > 0 && (
                          <ul className="text-xs text-gray-400 mt-2 space-y-1">
                            {importResult.parseErrors.slice(0, 5).map((err: string, i: number) => (
                              <li key={i}>- {err}</li>
                            ))}
                            {importResult.parseErrors.length > 5 && (
                              <li>- e mais {importResult.parseErrors.length - 5} erros...</li>
                            )}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={resetImportModal}
                  className="flex-1 h-11 rounded-xl border border-[#2a2a2e] text-gray-400 hover:text-white hover:border-[#bfff00]/30 transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImportUsers}
                  disabled={!importText.trim() || importing}
                  className="flex-1 h-11 rounded-xl bg-[#bfff00] text-black font-bold text-sm hover:bg-[#a8e600] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {importing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Importar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Message Configuration Modal */}
      <Dialog open={configMessageOpen} onOpenChange={(open) => !open && resetConfigMessage()}>
        <DialogContent className="sm:max-w-lg bg-[#1c1c1e] border-[#2a2a2e] p-0 max-h-[90vh] overflow-y-auto rounded-[20px] [&>button]:text-gray-400 [&>button]:hover:text-white">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-[#bfff00]/10 flex items-center justify-center border border-[#bfff00]/20">
                <MessageSquare className="h-6 w-6 text-[#bfff00]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Configurar Mensagem</h2>
                <p className="text-xs text-gray-400">Defina a mensagem que sera enviada</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Media Upload Section - NO TOPO */}
              <div>
                <label className="text-xs font-bold text-gray-400 mb-3 block uppercase tracking-wide">
                  Midias (Opcional - ate 3 imagens/videos)
                </label>
                
                <div className="grid grid-cols-3 gap-3">
                  {[0, 1, 2].map((idx) => (
                    <div key={idx} className="relative">
                      {messageMedias[idx] ? (
                        <div className="relative group aspect-square rounded-xl overflow-hidden bg-[#2a2a2e]">
                          <img 
                            src={messageMedias[idx]} 
                            alt={`Midia ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => {
                              const newMedias = [...messageMedias]
                              newMedias.splice(idx, 1)
                              setMessageMedias(newMedias)
                            }}
                            className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <ImageUpload
                          value=""
                          onChange={(url) => {
                            if (url) {
                              const newMedias = [...messageMedias]
                              newMedias[idx] = url
                              setMessageMedias(newMedias)
                            }
                          }}
                          accept="image/*,video/*"
                          placeholder={`Midia ${idx + 1}`}
                          className="aspect-square"
                          previewClassName="aspect-square bg-[#2a2a2e] border-[#3a3a3e] hover:border-[#bfff00]/30"
                        />
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">As midias serao enviadas junto com a mensagem</p>
              </div>

              {/* Message Text */}
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wide">
                  Texto da Mensagem *
                </label>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Digite sua mensagem aqui...&#10;&#10;Voce pode usar HTML como <b>negrito</b> e <i>italico</i>"
                  rows={5}
                  className="w-full px-4 py-3 bg-[#2a2a2e] border border-[#3a3a3e] rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#bfff00]/50 resize-none"
                />
              </div>

              {/* Buttons Section */}
              <div>
                <label className="text-xs font-bold text-gray-400 mb-3 block uppercase tracking-wide">
                  Botoes (Opcional)
                </label>
                
                {/* Pre-configured buttons */}
                {loadingFlowConfig ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Ver Planos button option */}
                    {botFlowConfig?.hasPlans && (
                      <button
                        onClick={() => {
                          const hasPlansBtn = messageButtons.some(b => b.type === "plans")
                          if (hasPlansBtn) {
                            setMessageButtons(messageButtons.filter(b => b.type !== "plans"))
                          } else {
                            setMessageButtons([...messageButtons, { type: "plans", text: "Ver Planos", url: "" }])
                          }
                        }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          messageButtons.some(b => b.type === "plans")
                            ? "bg-[#bfff00]/10 border-[#bfff00] text-[#bfff00]"
                            : "bg-[#2a2a2e] border-[#3a3a3e] text-gray-400 hover:text-white hover:border-[#bfff00]/30"
                        }`}
                      >
                        <CreditCard className="h-5 w-5" />
                        <div className="text-left flex-1">
                          <p className="font-medium text-sm">Ver Planos</p>
                          <p className="text-xs opacity-70">Puxa os planos configurados no fluxo</p>
                        </div>
                        {messageButtons.some(b => b.type === "plans") && (
                          <CheckCircle2 className="h-5 w-5" />
                        )}
                      </button>
                    )}

                    {/* Packs button option */}
                    {botFlowConfig?.hasPacks && (
                      <button
                        onClick={() => {
                          const hasPacksBtn = messageButtons.some(b => b.type === "packs")
                          if (hasPacksBtn) {
                            setMessageButtons(messageButtons.filter(b => b.type !== "packs"))
                          } else {
                            setMessageButtons([...messageButtons, { type: "packs", text: "Ver Packs", url: "" }])
                          }
                        }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          messageButtons.some(b => b.type === "packs")
                            ? "bg-[#bfff00]/10 border-[#bfff00] text-[#bfff00]"
                            : "bg-[#2a2a2e] border-[#3a3a3e] text-gray-400 hover:text-white hover:border-[#bfff00]/30"
                        }`}
                      >
                        <Package className="h-5 w-5" />
                        <div className="text-left flex-1">
                          <p className="font-medium text-sm">Ver Packs</p>
                          <p className="text-xs opacity-70">Puxa os packs configurados no fluxo</p>
                        </div>
                        {messageButtons.some(b => b.type === "packs") && (
                          <CheckCircle2 className="h-5 w-5" />
                        )}
                      </button>
                    )}

                    {/* Message if no flow configured */}
                    {!botFlowConfig?.hasPlans && !botFlowConfig?.hasPacks && !loadingFlowConfig && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                        <p className="font-medium">Nenhum fluxo configurado</p>
                        <p className="opacity-70 mt-1">Vincule um fluxo com planos ou packs ao bot para habilitar os botoes</p>
                      </div>
                    )}

                    {/* Custom buttons */}
                    {messageButtons.filter(b => b.type === "custom").map((btn, idx) => (
                      <div key={`custom-${idx}`} className="flex gap-2">
                        <input
                          type="text"
                          value={btn.text}
                          onChange={(e) => {
                            const customIdx = messageButtons.findIndex((b, i) => b.type === "custom" && messageButtons.slice(0, i + 1).filter(x => x.type === "custom").length === idx + 1)
                            if (customIdx !== -1) {
                              const newBtns = [...messageButtons]
                              newBtns[customIdx].text = e.target.value
                              setMessageButtons(newBtns)
                            }
                          }}
                          placeholder="Texto do botao"
                          className="flex-1 px-3 py-2 bg-[#2a2a2e] border border-[#3a3a3e] rounded-lg text-white placeholder:text-gray-500 text-sm"
                        />
                        <input
                          type="url"
                          value={btn.url}
                          onChange={(e) => {
                            const customIdx = messageButtons.findIndex((b, i) => b.type === "custom" && messageButtons.slice(0, i + 1).filter(x => x.type === "custom").length === idx + 1)
                            if (customIdx !== -1) {
                              const newBtns = [...messageButtons]
                              newBtns[customIdx].url = e.target.value
                              setMessageButtons(newBtns)
                            }
                          }}
                          placeholder="URL"
                          className="flex-1 px-3 py-2 bg-[#2a2a2e] border border-[#3a3a3e] rounded-lg text-white placeholder:text-gray-500 text-sm"
                        />
                        <button
                          onClick={() => {
                            const customIdx = messageButtons.findIndex((b, i) => b.type === "custom" && messageButtons.slice(0, i + 1).filter(x => x.type === "custom").length === idx + 1)
                            if (customIdx !== -1) {
                              setMessageButtons(messageButtons.filter((_, i) => i !== customIdx))
                            }
                          }}
                          className="w-10 h-10 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}

                    {/* Add custom button */}
                    {messageButtons.length < 3 && (
                      <button
                        onClick={() => setMessageButtons([...messageButtons, { type: "custom", text: "", url: "" }])}
                        className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-[#3a3a3e] text-gray-400 hover:text-white hover:border-[#bfff00]/30 transition-all text-sm"
                      >
                        <Plus className="h-4 w-4" />
                        Adicionar Botao Personalizado
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={resetConfigMessage}
                  className="flex-1 h-12 rounded-xl border border-[#2a2a2e] text-gray-400 hover:text-white hover:border-[#bfff00]/30 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveMessage}
                  disabled={!messageText.trim() || savingMessage}
                  className="flex-1 h-12 rounded-xl bg-[#bfff00] text-black font-bold hover:bg-[#a8e600] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {savingMessage ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Salvar Mensagem
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

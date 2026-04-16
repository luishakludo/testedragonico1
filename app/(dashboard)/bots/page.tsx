"use client"

import { useState, useEffect, useCallback } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import {
  Plus, Search, Bot as BotIcon, MoreVertical, Trash2, Settings,
  Loader2, CheckCircle2, LayoutGrid, List, ChevronRight, Signal, X, AtSign, Save, Users, DollarSign, Workflow, Power, RefreshCw
} from "lucide-react"
import { useRouter } from "next/navigation"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useBots, type Bot } from "@/lib/bot-context"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { AvatarUpload } from "@/components/avatar-upload"

interface TelegramBotData {
  telegram_bot_id: number
  name: string
  username: string
  description: string
  short_description: string
  photo_url: string | null
  can_join_groups: boolean
  can_read_all_group_messages: boolean
  supports_inline_queries: boolean
  commands: Array<{ command: string; description: string }>
}

interface ExtendedBot extends Bot {
  telegram_bot_id?: number
  username?: string
  description?: string
  short_description?: string
  photo_url?: string | null
}

export default function BotsPage() {
  const { bots, selectedBot, setSelectedBot, addBot, updateBot, deleteBot } = useBots()
  const { toast } = useToast()
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  // Create Bot Modal - Simplificado (apenas token)
  const [createOpen, setCreateOpen] = useState(false)
  const [newBotToken, setNewBotToken] = useState("")
  const [isValidating, setIsValidating] = useState(false)
  const [validatedBot, setValidatedBot] = useState<TelegramBotData | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Config Modal - Minimalista
  const [configBot, setConfigBot] = useState<ExtendedBot | null>(null)
  const [cfgName, setCfgName] = useState("")
  const [cfgDescription, setCfgDescription] = useState("")
  const [cfgShortDescription, setCfgShortDescription] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingConfig, setIsLoadingConfig] = useState(false)
  const [cfgPhoto, setCfgPhoto] = useState<File | null>(null)
  const [cfgPhotoPreview, setCfgPhotoPreview] = useState<string | null>(null)
  
  // Cache de dados do Telegram (foto, username, etc.)
  const [telegramDataCache, setTelegramDataCache] = useState<Record<string, TelegramBotData>>({})
  const [isLoadingTelegramData, setIsLoadingTelegramData] = useState(false)
  
  // Trocar token modal
  const [changeTokenBot, setChangeTokenBot] = useState<Bot | null>(null)
  const [newToken, setNewToken] = useState("")
  const [isChangingToken, setIsChangingToken] = useState(false)
  
  // Cache de fluxos vinculados aos bots
  const [botFlowsCache, setBotFlowsCache] = useState<Record<string, { id: string; name: string } | null>>({})
  
  // Cache de stats (leads e vendas) por bot
  const [botStatsCache, setBotStatsCache] = useState<Record<string, { leads: number; vendas: number }>>({})
  
  // Carregar stats (leads e vendas) para cada bot
  const loadBotStats = useCallback(async (botsToLoad: Bot[]) => {
    const newCache: Record<string, { leads: number; vendas: number }> = { ...botStatsCache }
    
    await Promise.all(botsToLoad.map(async (bot) => {
      try {
        // Buscar leads (conversations/starts)
        const conversationsRes = await fetch(`/api/conversations?bot_id=${bot.id}&period=year`)
        const conversationsData = await conversationsRes.json()
        const leads = conversationsData?.total || 0
        
        // Buscar vendas (pagamentos aprovados)
        const paymentsRes = await fetch(`/api/payments/list?botId=${bot.id}&limit=1`)
        const paymentsData = await paymentsRes.json()
        const vendas = paymentsData?.stats?.approved || 0
        
        newCache[bot.id] = { leads, vendas }
      } catch {
        newCache[bot.id] = { leads: 0, vendas: 0 }
      }
    }))
    
    setBotStatsCache(newCache)
  }, [botStatsCache])
  
  // Carregar stats quando bots mudam
  useEffect(() => {
    if (bots.length > 0) {
      loadBotStats(bots)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bots])
  
  // Carregar fluxos vinculados aos bots (busca em flows.bot_id E flow_bots)
  const loadBotFlows = useCallback(async (botsToLoad: Bot[]) => {
    const newCache: Record<string, { id: string; name: string } | null> = { ...botFlowsCache }
    
    await Promise.all(botsToLoad.map(async (bot) => {
      // Primeiro tenta por flows.bot_id
      let { data: flow } = await supabase
        .from("flows")
        .select("id, name")
        .eq("bot_id", bot.id)
        .eq("status", "ativo")
        .limit(1)
        .single()
      
      // Se nao encontrou, tenta por flow_bots
      if (!flow) {
        const { data: flowBot } = await supabase
          .from("flow_bots")
          .select("flow_id")
          .eq("bot_id", bot.id)
          .limit(1)
          .single()
        
        if (flowBot) {
          const { data: linkedFlow } = await supabase
            .from("flows")
            .select("id, name")
            .eq("id", flowBot.flow_id)
            .single()
          
          flow = linkedFlow
        }
      }
      
      newCache[bot.id] = flow || null
    }))
    
    setBotFlowsCache(newCache)
  }, [botFlowsCache])
  
  // Carregar fluxos quando bots mudam
  useEffect(() => {
    if (bots.length > 0) {
      loadBotFlows(bots)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bots])
  
  // Carregar dados do Telegram para todos os bots
  const loadTelegramData = useCallback(async (botsToLoad: Bot[]) => {
    // Verificar quais bots precisam carregar
    const botsNeedingData = botsToLoad.filter(bot => !telegramDataCache[bot.id])
    if (botsNeedingData.length === 0) return
    
    setIsLoadingTelegramData(true)
    const newCache: Record<string, TelegramBotData> = { ...telegramDataCache }
    
    // Carregar em paralelo
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
            newCache[bot.id] = data.bot
          }
        }
      } catch {
        // Ignora erros de validação
      }
    }))
    
    setTelegramDataCache(newCache)
    setIsLoadingTelegramData(false)
  }, [telegramDataCache])
  
  // Carregar dados do Telegram quando bots mudam
  useEffect(() => {
    if (bots.length > 0) {
      loadTelegramData(bots)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bots])
  
  // Função para obter dados extendidos de um bot
  const getExtendedBot = useCallback((bot: Bot): ExtendedBot => {
    const telegramData = telegramDataCache[bot.id]
    return {
      ...bot,
      username: telegramData?.username,
      description: telegramData?.description,
      short_description: telegramData?.short_description,
      photo_url: telegramData?.photo_url,
      telegram_bot_id: telegramData?.telegram_bot_id,
    }
  }, [telegramDataCache])

  const filteredBots = bots.filter(
    (bot) =>
      bot.name.toLowerCase().includes(search.toLowerCase()) ||
      bot.token.toLowerCase().includes(search.toLowerCase())
  )

  // Validar token e buscar dados do bot
  async function handleValidateToken() {
    if (!newBotToken.trim()) return
    
    setIsValidating(true)
    setValidatedBot(null)
    
    try {
      const response = await fetch("/api/telegram/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: newBotToken.trim() }),
      })
      
      const data = await response.json()
      
      if (!response.ok || data.error) {
        toast({
          title: "Erro",
          description: data.error || "Token inválido ou bot não encontrado",
          variant: "destructive",
        })
        return
      }
      
      setValidatedBot(data.bot)
    } catch {
      toast({
        title: "Erro",
        description: "Erro ao validar token",
        variant: "destructive",
      })
    } finally {
      setIsValidating(false)
    }
  }

  // Criar bot após validação
  async function handleCreateBot() {
    if (!validatedBot) return
    
    setIsCreating(true)
    try {
      const createdBot = await addBot({ 
        name: validatedBot.name, 
        token: newBotToken.trim() 
      })
      
      // Registrar webhook
      await fetch("/api/telegram/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken: createdBot.token, action: "register" }),
      })
      
      toast({
        title: "Sucesso",
        description: "Bot conectado com sucesso!",
      })
      
      setCreateOpen(false)
      setNewBotToken("")
      setValidatedBot(null)
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Erro ao criar bot",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  // Abrir configurações e buscar dados atualizados do Telegram
  async function openConfig(bot: Bot) {
    const extendedBot = bot as ExtendedBot
    setConfigBot(extendedBot)
    setCfgName(bot.name)
    setCfgDescription("")
    setCfgShortDescription("")
    setIsLoadingConfig(true)
    
    // Buscar dados atualizados do Telegram
    try {
      const response = await fetch("/api/telegram/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: bot.token }),
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.bot) {
          const updatedBot: ExtendedBot = {
            ...extendedBot,
            name: data.bot.name || extendedBot.name,
            username: data.bot.username,
            description: data.bot.description || "",
            short_description: data.bot.short_description || "",
            photo_url: data.bot.photo_url,
          }
          setConfigBot(updatedBot)
          setCfgName(data.bot.name || bot.name)
          setCfgDescription(data.bot.description || "")
          setCfgShortDescription(data.bot.short_description || "")
        }
      }
    } catch {
      // Se falhar ao buscar, usa os dados locais
      setCfgName(bot.name)
      setCfgDescription(extendedBot.description || "")
      setCfgShortDescription(extendedBot.short_description || "")
    } finally {
      setIsLoadingConfig(false)
    }
  }

  // Fechar configurações
  function closeConfig() {
    setConfigBot(null)
    setCfgName("")
    setCfgDescription("")
    setCfgShortDescription("")
    setIsLoadingConfig(false)
    setCfgPhoto(null)
    setCfgPhotoPreview(null)
  }

  // Salvar configuracoes
  async function handleSaveConfig() {
    if (!configBot) return
    
    setIsSaving(true)
    const hadPhoto = !!cfgPhoto
    
    try {
      const formData = new FormData()
      formData.append("token", configBot.token)
      formData.append("name", cfgName.trim())
      formData.append("description", cfgDescription.trim())
      formData.append("shortDescription", cfgShortDescription.trim())
      
      if (cfgPhoto) {
        formData.append("photo", cfgPhoto)
      }
      
      const response = await fetch("/api/telegram/update", {
        method: "POST",
        body: formData,
      })
      
      const result = await response.json()
      
      await updateBot(configBot.id, {
        name: cfgName.trim() || configBot.name,
      })
      
      const photoFailed = hadPhoto && result.results?.photo === false
      const photoError = result.results?.photoError
      
      if (photoFailed) {
        toast({
          title: "Erro na foto",
          description: `Erro do Telegram: ${photoError || "desconhecido"}. Tente PNG quadrado < 5MB.`,
          variant: "destructive",
        })
      }
      
      // Buscar dados atualizados do Telegram
      const validateResponse = await fetch("/api/telegram/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: configBot.token }),
      })
      
      if (validateResponse.ok) {
        const validateData = await validateResponse.json()
        
        if (validateData.bot) {
          let photoUrl = validateData.bot.photo_url
          if (photoUrl && hadPhoto && !photoFailed) {
            photoUrl = `${photoUrl}${photoUrl.includes('?') ? '&' : '?'}t=${Date.now()}`
          }
          
          setTelegramDataCache(prev => ({
            ...prev,
            [configBot.id]: {
              ...validateData.bot,
              photo_url: photoUrl
            }
          }))
          
          const updatedBot: ExtendedBot = { 
            ...configBot, 
            name: cfgName.trim() || configBot.name,
            description: validateData.bot.description,
            short_description: validateData.bot.short_description,
            photo_url: photoUrl,
          }
          setConfigBot(updatedBot)
        }
      }
      
      setCfgPhoto(null)
      setCfgPhotoPreview(null)
      
      if (!photoFailed) {
        toast({
          title: "Sucesso",
          description: hadPhoto ? "Foto e configuracoes salvas!" : "Alteracoes salvas com sucesso!",
        })
      }
    } catch {
      toast({
        title: "Erro",
        description: "Erro ao salvar alteracoes",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Toggle rapido de ativar/desativar bot
  async function handleQuickToggle(bot: Bot, e: React.MouseEvent) {
    e.stopPropagation()
    const newStatus = bot.status === "active" ? "inactive" : "active"
    
    try {
      await updateBot(bot.id, { status: newStatus })
      await fetch("/api/telegram/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken: bot.token, action: newStatus === "active" ? "register" : "unregister" }),
      })
      
      toast({
        title: newStatus === "active" ? "Bot ativado" : "Bot desativado",
        description: newStatus === "active" ? "O bot esta online e recebendo mensagens" : "O bot esta offline",
      })
    } catch {
      toast({
        title: "Erro",
        description: "Nao foi possivel alterar o status do bot",
        variant: "destructive",
      })
    }
  }

  // Trocar token do bot
  async function handleChangeToken() {
    if (!changeTokenBot || !newToken.trim()) return
    
    setIsChangingToken(true)
    try {
      // Validar novo token
      const response = await fetch("/api/telegram/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: newToken.trim() }),
      })
      
      const data = await response.json()
      
      if (!response.ok || data.error) {
        toast({
          title: "Erro",
          description: data.error || "Token invalido",
          variant: "destructive",
        })
        setIsChangingToken(false)
        return
      }
      
      // Desregistrar webhook antigo
      await fetch("/api/telegram/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken: changeTokenBot.token, action: "unregister" }),
      })
      
      // Atualizar token no banco
      await updateBot(changeTokenBot.id, { 
        token: newToken.trim(),
        name: data.bot.name || changeTokenBot.name,
      })
      
      // Registrar novo webhook
      await fetch("/api/telegram/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken: newToken.trim(), action: "register" }),
      })
      
      // Limpar cache do Telegram para este bot
      setTelegramDataCache(prev => {
        const next = { ...prev }
        delete next[changeTokenBot.id]
        return next
      })
      
      toast({
        title: "Token atualizado",
        description: "O bot foi atualizado com o novo token",
      })
      
      setChangeTokenBot(null)
      setNewToken("")
    } catch {
      toast({
        title: "Erro",
        description: "Erro ao trocar token",
        variant: "destructive",
      })
    } finally {
      setIsChangingToken(false)
    }
  }

  // Excluir bot
  async function handleDelete(id: string) {
    try {
      const b = bots.find((b) => b.id === id)
      if (b) {
        await fetch("/api/telegram/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ botToken: b.token, action: "unregister" }),
        })
      }
      await deleteBot(id)
      if (configBot?.id === id) closeConfig()
      
      toast({
        title: "Sucesso",
        description: "Bot excluído com sucesso!",
      })
    } catch {
      toast({
        title: "Erro",
        description: "Erro ao excluir bot",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden bg-[#f8f9fa]">
      {/* Header */}
      <header className="px-4 md:px-8 py-6 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1a1a1a] tracking-tight">Meus Bots</h1>
          <p className="text-sm text-gray-500 mt-0.5">{bots.length} bot(s) cadastrado(s)</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1 bg-white rounded-xl p-1 border border-gray-200 shadow-sm">
            <button
              onClick={() => setViewMode("grid")}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                viewMode === "grid" ? "bg-[#1c1c1e] text-white" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                viewMode === "list" ? "bg-[#1c1c1e] text-white" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 bg-[#bfff00] text-[#1c1c1e] px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#d4ff4d] transition-colors shadow-lg shadow-[#bfff00]/20"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo Bot</span>
          </button>
        </div>
      </header>

      {/* Create Bot Dialog - Design escuro com verde */}
      <Dialog open={createOpen} onOpenChange={(open) => {
        setCreateOpen(open)
        if (!open) {
          setNewBotToken("")
          setValidatedBot(null)
        }
      }}>
        <DialogContent className="sm:max-w-[400px] bg-[#1c1c1e] border-[#2a2a2e] p-0 gap-0 overflow-hidden rounded-[20px] [&>button]:text-gray-400 [&>button]:hover:text-white">
          <div className="p-5">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-[#bfff00]/10 flex items-center justify-center border border-[#bfff00]/20">
                <BotIcon className="h-6 w-6 text-[#bfff00]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Conectar Bot</h2>
                <p className="text-xs text-gray-400">Cole o token do Telegram</p>
              </div>
            </div>

            {/* Se ainda não validou - mostra input de token */}
            {!validatedBot ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-medium text-gray-400 mb-1.5 block uppercase tracking-wide">
                    Token do Bot
                  </Label>
                  <Input
                    placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                    value={newBotToken}
                    onChange={(e) => setNewBotToken(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleValidateToken()}
                    className="h-11 bg-[#2a2a2e] border-[#3a3a3e] rounded-lg font-mono text-sm text-white placeholder:text-gray-500 focus:border-[#bfff00]"
                    autoFocus
                  />
                  <p className="text-[11px] text-gray-500 mt-1.5">
                    Pegue o token com o @BotFather no Telegram
                  </p>
                </div>

                <button
                  onClick={handleValidateToken}
                  disabled={isValidating || !newBotToken.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-[#bfff00] text-[#1c1c1e] h-11 rounded-lg font-semibold text-sm hover:bg-[#d4ff4d] transition-colors disabled:opacity-50"
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Validando...
                    </>
                  ) : (
                    "Conectar Bot"
                  )}
                </button>
              </div>
            ) : (
              /* Bot validado - mostra card de confirmação */
              <div className="space-y-4">
                <div className="bg-[#2a2a2e] rounded-xl p-4 border border-[#3a3a3e]">
                  <div className="flex items-center gap-3">
                    {validatedBot.photo_url ? (
                      <img
                        src={validatedBot.photo_url}
                        alt={validatedBot.name}
                        className="w-14 h-14 rounded-xl object-cover border border-[#3a3a3e]"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-[#bfff00]/10 flex items-center justify-center border border-[#bfff00]/20">
                        <BotIcon className="h-7 w-7 text-[#bfff00]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white text-base truncate">
                        {validatedBot.name}
                      </h3>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <AtSign className="h-3 w-3" />
                        {validatedBot.username}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#bfff00]/10 text-[#bfff00]">
                      <CheckCircle2 className="h-3 w-3" />
                      <span className="text-[10px] font-medium">OK</span>
                    </div>
                  </div>
                  
                  {validatedBot.short_description && (
                    <p className="text-xs text-gray-400 mt-3 line-clamp-2">
                      {validatedBot.short_description}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setValidatedBot(null)
                      setNewBotToken("")
                    }}
                    className="flex-1 h-10 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-[#2a2a2e] transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateBot}
                    disabled={isCreating}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#bfff00] text-[#1c1c1e] h-10 rounded-lg font-semibold text-sm hover:bg-[#d4ff4d] transition-colors disabled:opacity-50"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Conectando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Confirmar
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Config Bot Dialog - Design escuro compacto com glow */}
      <Dialog open={!!configBot} onOpenChange={(open) => !open && closeConfig()}>
        <DialogContent className="sm:max-w-[400px] bg-[#1c1c1e] border-[#2a2a2e] p-0 gap-0 overflow-hidden rounded-[20px] [&>button]:text-gray-400 [&>button]:hover:text-white">
          {configBot && (
            <>
              {/* Loading state */}
              {isLoadingConfig ? (
                <div className="p-8 flex flex-col items-center justify-center">
                  <Loader2 className="h-6 w-6 text-[#bfff00] animate-spin mb-2" />
                  <p className="text-gray-400 text-sm">Carregando...</p>
                </div>
              ) : (
                <>
                  {/* Header compacto com glow */}
                  <div className="relative pt-5 pb-4 px-5 text-center">
                    {/* Glow verde */}
                    <div 
                      className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
                      style={{
                        background: "radial-gradient(ellipse at center bottom, rgba(190, 255, 0, 0.1) 0%, transparent 70%)"
                      }}
                    />
                    
                    {/* Foto com drag & drop e crop */}
                    <AvatarUpload
                      currentPhoto={
                        cfgPhotoPreview || 
                        ((configBot as ExtendedBot).photo_url 
                          ? `${(configBot as ExtendedBot).photo_url}${(configBot as ExtendedBot).photo_url!.includes('?') ? '&' : '?'}t=${Date.now()}`
                          : null
                        )
                      }
                      onPhotoSelect={(file) => {
                        setCfgPhoto(file)
                        // Gerar preview imediato
                        const reader = new FileReader()
                        reader.onloadend = () => {
                          setCfgPhotoPreview(reader.result as string)
                        }
                        reader.readAsDataURL(file)
                      }}
                      size="md"
                      showStatus
                      statusActive={configBot.status === "active"}
                      placeholder={<BotIcon className="h-7 w-7 text-[#bfff00]" />}
                      className="mb-2"
                    />
                    
                    <h2 className="text-base font-bold text-white">Configuracoes do Bot</h2>
                    <p className="text-[11px] text-gray-400">Clique na foto para alterar</p>
                    
                    {/* Toggle de status */}
                    <div className="flex items-center justify-center gap-2.5 mt-3 bg-[#2a2a2e] rounded-full px-4 py-2 mx-auto w-fit">
                      <span className={`text-xs font-medium ${configBot.status !== "active" ? "text-white" : "text-gray-500"}`}>
                        Offline
                      </span>
                      <Switch
                        checked={configBot.status === "active"}
                        onCheckedChange={async (checked) => {
                          await updateBot(configBot.id, { status: checked ? "active" : "inactive" })
                          setConfigBot({ ...configBot, status: checked ? "active" : "inactive" })
                          await fetch("/api/telegram/register", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ botToken: configBot.token, action: checked ? "register" : "unregister" }),
                          })
                        }}
                        className="data-[state=checked]:bg-[#bfff00]"
                      />
                      <span className={`text-xs font-medium ${configBot.status === "active" ? "text-[#bfff00]" : "text-gray-500"}`}>
                        Online
                      </span>
                    </div>
                  </div>

                  {/* Campos editaveis */}
                  <div className="px-5 pb-4 space-y-3 border-t border-[#2a2a2e] pt-4">
                    {/* Nome */}
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Nome</Label>
                      <Input 
                        value={cfgName} 
                        onChange={(e) => setCfgName(e.target.value)} 
                        className="h-10 bg-[#2a2a2e] border-[#3a3a3e] rounded-lg text-sm text-white placeholder:text-gray-500 focus:border-[#bfff00]" 
                        placeholder="Nome do bot"
                      />
                    </div>

                    {/* Username */}
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                        <AtSign className="h-2.5 w-2.5" />Username
                      </Label>
                      <Input 
                        value={(configBot as ExtendedBot).username || ""} 
                        disabled
                        className="h-10 bg-[#232325] border-[#2a2a2e] rounded-lg text-sm text-gray-500" 
                      />
                    </div>

                    {/* Bio */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Bio</Label>
                        <span className="text-[10px] text-gray-500">{cfgShortDescription.length}/120</span>
                      </div>
                      <Input 
                        value={cfgShortDescription} 
                        onChange={(e) => setCfgShortDescription(e.target.value)} 
                        className="h-10 bg-[#2a2a2e] border-[#3a3a3e] rounded-lg text-sm text-white placeholder:text-gray-500 focus:border-[#bfff00]" 
                        placeholder="Descricao curta"
                        maxLength={120}
                      />
                    </div>

                    {/* Descricao */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Descricao</Label>
                        <span className="text-[10px] text-gray-500">{cfgDescription.length}/512</span>
                      </div>
                      <Textarea 
                        value={cfgDescription} 
                        onChange={(e) => setCfgDescription(e.target.value)} 
                        className="min-h-[70px] bg-[#2a2a2e] border-[#3a3a3e] rounded-lg resize-none text-sm text-white placeholder:text-gray-500 focus:border-[#bfff00]" 
                        placeholder="O que seu bot faz?"
                        maxLength={512}
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-5 py-3 bg-[#18181a] border-t border-[#2a2a2e] flex items-center justify-between">
                    <button
                      onClick={() => handleDelete(configBot.id)}
                      className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir Bot
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={closeConfig}
                        className="px-4 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-[#2a2a2e] transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveConfig}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 bg-[#bfff00] text-[#1c1c1e] px-5 py-2 rounded-lg font-semibold text-xs hover:bg-[#d4ff4d] disabled:opacity-50 transition-colors"
                      >
                        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        {isSaving ? "Salvando..." : "Salvar"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Change Token Dialog - Design escuro */}
      <Dialog open={!!changeTokenBot} onOpenChange={(open) => !open && setChangeTokenBot(null)}>
        <DialogContent className="sm:max-w-[400px] bg-[#1c1c1e] border-[#2a2a2e] p-0 gap-0 overflow-hidden rounded-[20px] [&>button]:text-gray-400 [&>button]:hover:text-white">
          <div className="p-5">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-[#bfff00]/10 flex items-center justify-center border border-[#bfff00]/20">
                <RefreshCw className="h-5 w-5 text-[#bfff00]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Trocar Token</h2>
                <p className="text-xs text-gray-400">{changeTokenBot?.name}</p>
              </div>
            </div>
            
            {/* Input */}
            <div className="space-y-1.5 mb-4">
              <Label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Novo Token
              </Label>
              <Input
                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
                className="h-11 bg-[#2a2a2e] border-[#3a3a3e] rounded-lg font-mono text-sm text-white placeholder:text-gray-500 focus:border-[#bfff00]"
              />
              <p className="text-[11px] text-gray-500">
                Use quando seu bot for banido. Os dados serao mantidos.
              </p>
            </div>
          </div>
          
          {/* Footer */}
          <div className="px-5 py-3 bg-[#18181a] border-t border-[#2a2a2e] flex items-center justify-end gap-2">
            <button
              onClick={() => setChangeTokenBot(null)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-[#2a2a2e] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleChangeToken}
              disabled={isChangingToken || !newToken.trim()}
              className="flex items-center gap-2 bg-[#bfff00] text-[#1c1c1e] px-4 py-2 rounded-lg font-semibold text-sm hover:bg-[#d4ff4d] disabled:opacity-50 transition-colors"
            >
              {isChangingToken ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Trocando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Trocar Token
                </>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-8">
        {/* Search */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar bots..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white rounded-xl border border-gray-200 pl-12 pr-4 py-3 text-sm text-[#1a1a1a] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#bfff00]/30 focus:border-[#bfff00] transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Empty State */}
        {bots.length === 0 ? (
          <div className="relative bg-[#1c1c1e] rounded-[28px] p-12 text-center overflow-hidden">
            {/* Glow verde */}
            <div 
              className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
              style={{
                background: "radial-gradient(ellipse at center bottom, rgba(190, 255, 0, 0.15) 0%, transparent 70%)"
              }}
            />
            <div className="relative z-10">
              <div className="w-24 h-24 rounded-3xl bg-[#bfff00]/10 flex items-center justify-center mx-auto mb-6">
                <BotIcon className="h-12 w-12 text-[#bfff00]" />
              </div>
              <h3 className="text-xl font-bold text-white">Nenhum bot conectado</h3>
              <p className="text-gray-400 mt-2 mb-6 max-w-sm mx-auto">
                Conecte seu primeiro bot em apenas 1 passo
              </p>
              <button
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-2 bg-[#bfff00] text-[#1c1c1e] px-6 py-3 rounded-xl font-semibold text-sm hover:bg-[#d4ff4d] transition-colors shadow-lg shadow-[#bfff00]/20"
              >
                <Plus className="h-4 w-4" />
                Conectar Bot
              </button>
            </div>
          </div>
        ) : viewMode === "grid" ? (
          /* Grid View - Cards escuros com glow */
          <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredBots.map((bot) => {
              const isSelected = selectedBot?.id === bot.id
              const isActive = bot.status === "active"
              const extendedBot = getExtendedBot(bot)
              
              return (
                <div
                  key={bot.id}
                  className={`relative bg-[#1c1c1e] rounded-[20px] overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1 group ${
                    isSelected ? "ring-2 ring-[#bfff00]" : ""
                  }`}
                >
                  {/* Glow verde na parte inferior */}
                  <div 
                    className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
                    style={{
                      background: isActive 
                        ? "radial-gradient(ellipse at center bottom, rgba(190, 255, 0, 0.12) 0%, transparent 70%)"
                        : "radial-gradient(ellipse at center bottom, rgba(100, 100, 100, 0.1) 0%, transparent 70%)"
                    }}
                  />
                  
                  {/* Topo com foto e status */}
                  <div className="relative pt-3 pb-3 px-3 flex flex-col items-center">
                    {/* Menu no canto */}
                    <div className="absolute top-2 right-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-3.5 w-3.5 text-gray-400" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-lg bg-[#2a2a2e] border-[#3a3a3e]">
                          <DropdownMenuItem
                            className="flex items-center gap-2 py-2 cursor-pointer text-sm text-white hover:bg-white/10"
                            onClick={(e) => { e.stopPropagation(); openConfig(bot) }}
                          >
                            <Settings className="h-3.5 w-3.5" />
                            Configurar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="flex items-center gap-2 py-2 cursor-pointer text-sm text-white hover:bg-white/10"
                            onClick={(e) => { 
                              e.stopPropagation()
                              setChangeTokenBot(bot)
                              setNewToken("")
                            }}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Trocar Token
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="flex items-center gap-2 py-2 cursor-pointer text-sm text-red-400 hover:bg-white/10"
                            onClick={(e) => { e.stopPropagation(); handleDelete(bot.id) }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Badge de status */}
                    <div className="absolute top-2 left-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${
                        isActive 
                          ? "bg-[#bfff00]/20 text-[#bfff00]" 
                          : "bg-gray-600/30 text-gray-400"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-[#bfff00] animate-pulse" : "bg-gray-500"}`} />
                        {isActive ? "ONLINE" : "OFFLINE"}
                      </span>
                    </div>

                    {/* Foto do bot com cache-busting */}
                    <div className="mt-5">
                      {isLoadingTelegramData && !telegramDataCache[bot.id] ? (
                        <div className="w-16 h-16 rounded-xl bg-[#2a2a2e] animate-pulse" />
                      ) : extendedBot.photo_url ? (
                        <img
                          src={`${extendedBot.photo_url}${extendedBot.photo_url.includes('?') ? '&' : '?'}cb=${bot.id}`}
                          alt={bot.name}
                          className="w-16 h-16 rounded-xl object-cover border-2 border-[#3a3a3e]"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
                          isActive ? "bg-[#bfff00]/10" : "bg-[#2a2a2e]"
                        }`}>
                          <BotIcon className={`h-7 w-7 ${isActive ? "text-[#bfff00]" : "text-gray-500"}`} />
                        </div>
                      )}
                    </div>

                    {/* Nome do bot */}
                    <h3 className="text-base font-bold text-white text-center mt-2.5 truncate max-w-full">
                      {bot.name}
                    </h3>

                    {/* Username com badge */}
                    {extendedBot.username && (
                      <div className="mt-1.5 px-3 py-1 bg-[#2a2a2e] rounded-full">
                        <p className="text-xs text-gray-400 flex items-center gap-0.5">
                          <AtSign className="h-3 w-3" />
                          {extendedBot.username}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Estatisticas */}
                  <div className="px-3 py-2.5 border-t border-[#2a2a2e]">
                    <div className="grid grid-cols-2">
                      <div className="text-center">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Leads</p>
                        <p className="text-lg font-bold text-white">{botStatsCache[bot.id]?.leads ?? 0}</p>
                      </div>
                      <div className="text-center border-l border-[#2a2a2e]">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Vendas</p>
                        <p className="text-lg font-bold text-white">{botStatsCache[bot.id]?.vendas ?? 0}</p>
                      </div>
                    </div>
                  </div>

                  {/* Fluxo Vinculado */}
                  <div className="px-3 py-2.5 border-t border-[#2a2a2e]">
                    {botFlowsCache[bot.id] ? (
                      <div className="flex items-center gap-2 justify-center bg-[#bfff00]/10 rounded-lg py-1.5 px-3">
                        <Workflow className="h-3.5 w-3.5 text-[#bfff00]" />
                        <span className="text-xs font-medium text-white truncate max-w-[100px]">
                          {botFlowsCache[bot.id]?.name}
                        </span>
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#bfff00]" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 justify-center text-gray-500 bg-[#2a2a2e]/50 rounded-lg py-1.5 px-3">
                        <Workflow className="h-3.5 w-3.5" />
                        <span className="text-xs">Sem fluxo vinculado</span>
                      </div>
                    )}
                  </div>

                  {/* Botoes de acao */}
                  <div className="relative z-10 px-3 pb-3 flex gap-2">
                    {/* Toggle Ativar/Desativar */}
                    <button
                      onClick={(e) => handleQuickToggle(bot, e)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                        isActive 
                          ? "bg-gradient-to-r from-red-500/20 to-red-600/20 hover:from-red-500/30 hover:to-red-600/30 text-red-400 border border-red-500/20" 
                          : "bg-gradient-to-r from-[#bfff00]/20 to-[#9acd00]/20 hover:from-[#bfff00]/30 hover:to-[#9acd00]/30 text-[#bfff00] border border-[#bfff00]/20"
                      }`}
                    >
                      <Power className="h-3.5 w-3.5" />
                      {isActive ? "Desativar" : "Ativar"}
                    </button>
                    {/* Ir para Fluxos */}
                    <button
                      onClick={(e) => { 
                        e.stopPropagation()
                        setSelectedBot(bot)
                        router.push("/fluxos")
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#2a2a2e] hover:bg-[#bfff00] hover:text-[#1c1c1e] text-gray-400 font-semibold text-xs transition-all border border-[#3a3a3e] hover:border-[#bfff00]"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                      Fluxos
                    </button>
                  </div>

                  {/* Selected Badge */}
                  {isSelected && (
                    <div className="py-2 bg-[#bfff00]/10 border-t border-[#bfff00]/20">
                      <p className="text-[11px] font-medium text-[#bfff00] text-center flex items-center justify-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Bot selecionado
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          /* List View */
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            {filteredBots.map((bot, index) => {
              const isSelected = selectedBot?.id === bot.id
              const isActive = bot.status === "active"
              const extendedBot = getExtendedBot(bot)
              
              return (
                <div
                  key={bot.id}
                  onClick={() => setSelectedBot(bot)}
                  className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                    index !== filteredBots.length - 1 ? "border-b border-gray-100" : ""
                  } ${isSelected ? "bg-[#bfff00]/5" : ""}`}
                >
                  {/* Icon */}
                  {isLoadingTelegramData && !telegramDataCache[bot.id] ? (
                    <div className="w-12 h-12 rounded-xl bg-gray-100 animate-pulse flex-shrink-0" />
                  ) : extendedBot.photo_url ? (
                    <img
                      src={extendedBot.photo_url}
                      alt={bot.name}
                      className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-gray-200"
                    />
                  ) : (
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isActive ? "bg-[#bfff00]/10" : "bg-gray-100"
                    }`}>
                      <BotIcon className={`h-6 w-6 ${isActive ? "text-[#bfff00]" : "text-gray-400"}`} />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#1a1a1a] truncate">{bot.name}</h3>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isActive 
                          ? "bg-[#bfff00]/15 text-[#65a30d]" 
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-[#bfff00]" : "bg-gray-400"}`} />
                        {isActive ? "ONLINE" : "OFFLINE"}
                      </span>
                    </div>
                    {extendedBot.username && (
                      <p className="text-sm text-gray-500 truncate mt-0.5 flex items-center gap-1">
                        <AtSign className="h-3 w-3" />
                        {extendedBot.username}
                      </p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="hidden md:flex items-center gap-6 flex-shrink-0">
                    <div className="text-center">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase">Leads</p>
                      <p className="text-lg font-bold text-[#1a1a1a]">{botStatsCache[bot.id]?.leads ?? 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase">Vendas</p>
                      <p className="text-lg font-bold text-[#1a1a1a]">{botStatsCache[bot.id]?.vendas ?? 0}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={(e) => { 
                        e.stopPropagation()
                        setSelectedBot(bot)
                        router.push("/fluxos")
                      }}
                      className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 hover:bg-[#bfff00] hover:text-[#1c1c1e] text-gray-500 text-xs font-semibold transition-colors"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                      Fluxos
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openConfig(bot) }}
                      className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-[#1a1a1a] transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(bot.id) }}
                      className="w-9 h-9 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { 
  Users, 
  Crown,
  ShoppingBag,
  RefreshCw,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  Infinity,
  AlertCircle,
  Package,
  Filter,
  GitBranch,
  Calendar,
  Ban,
  Loader2,
  Trash2
} from "lucide-react"
import { toast } from "sonner"

interface Purchase {
  id: string
  product_type: string
  product_name: string
  amount: number
  status: string
  created_at: string
  flow_id?: string
}

// Interface para assinaturas individuais (plano, upsell, downsell)
interface Subscription {
  type: "plan" | "upsell" | "downsell"
  name: string
  price: number
  duration_days: number | null
  remaining_days: number | null
  is_lifetime: boolean
  is_expired: boolean
  start_date: string
  end_date?: string
}

interface Client {
  id: string
  telegram_user_id: string
  telegram_username?: string
  first_name?: string
  last_name?: string
  full_name: string
  type: "assinante" | "comprador"
  plan_name?: string
  plan_price?: number
  duration_type?: string
  duration_days?: number | null
  remaining_days?: number | null
  is_lifetime?: boolean
  is_expired?: boolean
  subscription_start?: string
  subscription_end?: string
  purchase_date: string
  purchases: Purchase[]
  subscriptions?: Subscription[] // Lista de todas as assinaturas (plano, upsell, downsell)
  total_spent: number
  bot_id: string
  bot_name?: string
  flow_id?: string
  flow_name?: string
}

interface Stats {
  total: number
  assinantes: number
  compradores: number
  assinantes_ativos: number
  assinantes_expirados: number
  vitalicio: number
}

interface Flow {
  id: string
  name: string
  bot_id?: string
}

interface Bot {
  id: string
  name: string
}

export default function ClientesPage() {
  const { session, isLoading: authLoading } = useAuth()
  const userId = session?.user?.id || session?.userId
  
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  const [flows, setFlows] = useState<Flow[]>([])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [bots, setBots] = useState<Bot[]>([]) // Para uso futuro (filtro por bot)
  const [selectedFlowId, setSelectedFlowId] = useState<string>("")
  const [banningClient, setBanningClient] = useState<string | null>(null)
  const [clearingClients, setClearingClients] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const ITEMS_PER_PAGE = 50

  // Funcao para limpar todos os clientes
  const handleClearAllClients = async () => {
    if (!userId) return
    
    setClearingClients(true)
    
    try {
      const res = await fetch("/api/clients/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      })

      const data = await res.json()

      if (data.success) {
        toast.success(data.message || "Todos os clientes foram removidos")
        setClients([])
        setTotalCount(0)
        setStats({ total: 0, assinantes: 0, compradores: 0, assinantes_ativos: 0, assinantes_expirados: 0, vitalicio: 0 })
        setShowClearConfirm(false)
      } else {
        toast.error(data.error || "Erro ao limpar clientes")
      }
    } catch (err) {
      console.error("[clear] Error:", err)
      toast.error("Erro ao limpar clientes")
    } finally {
      setClearingClients(false)
    }
  }

  // Funcao para banir cliente
  const handleBanClient = async (client: Client, action: "ban" | "remove" = "remove") => {
    if (!client.telegram_user_id || !client.bot_id) {
      toast.error("Dados do cliente incompletos")
      return
    }

    setBanningClient(client.id)
    
    try {
      const res = await fetch("/api/clients/ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramUserId: client.telegram_user_id,
          botId: client.bot_id,
          action,
          reason: "Manual ban from dashboard"
        })
      })

      const data = await res.json()

      if (data.success) {
        toast.success(data.message || "Cliente removido com sucesso")
        // Atualizar lista de clientes
        fetchClients()
        setSelectedClient(null)
      } else {
        toast.error(data.error || "Erro ao remover cliente")
      }
    } catch (err) {
      console.error("[ban] Error:", err)
      toast.error("Erro ao processar banimento")
    } finally {
      setBanningClient(null)
    }
  }

  // Buscar fluxos separadamente para garantir que os botoes de filtro aparecam
  useEffect(() => {
    if (!userId) return
    
    const fetchFlows = async () => {
      try {
        const res = await fetch(`/api/fluxo/list?userId=${userId}`)
        const data = await res.json()
        if (data.flows) {
          setFlows(data.flows)
        }
      } catch (err) {
        console.error("[v0] Error fetching flows:", err)
      }
    }
    
    fetchFlows()
  }, [userId])
  
  useEffect(() => {
    if (authLoading) return
    if (userId) {
      fetchClients()
    } else {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, activeTab, userId, authLoading, selectedFlowId])

  const fetchClients = async () => {
    if (!userId) return
    setLoading(true)
    
    try {
      const offset = (currentPage - 1) * ITEMS_PER_PAGE
      const filterParam = activeTab !== "all" ? `&filter=${activeTab}` : ""
      const flowParam = selectedFlowId ? `&flowId=${selectedFlowId}` : ""
      const url = `/api/clients?userId=${userId}&limit=${ITEMS_PER_PAGE}&offset=${offset}${filterParam}${flowParam}`
      
      console.log("[v0] Fetching clients:", url)
      const res = await fetch(url, { credentials: "include" })
      const data = await res.json()
      
      console.log("[v0] Clients response:", data)
      
      if (data.clients) {
        setClients(data.clients)
        setTotalCount(data.total || 0)
        if (data.stats) setStats(data.stats)
        if (data.flows) setFlows(data.flows)
        if (data.bots) setBots(data.bots)
      }
    } catch (err) {
      console.error("[clientes] Error:", err)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getProductTypeName = (type: string) => {
    switch (type) {
      case "main_product":
      case "plan":
        return "Plano"
      case "pack":
        return "Pack"
      case "upsell":
        return "Upsell"
      case "downsell":
        return "Downsell"
      case "order_bump":
        return "Order Bump"
      default:
        return type
    }
  }

  const filteredClients = clients.filter((c) => {
    if (searchQuery === "") return true
    return c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.telegram_username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.telegram_user_id?.includes(searchQuery)
  })

  const tabs = [
    { id: "all", label: "Todos", count: stats?.total || 0 },
    { id: "assinantes", label: "Assinantes", count: stats?.assinantes || 0 },
    { id: "compradores", label: "Compradores", count: stats?.compradores || 0 },
  ]

  return (
    <>
      <ScrollArea className="flex-1">
        <div className="p-4 md:p-8 bg-[#f5f5f7] min-h-[calc(100vh-60px)]">
          <div className="max-w-5xl mx-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Clientes</h1>
                <p className="text-gray-500">Gerencie seus assinantes e compradores</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowClearConfirm(true)}
                  disabled={clearingClients || (stats?.total || 0) === 0}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Limpar Tudo
                </button>
                <button 
                  onClick={() => fetchClients()}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1c1c1e] text-white text-sm font-medium hover:bg-[#2a2a2e] disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {/* Total Clientes */}
              <div className="relative rounded-[20px] p-5 overflow-hidden bg-[#1c1c1e]">
                <div 
                  className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
                  style={{ background: "radial-gradient(ellipse at center bottom, rgba(190, 255, 0, 0.15) 0%, transparent 70%)" }}
                />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-400 uppercase tracking-wide">Total Clientes</span>
                    <div className="w-9 h-9 rounded-xl bg-[#bfff00]/20 flex items-center justify-center">
                      <Users className="h-4 w-4 text-[#bfff00]" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-[#bfff00]">{stats?.total || 0}</p>
                  <p className="text-sm font-medium text-gray-500 mt-1">clientes unicos</p>
                </div>
              </div>

              {/* Assinantes */}
              <div className="relative rounded-[20px] p-5 overflow-hidden bg-[#1c1c1e]">
                <div 
                  className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
                  style={{ background: "radial-gradient(ellipse at center bottom, rgba(168, 85, 247, 0.15) 0%, transparent 70%)" }}
                />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-400 uppercase tracking-wide">Assinantes</span>
                    <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center">
                      <Crown className="h-4 w-4 text-purple-400" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-white">{stats?.assinantes || 0}</p>
                  <p className="text-sm font-medium text-gray-500 mt-1">
                    {stats?.assinantes_ativos || 0} ativos, {stats?.vitalicio || 0} vitalicios
                  </p>
                </div>
              </div>

              {/* Compradores */}
              <div className="relative rounded-[20px] p-5 overflow-hidden bg-[#1c1c1e]">
                <div 
                  className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
                  style={{ background: "radial-gradient(ellipse at center bottom, rgba(59, 130, 246, 0.15) 0%, transparent 70%)" }}
                />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-400 uppercase tracking-wide">Compradores</span>
                    <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <ShoppingBag className="h-4 w-4 text-blue-400" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-white">{stats?.compradores || 0}</p>
                  <p className="text-sm font-medium text-gray-500 mt-1">packs e order bumps</p>
                </div>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col gap-4 mb-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nome, @username..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-9 pl-9 pr-4 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100 focus:border-gray-300 transition-all"
                  />
                </div>

                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id); setCurrentPage(1); }}
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

              {/* Filtro por Fluxo - Botoes (sempre visivel) */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filtrar por fluxo:</span>
                </div>
                <button
                  onClick={() => { setSelectedFlowId(""); setCurrentPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedFlowId === ""
                      ? "bg-[#1c1c1e] text-white"
                      : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  Todos
                </button>
                {flows.length > 0 ? (
                  flows.map((flow) => (
                    <button
                      key={flow.id}
                      onClick={() => { setSelectedFlowId(flow.id); setCurrentPage(1); }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        selectedFlowId === flow.id
                          ? "bg-[#1c1c1e] text-white"
                          : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <GitBranch className="w-3 h-3" />
                      {flow.name}
                    </button>
                  ))
                ) : (
                  <span className="text-xs text-gray-400 italic">Nenhum fluxo cadastrado</span>
                )}
              </div>
            </div>

            {/* Table Layout */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[48px_180px_140px_100px_100px_100px_80px] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-200">
                <div />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Cliente</span>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Tipo</span>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Plano</span>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Tempo</span>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Total Gasto</span>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide text-right">Acoes</span>
              </div>

              {/* Body */}
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <Users className="h-5 w-5 text-gray-400" />
                  </div>
                  <p className="text-sm font-bold text-gray-900">Nenhum cliente encontrado</p>
                  <p className="text-xs text-gray-500 mt-1">Os clientes aparecerao aqui apos as vendas</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredClients.map((client) => (
                    <div
                      key={client.id}
                      className="w-full grid grid-cols-[48px_180px_140px_100px_100px_100px_80px] gap-4 items-center px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                    >
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        client.type === "assinante" ? "bg-purple-100" : "bg-blue-100"
                      }`}>
                        {client.type === "assinante" ? (
                          <Crown className="w-4 h-4 text-purple-600" />
                        ) : (
                          <ShoppingBag className="w-4 h-4 text-blue-600" />
                        )}
                      </div>

                      {/* Cliente */}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{client.full_name}</p>
                        <p className="text-sm font-medium text-gray-500 truncate">
                          {client.telegram_username ? `@${client.telegram_username}` : `ID: ${client.telegram_user_id}`}
                        </p>
                      </div>

                      {/* Tipo */}
                      <div>
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                          client.type === "assinante" 
                            ? "bg-purple-100 text-purple-700" 
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {client.type === "assinante" ? (
                            <>
                              <Crown className="w-3 h-3" />
                              Assinante
                            </>
                          ) : (
                            <>
                              <ShoppingBag className="w-3 h-3" />
                              Comprador
                            </>
                          )}
                        </span>
                      </div>

                      {/* Plano */}
                      <div className="min-w-0">
                        {client.type === "assinante" ? (
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            {client.plan_name || "Plano"}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-400">-</p>
                        )}
                      </div>

                      {/* Tempo Restante - mostra assinaturas separadas */}
                      <div className="space-y-1">
                        {client.type === "assinante" && client.subscriptions && client.subscriptions.length > 0 ? (
                          client.subscriptions.map((sub, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                sub.type === "plan" ? "bg-purple-100 text-purple-700" :
                                sub.type === "upsell" ? "bg-green-100 text-green-700" :
                                "bg-orange-100 text-orange-700"
                              }`}>
                                {sub.type === "plan" ? "P" : sub.type === "upsell" ? "U" : "D"}
                              </span>
                              {sub.is_lifetime ? (
                                <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600">
                                  <Infinity className="w-3 h-3" />
                                </span>
                              ) : sub.is_expired ? (
                                <span className="inline-flex items-center gap-0.5 text-xs font-bold text-red-500">
                                  <AlertCircle className="w-3 h-3" />
                                  0d
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-600">
                                  <Clock className="w-3 h-3" />
                                  {sub.remaining_days}d
                                </span>
                              )}
                            </div>
                          ))
                        ) : client.type === "assinante" ? (
                          // Fallback para clientes sem subscriptions array (dados antigos)
                          client.is_lifetime ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                              <Infinity className="w-3 h-3" />
                              Vitalicio
                            </span>
                          ) : client.is_expired ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-500">
                              <AlertCircle className="w-3 h-3" />
                              Expirado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                              <Clock className="w-3 h-3" />
                              {client.remaining_days}d
                            </span>
                          )
                        ) : (
                          <p className="text-sm text-gray-400">-</p>
                        )}
                      </div>

                      {/* Total Gasto */}
                      <button 
                        onClick={() => setSelectedClient(client)}
                        className="text-left"
                      >
                        <p className="text-base font-bold text-emerald-600">
                          {formatCurrency(client.total_spent)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {client.purchases.length} compra{client.purchases.length !== 1 ? "s" : ""}
                        </p>
                      </button>

                      {/* Acoes */}
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedClient(client)}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Ver detalhes"
                        >
                          <Search className="w-4 h-4" />
                        </button>
                        {client.type === "assinante" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleBanClient(client, "remove")
                            }}
                            disabled={banningClient === client.id}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Remover do grupo"
                          >
                            {banningClient === client.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Ban className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalCount > ITEMS_PER_PAGE && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </button>

                <span className="px-4 py-2 text-sm text-gray-600">
                  Pagina {currentPage} de {Math.ceil(totalCount / ITEMS_PER_PAGE)}
                </span>

                <button
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={currentPage >= Math.ceil(totalCount / ITEMS_PER_PAGE)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Proximo
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Client Details Modal */}
      <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden bg-white">
          {selectedClient && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    selectedClient.type === "assinante" ? "bg-purple-100" : "bg-blue-100"
                  }`}>
                    {selectedClient.type === "assinante" ? (
                      <Crown className="w-5 h-5 text-purple-600" />
                    ) : (
                      <ShoppingBag className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{selectedClient.full_name}</p>
                    <p className="text-sm text-gray-500">
                      {selectedClient.telegram_username 
                        ? `@${selectedClient.telegram_username}` 
                        : `ID: ${selectedClient.telegram_user_id}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedClient(null)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Status Card */}
                <div className={`rounded-xl p-4 ${
                  selectedClient.type === "assinante" ? "bg-purple-50" : "bg-blue-50"
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Status</p>
                      <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${
                        selectedClient.type === "assinante" ? "text-purple-700" : "text-blue-700"
                      }`}>
                        {selectedClient.type === "assinante" ? (
                          <>
                            <Crown className="w-4 h-4" />
                            Assinante
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-4 h-4" />
                            Comprador
                          </>
                        )}
                      </span>
                    </div>
                    
                    {selectedClient.type === "assinante" && (
                      <div className="text-right">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Tempo</p>
                        {selectedClient.is_lifetime ? (
                          <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-600">
                            <Infinity className="w-4 h-4" />
                            Vitalicio
                          </span>
                        ) : selectedClient.is_expired ? (
                          <span className="inline-flex items-center gap-1 text-sm font-bold text-red-500">
                            <AlertCircle className="w-4 h-4" />
                            Expirado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-600">
                            <Clock className="w-4 h-4" />
                            {selectedClient.remaining_days} dias restantes
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {selectedClient.type === "assinante" && selectedClient.plan_name && (
                    <div className="mt-3 pt-3 border-t border-purple-200/50">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Plano</p>
                      <p className="text-sm font-bold text-gray-900">
                        {selectedClient.plan_name} - {formatCurrency(selectedClient.plan_price || 0)}
                      </p>
                      {selectedClient.duration_days && (
                        <p className="text-xs text-gray-500 mt-1">
                          Duracao: {selectedClient.duration_days} dias
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Subscription Details (for subscribers) - mostra todas as assinaturas separadas */}
                {selectedClient.type === "assinante" && selectedClient.subscriptions && selectedClient.subscriptions.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-600" />
                      <p className="text-sm font-bold text-amber-800">Assinaturas Ativas</p>
                    </div>
                    {selectedClient.subscriptions.map((sub, idx) => (
                      <div 
                        key={idx} 
                        className={`rounded-xl p-4 border ${
                          sub.type === "plan" ? "bg-purple-50 border-purple-100" :
                          sub.type === "upsell" ? "bg-green-50 border-green-100" :
                          "bg-orange-50 border-orange-100"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                            sub.type === "plan" ? "bg-purple-100 text-purple-700" :
                            sub.type === "upsell" ? "bg-green-100 text-green-700" :
                            "bg-orange-100 text-orange-700"
                          }`}>
                            {sub.type === "plan" ? "Plano" : sub.type === "upsell" ? "Upsell" : "Downsell"}
                          </span>
                          {sub.is_lifetime ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                              <Infinity className="w-3 h-3" />
                              Vitalicio
                            </span>
                          ) : sub.is_expired ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-500">
                              <AlertCircle className="w-3 h-3" />
                              Expirado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                              <Clock className="w-3 h-3" />
                              {sub.remaining_days}d restantes
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-gray-900">{sub.name}</p>
                        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                          <span>Inicio: {formatDate(sub.start_date)}</span>
                          {!sub.is_lifetime && sub.end_date && (
                            <span>Venc: {formatDate(sub.end_date)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Fallback para dados antigos sem subscriptions */}
                {selectedClient.type === "assinante" && (!selectedClient.subscriptions || selectedClient.subscriptions.length === 0) && (
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="w-4 h-4 text-amber-600" />
                      <p className="text-sm font-bold text-amber-800">Detalhes da Assinatura</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-amber-600">Inicio</p>
                        <p className="text-sm font-medium text-amber-900">
                          {selectedClient.subscription_start ? formatDate(selectedClient.subscription_start) : formatDate(selectedClient.purchase_date)}
                        </p>
                      </div>
                      {!selectedClient.is_lifetime && selectedClient.subscription_end && (
                        <div>
                          <p className="text-xs text-amber-600">Vencimento</p>
                          <p className="text-sm font-medium text-amber-900">
                            {formatDate(selectedClient.subscription_end)}
                          </p>
                        </div>
                      )}
                      {selectedClient.is_lifetime && (
                        <div>
                          <p className="text-xs text-amber-600">Vencimento</p>
                          <p className="text-sm font-medium text-emerald-600 flex items-center gap-1">
                            <Infinity className="w-3 h-3" /> Vitalicio
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Flow Info */}
                {selectedClient.flow_name && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
                    <GitBranch className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Fluxo:</span>
                    <span className="text-sm font-medium text-gray-900">{selectedClient.flow_name}</span>
                  </div>
                )}

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Gasto</p>
                    <p className="text-xl font-bold text-emerald-600">{formatCurrency(selectedClient.total_spent)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Primeira Compra</p>
                    <p className="text-sm font-bold text-gray-900">{formatDate(selectedClient.purchase_date)}</p>
                  </div>
                </div>

                {/* Purchases History */}
                <div>
                  <p className="text-sm font-bold text-gray-900 mb-3">Historico de Compras</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedClient.purchases.map((purchase) => (
                      <div
                        key={purchase.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                            <Package className="w-4 h-4 text-gray-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {purchase.product_name || getProductTypeName(purchase.product_type)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDateTime(purchase.created_at)}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-emerald-600">
                          {formatCurrency(purchase.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Botao de Banimento (apenas para assinantes) */}
                {selectedClient.type === "assinante" && (
                  <div className="pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleBanClient(selectedClient, "remove")}
                      disabled={banningClient === selectedClient.id}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
                    >
                      {banningClient === selectedClient.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Removendo...
                        </>
                      ) : (
                        <>
                          <Ban className="w-4 h-4" />
                          Remover do Grupo VIP
                        </>
                      )}
                    </button>
                    <p className="text-xs text-gray-400 text-center mt-2">
                      Remove o acesso do usuario ao grupo VIP e cancela a assinatura
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmacao para limpar todos os clientes */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="sm:max-w-md bg-white p-0 rounded-2xl">
          <div className="p-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
              Limpar todos os clientes?
            </h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              Isso vai apagar todos os pagamentos e dados de clientes dos seus bots. 
              Essa acao nao pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                disabled={clearingClients}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleClearAllClients}
                disabled={clearingClients}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {clearingClients ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Limpando...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Sim, limpar tudo
                  </>
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

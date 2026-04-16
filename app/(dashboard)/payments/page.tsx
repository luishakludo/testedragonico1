"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { 
  DollarSign, 
  Clock, 
  TrendingUp,
  RefreshCw,
  Search,
  Copy,
  Check,
  CreditCard,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react"

interface Payment {
  id: string
  bot_id: string
  telegram_user_id: string
  telegram_username: string | null
  telegram_first_name: string | null
  telegram_last_name: string | null
  gateway: string
  external_payment_id: string
  amount: number
  description: string
  status: string
  created_at: string
  updated_at: string
  bots?: {
    name: string
    username: string
  }
}

export default function VendasPage() {
  const { session, isLoading: authLoading } = useAuth()
  const userId = session?.user?.id || session?.userId
  
  // Debug: mostra userId no console assim que carregar
  console.log("[v0] VendasPage - session:", session, "userId:", userId, "authLoading:", authLoading)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [copied, setCopied] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [apiStats, setApiStats] = useState<{
    total: number
    approved: number
    pending: number
    rejected: number
    totalApproved: number
    totalPending: number
  } | null>(null)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const ITEMS_PER_PAGE = 50

  useEffect(() => {
    if (authLoading) return
    if (userId) {
      fetchPayments()
    } else {
      setLoading(false)
    }
  }, [currentPage, activeTab, userId, authLoading])

  const fetchPayments = async () => {
    if (!userId) return
    setLoading(true)
    setSyncResult(null)
    
    // Primeiro sincroniza os status com o Mercado Pago
    try {
      const syncRes = await fetch("/api/debug/auto-test")
      const syncData = await syncRes.json()
      if (syncData.pagamentosAtualizados > 0) {
        setSyncResult(`${syncData.pagamentosAtualizados} pagamento(s) sincronizado(s)!`)
        setTimeout(() => setSyncResult(null), 3000)
      }
    } catch {
      // Ignora erro de sync, continua com fetch normal
    }
    
    // Depois busca os pagamentos atualizados
    try {
      const offset = (currentPage - 1) * ITEMS_PER_PAGE
      const statusParam = activeTab !== "all" ? `&status=${activeTab}` : ""
      const url = `/api/payments/list?userId=${userId}&limit=${ITEMS_PER_PAGE}&offset=${offset}${statusParam}`
      console.log("[v0] Fetching payments - userId:", userId, "url:", url)
      const res = await fetch(url, { credentials: "include" })
      const data = await res.json()
      console.log("[v0] Payments response:", data.payments?.length, "stats:", data.stats)
      if (data.payments) {
        setPayments(data.payments)
        setTotalCount(data.total || 0)
        if (data.stats) setApiStats(data.stats)
      }
    } catch (err) {
      console.error("[v0] Error:", err)
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
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getUserName = (payment: Payment) => {
    if (payment.telegram_first_name) {
      return payment.telegram_last_name 
        ? `${payment.telegram_first_name} ${payment.telegram_last_name}`
        : payment.telegram_first_name
    }
    return payment.bots?.name || "Usuario"
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Filter only by search (status is filtered by API)
  const filteredPayments = payments.filter((p) => {
    if (searchQuery === "") return true
    return getUserName(p).toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.telegram_username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.external_payment_id?.includes(searchQuery)
  })

  // Use API stats (total across all pages) instead of just current page
  const stats = {
    faturamento: apiStats?.totalApproved || 0,
    total: apiStats?.approved || 0,
    pendentes: apiStats?.totalPending || 0,
    pendentesCount: apiStats?.pending || 0,
  }

  const tabs = [
    { id: "all", label: "Todas", count: apiStats?.total || 0 },
    { id: "approved", label: "Aprovadas", count: apiStats?.approved || 0 },
    { id: "pending", label: "Pendentes", count: apiStats?.pending || 0 },
    { id: "rejected", label: "Rejeitadas", count: apiStats?.rejected || 0 },
  ]

  return (
    <>

      <ScrollArea className="flex-1">
        <div className="p-4 md:p-8 bg-[#f5f5f7] min-h-[calc(100vh-60px)]">
          <div className="max-w-5xl mx-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Vendas</h1>
                <p className="text-gray-500">Acompanhe suas vendas e transacoes</p>
              </div>
              <div className="flex items-center gap-2">
                {syncResult && (
                  <span className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                    {syncResult}
                  </span>
                )}
                <button 
                  onClick={() => fetchPayments()}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1c1c1e] text-white text-sm font-medium hover:bg-[#2a2a2e] disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
              </div>
            </div>

            {/* Stats Cards com Glow */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {/* Faturamento */}
              <div className="relative rounded-[20px] p-5 overflow-hidden bg-[#1c1c1e]">
                <div 
                  className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
                  style={{ background: "radial-gradient(ellipse at center bottom, rgba(190, 255, 0, 0.15) 0%, transparent 70%)" }}
                />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-400 uppercase tracking-wide">Faturamento</span>
                    <div className="w-9 h-9 rounded-xl bg-[#bfff00]/20 flex items-center justify-center">
                      <DollarSign className="h-4 w-4 text-[#bfff00]" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-[#bfff00]">{formatCurrency(stats.faturamento)}</p>
                  <p className="text-sm font-medium text-gray-500 mt-1">vendas aprovadas</p>
                </div>
              </div>

              {/* Total de Vendas */}
              <div className="relative rounded-[20px] p-5 overflow-hidden bg-[#1c1c1e]">
                <div 
                  className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
                  style={{ background: "radial-gradient(ellipse at center bottom, rgba(59, 130, 246, 0.15) 0%, transparent 70%)" }}
                />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-400 uppercase tracking-wide">Total de Vendas</span>
                    <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-blue-400" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-white">{stats.total}</p>
                  <p className="text-sm font-medium text-gray-500 mt-1">vendas aprovadas</p>
                </div>
              </div>

              {/* Pendentes */}
              <div className="relative rounded-[20px] p-5 overflow-hidden bg-[#1c1c1e]">
                <div 
                  className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
                  style={{ background: "radial-gradient(ellipse at center bottom, rgba(234, 179, 8, 0.15) 0%, transparent 70%)" }}
                />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-400 uppercase tracking-wide">Pendentes</span>
                    <div className="w-9 h-9 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-yellow-400" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-yellow-400">{formatCurrency(stats.pendentes)}</p>
                  <p className="text-sm font-medium text-gray-500 mt-1">{stats.pendentesCount} aguardando</p>
                </div>
              </div>
            </div>

            {/* Search and Tabs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-4">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nome, ID..."
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

            {/* Table Layout */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[48px_200px_180px_100px_1fr] gap-6 px-5 py-3 bg-gray-50 border-b border-gray-200">
                <div />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Comprador</span>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Produto</span>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Data</span>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide text-right">Valor</span>
              </div>

              {/* Body */}
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : filteredPayments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <CreditCard className="h-5 w-5 text-gray-400" />
                  </div>
                  <p className="text-sm font-bold text-gray-900">Nenhuma venda encontrada</p>
                  <p className="text-xs text-gray-500 mt-1">As vendas aparecerao aqui</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredPayments.map((payment) => (
                    <button
                      key={payment.id}
                      onClick={() => setSelectedPayment(payment)}
                      className="w-full grid grid-cols-[48px_200px_180px_100px_1fr] gap-6 items-center px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                    >
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                        <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-400">
                          <circle cx="12" cy="8" r="4" fill="currentColor"/>
                          <path d="M20 21c0-4.418-3.582-8-8-8s-8 3.582-8 8" fill="currentColor"/>
                        </svg>
                      </div>

                      {/* Comprador */}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{getUserName(payment)}</p>
                        <p className="text-sm font-medium text-gray-500 truncate">
                          {payment.telegram_username ? `@${payment.telegram_username}` : "Telegram User"}
                        </p>
                      </div>

                      {/* Produto */}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{payment.description || "Pagamento"}</p>
                        <p className="text-sm font-medium text-gray-500">{payment.gateway || "PIX"}</p>
                      </div>

                      {/* Data */}
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{formatDate(payment.created_at).split(",")[0]}</p>
                        <p className="text-sm font-medium text-gray-500">{formatDate(payment.created_at).split(",")[1]?.trim() || ""}</p>
                      </div>

                      {/* Valor + Status */}
                      <div className="text-right">
                        <p className={`text-base font-bold ${
                          payment.status === "approved" ? "text-emerald-600" : 
                          payment.status === "pending" ? "text-amber-500" : 
                          "text-gray-500"
                        }`}>
                          {formatCurrency(Number(payment.amount))}
                        </p>
                        <span className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded ${
                          payment.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                          payment.status === "pending" ? "bg-amber-100 text-amber-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {payment.status === "approved" ? "Aprovada" : payment.status === "pending" ? "Pendente" : "Rejeitada"}
                        </span>
                      </div>
                    </button>
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

                <div className="flex items-center gap-1">
                  {(() => {
                    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
                    const pages: (number | string)[] = []
                    
                    if (totalPages <= 7) {
                      for (let i = 1; i <= totalPages; i++) pages.push(i)
                    } else {
                      pages.push(1)
                      if (currentPage > 3) pages.push("...")
                      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                        if (!pages.includes(i)) pages.push(i)
                      }
                      if (currentPage < totalPages - 2) pages.push("...")
                      if (!pages.includes(totalPages)) pages.push(totalPages)
                    }

                    return pages.map((page, idx) => (
                      typeof page === "number" ? (
                        <button
                          key={idx}
                          onClick={() => setCurrentPage(page)}
                          className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                            currentPage === page
                              ? "bg-[#1c1c1e] text-white"
                              : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {page}
                        </button>
                      ) : (
                        <span key={idx} className="px-2 text-gray-400">...</span>
                      )
                    ))
                  })()}
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalCount / ITEMS_PER_PAGE), p + 1))}
                  disabled={currentPage >= Math.ceil(totalCount / ITEMS_PER_PAGE)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Proximo
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Total info */}
            {totalCount > 0 && (
              <p className="text-center text-xs text-gray-500 mt-3">
                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} de {totalCount} pagamentos
              </p>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Payment Details Dialog - Compact Dark */}
      <Dialog open={!!selectedPayment} onOpenChange={(open) => !open && setSelectedPayment(null)}>
        <DialogContent className="sm:max-w-[380px] bg-[#1c1c1e] border-[#2a2a2e] p-0 gap-0 overflow-hidden rounded-2xl [&>button]:hidden">
          {selectedPayment && (
            <div className="p-5">
              {/* Close */}
              <button
                onClick={() => setSelectedPayment(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-[#2a2a2e] flex items-center justify-center text-gray-400 hover:text-white transition-colors z-10"
              >
                <X className="h-4 w-4" />
              </button>

              {/* User Header */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#bfff00]/20 to-[#22c55e]/20 flex items-center justify-center text-[#bfff00] font-bold">
                  {selectedPayment.telegram_first_name?.charAt(0).toUpperCase() || selectedPayment.bots?.name?.charAt(0).toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0 pr-8">
                  <h3 className="font-bold text-white truncate">{getUserName(selectedPayment)}</h3>
                  <p className="text-xs text-gray-500">
                    {selectedPayment.telegram_username ? `@${selectedPayment.telegram_username} • ` : ""}
                    ID: {selectedPayment.telegram_user_id}
                  </p>
                </div>
              </div>

              {/* Status */}
              <div className={`flex items-center justify-center gap-2 py-2.5 rounded-xl mb-5 ${
                selectedPayment.status === "approved" ? "bg-emerald-500/10" :
                selectedPayment.status === "pending" ? "bg-yellow-500/10" :
                "bg-red-500/10"
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  selectedPayment.status === "approved" ? "bg-emerald-400" :
                  selectedPayment.status === "pending" ? "bg-yellow-400" :
                  "bg-red-400"
                }`} />
                <span className={`text-sm font-semibold ${
                  selectedPayment.status === "approved" ? "text-emerald-400" :
                  selectedPayment.status === "pending" ? "text-yellow-400" :
                  "text-red-400"
                }`}>
                  {selectedPayment.status === "approved" ? "Pagamento Aprovado" : 
                   selectedPayment.status === "pending" ? "Aguardando Pagamento" : "Rejeitado"}
                </span>
              </div>

              {/* Amount */}
              <div className="bg-[#2a2a2e] rounded-xl p-4 mb-4 text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Valor</p>
                <p className={`text-3xl font-bold ${
                  selectedPayment.status === "approved" ? "text-emerald-400" : "text-white"
                }`}>
                  {formatCurrency(Number(selectedPayment.amount))}
                </p>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[#2a2a2e] rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Metodo</p>
                  <p className="text-sm font-medium text-white mt-1">PIX</p>
                </div>
                <div className="bg-[#2a2a2e] rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Gateway</p>
                  <p className="text-sm font-medium text-white mt-1 capitalize">{selectedPayment.gateway}</p>
                </div>
              </div>

              {/* Product */}
              <div className="bg-[#2a2a2e] rounded-xl p-3 mb-4">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Produto</p>
                <p className="text-sm font-medium text-white mt-1">{selectedPayment.description || "Pagamento"}</p>
              </div>

              {/* Payment ID */}
              <div className="bg-[#2a2a2e] rounded-xl p-3 mb-4 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">ID Pagamento</p>
                  <p className="text-sm font-mono text-white mt-1 truncate">{selectedPayment.external_payment_id}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(selectedPayment.external_payment_id)}
                  className="w-8 h-8 rounded-lg bg-[#3a3a3e] flex items-center justify-center text-gray-400 hover:text-white transition-colors shrink-0 ml-3"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-[#bfff00]" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Dates + Bot */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[#2a2a2e] rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Criado</p>
                  <p className="text-xs text-white mt-1">{new Date(selectedPayment.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <div className="bg-[#2a2a2e] rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Atualizado</p>
                  <p className="text-xs text-white mt-1">{new Date(selectedPayment.updated_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <div className="bg-[#2a2a2e] rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Bot</p>
                  <p className="text-xs text-white mt-1 truncate">{selectedPayment.bots?.name || "Bot"}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

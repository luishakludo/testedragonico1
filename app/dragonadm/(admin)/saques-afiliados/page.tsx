"use client"

import { useState, useEffect } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Search,
  Loader2,
  User,
  CreditCard,
  Key,
  Calendar,
  RefreshCw,
  Wallet,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Withdraw {
  id: string
  user_id: string
  amount: number
  name: string
  cpf: string
  pix_key: string
  status: "pending" | "approved" | "rejected" | "paid"
  admin_notes: string | null
  created_at: string
  processed_at: string | null
  user?: {
    name: string
    email: string
  }
}

export default function SaquesAfiliadosPage() {
  const [withdraws, setWithdraws] = useState<Withdraw[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "paid" | "rejected">("all")
  const [search, setSearch] = useState("")
  const [selectedWithdraw, setSelectedWithdraw] = useState<Withdraw | null>(null)
  const [adminNotes, setAdminNotes] = useState("")
  const [processing, setProcessing] = useState(false)

  const fetchWithdraws = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/dragonadm/withdraws")
      const data = await response.json()

      if (!response.ok) {
        console.error("Error fetching withdraws:", data.error)
        return
      }

      let filteredData = data.withdraws || []
      if (filter !== "all") {
        filteredData = filteredData.filter((w: Withdraw) => w.status === filter)
      }

      setWithdraws(filteredData)
    } catch (err) {
      console.error("Error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWithdraws()
  }, [filter])

  const handleUpdateStatus = async (status: "approved" | "rejected" | "paid") => {
    if (!selectedWithdraw) return
    
    setProcessing(true)
    try {
      const response = await fetch("/api/dragonadm/withdraws", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedWithdraw.id,
          status,
          admin_notes: adminNotes || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error)
      }

      toast.success(
        status === "approved" ? "Saque aprovado!" :
        status === "paid" ? "Saque marcado como pago!" :
        "Saque rejeitado!"
      )
      setSelectedWithdraw(null)
      setAdminNotes("")
      fetchWithdraws()
    } catch (err) {
      console.error("Error updating withdraw:", err)
      toast.error("Erro ao atualizar saque")
    } finally {
      setProcessing(false)
    }
  }

  const filteredWithdraws = withdraws.filter(w => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      w.name.toLowerCase().includes(searchLower) ||
      w.cpf.includes(search) ||
      w.pix_key.toLowerCase().includes(searchLower) ||
      w.user?.email?.toLowerCase().includes(searchLower)
    )
  })

  const stats = {
    pending: withdraws.filter(w => w.status === "pending").length,
    pendingAmount: withdraws.filter(w => w.status === "pending").reduce((acc, w) => acc + Number(w.amount), 0),
    approved: withdraws.filter(w => w.status === "approved").length,
    paid: withdraws.filter(w => w.status === "paid").length,
    paidAmount: withdraws.filter(w => w.status === "paid").reduce((acc, w) => acc + Number(w.amount), 0),
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatCPF = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
  }

  const tabs = [
    { id: "all", label: "Todos" },
    { id: "pending", label: "Pendentes" },
    { id: "approved", label: "Aprovados" },
    { id: "paid", label: "Pagos" },
    { id: "rejected", label: "Rejeitados" },
  ]

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 lg:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(149, 228, 104, 0.1))',
                  border: '1px solid rgba(34, 197, 94, 0.2)'
                }}
              >
                <Wallet className="w-5 h-5 text-[#22c55e]" />
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Saques de Afiliados</h1>
            </div>
            <p className="text-[#666666] text-sm">
              Gerencie as solicitacoes de saque do programa de indicacao
            </p>
          </div>
          <button
            onClick={fetchWithdraws}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-[#a1a1a1] hover:text-white disabled:opacity-50"
            style={{ 
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)'
            }}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Atualizar
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-5 grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Clock, label: "Pendentes", value: stats.pending, subValue: `R$ ${stats.pendingAmount.toFixed(2)}`, color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)" },
            { icon: CheckCircle2, label: "Aprovados", value: stats.approved, color: "#a1a1a1", bg: "rgba(255,255,255,0.05)" },
            { icon: DollarSign, label: "Pagos", value: stats.paid, subValue: `R$ ${stats.paidAmount.toFixed(2)}`, color: "#22c55e", bg: "rgba(34, 197, 94, 0.1)" },
            { icon: DollarSign, label: "Total Saques", value: withdraws.length, color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.1)" },
          ].map((stat, i) => (
            <div
              key={i}
              className="group rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1"
              style={{
                background: '#0f0f0f',
                border: '1px solid rgba(255,255,255,0.06)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${stat.color}30`
                e.currentTarget.style.boxShadow = `0 0 25px ${stat.color}15`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div className="flex items-center gap-4">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                  style={{ background: stat.bg }}
                >
                  <stat.icon className="h-6 w-6" style={{ color: stat.color }} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-[#666666]">{stat.label}</p>
                  {stat.subValue && (
                    <p className="text-xs font-medium mt-0.5" style={{ color: stat.color }}>{stat.subValue}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div 
          className="rounded-2xl p-5"
          style={{ 
            background: '#0f0f0f',
            border: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666666]" />
              <input
                placeholder="Buscar por nome, CPF, PIX ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl text-sm text-white placeholder:text-[#666666] focus:outline-none focus:ring-2 focus:ring-[#95e468]/30 transition-all"
                style={{ 
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id as typeof filter)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap",
                    filter === tab.id
                      ? "text-[#050505]"
                      : "text-[#a1a1a1] hover:text-white"
                  )}
                  style={filter === tab.id ? {
                    background: 'linear-gradient(135deg, #95e468, #7bc752)',
                    boxShadow: '0 0 15px rgba(149, 228, 104, 0.3)'
                  } : {
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Withdraws List */}
        <div 
          className="rounded-2xl overflow-hidden"
          style={{ 
            background: '#0f0f0f',
            border: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-[#22c55e]/10 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-[#22c55e] animate-spin" />
                </div>
                <div className="absolute inset-0 rounded-xl bg-[#22c55e]/20 blur-xl animate-pulse" />
              </div>
              <p className="text-sm text-[#666666]">Carregando saques...</p>
            </div>
          ) : filteredWithdraws.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div 
                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}
              >
                <DollarSign className="h-10 w-10 text-[#444444]" />
              </div>
              <p className="text-sm text-[#666666]">Nenhum saque encontrado</p>
            </div>
          ) : (
            <div>
              {filteredWithdraws.map((withdraw, i) => (
                <div
                  key={withdraw.id}
                  onClick={() => {
                    setSelectedWithdraw(withdraw)
                    setAdminNotes(withdraw.admin_notes || "")
                  }}
                  className="p-5 cursor-pointer transition-colors hover:bg-white/[0.02]"
                  style={{ borderBottom: i < filteredWithdraws.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div 
                        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold text-white"
                        style={{ 
                          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(149, 228, 104, 0.1))',
                          border: '1px solid rgba(255,255,255,0.06)'
                        }}
                      >
                        {withdraw.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-white">{withdraw.name}</p>
                        <p className="text-xs text-[#666666]">{withdraw.user?.email}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[11px] text-[#666666]">
                            CPF: {formatCPF(withdraw.cpf)}
                          </span>
                          <span className="text-[#444444]">|</span>
                          <span className="text-[11px] text-[#666666]">
                            PIX: {withdraw.pix_key}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p 
                        className="text-xl font-bold"
                        style={{
                          background: 'linear-gradient(135deg, #22c55e, #95e468)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent'
                        }}
                      >
                        R$ {Number(withdraw.amount).toFixed(2)}
                      </p>
                      <span 
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium mt-1"
                        style={{ 
                          background: withdraw.status === "pending" ? 'rgba(245, 158, 11, 0.1)' : 
                                     withdraw.status === "approved" ? 'rgba(59, 130, 246, 0.1)' :
                                     withdraw.status === "paid" ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: withdraw.status === "pending" ? '#f59e0b' : 
                                 withdraw.status === "approved" ? '#3b82f6' :
                                 withdraw.status === "paid" ? '#22c55e' : '#ef4444',
                        }}
                      >
                        {withdraw.status === "pending" ? "Pendente" :
                         withdraw.status === "approved" ? "Aprovado" :
                         withdraw.status === "paid" ? "Pago" : "Rejeitado"}
                      </span>
                      <p className="text-[10px] text-[#666666] mt-1.5">
                        {formatDate(withdraw.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      <Dialog open={!!selectedWithdraw} onOpenChange={() => setSelectedWithdraw(null)}>
        <DialogContent 
          className="sm:max-w-[450px] p-0 gap-0 rounded-2xl"
          style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {selectedWithdraw && (
            <>
              <div className="p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-4">
                  <div 
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white"
                    style={{ 
                      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(149, 228, 104, 0.1))',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}
                  >
                    {selectedWithdraw.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{selectedWithdraw.name}</h3>
                    <p className="text-sm text-[#666666]">{selectedWithdraw.user?.email}</p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-5">
                <div 
                  className="text-center p-5 rounded-xl"
                  style={{ 
                    background: 'linear-gradient(145deg, rgba(34, 197, 94, 0.05), rgba(149, 228, 104, 0.02))',
                    border: '1px solid rgba(34, 197, 94, 0.15)'
                  }}
                >
                  <p className="text-xs text-[#666666] mb-1">Valor do Saque</p>
                  <p 
                    className="text-4xl font-bold"
                    style={{
                      background: 'linear-gradient(135deg, #22c55e, #95e468)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}
                  >
                    R$ {Number(selectedWithdraw.amount).toFixed(2)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: User, label: "Nome", value: selectedWithdraw.name },
                    { icon: CreditCard, label: "CPF", value: formatCPF(selectedWithdraw.cpf) },
                  ].map((item, i) => (
                    <div 
                      key={i}
                      className="p-4 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <item.icon className="h-3.5 w-3.5 text-[#666666]" />
                        <span className="text-[10px] text-[#666666] uppercase tracking-wider">{item.label}</span>
                      </div>
                      <p className="text-sm font-medium text-white">{item.value}</p>
                    </div>
                  ))}
                  <div 
                    className="p-4 rounded-xl col-span-2"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Key className="h-3.5 w-3.5 text-[#666666]" />
                      <span className="text-[10px] text-[#666666] uppercase tracking-wider">Chave PIX</span>
                    </div>
                    <p className="text-sm font-medium text-white break-all">{selectedWithdraw.pix_key}</p>
                  </div>
                  <div 
                    className="p-4 rounded-xl col-span-2"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Calendar className="h-3.5 w-3.5 text-[#666666]" />
                      <span className="text-[10px] text-[#666666] uppercase tracking-wider">Data da Solicitacao</span>
                    </div>
                    <p className="text-sm font-medium text-white">{formatDate(selectedWithdraw.created_at)}</p>
                  </div>
                </div>

                {selectedWithdraw.status === "pending" && (
                  <div>
                    <label className="text-xs text-[#666666] mb-2 block uppercase tracking-wider">
                      Observacoes (opcional)
                    </label>
                    <Textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Adicionar notas sobre este saque..."
                      className="min-h-[80px] bg-[#111111] border-[rgba(255,255,255,0.06)] text-white placeholder:text-[#666666] rounded-xl"
                    />
                  </div>
                )}

                {selectedWithdraw.admin_notes && selectedWithdraw.status !== "pending" && (
                  <div 
                    className="p-4 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <p className="text-[10px] text-[#666666] uppercase tracking-wider mb-1.5">Observacoes</p>
                    <p className="text-sm text-white">{selectedWithdraw.admin_notes}</p>
                  </div>
                )}
              </div>

              <div className="p-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}>
                {selectedWithdraw.status === "pending" && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleUpdateStatus("rejected")}
                      disabled={processing}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                      style={{ 
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.2)'
                      }}
                    >
                      {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                        <>
                          <XCircle className="h-4 w-4" />
                          Rejeitar
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleUpdateStatus("approved")}
                      disabled={processing}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-[#050505] transition-all disabled:opacity-50"
                      style={{ 
                        background: 'linear-gradient(135deg, #95e468, #7bc752)',
                        boxShadow: '0 0 20px rgba(149, 228, 104, 0.3)'
                      }}
                    >
                      {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          Aprovar
                        </>
                      )}
                    </button>
                  </div>
                )}

                {selectedWithdraw.status === "approved" && (
                  <button
                    onClick={() => handleUpdateStatus("paid")}
                    disabled={processing}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                    style={{ 
                      background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                      boxShadow: '0 0 20px rgba(34, 197, 94, 0.3)'
                    }}
                  >
                    {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                      <>
                        <DollarSign className="h-4 w-4" />
                        Marcar como Pago
                      </>
                    )}
                  </button>
                )}

                {(selectedWithdraw.status === "paid" || selectedWithdraw.status === "rejected") && (
                  <div className="text-center">
                    <span 
                      className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium"
                      style={{ 
                        background: selectedWithdraw.status === "paid" ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: selectedWithdraw.status === "paid" ? '#22c55e' : '#ef4444',
                      }}
                    >
                      {selectedWithdraw.status === "paid" ? "Saque Pago" : "Saque Rejeitado"}
                    </span>
                    {selectedWithdraw.processed_at && (
                      <p className="text-xs text-[#666666] mt-2">
                        Processado em {formatDate(selectedWithdraw.processed_at)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </ScrollArea>
  )
}

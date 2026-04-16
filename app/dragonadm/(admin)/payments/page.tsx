"use client"

import { useEffect, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { CreditCard, Search, RefreshCw, Loader2, DollarSign, Clock, CheckCircle, XCircle } from "lucide-react"

interface PaymentData {
  id: string
  user_email?: string
  amount: number
  status: string
  created_at: string
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentData[]>([])
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "approved" | "pending" | "rejected">("all")
  const [isLoading, setIsLoading] = useState(true)

  const loadPayments = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/dragonadm/payments")
      if (res.ok) {
        const data = await res.json()
        setPayments(data.payments || [])
      }
    } catch (error) {
      console.error("Erro ao carregar pagamentos:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPayments()
  }, [loadPayments])

  const filteredPayments = payments
    .filter(p => filter === "all" || p.status === filter)
    .filter(p =>
      p.user_email?.toLowerCase().includes(search.toLowerCase()) ||
      p.status?.toLowerCase().includes(search.toLowerCase())
    )

  const approvedPayments = payments.filter(p => p.status === "approved")
  const totalRevenue = approvedPayments.reduce((acc, p) => acc + (p.amount || 0), 0)
  const pendingCount = payments.filter(p => p.status === "pending").length

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-500">
            <CheckCircle className="w-3 h-3" /> Aprovado
          </span>
        )
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/10 text-yellow-500">
            <Clock className="w-3 h-3" /> Pendente
          </span>
        )
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-500">
            <XCircle className="w-3 h-3" /> Rejeitado
          </span>
        )
      default:
        return <span className="text-xs text-[#666]">{status}</span>
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Pagamentos</h1>
        <button
          onClick={loadPayments}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#888] hover:text-white hover:bg-white/5 disabled:opacity-50 transition-all"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-3">
        <div className="rounded-xl p-4 bg-[#111] border border-white/5">
          <p className="text-2xl font-bold text-white">{payments.length}</p>
          <p className="text-sm text-[#666]">Total</p>
        </div>
        <div className="rounded-xl p-4 bg-[#95e468]/5 border border-[#95e468]/20">
          <p className="text-2xl font-bold text-[#95e468]">R$ {totalRevenue.toFixed(2)}</p>
          <p className="text-sm text-[#666]">Receita</p>
        </div>
        <div className="rounded-xl p-4 bg-yellow-500/5 border border-yellow-500/20">
          <p className="text-2xl font-bold text-yellow-500">{pendingCount}</p>
          <p className="text-sm text-[#666]">Pendentes</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666]" />
          <input
            placeholder="Buscar pagamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm text-white placeholder:text-[#666] bg-[#111] border border-white/5 focus:outline-none focus:border-[#95e468]/30 transition-all"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "approved", "pending", "rejected"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? "bg-[#95e468] text-black"
                  : "bg-white/5 text-[#888] hover:text-white"
              }`}
            >
              {f === "all" ? "Todos" : f === "approved" ? "Aprovados" : f === "pending" ? "Pendentes" : "Rejeitados"}
            </button>
          ))}
        </div>
      </div>

      {/* Payments Table */}
      <div className="rounded-xl bg-[#111] border border-white/5 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-[#95e468] animate-spin" />
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <CreditCard className="h-10 w-10 text-[#444] mb-3" />
            <p className="text-sm text-[#666]">
              {payments.length === 0 ? "Nenhum pagamento" : "Nenhum resultado"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase">Usuario</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase">Valor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase">Data</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="border-b border-white/[0.02] hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#95e468]/10 flex items-center justify-center text-xs font-bold text-[#95e468]">
                          {payment.user_email?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <span className="text-sm text-white">{payment.user_email || "-"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-[#95e468]">
                        R$ {(payment.amount || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(payment.status)}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#666]">
                      {new Date(payment.created_at).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

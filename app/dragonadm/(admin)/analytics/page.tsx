"use client"

import { useEffect, useState } from "react"
import { TrendingUp, Users, Bot, CreditCard, DollarSign, Calendar } from "lucide-react"

interface AnalyticsData {
  totalUsers: number
  activeUsers: number
  bannedUsers: number
  totalBots: number
  activeBots: number
  totalPayments: number
  pendingPayments: number
  totalRevenue: number
  // Dados por periodo
  usersThisMonth: number
  usersLastMonth: number
  revenueThisMonth: number
  revenueLastMonth: number
  botsThisMonth: number
  botsLastMonth: number
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d")

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const res = await fetch(`/api/dragonadm/analytics?period=${period}`)
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      } catch (error) {
        console.error("Erro ao carregar analytics:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadAnalytics()
  }, [period])

  const calcGrowth = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 100)
  }

  const metrics = [
    {
      label: "Usuarios Total",
      value: data?.totalUsers || 0,
      icon: Users,
      growth: calcGrowth(data?.usersThisMonth || 0, data?.usersLastMonth || 0),
    },
    {
      label: "Novos este mes",
      value: data?.usersThisMonth || 0,
      icon: TrendingUp,
      growth: calcGrowth(data?.usersThisMonth || 0, data?.usersLastMonth || 0),
    },
    {
      label: "Bots Criados",
      value: data?.totalBots || 0,
      icon: Bot,
      growth: calcGrowth(data?.botsThisMonth || 0, data?.botsLastMonth || 0),
    },
    {
      label: "Bots Ativos",
      value: data?.activeBots || 0,
      icon: Bot,
      highlight: true,
    },
    {
      label: "Pagamentos",
      value: data?.totalPayments || 0,
      icon: CreditCard,
    },
    {
      label: "Pendentes",
      value: data?.pendingPayments || 0,
      icon: CreditCard,
    },
    {
      label: "Receita Total",
      value: `R$ ${(data?.totalRevenue || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      highlight: true,
    },
    {
      label: "Receita este mes",
      value: `R$ ${(data?.revenueThisMonth || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      growth: calcGrowth(data?.revenueThisMonth || 0, data?.revenueLastMonth || 0),
    },
  ]

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <div className="flex items-center gap-2">
          {(["7d", "30d", "90d"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                period === p
                  ? "bg-[#95e468] text-black"
                  : "bg-white/5 text-[#888] hover:text-white"
              }`}
            >
              {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "90 dias"}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric, i) => (
          <div
            key={i}
            className={`rounded-xl p-5 border transition-all hover:border-[#95e468]/30 ${
              metric.highlight ? "bg-[#95e468]/5 border-[#95e468]/20" : "bg-[#111] border-white/5"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                metric.highlight ? "bg-[#95e468]/20" : "bg-white/5"
              }`}>
                <metric.icon className={`h-5 w-5 ${metric.highlight ? "text-[#95e468]" : "text-white/60"}`} />
              </div>
              {metric.growth !== undefined && (
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  metric.growth >= 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                }`}>
                  {metric.growth >= 0 ? "+" : ""}{metric.growth}%
                </span>
              )}
            </div>
            <p className={`text-2xl font-bold mb-1 ${metric.highlight ? "text-[#95e468]" : "text-white"}`}>
              {isLoading ? "..." : metric.value}
            </p>
            <p className="text-sm text-[#666]">{metric.label}</p>
          </div>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl p-5 bg-[#111] border border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#95e468]/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-[#95e468]" />
            </div>
            <h3 className="text-lg font-semibold text-white">Usuarios</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#888]">Total</span>
              <span className="text-sm font-medium text-white">{data?.totalUsers || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#888]">Ativos</span>
              <span className="text-sm font-medium text-green-500">{data?.activeUsers || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#888]">Banidos</span>
              <span className="text-sm font-medium text-red-500">{data?.bannedUsers || 0}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl p-5 bg-[#111] border border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#95e468]/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-[#95e468]" />
            </div>
            <h3 className="text-lg font-semibold text-white">Receita</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#888]">Total</span>
              <span className="text-sm font-medium text-white">
                R$ {(data?.totalRevenue || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#888]">Este mes</span>
              <span className="text-sm font-medium text-[#95e468]">
                R$ {(data?.revenueThisMonth || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#888]">Mes anterior</span>
              <span className="text-sm font-medium text-[#666]">
                R$ {(data?.revenueLastMonth || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

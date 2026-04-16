"use client"

import { useEffect, useState } from "react"
import {
  Users,
  Bot,
  DollarSign,
  ArrowUpRight,
} from "lucide-react"

interface DashboardStats {
  totalUsers: number
  totalBots: number
  totalRevenue: number
}

export default function DragonAdmDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch("/api/dragonadm/stats")
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch (error) {
        console.error("Erro ao carregar stats:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadStats()
  }, [])

  const statCards = [
    { 
      title: "Total Usuarios", 
      value: stats?.totalUsers || 0, 
      icon: Users,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20"
    },
    { 
      title: "Total Bots", 
      value: stats?.totalBots || 0, 
      icon: Bot,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-500/20"
    },
    { 
      title: "Receita Total", 
      value: `R$ ${(stats?.totalRevenue || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "text-[#BFFF00]",
      bgColor: "bg-[#BFFF00]/10",
      borderColor: "border-[#BFFF00]/20"
    },
  ]

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#BFFF00]/10">
          <div className="w-2 h-2 rounded-full bg-[#BFFF00]" />
          <span className="text-xs text-[#BFFF00]">Online</span>
        </div>
      </div>

      {/* Stats Grid - 3 cards principais */}
      <div className="grid gap-4 sm:grid-cols-3">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className={`rounded-xl p-6 border ${stat.bgColor} ${stat.borderColor} transition-all hover:scale-[1.02]`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bgColor}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </div>
            <p className={`text-3xl font-bold mb-1 ${stat.color}`}>
              {isLoading ? "..." : stat.value}
            </p>
            <p className="text-sm text-[#888]">{stat.title}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Users, label: "Usuarios", desc: "Gerenciar usuarios", href: "/dragonadm/users" },
          { icon: Bot, label: "Bots", desc: "Ver todos os bots", href: "/dragonadm/bots" },
          { icon: DollarSign, label: "Pagamentos", desc: "Historico de pagamentos", href: "/dragonadm/payments" },
        ].map((action, i) => (
          <a
            key={i}
            href={action.href}
            className="group rounded-xl p-4 bg-[#111] border border-white/5 hover:border-[#BFFF00]/30 transition-all flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-lg bg-[#BFFF00]/10 flex items-center justify-center group-hover:bg-[#BFFF00]/20 transition-colors">
              <action.icon className="h-6 w-6 text-[#BFFF00]" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">{action.label}</h3>
              <p className="text-xs text-[#666]">{action.desc}</p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-[#444] ml-auto group-hover:text-[#BFFF00] transition-colors" />
          </a>
        ))}
      </div>
    </div>
  )
}

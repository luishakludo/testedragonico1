"use client"

import { useEffect, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Bot, Search, RefreshCw, Loader2, CheckCircle, XCircle, User } from "lucide-react"

interface BotData {
  id: string
  name: string
  username: string
  is_active: boolean
  created_at: string
  user_email?: string
}

export default function BotsPage() {
  const [bots, setBots] = useState<BotData[]>([])
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  const loadBots = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/dragonadm/bots")
      if (res.ok) {
        const data = await res.json()
        setBots(data.bots || [])
      }
    } catch (error) {
      console.error("Erro ao carregar bots:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBots()
  }, [loadBots])

  const filteredBots = bots.filter(b =>
    b.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.username?.toLowerCase().includes(search.toLowerCase())
  )

  const activeBots = bots.filter(b => b.is_active).length

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Bots</h1>
        <button
          onClick={loadBots}
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
          <p className="text-2xl font-bold text-white">{bots.length}</p>
          <p className="text-sm text-[#666]">Total</p>
        </div>
        <div className="rounded-xl p-4 bg-[#95e468]/5 border border-[#95e468]/20">
          <p className="text-2xl font-bold text-[#95e468]">{activeBots}</p>
          <p className="text-sm text-[#666]">Ativos</p>
        </div>
        <div className="rounded-xl p-4 bg-[#111] border border-white/5">
          <p className="text-2xl font-bold text-[#666]">{bots.length - activeBots}</p>
          <p className="text-sm text-[#666]">Inativos</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666]" />
        <input
          placeholder="Buscar bot..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80 pl-10 pr-4 py-2.5 rounded-lg text-sm text-white placeholder:text-[#666] bg-[#111] border border-white/5 focus:outline-none focus:border-[#95e468]/30 transition-all"
        />
      </div>

      {/* Bots Table */}
      <div className="rounded-xl bg-[#111] border border-white/5 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-[#95e468] animate-spin" />
          </div>
        ) : filteredBots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Bot className="h-10 w-10 text-[#444] mb-3" />
            <p className="text-sm text-[#666]">
              {bots.length === 0 ? "Nenhum bot" : "Nenhum resultado"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase">Bot</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase">Username</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase">Dono</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase">Criado</th>
                </tr>
              </thead>
              <tbody>
                {filteredBots.map((bot) => (
                  <tr key={bot.id} className="border-b border-white/[0.02] hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#95e468]/10 flex items-center justify-center">
                          <Bot className="w-4 h-4 text-[#95e468]" />
                        </div>
                        <span className="text-sm font-medium text-white">{bot.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-[#888]">@{bot.username}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-[#666]">
                        <User className="w-3.5 h-3.5" />
                        {bot.user_email || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {bot.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-500">
                          <CheckCircle className="w-3 h-3" /> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-white/5 text-[#666]">
                          <XCircle className="w-3 h-3" /> Inativo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#666]">
                      {new Date(bot.created_at).toLocaleDateString("pt-BR")}
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

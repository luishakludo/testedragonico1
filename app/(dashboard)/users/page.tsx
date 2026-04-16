"use client"

import { useState, useEffect, useCallback } from "react"


import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { NoBotSelected } from "@/components/no-bot-selected"
import { useBots } from "@/lib/bot-context"
import {
  Users, Crown, Search, TrendingUp, Clock, X,
  ArrowDown, Calendar, Activity, ChevronRight, Loader2, RefreshCw, Star,
} from "lucide-react"
import Image from "next/image"

// --- Types ---
interface BotUserData {
  id: string
  nome: string
  telegram: string
  assinante: boolean
  diasRestantes: number
  plano: string | null
  iniciadoEm: string
  ultimaAtividade: string
  etapa: number
  isVip: boolean
  vipSince: string | null
  vipExpiresAt: string | null
}

interface KPIsData {
  totalUsuarios: number
  assinantes: number
  expirando7d: number
  taxaConversao: number
}

interface FunnelStep {
  id: string
  label: string
  count: number
}

interface ApiResponse {
  kpis: KPIsData
  funnel: FunnelStep[]
  users: BotUserData[]
}

type FilterType = "todos" | "assinantes" | "nao_assinantes" | "expirando" | "vip"

// --- Dragon Icon (inline, works like lucide icon) ---
function DragonIconInline({ className }: { className?: string }) {
  return (
    <Image
      src="/images/dragon-icon.png"
      alt=""
      width={20}
      height={20}
      className={className}
    />
  )
}

// --- KPI Card - Dashboard Style ---
function KPICard({ icon: Icon, label, value, suffix, iconBg, iconColor, isDark }: {
  icon: React.ElementType; label: string; value: string; suffix?: string
  iconBg: string; iconColor: string; isDark?: boolean
}) {
  return (
    <div className={`rounded-[24px] p-5 relative overflow-hidden ${isDark ? 'bg-foreground dark:bg-card' : 'bg-card border border-border shadow-sm'}`}>
      {isDark && <div className="absolute top-0 right-0 w-20 h-20 bg-[#a3e635] opacity-10 blur-[40px] rounded-full" />}
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1.5">
            <span className={`text-xs font-medium ${isDark ? 'text-muted-foreground' : 'text-muted-foreground'}`}>{label}</span>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl md:text-3xl font-bold tracking-tight ${isDark ? 'text-background dark:text-foreground' : 'text-foreground'}`}>{value}</span>
              {suffix && <span className={`text-sm font-medium ${isDark ? 'text-muted-foreground' : 'text-muted-foreground'}`}>{suffix}</span>}
            </div>
          </div>
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Funnel ---
const FUNNEL_PALETTE = [
  { gradient: "from-accent/80 to-accent/40", dot: "bg-accent", text: "text-accent" },
  { gradient: "from-blue-500/80 to-blue-500/40", dot: "bg-blue-500", text: "text-blue-500" },
  { gradient: "from-amber-500/80 to-amber-500/40", dot: "bg-amber-500", text: "text-amber-500" },
  { gradient: "from-emerald-500/80 to-emerald-500/40", dot: "bg-emerald-500", text: "text-emerald-500" },
  { gradient: "from-purple-500/80 to-purple-500/40", dot: "bg-purple-500", text: "text-purple-500" },
  { gradient: "from-rose-500/80 to-rose-500/40", dot: "bg-rose-500", text: "text-rose-500" },
  { gradient: "from-cyan-500/80 to-cyan-500/40", dot: "bg-cyan-500", text: "text-cyan-500" },
  { gradient: "from-orange-500/80 to-orange-500/40", dot: "bg-orange-500", text: "text-orange-500" },
]

function FunnelVisual({ funnel }: { funnel: FunnelStep[] }) {
  const maxCount = funnel[0]?.count || 1

  return (
    <div className="bg-card rounded-[24px] border border-border shadow-sm">
      <div className="p-5 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-bold text-foreground">Funil de Conversao</h3>
            <p className="text-xs text-muted-foreground mt-1">Acompanhe onde seus usuarios estao parando</p>
          </div>
          {funnel.length >= 2 && funnel[0].count > 0 && (
            <span className="bg-[#a3e635]/10 text-[#65a30d] px-3 py-1.5 rounded-full text-xs font-semibold">
              {'Taxa: ' + ((funnel[funnel.length - 1].count / funnel[0].count) * 100).toFixed(1) + '%'}
            </span>
          )}
        </div>

        {funnel[0]?.count === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary mb-3">
              <DragonIconInline className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhum usuario ainda</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Os dados aparecem quando alguem iniciar seu bot</p>
          </div>
        ) : (
          <div className="flex flex-col gap-0">
            {funnel.map((step, i) => {
              const pct = maxCount > 0 ? (step.count / maxCount) * 100 : 0
              const drop = i > 0 && funnel[i - 1].count > 0
                ? ((funnel[i - 1].count - step.count) / funnel[i - 1].count * 100).toFixed(1)
                : null
              const palette = FUNNEL_PALETTE[i % FUNNEL_PALETTE.length]
              const stepNum = i + 1

              return (
                <div key={step.id}>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center gap-0 shrink-0 w-10">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${palette.dot}/15`}>
                        <span className={`text-xs font-bold ${palette.text}`}>{stepNum}</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-foreground truncate mr-2">{step.label}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          {drop && Number(drop) > 0 && (
                            <span className="text-[11px] font-medium text-destructive/80">{'-' + drop + '%'}</span>
                          )}
                          <span className="text-sm font-bold text-foreground tabular-nums">
                            {step.count.toLocaleString("pt-BR")}
                          </span>
                        </div>
                      </div>
                      <div className="h-3 rounded-full bg-secondary/80 overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${palette.gradient} transition-all duration-700`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {i < funnel.length - 1 && (
                    <div className="flex items-center gap-4 py-1">
                      <div className="w-10 flex justify-center">
                        <div className="w-px h-4 bg-border" />
                      </div>
                      <div className="flex-1 flex items-center gap-2">
                        <ArrowDown className="h-3 w-3 text-muted-foreground/50" />
                        <span className="text-[10px] text-muted-foreground">
                          {(funnel[i].count - funnel[i + 1].count).toLocaleString("pt-BR") + ' desistiram'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// --- User Detail Drawer ---
function UserDetailDrawer({ user, onClose, funnel }: {
  user: BotUserData; onClose: () => void; funnel: FunnelStep[]
}) {
  // Encontrar em qual etapa do funil o usuario esta
  const userStepIndex = Math.min(user.etapa, funnel.length - 1)
  const currentStepLabel = funnel[userStepIndex]?.label || "Iniciou bot"
  const palette = FUNNEL_PALETTE[userStepIndex % FUNNEL_PALETTE.length]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold ${
              user.assinante ? "bg-accent/10 text-accent" : "bg-secondary text-muted-foreground"
            }`}>
              {user.nome.charAt(0)}
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">{user.nome}</h3>
              <p className="text-sm text-muted-foreground">{user.telegram}</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="mb-6 flex items-center gap-2">
          <Badge
            variant="outline"
            className={`rounded-lg px-3 py-1 text-xs font-semibold ${
              user.assinante
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : "bg-secondary text-muted-foreground border-border"
            }`}
          >
            {user.assinante ? "Assinante Ativo" : "Nao Assinante"}
          </Badge>
          {user.isVip && (
            <Badge
              variant="outline"
              className="rounded-lg px-3 py-1 text-xs font-semibold bg-amber-500/10 text-amber-500 border-amber-500/20 flex items-center gap-1"
            >
              <Star className="h-3 w-3 fill-amber-500" />
              VIP
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-secondary/50 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Inicio</span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {new Date(user.iniciadoEm).toLocaleDateString("pt-BR")}
            </span>
          </div>
          <div className="bg-secondary/50 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Atividade</span>
            </div>
            <span className="text-sm font-medium text-foreground">{user.ultimaAtividade}</span>
          </div>
          <div className="bg-secondary/50 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Crown className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Plano</span>
            </div>
            <span className="text-sm font-medium text-foreground">{user.plano || "Nenhum"}</span>
          </div>
          <div className="bg-secondary/50 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Expira em</span>
            </div>
            <span className={`text-sm font-medium ${
              user.diasRestantes <= 7 && user.diasRestantes > 0 ? "text-destructive" :
              user.diasRestantes <= 14 && user.diasRestantes > 0 ? "text-amber-500" : "text-foreground"
            }`}>
              {user.assinante ? user.diasRestantes + " dias" : "--"}
            </span>
          </div>
        </div>

        {user.isVip && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
              <span className="text-sm font-semibold text-amber-500">Status VIP</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">VIP desde</span>
                <p className="text-sm font-medium text-foreground mt-0.5">
                  {user.vipSince ? new Date(user.vipSince).toLocaleDateString("pt-BR") : "--"}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Expira em</span>
                <p className="text-sm font-medium text-foreground mt-0.5">
                  {user.vipExpiresAt ? new Date(user.vipExpiresAt).toLocaleDateString("pt-BR") : "Vitalicio"}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-secondary/50 rounded-xl p-4">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Posicao no Funil</span>
          <div className="flex items-center gap-1 mt-3">
            {funnel.map((_, idx) => {
              const stepPalette = FUNNEL_PALETTE[idx % FUNNEL_PALETTE.length]
              return (
                <div key={idx} className="flex-1">
                  <div className={`h-2 rounded-full transition-colors ${
                    idx <= userStepIndex ? stepPalette.dot : "bg-secondary"
                  }`} />
                </div>
              )
            })}
          </div>
          <p className={`text-sm font-medium mt-2 ${palette.text}`}>
            {currentStepLabel}
          </p>
        </div>
      </div>
    </div>
  )
}

// --- Main Page ---
export default function UsersPage() {
  const { selectedBot } = useBots()
  const [busca, setBusca] = useState("")
  const [filtro, setFiltro] = useState<FilterType>("todos")
  const [selectedUser, setSelectedUser] = useState<BotUserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ApiResponse | null>(null)

  const fetchData = useCallback(async () => {
    if (!selectedBot) return
    setLoading(true)
    try {
      const res = await fetch(`/api/bot-users?bot_id=${selectedBot.id}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [selectedBot])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (!selectedBot) {
    return (
      <>
        
        <NoBotSelected />
      </>
    )
  }

  const kpis = data?.kpis || { totalUsuarios: 0, assinantes: 0, expirando7d: 0, taxaConversao: 0 }
  const funnel = data?.funnel || [
    { id: "start", label: "Iniciaram o Bot", count: 0 },
    { id: "msg", label: "Receberam Mensagem", count: 0 },
    { id: "pay", label: "Chegaram ao Pagamento", count: 0 },
    { id: "sub", label: "Assinaram", count: 0 },
  ]
  const allUsers = data?.users || []

  const assinantes = allUsers.filter((u) => u.assinante)
  const naoAssinantes = allUsers.filter((u) => !u.assinante)
  const expirando = assinantes.filter((u) => u.diasRestantes <= 7 && u.diasRestantes > 0)
  const vipUsers = allUsers.filter((u) => u.isVip)

  const filtrados = allUsers.filter((u) => {
    const matchBusca =
      u.nome.toLowerCase().includes(busca.toLowerCase()) ||
      u.telegram.toLowerCase().includes(busca.toLowerCase())
    if (!matchBusca) return false
    switch (filtro) {
      case "assinantes": return u.assinante
      case "nao_assinantes": return !u.assinante
      case "expirando": return u.assinante && u.diasRestantes <= 7 && u.diasRestantes > 0
      case "vip": return u.isVip
      default: return true
    }
  })

  const filterTabs = [
    { key: "todos" as FilterType, label: "Todos", count: allUsers.length },
    { key: "vip" as FilterType, label: "VIP", count: vipUsers.length },
    { key: "assinantes" as FilterType, label: "Assinantes", count: assinantes.length },
    { key: "nao_assinantes" as FilterType, label: "Gratuitos", count: naoAssinantes.length },
    { key: "expirando" as FilterType, label: "Expirando", count: expirando.length },
  ]

  // Gerar labels a partir do funil dinamico
  const etapaLabels = funnel.map(f => f.label)

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <header className="px-4 md:px-8 py-5 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie os usuarios do seu bot</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 bg-card px-4 py-2.5 rounded-xl shadow-sm border border-border text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-8">
        <div className="flex flex-col gap-6">

          {/* KPI Cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <KPICard
              icon={Users} label="Total Usuarios" value={kpis.totalUsuarios.toLocaleString("pt-BR")}
              iconBg="bg-[#a3e635]/10" iconColor="text-[#65a30d]"
              isDark
            />
            <KPICard
              icon={Crown} label="Assinantes" value={kpis.assinantes.toLocaleString("pt-BR")}
              iconBg="bg-emerald-50" iconColor="text-emerald-600"
            />
            <KPICard
              icon={Clock} label="Expirando em 7d" value={kpis.expirando7d.toString()}
              iconBg="bg-amber-50" iconColor="text-amber-600"
            />
            <KPICard
              icon={TrendingUp} label="Conversao" value={kpis.taxaConversao.toString()} suffix="%"
              iconBg="bg-blue-50" iconColor="text-blue-600"
            />
          </div>

          {/* Funnel */}
          <FunnelVisual funnel={funnel} />

          {/* Users List */}
          <div className="bg-card rounded-[24px] border border-border shadow-sm">
            <div className="p-5 md:p-6">
              <div className="flex flex-col gap-4 mb-5">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-base font-bold text-foreground">Gerenciamento de Usuarios</h3>
                    <p className="text-xs text-muted-foreground">Usuarios que interagiram com seu bot</p>
                  </div>
                  <button
                    onClick={fetchData}
                    disabled={loading}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
                  </button>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-2 flex-wrap">
                    {filterTabs.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setFiltro(tab.key)}
                        className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                          filtro === tab.key
                            ? "bg-foreground dark:bg-card text-background dark:text-foreground"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {tab.label}
                        <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${
                          filtro === tab.key ? "bg-card/20 text-background dark:text-foreground" : "bg-gray-200 text-muted-foreground"
                        }`}>
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      className="w-full sm:w-56 bg-gray-50 pl-9 border-gray-200 rounded-xl h-10 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Loading state */}
              {loading && (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 text-accent animate-spin mb-3" />
                  <p className="text-sm text-muted-foreground">Carregando usuarios...</p>
                </div>
              )}

              {/* Empty state */}
              {!loading && filtrados.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary mb-3">
                    <Users className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {allUsers.length === 0 ? "Nenhum usuario ainda" : "Nenhum usuario encontrado"}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {allUsers.length === 0
                      ? "Quando alguem der /start no seu bot, aparece aqui"
                      : "Tente ajustar os filtros ou busca"}
                  </p>
                </div>
              )}

              {/* User cards */}
              {!loading && filtrados.length > 0 && (
                <div className="flex flex-col gap-2">
                  {filtrados.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className="flex items-center gap-3 md:gap-4 w-full rounded-xl bg-secondary/30 hover:bg-secondary/60 border border-transparent hover:border-border p-3 md:p-4 transition-all text-left group"
                    >
                      <div className={`flex h-9 w-9 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        user.assinante ? "bg-accent/15 text-accent" : "bg-secondary text-muted-foreground"
                      }`}>
                        {user.nome.charAt(0)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground truncate">{user.nome}</span>
                          {user.isVip && (
                            <Badge variant="outline" className="rounded-md border-amber-500/30 text-amber-500 bg-amber-500/10 text-[9px] px-1.5 py-0 flex items-center gap-1">
                              <Star className="h-2.5 w-2.5 fill-amber-500" />
                              VIP
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground hidden sm:inline">{user.telegram}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-muted-foreground">{etapaLabels[Math.min(user.etapa, etapaLabels.length - 1)] || "Iniciou bot"}</span>
                          {user.assinante && user.diasRestantes <= 7 && user.diasRestantes > 0 && (
                            <Badge variant="outline" className="rounded-md border-destructive/30 text-destructive bg-destructive/5 text-[9px] px-1.5 py-0">
                              {'Expira em ' + user.diasRestantes + 'd'}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <Badge
                          variant="outline"
                          className={`rounded-lg text-[10px] font-semibold hidden sm:flex ${
                            user.assinante
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : "bg-secondary text-muted-foreground border-border"
                          }`}
                        >
                          {user.assinante ? "Assinante" : "Gratuito"}
                        </Badge>

                        {user.assinante && (
                          <div className="items-center gap-2 hidden md:flex">
                            <div className="h-1.5 w-14 rounded-full bg-secondary overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  user.diasRestantes <= 7 ? "bg-destructive" :
                                  user.diasRestantes <= 14 ? "bg-amber-500" : "bg-emerald-500"
                                }`}
                                style={{ width: `${Math.min((user.diasRestantes / 30) * 100, 100)}%` }}
                              />
                            </div>
                            <span className={`text-[11px] font-medium tabular-nums w-6 text-right ${
                              user.diasRestantes <= 7 ? "text-destructive" :
                              user.diasRestantes <= 14 ? "text-amber-500" : "text-muted-foreground"
                            }`}>
                              {user.diasRestantes + 'd'}
                            </span>
                          </div>
                        )}

                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedUser && (
        <UserDetailDrawer user={selectedUser} onClose={() => setSelectedUser(null)} funnel={funnel} />
      )}
    </div>
  )
}

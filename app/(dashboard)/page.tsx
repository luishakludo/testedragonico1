"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import {
  Search,
  Moon,
  Sun,
  Settings,
  Calendar,

  Home,
  BarChart2,
  TrendingUp,
  Megaphone,
  Clock,
  FileText,
  FileBarChart,
  HelpCircle,
  ChevronDown,
  Minus,
  Plus,
  Send,
  Mic,

  List,
  X,
  Check,
  Bot,
  MessageSquare,
  Lock,
  User,
} from "lucide-react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { useBots } from "@/lib/bot-context"
import { useAuth } from "@/lib/auth-context"
import { NoBotSelected } from "@/components/no-bot-selected"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ChatDialog } from "@/components/chat/chat-dialog"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subMonths } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { DateRange } from "react-day-picker"

const dateRanges = [
  { label: "Hoje", value: "today" },
  { label: "Ontem", value: "yesterday" },
  { label: "Ultimos 7 dias", value: "7days" },
  { label: "Ultimos 30 dias", value: "30days" },
  { label: "Ultimos 3 meses", value: "3months" },
  { label: "Este mes", value: "month" },
  { label: "Este ano", value: "year" },
]

// Funcao para obter o range de datas baseado no preset
function getPresetDateRange(preset: string): DateRange {
  const now = new Date()
  switch (preset) {
    case "today":
      return { from: new Date(now.setHours(0, 0, 0, 0)), to: new Date() }
    case "yesterday": {
      const yesterday = subDays(new Date(), 1)
      yesterday.setHours(0, 0, 0, 0)
      const yesterdayEnd = subDays(new Date(), 1)
      yesterdayEnd.setHours(23, 59, 59, 999)
      return { from: yesterday, to: yesterdayEnd }
    }
    case "7days":
      return { from: subDays(new Date(), 7), to: new Date() }
    case "30days":
      return { from: subDays(new Date(), 30), to: new Date() }
    case "3months":
      return { from: subMonths(new Date(), 3), to: new Date() }
    case "month":
      return { from: startOfMonth(new Date()), to: new Date() }
    case "year":
      return { from: startOfYear(new Date()), to: new Date() }
    default:
      return { from: subDays(new Date(), 7), to: new Date() }
  }
}

// Funcao para formatar o label do range de datas
function formatDateRangeLabel(range: DateRange | undefined, preset: string): string {
  if (!range?.from) return "Selecionar periodo"
  
  const presetLabel = dateRanges.find(d => d.value === preset)?.label
  if (presetLabel && preset !== "custom") return presetLabel
  
  if (range.to) {
    return `${format(range.from, "dd/MM/yyyy")} - ${format(range.to, "dd/MM/yyyy")}`
  }
  return format(range.from, "dd/MM/yyyy")
}

const filterOptions = [
  { label: "Todos", value: "all" },
  { label: "Ativos", value: "active" },
  { label: "Inativos", value: "inactive" },
  { label: "Novos", value: "new" },
]

// Fetcher para SWR
const fetcher = (url: string) => fetch(url).then(res => res.json())

  // Tipo para conversa
  interface Conversation {
  id: string
  nome: string
  telegram: string
  telegramUserId: string
  telegramChatId: string
  mensagens: number
  status: string
  statusLabel: string
  tempoResposta: string
  resultado: string
  resultadoTipo: string
  fluxo: string | null
  iniciadoEm: string
  ultimaAtividade: string
}



export default function DashboardPage() {
  const { selectedBot, bots, setSelectedBot } = useBots()
  const { session } = useAuth()
  const { theme, setTheme } = useTheme()
  const [selectedDateRange, setSelectedDateRange] = useState("7days")
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>(getPresetDateRange("7days"))
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [editingYear, setEditingYear] = useState(false)
  const [yearInputValue, setYearInputValue] = useState(new Date().getFullYear().toString())


  const [tablePeriod, setTablePeriod] = useState("month")
  const [chatOpen, setChatOpen] = useState(false)
  const [selectedChatUserId, setSelectedChatUserId] = useState<string | null>(null)
  
  // Obter userId do usuario logado para filtrar dados corretamente
  const userId = session?.user?.id || session?.userId

  // Handler para selecionar preset de data
  const handlePresetSelect = (preset: string) => {
    setSelectedDateRange(preset)
    setDateRange(getPresetDateRange(preset))
    setIsDatePickerOpen(false)
  }

  // Handler para selecionar range customizado no calendario
  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setDateRange(range)
    if (range?.from && range?.to) {
      setSelectedDateRange("custom")
    }
  }

  // Buscar conversas recentes
  const { data: conversationsData, isLoading: loadingConversations } = useSWR<{
    conversations: Conversation[]
    total: number
  }>(
    selectedBot ? `/api/conversations?bot_id=${selectedBot.id}&period=${tablePeriod}` : null,
    fetcher,
    { refreshInterval: 30000 } // Atualizar a cada 30 segundos
  )

  // Construir URL de payments com filtro de periodo
  const paymentsUrl = userId
    ? selectedDateRange === "custom" && dateRange?.from && dateRange?.to
      ? `/api/payments/list?userId=${userId}&startDate=${dateRange.from.toISOString()}&endDate=${dateRange.to.toISOString()}&limit=1&offset=0`
      : `/api/payments/list?userId=${userId}&period=${selectedDateRange}&limit=1&offset=0`
    : null

  // Buscar dados de faturamento (payments) - usando userId e filtro de periodo
  const { data: paymentsData } = useSWR<{
    stats: {
      totalApproved: number
      approved: number
      approvedUniqueUsers: number
    }
  }>(
    paymentsUrl,
    fetcher,
    { refreshInterval: 30000 }
  )

  const faturamento = paymentsData?.stats?.totalApproved || 0

  const conversations = conversationsData?.conversations || []

  if (!selectedBot) {
    return <NoBotSelected />
  }

  const userName = session?.name || session?.email?.split("@")[0] || "Usuario"

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden bg-background">
      {/* Top Header */}
      <header className="px-8 py-5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4 bg-card px-4 py-2.5 rounded-full shadow-sm w-full max-w-[400px]">
          <Search size={18} className="text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar"
            className="bg-transparent border-none outline-none text-sm w-full placeholder-muted-foreground text-foreground"
          />
          <div className="hidden sm:flex items-center gap-1 bg-accent/20 text-accent-foreground px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap">
            <span>⌘</span> + <span>Space</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-10 h-10 bg-card rounded-full flex items-center justify-center text-muted-foreground shadow-sm hover:bg-muted transition-colors"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link href="/bots">
            <button className="w-10 h-10 bg-accent/30 rounded-full flex items-center justify-center text-accent-foreground shadow-sm hover:bg-accent/40 transition-colors">
              <Bot size={18} />
            </button>
          </Link>
          <div className="h-6 w-px bg-border mx-2"></div>
          <Popover>
            <PopoverTrigger asChild>
              <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center shadow-sm">
                  <Bot size={20} className="text-accent-foreground" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-foreground leading-tight">{selectedBot.name}</span>
                  <span className="text-[11px] text-muted-foreground">{selectedBot.status === "active" ? "Ativo" : "Inativo"}</span>
                </div>
                <ChevronDown size={16} className="text-muted-foreground ml-1" />
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="end">
              <div className="flex flex-col gap-1">
                {bots.map((bot) => (
                  <button
                    key={bot.id}
                    onClick={() => setSelectedBot(bot)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${selectedBot?.id === bot.id
                        ? "bg-accent/30 text-accent-foreground font-medium"
                        : "hover:bg-muted text-foreground"
                      }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${bot.status === "active" ? "bg-accent" : "bg-muted-foreground"}`} />
                    <span className="truncate">{bot.name}</span>
                    {selectedBot?.id === bot.id && <Check size={14} className="ml-auto" />}
                  </button>
                ))}
                <div className="h-px bg-border my-1" />
                <Link href="/bots" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-accent-foreground hover:bg-muted transition-colors">
                  <Plus size={14} />
                  <span>Gerenciar bots</span>
                </Link>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      {/* Dashboard Content Area */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {/* Content Header */}
        <div className="flex flex-row items-end justify-between mb-6 gap-4">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Painel Analítico
          </h1>
          <div className="flex items-center gap-3">
            {/* Backdrop blur overlay para date picker */}
            {isDatePickerOpen && (
              <div 
                className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
                onClick={() => setIsDatePickerOpen(false)}
              />
            )}
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 bg-card px-4 py-2.5 rounded-xl shadow-sm border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors relative z-50">
                  <Calendar size={16} className="text-muted-foreground" />
                  <span>{formatDateRangeLabel(dateRange, selectedDateRange)}</span>
                  <ChevronDown size={14} className="text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-50" align="end">
                <div className="flex">
                  {/* Sidebar de presets */}
                  <div className="w-40 border-r border-border p-3 flex flex-col gap-1">
                    {dateRanges.map((range) => (
                      <button
                        key={range.value}
                        onClick={() => handlePresetSelect(range.value)}
                        className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedDateRange === range.value
                            ? "bg-foreground text-background font-medium"
                            : "hover:bg-muted text-foreground"
                          }`}
                      >
                        {range.label}
                      </button>
                    ))}
                  </div>
                  
                  {/* Calendarios lado a lado */}
                  <div className="p-4">
                    <div className="flex gap-4">
                      <CalendarComponent
                        mode="range"
                        selected={dateRange}
                        onSelect={handleDateRangeSelect}
                        numberOfMonths={2}
                        locale={ptBR}
                        className="rounded-lg"
                      />
                    </div>
                    
                    {/* Rodape com range selecionado e botoes */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                      <div className="text-sm text-muted-foreground">
                        {dateRange?.from && dateRange?.to && (
                          <span>
                            {format(dateRange.from, "dd 'de' MMMM", { locale: ptBR })} - {format(dateRange.to, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsDatePickerOpen(false)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          className="bg-accent text-accent-foreground hover:bg-accent/90"
                          onClick={() => setIsDatePickerOpen(false)}
                        >
                          Aplicar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            
          </div>
        </div>

        {/* Grid Layout - Fixed 3 column layout with Dragon AI on right */}
        <div className="grid grid-cols-[1fr_240px] gap-4">
          {/* Sales Distribution Card - Top Left */}
          <div className="bg-foreground dark:bg-card rounded-[24px] p-5 text-background dark:text-foreground relative overflow-hidden shadow-lg">
            {/* Glow effect */}
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[80%] h-20 bg-accent opacity-20 blur-[40px] rounded-full pointer-events-none"></div>

            <div className="relative z-10">
              <h2 className="text-xl font-semibold mb-1">Distribuição de Vendas</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Métricas de vendas mostrando crescimento em leads, receita e performance
              </p>

              <div className="grid grid-cols-3 gap-4">
                {/* Metric 1 */}
                <div className="bg-background/10 dark:bg-secondary rounded-2xl p-5 border border-background/5 dark:border-border">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                    <div className="w-2 h-2 rounded-full bg-background dark:bg-foreground"></div>
                    Receita Total
                  </div>
                  <div className="text-3xl font-bold flex items-end gap-1">
                    {faturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-normal text-muted-foreground mb-1">R$</span>
                  </div>
                </div>
                {/* Metric 2 */}
                <div className="bg-background/10 dark:bg-secondary rounded-2xl p-5 border border-background/5 dark:border-border">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                    <div className="w-2 h-2 rounded-full bg-background dark:bg-foreground"></div>
                    ROI
                  </div>
                  <div className="text-3xl font-bold flex items-end gap-1">
                    0 <span className="text-sm font-normal text-muted-foreground mb-1">%</span>
                  </div>
                </div>
                {/* Metric 3 */}
                <div className="bg-background/10 dark:bg-secondary rounded-2xl p-5 border border-background/5 dark:border-border">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                    <div className="w-4 h-4 rounded-full bg-background/10 dark:bg-secondary flex items-center justify-center border border-muted-foreground/50">
                      <span className="text-[8px]">±</span>
                    </div>
                    Usuários Ativos
                  </div>
                  <div className="text-3xl font-bold">{paymentsData?.stats?.approvedUniqueUsers || 0}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Container para Análise de Vendas e Análise de Negócios lado a lado */}
          <div className="flex flex-row gap-6">
            {/* Sales Analysis Card */}
            <div className="flex-1 bg-card rounded-[24px] p-5 shadow-sm border border-border flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent"></span>
                  <h3 className="font-semibold text-foreground text-sm">Análise de Vendas</h3>
                </div>
              </div>

              <div className="flex-1 flex items-center gap-4">
                {/* Donut Chart Simulation */}
                <div className="relative w-24 h-24 flex-shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="transparent" className="stroke-muted" strokeWidth="12" strokeDasharray="4 4" />
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="url(#gradient)" strokeWidth="14" strokeDasharray="0 251" strokeDashoffset="0" className="drop-shadow-sm" strokeLinecap="round" />
                    <circle cx="50" cy="50" r="40" fill="transparent" className="stroke-accent" strokeWidth="14" strokeDasharray="0 251" strokeDashoffset="-180" strokeLinecap="round" />
                    <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#3b82f6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xs font-bold text-foreground">R${faturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-[8px] text-muted-foreground">Receita Total</span>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm bg-blue-600"></span>
                    <span className="text-xs font-bold text-foreground">{conversationsData?.total || 0}</span>
                    <span className="text-xs text-muted-foreground">Leads</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm bg-muted"></span>
                    <span className="text-xs font-bold text-foreground">{faturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-xs text-muted-foreground">Receita</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm bg-accent"></span>
                    <span className="text-xs font-bold text-foreground">0</span>
                    <span className="text-xs text-muted-foreground">Crescimento</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border text-[10px] text-muted-foreground flex items-center gap-1">
                <HelpCircle size={10} />
                Calculado a partir da atividade agregada do período
              </div>
            </div>

            {/* Deal Analysis Card */}
            <div className="flex-1 bg-accent/20 dark:bg-accent/10 rounded-[24px] p-5 shadow-sm border border-accent/30 dark:border-accent/20 flex flex-col relative overflow-hidden min-h-[220px]">
              {/* Background Stripes */}
              <div className="absolute inset-0 opacity-30 dark:opacity-20" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 8px, hsl(100 71% 65% / 0.3) 8px, hsl(100 71% 65% / 0.3) 16px)" }}></div>
              <div className="flex justify-between items-center mb-3 relative z-10">
                <div className="flex items-center gap-2">
                  <BarChart2 size={14} className="text-accent" />
                  <h3 className="font-semibold text-foreground text-sm">Análise de Negócios</h3>
                </div>
              </div>

              {/* Cards em Fileira */}
              <div className="flex-1 flex items-end gap-3 mt-1 z-10">
                {/* Card Ganhos - mostra usuarios que pagaram (conversoes) */}
                <div className="flex-1 h-[33%] bg-accent rounded-2xl p-3 relative overflow-hidden">
                  <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.3) 5px, rgba(255,255,255,0.3) 10px)" }}></div>
                  <div className="relative z-10 bg-white/90 dark:bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold text-foreground inline-block">Ganhos {paymentsData?.stats?.approved ?? 0}</div>
                </div>
                {/* Card Perdas */}
                <div className="flex-1 h-[33%] bg-secondary rounded-2xl p-3 shadow-lg">
                  <div className="bg-card/80 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold text-foreground inline-block">Perdas 0</div>
                </div>
                {/* Card Crescimento */}
                <div className="flex-1 h-[33%] bg-accent rounded-2xl p-3">
                  <div className="bg-white/90 dark:bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold text-foreground inline-block">Avanço 0</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Dragon AI Panel - Fixed position */}
          <div className="row-span-2 col-start-2 row-start-1">
            <div className="bg-foreground dark:bg-card rounded-[24px] p-5 flex flex-col shadow-2xl relative overflow-hidden border border-background/5 dark:border-border h-full">

              {/* Overlay "EM BREVE" com blur - Locked state */}
              <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[24px] backdrop-blur-md bg-black/50">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                    <Lock size={20} className="text-white/80" />
                  </div>
                  <span className="text-xl font-black text-white tracking-[0.2em] uppercase drop-shadow-lg">EM BREVE</span>
                  <span className="text-xs text-white/60 font-medium">Recurso em desenvolvimento</span>
                </div>
              </div>

              {/* Efeitos de fundo (Glow) */}
              <div className="absolute top-0 right-0 w-20 h-20 bg-accent opacity-10 blur-[40px] rounded-full"></div>
              <div className="absolute bottom-0 left-0 w-20 h-20 bg-blue-500 opacity-5 blur-[40px] rounded-full"></div>

              {/* Cabeçalho */}
              <div className="flex justify-between items-center mb-4 relative z-10">
                <button className="w-8 h-8 rounded-xl bg-background/10 dark:bg-secondary flex items-center justify-center border border-background/5 dark:border-border text-muted-foreground hover:text-background dark:hover:text-foreground transition-all">
                  <Minus size={14} />
                </button>
                <span className="font-black text-sm text-background dark:text-foreground tracking-[0.15em] italic uppercase">Dragon AI</span>
                <button className="w-8 h-8 rounded-xl bg-background/10 dark:bg-secondary flex items-center justify-center border border-background/5 dark:border-border text-muted-foreground hover:text-background dark:hover:text-foreground transition-all">
                  <Plus size={14} />
                </button>
              </div>

              {/* Área da Esfera 3D */}
              <div className="flex-1 flex flex-col items-center justify-center relative z-10 py-2">
                <div className="relative w-24 h-24 mb-4 group">
                  {/* Esfera Principal com Gradiente Complexo */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-accent via-green-500 to-green-900 shadow-[0_0_30px_rgba(163,230,53,0.3)] animate-[pulse_4s_ease-in-out_infinite] transition-transform duration-700 group-hover:scale-105"></div>

                  {/* Camada de Brilho e Reflexo (Efeito Vidro) */}
                  <div className="absolute inset-0 rounded-full shadow-[inset_-10px_-10px_20px_rgba(0,0,0,0.6),inset_10px_10px_20px_rgba(255,255,255,0.3)]"></div>

                  {/* Pontos de Luz Internos */}
                  <div className="absolute top-3 left-5 w-6 h-6 rounded-full bg-white/30 blur-md"></div>
                  <div className="absolute bottom-5 right-5 w-10 h-10 rounded-full bg-cyan-400/20 blur-xl"></div>

                  {/* Aro Externo Sutil */}
                  <div className="absolute -inset-2 rounded-full border border-accent/5 scale-95 group-hover:scale-100 transition-transform duration-1000"></div>
                </div>

                <h2 className="text-background/70 dark:text-foreground/70 text-sm font-medium text-center">Como posso ajudar?</h2>
              </div>

              {/* Botões de Ação (Pro Analysis & Report) */}
              <div className="flex gap-2 mb-3 relative z-10">
                <button className="flex-1 bg-background/10 dark:bg-secondary hover:bg-background/20 dark:hover:bg-secondary/80 px-3 py-2 rounded-lg border border-background/5 dark:border-border flex items-center gap-2 transition-all group">
                  <div className="w-6 h-6 rounded-full border border-accent flex items-center justify-center group-hover:shadow-[0_0_8px_rgba(163,230,53,0.3)] transition-all flex-shrink-0">
                    <Clock size={10} className="text-accent" />
                  </div>
                  <span className="text-[9px] font-medium text-background/80 dark:text-foreground/80">Análise</span>
                </button>

                <button className="flex-1 bg-background/10 dark:bg-secondary hover:bg-background/20 dark:hover:bg-secondary/80 px-3 py-2 rounded-lg border border-background/5 dark:border-border flex items-center gap-2 transition-all group">
                  <div className="w-6 h-6 rounded-full bg-background/30 dark:bg-muted/80 flex items-center justify-center group-hover:bg-background/40 dark:group-hover:bg-muted flex-shrink-0">
                    <FileText size={10} className="text-background dark:text-foreground" />
                  </div>
                  <span className="text-[9px] font-medium text-background/80 dark:text-foreground/80">Reportar</span>
                </button>
              </div>

              {/* Barra de Input / Chat */}
              <div className="relative z-10">
                <div className="bg-background/10 dark:bg-secondary rounded-xl p-1.5 pl-3 flex items-center border border-background/5 dark:border-border focus-within:border-accent/30 transition-colors">
                  <input
                    type="text"
                    placeholder="Pergunte o que quiser..."
                    className="bg-transparent border-none outline-none text-xs text-background dark:text-foreground placeholder-muted-foreground w-full font-medium"
                  />
                  <div className="flex items-center gap-1">
                    <button className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-background dark:hover:text-foreground transition-colors">
                      <Send size={12} className="transform rotate-45" />
                    </button>
                    <button className="w-8 h-8 rounded-lg bg-background dark:bg-background flex items-center justify-center text-muted-foreground hover:text-accent transition-all border border-background/10 dark:border-border">
                      <Mic size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Table Section */}
        <div className="mt-5 bg-card rounded-[24px] p-6 shadow-sm border border-border mb-4">
          {/* Table Header */}
          <div className="flex flex-row justify-between items-center mb-6 gap-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-accent/30 rounded flex items-center justify-center">
                <List size={12} className="text-accent-foreground" />
              </div>
              <h3 className="font-semibold text-foreground text-lg">
                Conversas Recentes
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-2 text-sm font-medium text-muted-foreground bg-muted px-3 py-1.5 rounded-lg border border-border hover:bg-muted/80 transition-colors">
                    {tablePeriod === "week" ? "Semana" : tablePeriod === "month" ? "Mes" : "Ano"}
                    <ChevronDown size={14} />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-32 p-2" align="end">
                  <div className="flex flex-col gap-1">
                    {[
                      { label: "Semana", value: "week" },
                      { label: "Mes", value: "month" },
                      { label: "Ano", value: "year" },
                    ].map((period) => (
                      <button
                        key={period.value}
                        onClick={() => setTablePeriod(period.value)}
                        className={`px-3 py-1.5 rounded text-xs text-left transition-colors ${tablePeriod === period.value
                            ? "bg-accent/30 text-accent-foreground font-medium"
                            : "hover:bg-muted text-muted-foreground"
                          }`}
                      >
                        {period.label}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="pb-3 font-medium px-2">Usuario</th>
                  <th className="pb-3 font-medium px-2">Mensagens</th>
                  <th className="pb-3 font-medium px-2">Status</th>
                  <th className="pb-3 font-medium px-2">Tempo de Resposta</th>
                  <th className="pb-3 font-medium px-2">Resultado</th>
                  <th className="pb-3 font-medium px-2 text-right">Acao</th>
                </tr>
              </thead>
              <tbody>
                {loadingConversations ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                        Carregando conversas...
                      </div>
                    </td>
                  </tr>
                ) : conversations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      Nenhuma conversa registrada ainda
                    </td>
                  </tr>
                ) : (
                  conversations.map((conv) => (
                    <tr 
                      key={conv.id} 
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
  onClick={() => {
    setSelectedChatUserId(conv.telegramUserId)
    setChatOpen(true)
  }}
                    >
                      {/* Usuario */}
                      <td className="py-4 px-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                            <User size={16} className="text-accent-foreground" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">{conv.nome}</span>
                            <span className="text-xs text-muted-foreground">{conv.telegram}</span>
                          </div>
                        </div>
                      </td>
                      {/* Mensagens */}
                      <td className="py-4 px-2">
                        <div className="flex items-center gap-2">
                          <MessageSquare size={14} className="text-muted-foreground" />
                          <span className="text-sm text-foreground">{conv.mensagens}</span>
                          {conv.fluxo && (
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full truncate max-w-[100px]">
                              {conv.fluxo}
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Status */}
                      <td className="py-4 px-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          conv.status === "ativo" 
                            ? "bg-green-500/20 text-green-600 dark:text-green-400" 
                            : conv.status === "aguardando"
                            ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                            : conv.status === "concluido"
                            ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            conv.status === "ativo" 
                              ? "bg-green-500" 
                              : conv.status === "aguardando"
                              ? "bg-yellow-500"
                              : conv.status === "concluido"
                              ? "bg-blue-500"
                              : "bg-muted-foreground"
                          }`}></span>
                          {conv.statusLabel}
                        </span>
                      </td>
                      {/* Tempo de Resposta */}
                      <td className="py-4 px-2">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Clock size={14} />
                          {conv.tempoResposta}
                        </div>
                      </td>
                      {/* Resultado */}
                      <td className="py-4 px-2">
                        <span className={`text-sm font-medium ${
                          conv.resultadoTipo === "positivo" 
                            ? "text-green-600 dark:text-green-400" 
                            : conv.resultadoTipo === "negativo"
                            ? "text-red-500 dark:text-red-400"
                            : "text-muted-foreground"
                        }`}>
                          {conv.resultado}
                        </span>
                      </td>
                      {/* Acao */}
                      <td className="py-4 px-2 text-right">
                        <Button
                          variant="outline"
                          size="sm"
  onClick={(e) => {
    e.stopPropagation()
    setSelectedChatUserId(conv.telegramUserId)
    setChatOpen(true)
  }}
                          className="gap-1.5"
                        >
                          <MessageSquare size={14} />
                          Abrir Chat
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Chat Dialog */}
      <ChatDialog 
        open={chatOpen} 
        onOpenChange={setChatOpen}
        botId={selectedBot?.id}
        initialUserId={selectedChatUserId || undefined}
      />
    </div>
  )
}

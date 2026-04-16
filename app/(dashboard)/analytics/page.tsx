"use client"


import { ScrollArea } from "@/components/ui/scroll-area"
import { NoBotSelected } from "@/components/no-bot-selected"
import { useBots } from "@/lib/bot-context"
import { 
  TrendingUp, 
  TrendingDown,
  Users, 
  Eye,
  ShoppingCart,
  CreditCard,
  ArrowRight,
  ChevronDown,
  MoreHorizontal,
  Zap,
  Target,
  Layers,
  Map,
  Clock,
  Calendar,
  Filter,
  RefreshCw,
  ExternalLink,
  ArrowUpRight,
  ChevronRight,
  Smartphone,
  Monitor,
  Tablet,
  Globe2,
  Search,
  Share2,
  Mail,
  MousePointerClick,
  Timer,
  Repeat,
  UserCheck,
  ShoppingBag,
  Banknote,
  Activity,
  BarChart2,
  PieChart as PieIcon,
  LineChart as LineIcon
} from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, 
  BarChart, Bar, Tooltip, LineChart, Line, Cell,
  RadialBarChart, RadialBar, Legend,
  ComposedChart
} from "recharts"

// Funnel Data - usando variações de #95e468
const funnelData = [
  { stage: "Visitantes", value: 45200, percentage: 100, color: "#95e468" },
  { stage: "Engajados", value: 28400, percentage: 63, color: "#7dd350" },
  { stage: "Leads", value: 12800, percentage: 28, color: "#65c238" },
  { stage: "Qualificados", value: 6400, percentage: 14, color: "#4dab20" },
  { stage: "Clientes", value: 2180, percentage: 5, color: "#3a8a15" },
]

// Realtime Data
const realtimeData = [
  { time: "agora", users: 847 },
  { time: "-1m", users: 823 },
  { time: "-2m", users: 756 },
  { time: "-3m", users: 789 },
  { time: "-4m", users: 834 },
  { time: "-5m", users: 801 },
  { time: "-6m", users: 778 },
  { time: "-7m", users: 745 },
  { time: "-8m", users: 812 },
  { time: "-9m", users: 856 },
]

// Revenue Timeline
const revenueTimeline = [
  { month: "Jan", atual: 42000, anterior: 38000 },
  { month: "Fev", atual: 48000, anterior: 41000 },
  { month: "Mar", atual: 52000, anterior: 45000 },
  { month: "Abr", atual: 61000, anterior: 52000 },
  { month: "Mai", atual: 58000, anterior: 55000 },
  { month: "Jun", atual: 72000, anterior: 58000 },
]

// Sources Data
const sourcesData = [
  { source: "Pesquisa Orgânica", visits: 18420, conversions: 1842, revenue: 36840, trend: 12.4 },
  { source: "Redes Sociais", visits: 12680, conversions: 1014, revenue: 24320, trend: 8.7 },
  { source: "Tráfego Direto", visits: 8940, conversions: 804, revenue: 18920, trend: -2.3 },
  { source: "Email Marketing", visits: 5620, conversions: 562, revenue: 14200, trend: 15.8 },
  { source: "Referências", visits: 3200, conversions: 288, revenue: 8640, trend: 5.2 },
]

// Device Data  
const deviceData = [
  { device: "Mobile", percentage: 58, icon: Smartphone, sessions: "26.4K" },
  { device: "Desktop", percentage: 32, icon: Monitor, sessions: "14.6K" },
  { device: "Tablet", percentage: 10, icon: Tablet, sessions: "4.5K" },
]

// Page Performance
const pagePerformance = [
  { page: "/produto/oferta-especial", views: 12840, avgTime: "4:32", bounceRate: 24 },
  { page: "/checkout/pagamento", views: 8920, avgTime: "2:18", bounceRate: 18 },
  { page: "/categoria/eletronicos", views: 7650, avgTime: "3:45", bounceRate: 32 },
  { page: "/landing/black-friday", views: 6420, avgTime: "5:12", bounceRate: 15 },
]

// Geography Data
const geoData = [
  { region: "São Paulo", percentage: 38, value: "R$ 145.2K" },
  { region: "Rio de Janeiro", percentage: 22, value: "R$ 84.3K" },
  { region: "Minas Gerais", percentage: 15, value: "R$ 57.4K" },
  { region: "Paraná", percentage: 12, value: "R$ 45.9K" },
  { region: "Outros", percentage: 13, value: "R$ 49.8K" },
]

export default function AnalyticsPage() {
  const { selectedBot } = useBots()

  if (!selectedBot) {
    return (
      <>

        <NoBotSelected />
      </>
    )
  }

  return (
    <>
      <ScrollArea className="flex-1">
        <div className="p-4 md:p-8 bg-background min-h-full">
          
          {/* Header Section */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                Central de Analytics
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Dados em tempo real e insights de performance
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-all shadow-sm">
                <Calendar size={16} />
                Últimos 30 dias
                <ChevronDown size={14} className="text-muted-foreground" />
              </button>
              <button className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-all shadow-sm">
                <Filter size={16} />
                Filtros
              </button>
              <button className="p-2.5 bg-foreground dark:bg-secondary text-background dark:text-foreground rounded-xl hover:bg-secondary transition-all shadow-sm">
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-12 gap-5">

            {/* Realtime Card - Big Feature */}
            <div className="col-span-12 lg:col-span-8 bg-foreground dark:bg-card rounded-[28px] p-6 md:p-8 text-background dark:text-foreground relative overflow-hidden">
              {/* Decorative Elements */}
              <div className="absolute top-0 right-0 w-80 h-80 bg-[#95e468] opacity-[0.07] blur-[100px] rounded-full pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-60 h-60 bg-blue-500 opacity-[0.05] blur-[80px] rounded-full pointer-events-none"></div>
              
              {/* Grid Pattern */}
              <div className="absolute inset-0 opacity-[0.03]" style={{
                backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                backgroundSize: '40px 40px'
              }}></div>

              <div className="relative z-10">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-[#95e468] animate-pulse"></div>
                    <span className="text-sm font-medium text-muted-foreground">Tempo Real</span>
                    <span className="px-2 py-0.5 bg-[#95e468]/20 text-[#95e468] text-xs font-semibold rounded-full">
                      LIVE
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Atualizado há 3s</span>
                    <button className="p-1.5 hover:bg-card/10 rounded-lg transition-colors">
                      <MoreHorizontal size={16} className="text-muted-foreground" />
                    </button>
                  </div>
                </div>

                {/* Main Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
                  <RealtimeStat 
                    label="Usuários Ativos"
                    value="847"
                    subvalue="agora"
                    trend={12}
                    icon={Users}
                  />
                  <RealtimeStat 
                    label="Páginas/Min"
                    value="2.4K"
                    subvalue="média"
                    trend={8}
                    icon={Layers}
                  />
                  <RealtimeStat 
                    label="Eventos/Min"
                    value="1.8K"
                    subvalue="tracking"
                    trend={-3}
                    icon={Zap}
                  />
                  <RealtimeStat 
                    label="Conversões"
                    value="34"
                    subvalue="última hora"
                    trend={22}
                    icon={Target}
                  />
                </div>

                {/* Realtime Chart */}
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={realtimeData}>
                      <defs>
                        <linearGradient id="realtimeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#95e468" stopOpacity={0.4}/>
                          <stop offset="100%" stopColor="#95e468" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area 
                        type="monotone" 
                        dataKey="users" 
                        stroke="#95e468" 
                        strokeWidth={2}
                        fill="url(#realtimeGrad)"
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Funnel Card */}
            <div className="col-span-12 lg:col-span-4 bg-card rounded-[28px] p-6 shadow-sm border border-border">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-foreground">Funil de Conversão</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Taxa geral: 4.8%</p>
                </div>
                <button className="p-2 hover:bg-muted rounded-xl transition-colors">
                  <ExternalLink size={16} className="text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-3">
                {funnelData.map((item, idx) => (
                  <div key={item.stage} className="relative">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-foreground">{item.stage}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">
                          {item.value.toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">({item.percentage}%)</span>
                      </div>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: `${item.percentage}%`,
                          backgroundColor: item.color
                        }}
                      />
                    </div>
                    {idx < funnelData.length - 1 && (
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                        <ChevronDown size={12} className="text-gray-300" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Drop-off médio</span>
                  <span className="text-sm font-semibold text-red-500">-37%</span>
                </div>
              </div>
            </div>

            {/* Revenue Comparison */}
            <div className="col-span-12 lg:col-span-8 bg-card rounded-[28px] p-6 shadow-sm border border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-semibold text-foreground">Receita Comparativa</h3>
                  <p className="text-sm text-muted-foreground">Período atual vs anterior</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#95e468]"></div>
                    <span className="text-xs text-muted-foreground">2026</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-muted-foreground/50"></div>
                    <span className="text-xs text-muted-foreground">2025</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-accent/20 rounded-2xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">Receita Total</p>
                  <p className="text-xl font-bold text-foreground">R$ 333K</p>
                  <p className="text-xs text-accent font-medium mt-1">+18.2% vs período</p>
                </div>
                <div className="bg-muted rounded-2xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">Ticket Médio</p>
                  <p className="text-xl font-bold text-foreground">R$ 247</p>
                  <p className="text-xs text-green-600 font-medium mt-1">+5.8%</p>
                </div>
                <div className="bg-muted rounded-2xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">LTV Cliente</p>
                  <p className="text-xl font-bold text-foreground">R$ 1.2K</p>
                  <p className="text-xs text-green-600 font-medium mt-1">+12.4%</p>
                </div>
              </div>

              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={revenueTimeline}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#95e468" stopOpacity={0.2}/>
                        <stop offset="100%" stopColor="#95e468" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: "#9ca3af", fontSize: 12 }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                      tickFormatter={(v) => `${v/1000}K`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(222 41% 12%)",
                        border: "1px solid hsl(222 25% 20%)",
                        borderRadius: "12px",
                        color: "#fafafa",
                        fontSize: 12,
                        padding: "12px 16px"
                      }}
                      formatter={(value: number) => [`R$ ${(value/1000).toFixed(1)}K`, ""]}
                    />
                    <Bar dataKey="anterior" fill="hsl(222 30% 25%)" radius={[6, 6, 0, 0]} barSize={24} />
                    <Line 
                      type="monotone" 
                      dataKey="atual" 
                      stroke="#95e468" 
                      strokeWidth={3}
                      dot={{ fill: "#95e468", strokeWidth: 0, r: 4 }}
                      activeDot={{ r: 6, fill: "#95e468" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Device Breakdown */}
            <div className="col-span-12 lg:col-span-4 bg-foreground dark:bg-card rounded-[28px] p-6 text-background dark:text-foreground relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-[#95e468] opacity-10 blur-[60px] rounded-full"></div>
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-semibold">Dispositivos</h3>
                  <span className="text-xs text-muted-foreground">45.5K sessões</span>
                </div>

                <div className="space-y-4">
                  {deviceData.map((device) => {
                    const Icon = device.icon
                    return (
                      <div key={device.device} className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-card/10 flex items-center justify-center">
                          <Icon size={18} className="text-[#95e468]" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium">{device.device}</span>
                            <span className="text-sm font-bold">{device.percentage}%</span>
                          </div>
                          <div className="h-1.5 bg-card/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-[#95e468] rounded-full"
                              style={{ width: `${device.percentage}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground w-12 text-right">{device.sessions}</span>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-6 pt-5 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Taxa de Rejeição Mobile</span>
                    <span className="text-sm font-semibold text-[#95e468]">28%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Traffic Sources Table */}
            <div className="col-span-12 lg:col-span-7 bg-card rounded-[28px] p-6 shadow-sm border border-border">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-foreground">Fontes de Tráfego</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Performance por canal de aquisição</p>
                </div>
                <button className="text-sm text-accent font-medium hover:underline flex items-center gap-1">
                  Ver detalhes <ChevronRight size={14} />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="pb-3 font-medium">Fonte</th>
                      <th className="pb-3 font-medium text-right">Visitas</th>
                      <th className="pb-3 font-medium text-right">Conversões</th>
                      <th className="pb-3 font-medium text-right">Receita</th>
                      <th className="pb-3 font-medium text-right">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {sourcesData.map((source, idx) => (
                      <tr key={source.source} className="border-b border-border last:border-0">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              idx === 0 ? 'bg-accent/20' : 'bg-muted'
                            }`}>
                              {idx === 0 && <Search size={14} className="text-accent" />}
                              {idx === 1 && <Share2 size={14} className="text-muted-foreground" />}
                              {idx === 2 && <Globe2 size={14} className="text-muted-foreground" />}
                              {idx === 3 && <Mail size={14} className="text-muted-foreground" />}
                              {idx === 4 && <ExternalLink size={14} className="text-muted-foreground" />}
                            </div>
                            <span className="font-medium text-foreground">{source.source}</span>
                          </div>
                        </td>
                        <td className="py-4 text-right text-muted-foreground">{source.visits.toLocaleString()}</td>
                        <td className="py-4 text-right text-muted-foreground">{source.conversions.toLocaleString()}</td>
                        <td className="py-4 text-right font-medium text-foreground">R$ {(source.revenue/1000).toFixed(1)}K</td>
                        <td className="py-4 text-right">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                            source.trend > 0 ? 'text-green-600' : 'text-red-500'
                          }`}>
                            {source.trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {Math.abs(source.trend)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Geography Card */}
            <div className="col-span-12 lg:col-span-5 bg-card dark:bg-card rounded-[28px] p-6 border border-border shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-foreground">Distribuição Geográfica</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Receita por região</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Map size={18} className="text-accent" />
                </div>
              </div>

              <div className="space-y-3">
                {geoData.map((region, idx) => (
                  <div key={region.region} className="flex items-center gap-4 bg-muted/50 rounded-2xl p-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground">{region.region}</span>
                        <span className="text-sm font-bold text-foreground">{region.value}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-accent rounded-full"
                          style={{ width: `${region.percentage}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right">{region.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Pages */}
            <div className="col-span-12 lg:col-span-6 bg-card rounded-[28px] p-6 shadow-sm border border-border">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-foreground">Páginas Mais Acessadas</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Performance de páginas do site</p>
                </div>
                <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 bg-muted px-3 py-1.5 rounded-lg">
                  Últimas 24h <ChevronDown size={12} />
                </button>
              </div>

              <div className="space-y-3">
                {pagePerformance.map((page, idx) => (
                  <div key={page.page} className="flex items-center gap-4 p-3 hover:bg-muted rounded-xl transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{page.page}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Eye size={10} /> {page.views.toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Timer size={10} /> {page.avgTime}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Bounce</p>
                      <p className={`text-sm font-semibold ${page.bounceRate < 25 ? 'text-green-600' : 'text-orange-500'}`}>
                        {page.bounceRate}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="col-span-12 lg:col-span-6 grid grid-cols-2 gap-4">
              <QuickMetricCard 
                title="Tempo Médio"
                value="3:42"
                subtitle="na sessão"
                icon={Clock}
                trend={8.3}
                color="lime"
              />
              <QuickMetricCard 
                title="Taxa Retorno"
                value="34%"
                subtitle="visitantes"
                icon={Repeat}
                trend={-2.1}
                color="dark"
              />
              <QuickMetricCard 
                title="Novos Usuários"
                value="2.8K"
                subtitle="esta semana"
                icon={UserCheck}
                trend={15.6}
                color="white"
              />
              <QuickMetricCard 
                title="Carrinho Médio"
                value="R$ 312"
                subtitle="por pedido"
                icon={ShoppingBag}
                trend={4.2}
                color="white"
              />
            </div>

          </div>
        </div>
      </ScrollArea>
    </>
  )
}

// Realtime Stat Component
function RealtimeStat({ 
  label, 
  value, 
  subvalue, 
  trend, 
  icon: Icon 
}: { 
  label: string
  value: string
  subvalue: string
  trend: number
  icon: React.ElementType
}) {
  return (
    <div className="bg-muted/30 backdrop-blur-sm rounded-2xl p-4 border border-border/30">
      <div className="flex items-center justify-between mb-3">
        <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
          <Icon size={16} className="text-accent" />
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          trend > 0 
            ? 'text-accent bg-accent/20' 
            : 'text-red-400 bg-red-400/20'
        }`}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label} <span className="text-muted-foreground">{subvalue}</span></p>
    </div>
  )
}

// Quick Metric Card Component  
function QuickMetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color
}: {
  title: string
  value: string
  subtitle: string
  icon: React.ElementType
  trend: number
  color: 'lime' | 'dark' | 'white'
}) {
  const styles = {
    lime: 'bg-accent text-accent-foreground',
    dark: 'bg-secondary text-foreground',
    white: 'bg-card text-foreground border border-border shadow-sm'
  }
  
  const iconBg = {
    lime: 'bg-accent-foreground/20',
    dark: 'bg-muted',
    white: 'bg-muted'
  }

  return (
    <div className={`rounded-[24px] p-5 ${styles[color]}`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${iconBg[color]} flex items-center justify-center`}>
          <Icon size={18} className={color === 'dark' ? 'text-accent' : color === 'lime' ? 'text-accent-foreground' : 'text-muted-foreground'} />
        </div>
        <span className={`text-xs font-medium ${
          trend > 0 
            ? color === 'dark' ? 'text-accent' : 'text-accent-foreground' 
            : 'text-red-500'
        }`}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      </div>
      <p className={`text-xs ${color === 'dark' ? 'text-muted-foreground' : color === 'lime' ? 'text-accent-foreground/70' : 'text-muted-foreground'}`}>
        {title}
      </p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <p className={`text-xs mt-0.5 ${color === 'dark' ? 'text-muted-foreground' : color === 'lime' ? 'text-accent-foreground/70' : 'text-muted-foreground'}`}>
        {subtitle}
      </p>
    </div>
  )
}

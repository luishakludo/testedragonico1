"use client"

import { useEffect, useState } from "react"
import { getSupabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import {
  Gift,
  Search,
  Trophy,
  Medal,
  Crown,
  Gem,
  Loader2,
  User,
  CheckCircle,
  Package,
  Truck,
} from "lucide-react"

interface UserAward {
  id: string
  user_id: string
  award_type: "bronze" | "silver" | "gold" | "diamond"
  total_revenue: number
  claimed: boolean
  shipped: boolean
  tracking_code?: string
  created_at: string
  user?: {
    name: string
    email: string
  }
}

const awardConfig = {
  bronze: { label: "Bronze", threshold: 10000, icon: Medal, color: "text-orange-600", bg: "bg-orange-600/10" },
  silver: { label: "Prata", threshold: 50000, icon: Trophy, color: "text-gray-400", bg: "bg-gray-400/10" },
  gold: { label: "Ouro", threshold: 100000, icon: Crown, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  diamond: { label: "Diamante", threshold: 500000, icon: Gem, color: "text-cyan-400", bg: "bg-cyan-400/10" },
}

export default function PremiacoesPage() {
  const [awards, setAwards] = useState<UserAward[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedAward, setSelectedAward] = useState<UserAward | null>(null)
  const [trackingCode, setTrackingCode] = useState("")
  const [processing, setProcessing] = useState(false)
  const supabase = getSupabase()
  const { toast } = useToast()

  useEffect(() => {
    loadAwards()
  }, [])

  const loadAwards = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("user_awards")
        .select(`*, user:users(name, email)`)
        .order("created_at", { ascending: false })

      if (error) throw error
      setAwards(data || [])
    } catch (error) {
      console.error("Error loading awards:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleShip = async (id: string) => {
    if (!trackingCode.trim()) {
      toast({ title: "Erro", description: "Informe o codigo de rastreio", variant: "destructive" })
      return
    }

    setProcessing(true)
    try {
      const { error } = await supabase
        .from("user_awards")
        .update({ shipped: true, tracking_code: trackingCode })
        .eq("id", id)

      if (error) throw error
      
      toast({ title: "Enviado!", description: "Codigo de rastreio adicionado" })
      loadAwards()
      setSelectedAward(null)
      setTrackingCode("")
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao atualizar", variant: "destructive" })
    } finally {
      setProcessing(false)
    }
  }

  const filteredAwards = awards.filter(a => {
    return search === "" || 
      a.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
      a.user?.email?.toLowerCase().includes(search.toLowerCase())
  })

  const stats = {
    total: awards.length,
    pending: awards.filter(a => a.claimed && !a.shipped).length,
    shipped: awards.filter(a => a.shipped).length,
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Premiacoes</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie premiacoes e envio de placas
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Gift className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total de Premios</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">Pendentes de Envio</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.shipped}</p>
                  <p className="text-xs text-muted-foreground">Enviados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Award Thresholds */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Metas de Premiacao</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(awardConfig).map(([key, config]) => {
                const Icon = config.icon
                return (
                  <div key={key} className={`p-4 rounded-xl ${config.bg}`}>
                    <div className="flex items-center gap-3">
                      <Icon className={`h-6 w-6 ${config.color}`} />
                      <div>
                        <p className={`font-bold ${config.color}`}>{config.label}</p>
                        <p className="text-sm text-muted-foreground">
                          R$ {config.threshold.toLocaleString("pt-BR")}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou email..."
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Awards List */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Premios Conquistados</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
              </div>
            ) : filteredAwards.length === 0 ? (
              <div className="text-center py-12">
                <Gift className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-muted-foreground">Nenhuma premiacao encontrada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAwards.map((award) => {
                  const config = awardConfig[award.award_type]
                  const Icon = config.icon
                  return (
                    <div
                      key={award.id}
                      className="p-4 rounded-xl border border-border bg-secondary/30 flex items-center gap-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                      onClick={() => setSelectedAward(award)}
                    >
                      <div className={`w-10 h-10 rounded-full ${config.bg} flex items-center justify-center`}>
                        <Icon className={`h-5 w-5 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{award.user?.name || "Usuario"}</p>
                        <p className="text-sm text-muted-foreground truncate">{award.user?.email}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${config.color}`}>{config.label}</p>
                        <p className="text-xs text-muted-foreground">
                          R$ {award.total_revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        award.shipped ? "bg-emerald-500/10 text-emerald-500" :
                        award.claimed ? "bg-yellow-500/10 text-yellow-500" :
                        "bg-secondary text-muted-foreground"
                      }`}>
                        {award.shipped ? "Enviado" : award.claimed ? "Pendente" : "Nao resgatado"}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Award Details Modal */}
      <Dialog open={!!selectedAward} onOpenChange={() => { setSelectedAward(null); setTrackingCode(""); }}>
        <DialogContent className="sm:max-w-md">
          {selectedAward && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                {(() => {
                  const config = awardConfig[selectedAward.award_type]
                  const Icon = config.icon
                  return (
                    <>
                      <div className={`w-12 h-12 rounded-full ${config.bg} flex items-center justify-center`}>
                        <Icon className={`h-6 w-6 ${config.color}`} />
                      </div>
                      <div>
                        <h3 className={`font-semibold text-lg ${config.color}`}>
                          Placa {config.label}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {selectedAward.user?.name}
                        </p>
                      </div>
                    </>
                  )
                })()}
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-secondary">
                  <p className="text-xs text-muted-foreground mb-1">Faturamento Total</p>
                  <p className="text-xl font-bold text-accent">
                    R$ {selectedAward.total_revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-secondary">
                  <p className="text-xs text-muted-foreground mb-1">Email</p>
                  <p className="font-medium">{selectedAward.user?.email}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary">
                  <p className="text-xs text-muted-foreground mb-1">Data do Premio</p>
                  <p className="font-medium">
                    {new Date(selectedAward.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>

              {selectedAward.shipped ? (
                <div className="p-4 rounded-lg bg-emerald-500/10 text-center">
                  <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                  <p className="font-medium text-emerald-500">Placa Enviada</p>
                  {selectedAward.tracking_code && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Rastreio: <span className="font-mono">{selectedAward.tracking_code}</span>
                    </p>
                  )}
                </div>
              ) : selectedAward.claimed ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-yellow-500/10">
                    <p className="text-sm text-yellow-500 font-medium">Aguardando envio</p>
                  </div>
                  <Input
                    value={trackingCode}
                    onChange={(e) => setTrackingCode(e.target.value)}
                    placeholder="Codigo de rastreio (ex: BR123456789BR)"
                  />
                  <Button
                    className="w-full bg-accent hover:bg-accent/90"
                    onClick={() => handleShip(selectedAward.id)}
                    disabled={processing}
                  >
                    {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Truck className="h-4 w-4 mr-2" />}
                    Marcar como Enviado
                  </Button>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-secondary text-center">
                  <p className="text-muted-foreground">Usuario ainda nao resgatou o premio</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ScrollArea>
  )
}

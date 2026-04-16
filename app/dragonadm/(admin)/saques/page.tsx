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
  DollarSign,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  User,
  Wallet,
  TrendingUp,
  AlertTriangle,
} from "lucide-react"

interface Withdrawal {
  id: string
  user_id: string
  amount: number
  pix_key: string
  pix_key_type: string
  status: "pending" | "approved" | "rejected"
  created_at: string
  processed_at?: string
  user?: {
    name: string
    email: string
  }
}

export default function SaquesPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected" | "all">("pending")
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null)
  const [processing, setProcessing] = useState(false)
  const supabase = getSupabase()
  const { toast } = useToast()

  useEffect(() => {
    loadWithdrawals()
  }, [])

  const loadWithdrawals = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("withdrawals")
        .select(`*, user:users(name, email)`)
        .order("created_at", { ascending: false })

      if (error) throw error
      setWithdrawals(data || [])
    } catch (error) {
      console.error("Error loading withdrawals:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id: string) => {
    setProcessing(true)
    try {
      const { error } = await supabase
        .from("withdrawals")
        .update({ status: "approved", processed_at: new Date().toISOString() })
        .eq("id", id)

      if (error) throw error
      
      toast({ title: "Saque aprovado", description: "O saque foi aprovado com sucesso" })
      loadWithdrawals()
      setSelectedWithdrawal(null)
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao aprovar saque", variant: "destructive" })
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async (id: string) => {
    setProcessing(true)
    try {
      const { error } = await supabase
        .from("withdrawals")
        .update({ status: "rejected", processed_at: new Date().toISOString() })
        .eq("id", id)

      if (error) throw error
      
      toast({ title: "Saque rejeitado", description: "O saque foi rejeitado" })
      loadWithdrawals()
      setSelectedWithdrawal(null)
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao rejeitar saque", variant: "destructive" })
    } finally {
      setProcessing(false)
    }
  }

  const filteredWithdrawals = withdrawals.filter(w => {
    const matchesTab = activeTab === "all" || w.status === activeTab
    const matchesSearch = search === "" || 
      w.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
      w.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
      w.pix_key?.includes(search)
    return matchesTab && matchesSearch
  })

  const stats = {
    pending: withdrawals.filter(w => w.status === "pending").length,
    pendingAmount: withdrawals.filter(w => w.status === "pending").reduce((acc, w) => acc + w.amount, 0),
    approved: withdrawals.filter(w => w.status === "approved").length,
    approvedAmount: withdrawals.filter(w => w.status === "approved").reduce((acc, w) => acc + w.amount, 0),
  }

  const tabs = [
    { id: "pending", label: "Pendentes", count: stats.pending },
    { id: "approved", label: "Aprovados", count: stats.approved },
    { id: "rejected", label: "Rejeitados", count: withdrawals.filter(w => w.status === "rejected").length },
    { id: "all", label: "Todos", count: withdrawals.length },
  ]

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Saques</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie solicitacoes de saque dos usuarios
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">R$ {stats.pendingAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-muted-foreground">Valor Pendente</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.approved}</p>
                  <p className="text-xs text-muted-foreground">Aprovados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">R$ {stats.approvedAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-muted-foreground">Total Pago</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome, email ou chave PIX..."
                  className="pl-9"
                />
              </div>
              <div className="flex gap-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "bg-accent text-accent-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Withdrawals List */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Solicitacoes de Saque</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
              </div>
            ) : filteredWithdrawals.length === 0 ? (
              <div className="text-center py-12">
                <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-muted-foreground">Nenhum saque encontrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredWithdrawals.map((withdrawal) => (
                  <div
                    key={withdrawal.id}
                    className="p-4 rounded-xl border border-border bg-secondary/30 flex items-center gap-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                    onClick={() => setSelectedWithdrawal(withdrawal)}
                  >
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{withdrawal.user?.name || "Usuario"}</p>
                      <p className="text-sm text-muted-foreground truncate">{withdrawal.user?.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">R$ {withdrawal.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(withdrawal.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                      withdrawal.status === "pending" ? "bg-yellow-500/10 text-yellow-500" :
                      withdrawal.status === "approved" ? "bg-emerald-500/10 text-emerald-500" :
                      "bg-red-500/10 text-red-500"
                    }`}>
                      {withdrawal.status === "pending" ? "Pendente" :
                       withdrawal.status === "approved" ? "Aprovado" : "Rejeitado"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Withdrawal Details Modal */}
      <Dialog open={!!selectedWithdrawal} onOpenChange={() => setSelectedWithdrawal(null)}>
        <DialogContent className="sm:max-w-md">
          {selectedWithdrawal && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Detalhes do Saque</h3>
                  <p className="text-sm text-muted-foreground">ID: {selectedWithdrawal.id.slice(0, 8)}...</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-secondary">
                  <p className="text-xs text-muted-foreground mb-1">Usuario</p>
                  <p className="font-medium">{selectedWithdrawal.user?.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedWithdrawal.user?.email}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary">
                  <p className="text-xs text-muted-foreground mb-1">Valor</p>
                  <p className="text-2xl font-bold text-accent">
                    R$ {selectedWithdrawal.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-secondary">
                  <p className="text-xs text-muted-foreground mb-1">Chave PIX ({selectedWithdrawal.pix_key_type})</p>
                  <p className="font-mono text-sm">{selectedWithdrawal.pix_key}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary">
                  <p className="text-xs text-muted-foreground mb-1">Data da Solicitacao</p>
                  <p className="font-medium">
                    {new Date(selectedWithdrawal.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>

              {selectedWithdrawal.status === "pending" && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    onClick={() => handleReject(selectedWithdrawal.id)}
                    disabled={processing}
                  >
                    {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                    Rejeitar
                  </Button>
                  <Button
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                    onClick={() => handleApprove(selectedWithdrawal.id)}
                    disabled={processing}
                  >
                    {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                    Aprovar
                  </Button>
                </div>
              )}

              {selectedWithdrawal.status !== "pending" && (
                <div className={`p-3 rounded-lg text-center ${
                  selectedWithdrawal.status === "approved" 
                    ? "bg-emerald-500/10 text-emerald-500" 
                    : "bg-red-500/10 text-red-500"
                }`}>
                  <p className="font-medium">
                    {selectedWithdrawal.status === "approved" ? "Saque Aprovado" : "Saque Rejeitado"}
                  </p>
                  {selectedWithdrawal.processed_at && (
                    <p className="text-xs mt-1">
                      Processado em {new Date(selectedWithdrawal.processed_at).toLocaleString("pt-BR")}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ScrollArea>
  )
}

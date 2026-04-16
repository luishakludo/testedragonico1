"use client"

import { useEffect, useState } from "react"
import { getSupabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import {
  Ticket,
  Plus,
  Search,
  Trash2,
  Loader2,
  Copy,
  Check,
  Percent,
  Calendar,
  Users,
  ToggleLeft,
} from "lucide-react"

interface Coupon {
  id: string
  code: string
  discount_percent: number
  discount_fixed?: number
  max_uses?: number
  current_uses: number
  expires_at?: string
  active: boolean
  created_at: string
}

export default function CuponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    discount_percent: 10,
    discount_fixed: 0,
    max_uses: 100,
    expires_at: "",
    active: true,
  })
  const supabase = getSupabase()
  const { toast } = useToast()

  useEffect(() => {
    loadCoupons()
  }, [])

  const loadCoupons = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) throw error
      setCoupons(data || [])
    } catch (error) {
      console.error("Error loading coupons:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newCoupon.code.trim()) {
      toast({ title: "Erro", description: "Informe o codigo do cupom", variant: "destructive" })
      return
    }

    setCreating(true)
    try {
      const { error } = await supabase.from("coupons").insert({
        code: newCoupon.code.toUpperCase(),
        discount_percent: newCoupon.discount_percent,
        discount_fixed: newCoupon.discount_fixed || null,
        max_uses: newCoupon.max_uses || null,
        expires_at: newCoupon.expires_at || null,
        active: newCoupon.active,
        current_uses: 0,
      })

      if (error) throw error
      
      toast({ title: "Cupom criado!", description: `Codigo: ${newCoupon.code.toUpperCase()}` })
      loadCoupons()
      setShowCreateModal(false)
      setNewCoupon({
        code: "",
        discount_percent: 10,
        discount_fixed: 0,
        max_uses: 100,
        expires_at: "",
        active: true,
      })
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao criar cupom", variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  const handleToggle = async (id: string, active: boolean) => {
    try {
      const { error } = await supabase
        .from("coupons")
        .update({ active: !active })
        .eq("id", id)

      if (error) throw error
      loadCoupons()
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao atualizar", variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este cupom?")) return

    try {
      const { error } = await supabase.from("coupons").delete().eq("id", id)
      if (error) throw error
      toast({ title: "Cupom excluido" })
      loadCoupons()
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao excluir", variant: "destructive" })
    }
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  const filteredCoupons = coupons.filter(c => 
    search === "" || c.code.toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    total: coupons.length,
    active: coupons.filter(c => c.active).length,
    totalUses: coupons.reduce((acc, c) => acc + c.current_uses, 0),
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Cupons</h1>
            <p className="text-sm text-muted-foreground">
              Crie e gerencie cupons de desconto
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Plus className="h-4 w-4 mr-2" />
            Novo Cupom
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Ticket className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total de Cupons</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <ToggleLeft className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.active}</p>
                  <p className="text-xs text-muted-foreground">Cupons Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalUses}</p>
                  <p className="text-xs text-muted-foreground">Usos Totais</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por codigo..."
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Coupons List */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Cupons</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
              </div>
            ) : filteredCoupons.length === 0 ? (
              <div className="text-center py-12">
                <Ticket className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-muted-foreground">Nenhum cupom encontrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCoupons.map((coupon) => (
                  <div
                    key={coupon.id}
                    className={`p-4 rounded-xl border border-border bg-secondary/30 flex items-center gap-4 ${
                      !coupon.active ? "opacity-60" : ""
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <Percent className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-mono font-bold text-lg">{coupon.code}</p>
                        <button onClick={() => copyCode(coupon.code)} className="text-muted-foreground hover:text-foreground">
                          {copied === coupon.code ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {coupon.discount_percent}% de desconto
                        {coupon.max_uses && ` | ${coupon.current_uses}/${coupon.max_uses} usos`}
                      </p>
                    </div>
                    {coupon.expires_at && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Expira: {new Date(coupon.expires_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    )}
                    <Switch
                      checked={coupon.active}
                      onCheckedChange={() => handleToggle(coupon.id, coupon.active)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(coupon.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Coupon Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <Ticket className="h-6 w-6 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Novo Cupom</h3>
                <p className="text-sm text-muted-foreground">Criar cupom de desconto</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Codigo do Cupom</Label>
                <Input
                  value={newCoupon.code}
                  onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                  placeholder="PROMO10"
                  className="font-mono uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Desconto (%)</Label>
                  <Input
                    type="number"
                    value={newCoupon.discount_percent}
                    onChange={(e) => setNewCoupon({ ...newCoupon, discount_percent: Number(e.target.value) })}
                    min={1}
                    max={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Limite de Usos</Label>
                  <Input
                    type="number"
                    value={newCoupon.max_uses}
                    onChange={(e) => setNewCoupon({ ...newCoupon, max_uses: Number(e.target.value) })}
                    min={1}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Data de Expiracao (opcional)</Label>
                <Input
                  type="date"
                  value={newCoupon.expires_at}
                  onChange={(e) => setNewCoupon({ ...newCoupon, expires_at: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                <div>
                  <p className="font-medium">Cupom Ativo</p>
                  <p className="text-xs text-muted-foreground">Disponivel para uso</p>
                </div>
                <Switch
                  checked={newCoupon.active}
                  onCheckedChange={(checked) => setNewCoupon({ ...newCoupon, active: checked })}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreateModal(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-accent hover:bg-accent/90"
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Criar Cupom
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  )
}

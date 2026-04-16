"use client"

import { useEffect, useState, useCallback } from "react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import { Loader2, ExternalLink, ArrowRight, CheckCircle2, Wallet, User, CreditCard, Key, Clock } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import useSWR from "swr"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Erro ao carregar dados")
  }
  return res.json()
}

interface ReferralUser {
  id: string
  referred_id: string
  name: string
  email: string
  phone: string
  banned: boolean
  user_created_at: string
  referral_date: string
  coupon_code: string
}

export default function ReferralPage() {
  const { session } = useAuth()
  const userId = session?.userId
  const [couponInput, setCouponInput] = useState("")
  const [selectedUser, setSelectedUser] = useState<ReferralUser | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState("")
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [editInput, setEditInput] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [editError, setEditError] = useState("")

  // Withdraw modal state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawStep, setWithdrawStep] = useState(1)
  const [withdrawData, setWithdrawData] = useState({
    name: "",
    cpf: "",
    pixKey: "",
    amount: "",
  })
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState("")
  const [showWithdrawHistory, setShowWithdrawHistory] = useState(false)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const { data: couponData, mutate: mutateCoupon } = useSWR(
    userId ? `/api/referral/coupon?userId=${userId}` : null,
    fetcher,
    {
      onErrorRetry: (_error, _key, _config, revalidate, { retryCount }) => {
        if (retryCount >= 2) return
        setTimeout(() => revalidate({ retryCount }), 3000)
      },
    }
  )
  const { data: statsData, mutate: mutateStats } = useSWR(
    userId ? `/api/referral/stats?userId=${userId}` : null,
    fetcher,
    {
      refreshInterval: 30000,
      onErrorRetry: (_error, _key, _config, revalidate, { retryCount }) => {
        if (retryCount >= 2) return
        setTimeout(() => revalidate({ retryCount }), 3000)
      },
    }
  )
  const { data: referralsData } = useSWR(
    userId ? `/api/referral/referrals?userId=${userId}` : null,
    fetcher,
    {
      refreshInterval: 30000,
      onErrorRetry: (_error, _key, _config, revalidate, { retryCount }) => {
        if (retryCount >= 2) return
        setTimeout(() => revalidate({ retryCount }), 3000)
      },
    }
  )

  // Buscar histórico de saques do usuário
  const { data: withdrawsData, mutate: mutateWithdraws } = useSWR(
    userId ? `/api/referral/withdraw?userId=${userId}` : null,
    fetcher
  )

  const coupon = couponData?.coupon ?? null
  const totalReferrals = statsData?.total_referrals ?? 0
  const totalSales = statsData?.total_sales ?? 0
  // Ganhos totais (valor fixo definido pelo admin)
  const totalEarnings = statsData?.total_earnings ?? 0
  // Saldo disponível (desconta saques aprovados e pendentes)
  const availableBalance = statsData?.available_balance ?? 0
  const totalPending = statsData?.total_pending ?? 0
  const referrals: ReferralUser[] = referralsData?.referrals ?? []
  const withdrawHistory = withdrawsData?.withdraws ?? []

  const referralLink = coupon && origin
    ? `${origin}/b/${coupon.coupon_code}`
    : ""

  const handleCreateCoupon = useCallback(async () => {
    const code = couponInput.trim().toLowerCase()
    if (!code || !userId) return

    setIsCreating(true)
    setCreateError("")

    try {
      const res = await fetch("/api/referral/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coupon_code: code, userId }),
      })
      const data = await res.json()

      if (!res.ok) {
        setCreateError(data.error || "Erro ao criar cupom")
        return
      }

      setCouponInput("")
      mutateCoupon()
    } catch {
      setCreateError("Erro ao criar cupom")
    } finally {
      setIsCreating(false)
    }
  }, [couponInput, mutateCoupon, userId])

  const handleCopy = useCallback(() => {
    if (!referralLink) return
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [referralLink])

  const handleStartEdit = useCallback(() => {
    if (coupon) {
      setEditInput(coupon.coupon_code)
      setEditError("")
      setIsEditing(true)
    }
  }, [coupon])

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditInput("")
    setEditError("")
  }, [])

  const handleUpdateCoupon = useCallback(async () => {
    const code = editInput.trim().toLowerCase()
    if (!code || !userId) return

    setIsUpdating(true)
    setEditError("")

    try {
      const res = await fetch("/api/referral/coupon", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coupon_code: code, userId }),
      })
      const data = await res.json()

      if (!res.ok) {
        setEditError(data.error || "Erro ao atualizar cupom")
        return
      }

      setIsEditing(false)
      setEditInput("")
      mutateCoupon()
    } catch {
      setEditError("Erro ao atualizar cupom")
    } finally {
      setIsUpdating(false)
    }
  }, [editInput, mutateCoupon, userId])

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 11)
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
  }

  const openWithdrawModal = () => {
    setWithdrawStep(1)
    setWithdrawData({ name: "", cpf: "", pixKey: "", amount: "" })
    setWithdrawError("")
    setShowWithdrawModal(true)
  }

  const handleWithdrawSubmit = async () => {
  if (!userId) return
  
  const amount = parseFloat(withdrawData.amount.replace(",", "."))
  if (isNaN(amount) || amount <= 0) {
  setWithdrawError("Valor invalido")
  return
  }
  if (amount > availableBalance) {
  setWithdrawError("Saldo insuficiente")
  return
  }
    if (amount < 10) {
      setWithdrawError("Valor minimo de R$ 10,00")
      return
    }

    setIsWithdrawing(true)
    setWithdrawError("")

    try {
      const res = await fetch("/api/referral/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          amount,
          name: withdrawData.name,
          cpf: withdrawData.cpf.replace(/\D/g, ""),
          pixKey: withdrawData.pixKey,
        }),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        setWithdrawError(data.error || "Erro ao solicitar saque")
        return
      }

  toast.success("Saque solicitado com sucesso!")
  setShowWithdrawModal(false)
  // Atualizar dados
  mutateStats()
  mutateWithdraws()
  } catch {
  setWithdrawError("Erro ao solicitar saque")
  } finally {
  setIsWithdrawing(false)
  }
  }

  return (
    <>
      <ScrollArea className="flex-1">
        <div className="min-h-full bg-[#f3f4f6] text-[#1A1A1A] pb-8">
          <div className="w-full max-w-md mx-auto px-4 sm:px-6 lg:max-w-5xl space-y-6 pt-6">
            
            {/* Hero Section */}
            <section className="text-center space-y-2 lg:text-left">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#1A1A1A] text-balance">
                Convide amigos e ganhe comissoes
              </h2>
              <p className="text-[#666666] text-sm max-w-xs mx-auto lg:mx-0 lg:max-w-md">
                Ganhe ate 30% de comissao recorrente por cada novo usuario indicado.
              </p>
            </section>

            {/* Desktop: Two column layout for Earnings + Link */}
            <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-6 lg:space-y-0">
              {/* Earnings Hero Card */}
              <div className="relative overflow-hidden rounded-[24px] p-6 sm:p-8 bg-foreground dark:bg-card text-background dark:text-foreground">
                {/* Glow effect */}
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[80%] h-20 bg-accent opacity-20 blur-[40px] rounded-full pointer-events-none"></div>
                <div className="flex flex-col gap-4 sm:gap-6 relative z-10 h-full justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-muted-foreground text-xs uppercase tracking-widest font-semibold">Ganhos Totais</p>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setShowWithdrawHistory(true)}
                          className="text-muted-foreground hover:text-foreground font-medium rounded-xl px-3"
                        >
                          Historico
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={openWithdrawModal}
                          className="bg-accent hover:bg-accent/90 text-black font-bold border-0 rounded-xl px-4"
                        >
                          Sacar
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tighter">
                        R$ {totalEarnings.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 sm:pt-6 border-t border-background/10 dark:border-border">
                    <div>
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">Usuarios Indicados</p>
                      <p className="text-xl lg:text-2xl font-bold">{totalReferrals}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">Comissao Atual</p>
                      <p className="text-xl lg:text-2xl font-bold text-accent">15%</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Referral Link Section */}
              <div className="space-y-4 lg:bg-white lg:rounded-[24px] lg:p-6 lg:shadow-sm lg:border lg:border-[#EEEEEE]">
                <label className="text-xs font-semibold text-[#666666] uppercase tracking-wider">Seu link de indicacao</label>
              
              {coupon ? (
                <>
                  {isEditing ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Novo cupom (ex: maria20)"
                          value={editInput}
                          onChange={(e) => {
                            setEditInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                            setEditError("")
                          }}
                          className="flex-1 bg-white border-[#EEEEEE] rounded-2xl text-[#1A1A1A] placeholder:text-[#666666] focus:border-[#ccff00] h-14 shadow-sm"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              handleUpdateCoupon()
                            }
                            if (e.key === "Escape") {
                              handleCancelEdit()
                            }
                          }}
                          disabled={isUpdating}
                          maxLength={20}
                          autoFocus
                        />
                        <button
                          onClick={handleUpdateCoupon}
                          disabled={isUpdating || editInput.trim().length < 3}
                          className="bg-white border border-[#EEEEEE] p-4 rounded-2xl flex items-center justify-center disabled:opacity-50 hover:bg-gray-50 transition-colors shadow-sm"
                        >
                          {isUpdating ? <Loader2 className="h-5 w-5 animate-spin text-[#1A1A1A]" /> : (
                            <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#ccff00]" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={isUpdating}
                          className="bg-white border border-[#EEEEEE] p-4 rounded-2xl flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
                        >
                          <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#666666]" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                      {editError && <p className="text-xs text-red-500">{editError}</p>}
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <div className="flex-1 min-w-0 bg-white border border-[#EEEEEE] rounded-2xl px-4 flex items-center h-14 shadow-sm">
                          <span className="text-[#666666] text-sm truncate">{referralLink}</span>
                        </div>
                        <button
                          onClick={handleCopy}
                          className="flex-shrink-0 bg-white border border-[#EEEEEE] p-4 rounded-2xl flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
                        >
                          {copied ? (
                            <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#ccff00]" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#1A1A1A]" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={handleStartEdit}
                          className="flex-shrink-0 bg-white border border-[#EEEEEE] p-4 rounded-2xl flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
                        >
                          <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#1A1A1A]" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                      </div>
                      <button 
                        onClick={handleCopy}
                        className="w-full bg-[#ccff00] hover:bg-[#b8e600] text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-[0_10px_20px_rgba(204,255,0,0.3)]"
                      >
                        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="18" cy="5" r="3"/>
                          <circle cx="6" cy="12" r="3"/>
                          <circle cx="18" cy="19" r="3"/>
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                        </svg>
                        {copied ? "Link Copiado!" : "Compartilhar Link"}
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="flex flex-col gap-3">
                  <Input
                    placeholder="Digite seu cupom (ex: joao10)"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                      setCreateError("")
                    }}
                    className="w-full bg-white border-[#EEEEEE] rounded-2xl text-[#1A1A1A] placeholder:text-[#666666] focus:border-[#ccff00] h-14 shadow-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleCreateCoupon()
                      }
                    }}
                    disabled={isCreating}
                    maxLength={20}
                  />
                  <button 
                    onClick={handleCreateCoupon}
                    disabled={isCreating || couponInput.length < 3}
                    className="w-full bg-[#ccff00] hover:bg-[#b8e600] text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors shadow-[0_10px_20px_rgba(204,255,0,0.3)]"
                  >
                    {isCreating ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                      <>
                        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="5" x2="12" y2="19"/>
                          <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Criar Cupom
                      </>
                    )}
                  </button>
                  {createError && <p className="text-xs text-red-500">{createError}</p>}
                  <p className="text-xs text-[#666666] text-center lg:text-left">
                    Apenas letras minusculas, numeros e hifens. Entre 3 e 20 caracteres.
                  </p>
                </div>
              )}
              </div>
            </div>

            {/* Desktop: Two column layout for Table + Steps */}
            <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-6 lg:space-y-0">
            {/* Referral Table */}
            <section className="space-y-4 lg:flex-1 flex flex-col">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#666666] uppercase tracking-wider">Indicacoes Recentes</h3>
                {referrals.length > 0 && (
                  <button className="text-xs text-[#666666] font-medium hover:text-[#1A1A1A] transition-colors">Ver todas</button>
                )}
              </div>
              
              <div className="bg-[#16181d] border border-white/5 rounded-3xl overflow-hidden flex-1">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[300px]">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02]">
                        <th className="px-4 py-3 font-semibold text-gray-400">Usuario</th>
                        <th className="px-4 py-3 font-semibold text-gray-400">Status</th>
                        <th className="px-4 py-3 font-semibold text-gray-400 text-right">Comissao</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {/* Mostrar usuarios reais */}
                      {referrals.slice(0, 3).map((ref) => (
                        <tr key={ref.id} onClick={() => setSelectedUser(ref)} className="cursor-pointer hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="flex flex-col">
                              <span className="font-bold text-white text-xs">{ref.name}</span>
                              <span className="text-[10px] text-gray-400">{formatDate(ref.referral_date)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold",
                              ref.banned 
                                ? "bg-red-500/10 text-red-400" 
                                : "bg-[#ccff00]/20 text-[#ccff00]"
                            )}>
                              {ref.banned ? "Inativo" : "Ativo"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="font-bold text-white text-xs">R$ 0,10</span>
                          </td>
                        </tr>
                      ))}
                      {/* Preencher linhas vazias para manter altura fixa (3 linhas total) */}
                      {Array.from({ length: Math.max(0, 3 - referrals.length) }).map((_, index) => (
                        <tr key={`empty-${index}`} className="h-[44px]">
                          <td colSpan={3} className="px-4 py-2 text-center">
                            {index === 0 && referrals.length === 0 ? (
                              <div className="flex items-center justify-center gap-2">
                                <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="1.5">
                                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                                  <circle cx="9" cy="7" r="4"/>
                                  <line x1="19" y1="8" x2="19" y2="14"/>
                                  <line x1="22" y1="11" x2="16" y2="11"/>
                                </svg>
                                <span className="text-gray-500 text-xs">Compartilhe e atraia mais amigos!</span>
                              </div>
                            ) : (
                              <span className="text-gray-700/30 text-xs">---</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Program Steps */}
            <section className="space-y-4 lg:flex-1 flex flex-col">
              <h3 className="text-sm font-semibold text-[#666666] uppercase tracking-wider">Como funciona</h3>
              <div className="bg-[#16181d] rounded-3xl p-5 border border-white/5 flex-1 flex items-center">
                <div className="grid grid-cols-3 gap-4 items-center w-full">
                  {/* Step 1 */}
                  <div className="flex flex-col items-center text-center">
                    <div className="relative mb-2">
                      <div className="w-11 h-11 rounded-xl bg-[#ccff00] flex items-center justify-center shadow-[0_0_20px_rgba(204,255,0,0.3)]">
                        <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#1A1A1A]" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="22" y1="2" x2="11" y2="13"/>
                          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                      </div>
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#ccff00] text-[#1A1A1A] rounded-full text-[10px] font-bold flex items-center justify-center shadow-sm">1</span>
                    </div>
                    <p className="text-xs font-bold text-white mb-0.5">Compartilhe</p>
                    <p className="text-[10px] text-gray-400 leading-tight">Envie seu link exclusivo</p>
                  </div>

                  {/* Step 2 */}
                  <div className="flex flex-col items-center text-center">
                    <div className="relative mb-2">
                      <div className="w-11 h-11 rounded-xl bg-[#1f2128] border border-[#ccff00]/30 flex items-center justify-center">
                        <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#ccff00]" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                          <circle cx="9" cy="7" r="4"/>
                          <line x1="19" y1="8" x2="19" y2="14"/>
                          <line x1="22" y1="11" x2="16" y2="11"/>
                        </svg>
                      </div>
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#ccff00] text-[#1A1A1A] rounded-full text-[10px] font-bold flex items-center justify-center shadow-sm">2</span>
                    </div>
                    <p className="text-xs font-bold text-white mb-0.5">Cadastro</p>
                    <p className="text-[10px] text-gray-400 leading-tight">Amigo se cadastra e assina</p>
                  </div>

                  {/* Step 3 */}
                  <div className="flex flex-col items-center text-center">
                    <div className="relative mb-2">
                      <div className="w-11 h-11 rounded-xl bg-[#ccff00] flex items-center justify-center shadow-[0_0_20px_rgba(204,255,0,0.3)]">
                        <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#1A1A1A]" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="1" x2="12" y2="23"/>
                          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                        </svg>
                      </div>
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#ccff00] text-[#1A1A1A] rounded-full text-[10px] font-bold flex items-center justify-center shadow-sm">3</span>
                    </div>
                    <p className="text-xs font-bold text-white mb-0.5">Receba</p>
                    <p className="text-[10px] text-gray-400 leading-tight">Ganhe sua comissao</p>
                  </div>
                </div>
              </div>
            </section>
            </div>

          </div>
        </div>
      </ScrollArea>

      {/* User Details Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="bg-white border-[#EEEEEE] text-[#1A1A1A] rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1A1A1A]">Detalhes do Indicado</DialogTitle>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#ccff00] to-[#b8e600] flex items-center justify-center text-[#1A1A1A] font-bold text-xl">
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-lg text-[#1A1A1A]">{selectedUser.name}</p>
                  <div className={cn(
                    "inline-flex px-2 py-0.5 rounded text-xs font-medium mt-1",
                    selectedUser.banned 
                      ? "bg-red-500/10 text-red-600" 
                      : "bg-[#ccff00]/20 text-[#1A1A1A]"
                  )}>
                    {selectedUser.banned ? "Inativo" : "Ativo"}
                  </div>
                </div>
              </div>

              <div className="space-y-3 bg-[#F8F9FA] rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#666666]" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <span className="text-sm text-[#666666]">{selectedUser.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#666666]" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                  <span className="text-sm text-[#666666]">{selectedUser.phone || "Nao informado"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#666666]" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <span className="text-sm text-[#666666]">Indicado em {formatDate(selectedUser.referral_date)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Withdraw Modal - Matching original design */}
      <Dialog open={showWithdrawModal} onOpenChange={setShowWithdrawModal}>
        <DialogContent className="sm:max-w-[420px] bg-[#12141a] border-[#2a2d35] p-0 gap-0 overflow-hidden rounded-2xl [&>button]:text-gray-500 [&>button]:hover:text-white">
          <div className="px-6 pt-6 pb-6">
            {/* Header with title and step */}
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-2xl font-bold text-white">Saque</h2>
              <span className="text-xs text-white/40 font-mono bg-white/5 px-2 py-0.5 rounded">{withdrawStep}/4</span>
            </div>

            {/* Progress dots */}
            <div className="flex gap-2 mb-6">
              {[1, 2, 3, 4].map((step) => (
                <div 
                  key={step}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    step === withdrawStep 
                      ? "bg-[#ccff00] w-8" 
                      : step < withdrawStep 
                        ? "bg-[#ccff00]/50 w-4" 
                        : "bg-white/10 w-4"
                  )}
                />
              ))}
            </div>

            {/* Content */}
            <div className="space-y-5">
              {withdrawStep === 1 && (
                <>
                  {/* Saldo display card with gradient */}
                  <div className="relative rounded-2xl overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#ccff00]/10 via-[#ccff00]/5 to-transparent" />
                    <div className="absolute inset-0 border border-[#ccff00]/20 rounded-2xl" />
                    <div className="relative p-6 text-center">
                      <p className="text-xs uppercase tracking-widest text-[#ccff00]/60 mb-3">Saldo Disponivel</p>
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-[#ccff00]/60 text-lg font-medium">R$</span>
                        <span className="text-5xl font-black text-[#ccff00] tabular-nums">
                          {availableBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="mt-4 flex items-center justify-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#ccff00]" />
                        <span className="text-[11px] text-white/50">Min. R$ 10,00</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Input de valor */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-white/60 font-medium">Valor do saque</label>
                      <button 
                        type="button"
                        onClick={() => setWithdrawData({ ...withdrawData, amount: availableBalance.toFixed(2).replace(".", ",") })}
                        className="text-sm text-[#ccff00] hover:text-[#d4ff4d] font-semibold transition-colors"
                      >
                        Sacar tudo
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ccff00] font-semibold">R$</span>
                      <Input
                        type="text"
                        placeholder="0,00"
                        value={withdrawData.amount}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9,]/g, "")
                          setWithdrawData({ ...withdrawData, amount: value })
                        }}
                        className="bg-[#1a1d24] border-[#2a2d35] hover:border-[#3a3d45] focus:border-[#ccff00]/40 text-[#ccff00]/70 placeholder:text-[#ccff00]/30 h-14 text-xl font-semibold pl-12 pr-4 rounded-xl transition-colors"
                      />
                    </div>
                  </div>
                </>
              )}

              {withdrawStep === 2 && (
                <div className="space-y-5">
                  <div>
                    <span className="text-xs uppercase tracking-widest text-[#ccff00]/50">Identificacao</span>
                    <h4 className="text-xl font-bold text-white mt-1">Qual seu nome?</h4>
                    <p className="text-sm text-white/40 mt-1">Use o nome completo do titular da conta</p>
                  </div>
                  <Input
                    placeholder="Nome completo"
                    value={withdrawData.name}
                    onChange={(e) => setWithdrawData({ ...withdrawData, name: e.target.value })}
                    className="bg-[#1a1d24] border-[#2a2d35] hover:border-[#3a3d45] focus:border-[#ccff00]/40 text-white h-14 text-lg rounded-xl transition-colors"
                  />
                </div>
              )}

              {withdrawStep === 3 && (
                <div className="space-y-5">
                  <div>
                    <span className="text-xs uppercase tracking-widest text-[#ccff00]/50">Documento</span>
                    <h4 className="text-xl font-bold text-white mt-1">Informe seu CPF</h4>
                    <p className="text-sm text-white/40 mt-1">Necessario para validar a transferencia</p>
                  </div>
                  <Input
                    placeholder="000.000.000-00"
                    value={withdrawData.cpf}
                    onChange={(e) => setWithdrawData({ ...withdrawData, cpf: formatCPF(e.target.value) })}
                    className="bg-[#1a1d24] border-[#2a2d35] hover:border-[#3a3d45] focus:border-[#ccff00]/40 text-white h-14 text-lg font-mono rounded-xl transition-colors tracking-wider"
                    maxLength={14}
                  />
                </div>
              )}

              {withdrawStep === 4 && (
                <div className="space-y-5">
                  <div>
                    <span className="text-xs uppercase tracking-widest text-[#ccff00]/50">Destino</span>
                    <h4 className="text-xl font-bold text-white mt-1">Chave PIX</h4>
                    <p className="text-sm text-white/40 mt-1">Use a chave CPF para maior seguranca</p>
                  </div>
                  <Input
                    placeholder="Sua chave PIX"
                    value={withdrawData.pixKey}
                    onChange={(e) => setWithdrawData({ ...withdrawData, pixKey: e.target.value })}
                    className="bg-[#1a1d24] border-[#2a2d35] hover:border-[#3a3d45] focus:border-[#ccff00]/40 text-white h-14 text-lg rounded-xl transition-colors"
                  />

                  {/* Resumo compacto */}
                  <div className="mt-6 p-4 rounded-xl bg-[#0d0f12] border border-[#ccff00]/10">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs uppercase tracking-widest text-[#ccff00]/50">Resumo</span>
                    </div>
                    <div className="space-y-2.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/50">{withdrawData.name}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/50 font-mono">{withdrawData.cpf}</span>
                      </div>
                      <div className="h-px bg-[#ccff00]/10 my-2" />
                      <div className="flex justify-between items-baseline">
                        <span className="text-white/40 text-sm">Total</span>
                        <span className="text-2xl font-bold text-[#ccff00]">R$ {withdrawData.amount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {withdrawError && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-xs text-red-400">{withdrawError}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 mt-6">
              {withdrawStep > 1 && (
                <Button
                  variant="ghost"
                  onClick={() => setWithdrawStep(s => s - 1)}
                  className="flex-1 h-12 text-white/60 hover:text-white hover:bg-white/5 rounded-xl font-medium"
                >
                  Voltar
                </Button>
              )}
              {withdrawStep < 4 ? (
                <Button
                  onClick={() => {
                    if (withdrawStep === 1) {
                      const amount = parseFloat(withdrawData.amount.replace(",", "."))
                      if (isNaN(amount) || amount < 10) {
                        setWithdrawError("Valor minimo de R$ 10,00")
                        return
                      }
                      if (amount > availableBalance) {
                        setWithdrawError("Saldo insuficiente")
                        return
                      }
                    }
                    if (withdrawStep === 2 && !withdrawData.name.trim()) {
                      setWithdrawError("Informe seu nome completo")
                      return
                    }
                    if (withdrawStep === 3 && withdrawData.cpf.replace(/\D/g, "").length !== 11) {
                      setWithdrawError("CPF invalido")
                      return
                    }
                    setWithdrawError("")
                    setWithdrawStep(s => s + 1)
                  }}
                  className="flex-1 h-12 bg-[#ccff00] hover:bg-[#d4ff33] text-black font-semibold rounded-xl transition-all"
                >
                  Continuar
                </Button>
              ) : (
                <Button
                  onClick={handleWithdrawSubmit}
                  disabled={isWithdrawing || !withdrawData.pixKey}
                  className="flex-1 h-12 bg-[#ccff00] hover:bg-[#d4ff33] text-black font-semibold rounded-xl disabled:opacity-50 transition-all"
                >
                  {isWithdrawing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Confirmar Saque"
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Withdraw History Modal */}
      <Dialog open={showWithdrawHistory} onOpenChange={setShowWithdrawHistory}>
        <DialogContent className="sm:max-w-[400px] bg-[#1c1c1e] border-[#2a2a2e] p-0 gap-0 overflow-hidden rounded-[20px] [&>button]:text-gray-400 [&>button]:hover:text-white">
          <div className="p-5">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-[#bfff00]/10 flex items-center justify-center border border-[#bfff00]/20">
                <Wallet className="h-6 w-6 text-[#bfff00]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Historico de Saques</h2>
                <p className="text-xs text-gray-400">Acompanhe suas solicitacoes</p>
              </div>
            </div>

            {/* Content */}
            <div className="max-h-[320px] overflow-y-auto -mx-5 px-5">
              {withdrawHistory.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-[#2a2a2e] flex items-center justify-center">
                    <Clock className="h-6 w-6 text-gray-500" />
                  </div>
                  <p className="text-gray-400 text-sm">Nenhum saque solicitado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {withdrawHistory.map((withdraw: { id: string; amount: number; status: string; created_at: string; pix_key: string }) => (
                    <div key={withdraw.id} className="p-4 rounded-xl bg-[#2a2a2e] border border-[#3a3a3e]">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-lg font-bold text-white">
                            R$ {Number(withdraw.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-1">
                            {new Date(withdraw.created_at).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </p>
                          <p className="text-[10px] text-gray-600 mt-1.5 font-mono truncate">PIX: {withdraw.pix_key}</p>
                        </div>
                        <span 
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0",
                            withdraw.status === "pending" && "bg-amber-500/10 text-amber-400",
                            withdraw.status === "approved" && "bg-[#bfff00]/10 text-[#bfff00]",
                            withdraw.status === "paid" && "bg-emerald-500/10 text-emerald-400",
                            withdraw.status === "rejected" && "bg-red-500/10 text-red-400"
                          )}
                        >
                          {withdraw.status === "pending" && "Pendente"}
                          {withdraw.status === "approved" && "Aprovado"}
                          {withdraw.status === "paid" && "Pago"}
                          {withdraw.status === "rejected" && "Rejeitado"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <button
              onClick={() => setShowWithdrawHistory(false)}
              className="w-full flex items-center justify-center bg-[#bfff00] text-[#1c1c1e] h-11 rounded-xl font-semibold text-sm hover:bg-[#d4ff4d] transition-colors mt-5"
            >
              Fechar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

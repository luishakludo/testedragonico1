"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import useSWR from "swr"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/lib/auth-context"
import {
  Camera,
  Pencil,
  Save,
  Eye,
  EyeOff,
  Trophy,
  Lock,
  DollarSign,
  CalendarDays,
  Clock,
  Copy,
  Check,
  Gift,
  Target,
  KeyRound,
  Loader2,
  User,
  Mail,
  Phone,
  LogOut,
  Shield,
  Sparkles,
  ChevronRight,
  Award,
  Zap,
  Crown,
  Star,
} from "lucide-react"

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface UserProfile {
  id: string
  name: string
  email: string
  phone: string
  avatar_url: string | null
  created_at: string
}

const milestones = [
  { label: "R$ 10K", value: 10000, icon: Award, color: "#bfff00" },
  { label: "R$ 100K", value: 100000, icon: Zap, color: "#3b82f6" },
  { label: "R$ 500K", value: 500000, icon: Crown, color: "#f59e0b" },
  { label: "R$ 1M", value: 1000000, icon: Star, color: "#ec4899" },
]

export default function SettingsPage() {
  const { session, logout } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [nome, setNome] = useState("")
  const [copiedId, setCopiedId] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Password state
  const [showOldPass, setShowOldPass] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)
  const [oldPass, setOldPass] = useState("")
  const [newPass, setNewPass] = useState("")
  const [passLoading, setPassLoading] = useState(false)
  const [passMsg, setPassMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Save message
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Active section for mobile tab-like navigation
  const [activeSection, setActiveSection] = useState<"perfil" | "seguranca" | "premiacoes">("perfil")

  // Buscar faturamento total do usuario
  const { data: revenueData } = useSWR<{ totalRevenue: number }>(
    session?.userId ? `/api/user/revenue?userId=${session.userId}` : null,
    fetcher,
    { refreshInterval: 60000 }
  )

  // Fetch profile
  const fetchProfile = useCallback(async () => {
    if (!session?.userId) return
    try {
      const res = await fetch(`/api/profile?userId=${session.userId}`)
      const data = await res.json()
      if (res.ok) {
        setProfile(data)
        setNome(data.name || "")
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [session?.userId])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !session?.userId) return

    setAvatarUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("userId", session.userId)

      const res = await fetch("/api/profile/avatar", { method: "POST", body: formData })
      const data = await res.json()

      if (res.ok && data.url) {
        const newUrl = data.url + "?t=" + Date.now()
        setProfile((prev) => prev ? { ...prev, avatar_url: newUrl } : prev)
      }
    } catch {
      // silent
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!session?.userId) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.userId, name: nome }),
      })
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
        setEditMode(false)
        setSaveMsg({ type: "success", text: "Perfil atualizado" })
        setTimeout(() => setSaveMsg(null), 3000)
      } else {
        const err = await res.json()
        setSaveMsg({ type: "error", text: err.error || "Erro ao salvar" })
      }
    } catch {
      setSaveMsg({ type: "error", text: "Erro ao salvar" })
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!session?.email) return
    setPassLoading(true)
    setPassMsg(null)
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: session.email,
          currentPassword: oldPass,
          newPassword: newPass,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setPassMsg({ type: "success", text: "Senha alterada com sucesso" })
        setOldPass("")
        setNewPass("")
      } else {
        setPassMsg({ type: "error", text: data.error || "Erro ao alterar" })
      }
    } catch {
      setPassMsg({ type: "error", text: "Erro ao alterar senha" })
    } finally {
      setPassLoading(false)
      setTimeout(() => setPassMsg(null), 4000)
    }
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(session?.userId || "")
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const userInitial = profile?.name
    ? profile.name.charAt(0).toUpperCase()
    : session?.email
      ? session.email.charAt(0).toUpperCase()
      : "U"

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : "---"

  const lastAccess = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
  const accountId = session?.userId?.slice(0, 12) || "000000000000"

  // Rewards - usando faturamento real
  const faturamentoAtual = revenueData?.totalRevenue || 0
  const currentMilestoneIdx = milestones.findIndex((m) => faturamentoAtual < m.value)
  const proximaMeta = currentMilestoneIdx >= 0 ? milestones[currentMilestoneIdx].value : milestones[milestones.length - 1].value
  const metaAnterior = currentMilestoneIdx > 0 ? milestones[currentMilestoneIdx - 1].value : 0
  const progressoNaMeta = faturamentoAtual - metaAnterior
  const tamanhoMeta = proximaMeta - metaAnterior
  const progressPercent = Math.min(100, (progressoNaMeta / tamanhoMeta) * 100)
  const faltaParaMeta = Math.max(0, proximaMeta - faturamentoAtual)

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f5f5f7]">
        <Loader2 className="h-6 w-6 animate-spin text-[#bfff00]" />
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="min-h-[calc(100vh-60px)] bg-[#f5f5f7]">
        <div className="max-w-4xl mx-auto p-4 md:p-8">

          {/* ══════════════════════════════════════════════════════════════════
              PROFILE HEADER CARD - Premium Design
          ══════════════════════════════════════════════════════════════════ */}
          <section className="relative rounded-xl bg-gradient-to-b from-[#1a1a1c] to-[#141416] border border-[#2a2a2e] overflow-hidden mb-5">
            {/* Glow Effects */}
            <div 
              className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[200px] pointer-events-none"
              style={{ background: "radial-gradient(ellipse at center top, rgba(190, 255, 0, 0.08) 0%, transparent 70%)" }}
            />
            <div 
              className="absolute bottom-0 right-0 w-[300px] h-[200px] pointer-events-none"
              style={{ background: "radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.06) 0%, transparent 60%)" }}
            />

            <div className="relative p-6">
              <div className="flex flex-col items-center gap-4">
                {/* Avatar with animated ring */}
                <div className="relative group">
                  <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-[#bfff00]/20 via-[#22c55e]/10 to-[#3b82f6]/10 blur-lg opacity-60 group-hover:opacity-100 transition-opacity" />
                  <Avatar className="relative h-20 w-20 rounded-full ring-2 ring-[#bfff00]/50 ring-offset-2 ring-offset-[#141416]">
                    {profile?.avatar_url ? (
                      <AvatarImage src={profile.avatar_url} alt="Avatar" className="object-cover" />
                    ) : null}
                    <AvatarFallback className="bg-gradient-to-br from-[#bfff00]/20 to-[#22c55e]/10 text-[#bfff00] text-2xl font-bold">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300"
                    aria-label="Trocar foto"
                  >
                    {avatarUploading ? (
                      <Loader2 className="h-5 w-5 text-[#bfff00] animate-spin" />
                    ) : (
                      <Camera className="h-5 w-5 text-[#bfff00]" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                  {/* Online indicator */}
                  <div className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-[#22c55e] border-2 border-[#141416]" />
                </div>

                {/* Name & email */}
                <div className="text-center">
                  <h1 className="text-xl font-bold text-white">
                    {profile?.name || session?.name || "Usuario"}
                  </h1>
                  <p className="text-xs text-gray-500 mt-1">{profile?.email || session?.email}</p>
                </div>

                {/* ID badge */}
                <button
                  onClick={handleCopyId}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1a1a1c] border border-[#2a2a2e] hover:border-[#bfff00]/40 transition-all text-xs"
                >
                  <span className="text-gray-500">ID:</span>
                  <span className="font-mono text-gray-300">{accountId}</span>
                  {copiedId ? (
                    <Check className="h-3 w-3 text-[#bfff00]" />
                  ) : (
                    <Copy className="h-3 w-3 text-gray-600" />
                  )}
                </button>
              </div>

              {/* Stats row - Clean minimal cards */}
              <div className="mt-6 flex items-stretch gap-2">
                {/* Membro Desde */}
                <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-br from-[#232325] to-[#1a1a1c] border border-[#333]">
                  <div className="shrink-0 flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br from-[#bfff00] to-[#9fdf00] shadow-lg shadow-[#bfff00]/20">
                    <CalendarDays className="h-5 w-5 text-black" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-500 font-medium tracking-wider uppercase">Membro desde</p>
                    <p className="text-sm font-semibold text-white truncate">{memberSince}</p>
                  </div>
                </div>
                
                {/* Ultimo Acesso */}
                <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-br from-[#232325] to-[#1a1a1c] border border-[#333]">
                  <div className="shrink-0 flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#2563eb] shadow-lg shadow-blue-500/20">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-500 font-medium tracking-wider uppercase">Ultimo acesso</p>
                    <p className="text-sm font-semibold text-white truncate">{lastAccess}</p>
                  </div>
                </div>
                
                {/* Taxa por Venda */}
                <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-br from-[#232325] to-[#1a1a1c] border border-[#bfff00]/20">
                  <div className="shrink-0 flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br from-[#bfff00] to-[#9fdf00] shadow-lg shadow-[#bfff00]/20">
                    <DollarSign className="h-5 w-5 text-black" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-500 font-medium tracking-wider uppercase">Taxa por venda</p>
                    <p className="text-sm font-bold text-[#bfff00]">R$ 0,50</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════════
              NAVIGATION TABS - Transparent background
          ══════════════════════════════════════════════════════════════════ */}
          <div className="flex items-center gap-3 mb-6">
            {[
              { id: "perfil" as const, label: "Dados Pessoais", icon: User },
              { id: "seguranca" as const, label: "Seguranca", icon: Shield },
              { id: "premiacoes" as const, label: "Premiacoes", icon: Sparkles },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeSection === tab.id
                    ? "bg-[#bfff00] text-black shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              PERSONAL INFO SECTION
          ══════════════════════════════════════════════════════════════════ */}
          {activeSection === "perfil" && (
            <section className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden animate-in fade-in-0 slide-in-from-bottom-3 duration-300">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Informacoes Pessoais</h2>
                <button
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    editMode
                      ? "bg-[#bfff00] text-black hover:bg-[#d4ff4d]"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                  onClick={() => {
                    if (editMode) {
                      handleSaveProfile()
                    } else {
                      setEditMode(true)
                    }
                  }}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : editMode ? (
                    <Save className="h-3 w-3" />
                  ) : (
                    <Pencil className="h-3 w-3" />
                  )}
                  {editMode ? "Salvar" : "Editar"}
                </button>
              </div>

              <div className="p-5">
                {saveMsg && (
                  <div className={`mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                    saveMsg.type === "success"
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-red-50 text-red-600 border border-red-200"
                  }`}>
                    {saveMsg.type === "success" && <Check className="h-4 w-4 shrink-0" />}
                    {saveMsg.text}
                  </div>
                )}

                {/* Info list - clean and simple */}
                <div className="divide-y divide-gray-100">
                  {/* Nome */}
                  <div className="py-4 first:pt-0">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">Nome</p>
                        {editMode ? (
                          <Input
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            className="bg-gray-50 border-gray-200 rounded-lg h-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#bfff00] focus:ring-[#bfff00]/20 max-w-sm"
                          />
                        ) : (
                          <p className="text-sm font-medium text-gray-900">{profile?.name || "Nao informado"}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">Email</p>
                        <p className="text-sm font-medium text-gray-900">{profile?.email || session?.email || "Nao informado"}</p>
                      </div>
                      <Lock className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>

                  {/* Telefone */}
                  <div className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">Telefone</p>
                        <p className="text-sm font-medium text-gray-900">{profile?.phone || "Nao informado"}</p>
                      </div>
                      <Lock className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>

                  {/* Conta criada */}
                  <div className="py-4 last:pb-0">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">Conta criada em</p>
                        <p className="text-sm font-medium text-gray-900">
                          {profile?.created_at
                            ? new Date(profile.created_at).toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "long",
                                year: "numeric",
                              })
                            : "---"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              SECURITY SECTION
          ══════════════════════════════════════════════════════════════════ */}
          {activeSection === "seguranca" && (
            <section className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden animate-in fade-in-0 slide-in-from-bottom-3 duration-300">
              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Alterar Senha</h2>
              </div>

              <div className="p-5">
                {passMsg && (
                  <div className={`mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                    passMsg.type === "success"
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-red-50 text-red-600 border border-red-200"
                  }`}>
                    {passMsg.type === "success" && <Check className="h-3 w-3 shrink-0" />}
                    {passMsg.text}
                  </div>
                )}

                <div className="space-y-4">
                  {/* Current password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-500">Senha atual</label>
                    <div className="relative">
                      <Input
                        type={showOldPass ? "text" : "password"}
                        placeholder="Digite sua senha atual"
                        value={oldPass}
                        onChange={(e) => setOldPass(e.target.value)}
                        className="bg-gray-50 border-gray-200 rounded-lg h-10 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#bfff00] focus:ring-[#bfff00]/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOldPass(!showOldPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                      >
                        {showOldPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* New password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-500">Nova senha</label>
                    <div className="relative">
                      <Input
                        type={showNewPass ? "text" : "password"}
                        placeholder="Minimo 6 caracteres"
                        value={newPass}
                        onChange={(e) => setNewPass(e.target.value)}
                        className="bg-gray-50 border-gray-200 rounded-lg h-10 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#bfff00] focus:ring-[#bfff00]/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                      >
                        {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {/* Password strength */}
                    {newPass.length > 0 && (
                      <div className="flex items-center gap-2 pt-1">
                        <div className="flex-1 flex gap-1">
                          {[1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-colors ${
                                newPass.length >= i * 3
                                  ? newPass.length >= 9
                                    ? "bg-[#22c55e]"
                                    : newPass.length >= 6
                                      ? "bg-amber-400"
                                      : "bg-red-400"
                                  : "bg-gray-200"
                              }`}
                            />
                          ))}
                        </div>
                        <span className={`text-[10px] font-medium ${
                          newPass.length >= 9 ? "text-[#22c55e]" : newPass.length >= 6 ? "text-amber-500" : "text-red-500"
                        }`}>
                          {newPass.length < 6 ? "Fraca" : newPass.length < 9 ? "Media" : "Forte"}
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleChangePassword}
                    disabled={passLoading || !oldPass || !newPass || newPass.length < 6}
                    className="w-full flex items-center justify-center gap-2 bg-[#bfff00] text-black hover:bg-[#d4ff4d] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg h-10 text-sm font-semibold transition-all"
                  >
                    {passLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                    Alterar senha
                  </button>
                </div>
              </div>

              {/* Logout */}
              <div className="border-t border-gray-100 px-5 py-4">
                <button
                  onClick={logout}
                  className="flex items-center gap-2 text-red-500 hover:text-red-600 transition-colors text-sm"
                >
                  <LogOut className="h-4 w-4" />
                  Sair da conta
                </button>
              </div>
            </section>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              REWARDS / PREMIACOES SECTION - Light Theme
          ══════════════════════════════════════════════════════════════════ */}
          {activeSection === "premiacoes" && (
            <section className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden animate-in fade-in-0 slide-in-from-bottom-3 duration-300">
              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Metas de Faturamento</h2>
                <p className="text-xs text-gray-500 mt-0.5">Desbloqueie recompensas ao atingir cada meta</p>
              </div>

              <div className="p-5">
                {/* Milestone cards - horizontal grid */}
                <div className="grid grid-cols-4 gap-3 mb-5">
                  {milestones.map((m, i) => {
                    const unlocked = faturamentoAtual >= m.value
                    const isNext = i === currentMilestoneIdx
                    const MilestoneIcon = m.icon
                    
                    return (
                      <div 
                        key={m.label} 
                        className={`relative rounded-2xl p-4 text-center transition-all ${
                          unlocked 
                            ? "bg-gradient-to-b from-emerald-50 to-emerald-100/50 ring-1 ring-emerald-200"
                            : isNext 
                              ? "bg-gradient-to-b from-lime-50 to-lime-100/30 ring-1 ring-lime-300" 
                              : "bg-gray-50/80 ring-1 ring-gray-100"
                        }`}
                      >
                        <div className={`mx-auto flex items-center justify-center h-11 w-11 rounded-xl mb-2.5 ${
                          unlocked
                            ? "bg-emerald-500 shadow-md shadow-emerald-200"
                            : isNext 
                              ? "bg-[#bfff00] shadow-md shadow-lime-200" 
                              : "bg-gray-200"
                        }`}>
                          {unlocked ? (
                            <Trophy className="h-5 w-5 text-white" />
                          ) : (
                            <MilestoneIcon className={`h-5 w-5 ${isNext ? "text-black" : "text-gray-400"}`} />
                          )}
                        </div>
                        <p className={`text-base font-bold ${
                          unlocked ? "text-emerald-700" : isNext ? "text-gray-900" : "text-gray-400"
                        }`}>
                          {m.label}
                        </p>
                        <p className={`text-[10px] font-medium mt-0.5 ${
                          unlocked ? "text-emerald-600" : isNext ? "text-lime-600" : "text-gray-400"
                        }`}>
                          {unlocked ? "Conquistado" : isNext ? "Proxima meta" : "Bloqueado"}
                        </p>
                      </div>
                    )
                  })}
                </div>

                {/* Progress section */}
                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">Seu progresso</span>
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                      {progressPercent.toFixed(0)}%
                    </span>
                  </div>
                  
                  <div className="relative h-2.5 bg-gray-200 rounded-full overflow-hidden mb-3">
                    <div 
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#bfff00] to-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(progressPercent, 2)}%` }}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">
                      Atual: <span className="text-gray-900 font-semibold">R$ {faturamentoAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </span>
                    <span className="text-gray-500">
                      Faltam: <span className="text-emerald-600 font-semibold">R$ {faltaParaMeta.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}

        </div>
      </div>
    </ScrollArea>
  )
}

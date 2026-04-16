"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Loader2, Shield, Eye, EyeOff, Lock, Mail } from "lucide-react"

// Credenciais do admin
const ADMIN_EMAIL = "1@gmail.com"
const ADMIN_PASSWORD = "1"

export default function DragonAdmLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    // Simular delay de autenticacao
    await new Promise(resolve => setTimeout(resolve, 500))

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      // Salvar sessao do admin
      localStorage.setItem("dragon_adm_session", JSON.stringify({
        email,
        loggedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 horas
      }))
      router.push("/dragonadm")
    } else {
      setError("Email ou senha incorretos")
    }

    setIsLoading(false)
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 admin-theme"
      style={{ background: '#0a0a0a' }}
    >
      {/* Login Card */}
      <div 
        className="w-full max-w-md rounded-3xl overflow-hidden relative"
        style={{ 
          background: 'linear-gradient(145deg, #0a0a0a 0%, #0f0f0f 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Top glow line */}
        <div 
          className="absolute top-0 left-8 right-8 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(149, 228, 104, 0.3), transparent)' }}
        />

        {/* Header */}
        <div className="p-8 pb-0 text-center">
          <div className="relative inline-block mb-6">
            <div 
              className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto"
              style={{ 
                background: '#111111',
                border: '1px solid rgba(149, 228, 104, 0.2)'
              }}
            >
              <Shield className="w-10 h-10 text-[#95e468]" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Dragon Admin</h1>
          <p className="text-sm text-[#666666]">Painel de administracao do sistema</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="p-8 space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#666666] uppercase tracking-wider">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666666]" />
              <Input
                type="email"
                placeholder="admin@dragon.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl pl-11 bg-[#111111] border-[rgba(255,255,255,0.06)] text-white placeholder:text-[#444444] focus:border-[#95e468]/50 focus:ring-[#95e468]/20"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-[#666666] uppercase tracking-wider">Senha</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666666]" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl pl-11 pr-11 bg-[#111111] border-[rgba(255,255,255,0.06)] text-white placeholder:text-[#444444] focus:border-[#95e468]/50 focus:ring-[#95e468]/20"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#666666] hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div 
              className="p-4 rounded-xl flex items-center gap-3"
              style={{ 
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)'
              }}
            >
              <Shield className="w-5 h-5 text-[#ef4444]" />
              <p className="text-sm text-[#ef4444]">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 rounded-xl text-sm font-semibold text-[#050505] transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
            style={{ 
              background: 'linear-gradient(135deg, #95e468, #7bc752)',
              boxShadow: '0 0 30px rgba(149, 228, 104, 0.3)'
            }}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Entrando...
              </>
            ) : (
              "Entrar no Painel"
            )}
          </button>

          <p className="text-xs text-[#444444] text-center pt-2">
            Acesso restrito a administradores autorizados
          </p>
        </form>
      </div>
    </div>
  )
}

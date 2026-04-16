"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Loader2, Eye, EyeOff, Gift, Zap, Shield, Clock, X } from "lucide-react"
import { DragonIcon } from "@/components/dragon-icon"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent } from "@/components/ui/dialog"

export default function CadastroPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-[#0a0a0a]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl animate-pulse">
            <DragonIcon className="h-5 w-5" />
          </div>
        </div>
      }
    >
      <CadastroContent />
    </Suspense>
  )
}

function CadastroContent() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [referralCoupon, setReferralCoupon] = useState<string | null>(null)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const { register, session, isLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!isLoading && session) {
      router.replace("/")
    }
  }, [isLoading, session, router])

  useEffect(() => {
    const refParam = searchParams.get("ref")
    if (refParam) {
      setReferralCoupon(refParam.toLowerCase())
      localStorage.setItem("referral_coupon", refParam.toLowerCase())
    } else {
      const storedCoupon = localStorage.getItem("referral_coupon")
      if (storedCoupon) {
        setReferralCoupon(storedCoupon)
      }
    }
  }, [searchParams])

  function formatPhone(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 11)
    if (digits.length <= 2) return digits
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!name.trim()) {
      setError("Digite seu nome")
      return
    }

    if (!email.trim()) {
      setError("Digite seu email")
      return
    }

    const phoneDigits = phone.replace(/\D/g, "")
    if (!phoneDigits || phoneDigits.length < 10) {
      setError("Digite um numero de telefone valido")
      return
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres")
      return
    }

    if (password !== confirmPassword) {
      setError("As senhas nao coincidem")
      return
    }

    if (!acceptedTerms) {
      setError("Voce precisa aceitar os termos de uso")
      return
    }

    setIsSubmitting(true)
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        phone: phoneDigits,
        password,
        referralCoupon: referralCoupon || undefined,
      })
      localStorage.removeItem("referral_coupon")
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Erro ao criar conta")
      }
      setIsSubmitting(false)
    }
  }

  if (isLoading || session) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0a0a0a]">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl animate-pulse">
          <DragonIcon className="h-5 w-5" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full bg-[#0a0a0a]">
      {/* LADO ESQUERDO: FORMULARIO */}
      <div className="flex w-full lg:w-1/2 flex-col justify-center px-8 py-12 lg:px-16 xl:px-24 overflow-y-auto">
        <div className="w-full max-w-[400px] mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-[#b8ff29] rounded-xl flex items-center justify-center">
              <DragonIcon className="w-5 h-5 text-[#0a0a0a]" />
            </div>
            <span className="text-xl font-semibold text-white">Dragon</span>
          </div>

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">Crie sua conta</h1>
            <p className="text-[#888] text-base">Preencha os dados para comecar.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {referralCoupon && (
              <div className="flex items-center gap-2 rounded-xl bg-[#b8ff29]/10 border border-[#b8ff29]/20 px-4 py-3">
                <Gift className="h-4 w-4 text-[#b8ff29] shrink-0" />
                <span className="text-sm text-[#b8ff29]">
                  Cupom aplicado: <span className="font-semibold">{referralCoupon}</span>
                </span>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-[#ccc]">Nome</label>
              <input 
                type="text" 
                id="name" 
                placeholder="Seu nome completo" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-[#222] bg-[#111] text-base text-white placeholder:text-[#555] focus:outline-none focus:border-[#b8ff29] focus:ring-1 focus:ring-[#b8ff29]/30 transition-all"
                autoComplete="name"
                autoFocus
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-[#ccc]">E-mail</label>
              <input 
                type="email" 
                id="email" 
                placeholder="seu@email.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-[#222] bg-[#111] text-base text-white placeholder:text-[#555] focus:outline-none focus:border-[#b8ff29] focus:ring-1 focus:ring-[#b8ff29]/30 transition-all"
                autoComplete="email"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium text-[#ccc]">Telefone</label>
              <input 
                type="tel" 
                id="phone" 
                placeholder="(11) 99999-9999" 
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                className="w-full h-12 px-4 rounded-xl border border-[#222] bg-[#111] text-base text-white placeholder:text-[#555] focus:outline-none focus:border-[#b8ff29] focus:ring-1 focus:ring-[#b8ff29]/30 transition-all"
                autoComplete="tel"
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-[#ccc]">Senha</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    id="password" 
                    placeholder="Min. 6 caracteres" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-12 px-4 pr-11 rounded-xl border border-[#222] bg-[#111] text-base text-white placeholder:text-[#555] focus:outline-none focus:border-[#b8ff29] focus:ring-1 focus:ring-[#b8ff29]/30 transition-all"
                    autoComplete="new-password"
                    disabled={isSubmitting}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#555] hover:text-white transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="confirm-password" className="text-sm font-medium text-[#ccc]">Confirmar</label>
                <div className="relative">
                  <input 
                    type={showConfirm ? "text" : "password"} 
                    id="confirm-password" 
                    placeholder="Repita a senha" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-12 px-4 pr-11 rounded-xl border border-[#222] bg-[#111] text-base text-white placeholder:text-[#555] focus:outline-none focus:border-[#b8ff29] focus:ring-1 focus:ring-[#b8ff29]/30 transition-all"
                    autoComplete="new-password"
                    disabled={isSubmitting}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#555] hover:text-white transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Aceite de Termos */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-[#111] border border-[#222]">
              <Switch
                checked={acceptedTerms}
                onCheckedChange={setAcceptedTerms}
                className="mt-0.5 data-[state=checked]:bg-[#b8ff29]"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#ccc]">
                  Ao entrar, concordo com os{" "}
                  <button
                    type="button"
                    onClick={() => setShowTermsModal(true)}
                    className="text-[#b8ff29] hover:underline font-medium"
                  >
                    Termos de Uso
                  </button>
                </p>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <button 
              type="submit" 
              disabled={isSubmitting || !acceptedTerms}
              className="w-full h-12 bg-[#b8ff29] text-[#0a0a0a] text-base font-semibold rounded-xl hover:bg-[#a8ef19] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mt-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Criar conta"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-base text-[#888]">
            Ja tem conta?{" "}
            <Link href="/login" className="text-[#b8ff29] font-medium hover:underline">Entrar</Link>
          </p>
        </div>
      </div>

      {/* LADO DIREITO: VISUAL INOVADOR */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden">
        {/* Background com gradiente */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f0f0f] via-[#111] to-[#0a0a0a]" />
        
        {/* Linhas diagonais animadas */}
        <div className="absolute inset-0 opacity-20">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute h-[1px] bg-gradient-to-r from-transparent via-[#b8ff29] to-transparent"
              style={{
                width: '200%',
                left: '-50%',
                top: `${12 + i * 12}%`,
                transform: `rotate(-15deg)`,
                animation: `slideRight ${3 + i * 0.5}s linear infinite`,
                animationDelay: `${i * 0.3}s`,
                opacity: 0.3 + (i * 0.1)
              }}
            />
          ))}
        </div>

        {/* Circulos decorativos */}
        <div className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full border border-[#222] opacity-40" />
        <div className="absolute bottom-1/3 left-1/3 w-96 h-96 rounded-full border border-[#1a1a1a] opacity-30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-[#b8ff29]/10" />

        {/* Conteudo central */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full px-12">
          {/* Logo grande com glow */}
          <div className="relative mb-16">
            <div className="absolute inset-0 w-40 h-40 rounded-3xl bg-[#b8ff29]/20 blur-3xl" />
            <div className="absolute inset-0 w-40 h-40 rounded-3xl bg-[#b8ff29]/10 blur-xl animate-pulse" />
            <div className="relative w-40 h-40 rounded-3xl bg-gradient-to-br from-[#b8ff29] to-[#8acc00] flex items-center justify-center shadow-2xl shadow-[#b8ff29]/20">
              <DragonIcon className="w-20 h-20 text-[#0a0a0a]" />
            </div>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-3 gap-4 mb-12 w-full max-w-lg">
            <div className="bg-[#111] border border-[#222] rounded-2xl p-5 text-center hover:border-[#b8ff29]/30 transition-colors">
              <div className="w-10 h-10 bg-[#b8ff29]/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Zap className="w-5 h-5 text-[#b8ff29]" />
              </div>
              <div className="text-2xl font-bold text-white">5.8k</div>
              <div className="text-xs text-[#666] mt-1">Usuarios</div>
            </div>
            <div className="bg-[#111] border border-[#222] rounded-2xl p-5 text-center hover:border-[#b8ff29]/30 transition-colors">
              <div className="w-10 h-10 bg-[#b8ff29]/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Shield className="w-5 h-5 text-[#b8ff29]" />
              </div>
              <div className="text-2xl font-bold text-[#b8ff29]">98%</div>
              <div className="text-xs text-[#666] mt-1">Satisfacao</div>
            </div>
            <div className="bg-[#111] border border-[#222] rounded-2xl p-5 text-center hover:border-[#b8ff29]/30 transition-colors">
              <div className="w-10 h-10 bg-[#b8ff29]/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Clock className="w-5 h-5 text-[#b8ff29]" />
              </div>
              <div className="text-2xl font-bold text-white">24/7</div>
              <div className="text-xs text-[#666] mt-1">Suporte</div>
            </div>
          </div>

          {/* Texto */}
          <div className="text-center max-w-md">
            <h2 className="text-2xl font-bold text-white mb-3">Comece sua jornada</h2>
            <p className="text-[#888] leading-relaxed">
              Crie sua conta e tenha acesso a automacao inteligente para escalar seu negocio.
            </p>
          </div>
        </div>

        {/* Pontos decorativos nos cantos */}
        <div className="absolute top-8 right-8 flex gap-2">
          <div className="w-2 h-2 rounded-full bg-[#b8ff29]" />
          <div className="w-2 h-2 rounded-full bg-[#b8ff29]/50" />
          <div className="w-2 h-2 rounded-full bg-[#b8ff29]/25" />
        </div>
        <div className="absolute bottom-8 left-8 flex gap-2">
          <div className="w-2 h-2 rounded-full bg-[#b8ff29]/25" />
          <div className="w-2 h-2 rounded-full bg-[#b8ff29]/50" />
          <div className="w-2 h-2 rounded-full bg-[#b8ff29]" />
        </div>
      </div>

      <style jsx>{`
        @keyframes slideRight {
          0% { transform: rotate(-15deg) translateX(-10%); }
          100% { transform: rotate(-15deg) translateX(10%); }
        }
      `}</style>

      {/* Modal de Termos */}
      <Dialog open={showTermsModal} onOpenChange={setShowTermsModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0 gap-0 bg-[#0f0f0f] border-[#222] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-[#222]">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#b8ff29]/10 flex items-center justify-center">
                <DragonIcon className="h-5 w-5 text-[#b8ff29]" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Termos de Uso</h3>
                <p className="text-xs text-[#888]">Dragon</p>
              </div>
            </div>
            <button
              onClick={() => setShowTermsModal(false)}
              className="h-8 w-8 rounded-lg bg-[#1a1a1a] hover:bg-[#222] flex items-center justify-center transition-colors"
            >
              <X className="h-4 w-4 text-[#888]" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[65vh] p-6">
            <div className="space-y-6 text-sm">
              {/* 1. Termos de Uso */}
              <section>
                <h4 className="text-[#b8ff29] font-semibold text-base mb-3 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-md bg-[#b8ff29]/10 flex items-center justify-center text-xs">1</span>
                  Termos de Uso
                </h4>
                <div className="pl-8 space-y-3 text-[#aaa]">
                  <p><strong className="text-white">1.1 Aceitacao dos Termos</strong><br/>Ao acessar ou utilizar a plataforma DRAGON, o usuario declara que leu, compreendeu e concorda com todos os termos.</p>
                  <p><strong className="text-white">1.2 Elegibilidade</strong><br/>E obrigatorio ter 18 anos ou mais. O uso por menores e estritamente proibido.</p>
                  <p><strong className="text-white">1.3 Uso da Plataforma</strong><br/>O usuario concorda em nao utilizar a plataforma para atividades ilegais, nao fraudar pagamentos, nao burlar sistemas e nao usar bots ou automacoes indevidas.</p>
                  <p><strong className="text-white">1.4 Conta do Usuario</strong><br/>O usuario e responsavel pela seguranca da conta. A DRAGON pode suspender contas suspeitas. E proibido compartilhar contas.</p>
                </div>
              </section>

              {/* 2. Politica de Conteudo */}
              <section>
                <h4 className="text-[#b8ff29] font-semibold text-base mb-3 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-md bg-[#b8ff29]/10 flex items-center justify-center text-xs">2</span>
                  Politica de Conteudo
                </h4>
                <div className="pl-8 space-y-3 text-[#aaa]">
                  <p><strong className="text-white">2.1 Proibicao de Conteudo com Menores</strong><br/>A DRAGON proibe totalmente: conteudo com menores de 18 anos, conteudo que pareca menor, conteudo sexualizado com aparencia juvenil, deepfake envolvendo menores.</p>
                  <p><strong className="text-white">2.2 Conteudos Proibidos</strong><br/>Tambem sao proibidos: violencia extrema, conteudo ilegal, fraudes e golpes, conteudo sem consentimento, vazamentos nao autorizados.</p>
                  <p><strong className="text-white">2.3 Responsabilidade</strong><br/>O usuario declara que todo conteudo e legal, todos os envolvidos sao maiores de idade e possui autorizacao para publicacao.</p>
                </div>
              </section>

              {/* 3. Pagamentos e Taxas */}
              <section>
                <h4 className="text-[#b8ff29] font-semibold text-base mb-3 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-md bg-[#b8ff29]/10 flex items-center justify-center text-xs">3</span>
                  Pagamentos e Taxas
                </h4>
                <div className="pl-8 space-y-3 text-[#aaa]">
                  <p><strong className="text-white">3.1 Taxa da Plataforma</strong><br/>Taxa fixa de R$0,50 por venda.</p>
                  <p><strong className="text-white">3.2 Gateways de Pagamento</strong><br/>Pagamentos sao processados por terceiros. A DRAGON nao controla taxas do gateway.</p>
                  <p><strong className="text-white">3.3 Saques</strong><br/>Saques podem ter prazo de processamento. A DRAGON pode reter valores em caso de suspeita.</p>
                </div>
              </section>

              {/* 4. Reembolsos */}
              <section>
                <h4 className="text-[#b8ff29] font-semibold text-base mb-3 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-md bg-[#b8ff29]/10 flex items-center justify-center text-xs">4</span>
                  Reembolsos e Disputas
                </h4>
                <div className="pl-8 text-[#aaa]">
                  <p>Cada vendedor e responsavel pelos reembolsos. A DRAGON pode intervir em disputas. Fraudes podem gerar bloqueio de valores.</p>
                </div>
              </section>

              {/* 5. Seguranca */}
              <section>
                <h4 className="text-[#b8ff29] font-semibold text-base mb-3 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-md bg-[#b8ff29]/10 flex items-center justify-center text-xs">5</span>
                  Seguranca
                </h4>
                <div className="pl-8 text-[#aaa]">
                  <p>A DRAGON pode: monitorar atividades, bloquear acessos suspeitos, solicitar verificacao de identidade.</p>
                </div>
              </section>

              {/* 6. Penalidades */}
              <section>
                <h4 className="text-[#b8ff29] font-semibold text-base mb-3 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-md bg-[#b8ff29]/10 flex items-center justify-center text-xs">6</span>
                  Penalidades
                </h4>
                <div className="pl-8 text-[#aaa]">
                  <p>Em caso de violacao: remocao de conteudo, suspensao da conta, banimento permanente, retencao de saldo, acao legal.</p>
                </div>
              </section>

              {/* 7. Cooperacao Legal */}
              <section>
                <h4 className="text-[#b8ff29] font-semibold text-base mb-3 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-md bg-[#b8ff29]/10 flex items-center justify-center text-xs">7</span>
                  Cooperacao Legal
                </h4>
                <div className="pl-8 text-[#aaa]">
                  <p>A DRAGON coopera com autoridades e podera: compartilhar dados mediante ordem legal, denunciar atividades ilegais.</p>
                </div>
              </section>

              {/* 8. Privacidade */}
              <section>
                <h4 className="text-[#b8ff29] font-semibold text-base mb-3 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-md bg-[#b8ff29]/10 flex items-center justify-center text-xs">8</span>
                  Privacidade (LGPD)
                </h4>
                <div className="pl-8 space-y-3 text-[#aaa]">
                  <p><strong className="text-white">8.1 Coleta de Dados</strong><br/>Coletamos: nome, email, dados de pagamento, dados de navegacao.</p>
                  <p><strong className="text-white">8.2 Uso dos Dados</strong><br/>Operacao da plataforma, seguranca, marketing (com consentimento).</p>
                  <p><strong className="text-white">8.3 Direitos do Usuario</strong><br/>O usuario pode: solicitar exclusao de dados, acessar informacoes, revogar consentimento.</p>
                </div>
              </section>

              {/* 9-12 */}
              <section>
                <h4 className="text-[#b8ff29] font-semibold text-base mb-3 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-md bg-[#b8ff29]/10 flex items-center justify-center text-xs">9</span>
                  Propriedade Intelectual
                </h4>
                <div className="pl-8 text-[#aaa]">
                  <p>A marca DRAGON e protegida. E proibido copiar sistema ou identidade visual.</p>
                </div>
              </section>

              <section>
                <h4 className="text-[#b8ff29] font-semibold text-base mb-3 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-md bg-[#b8ff29]/10 flex items-center justify-center text-xs">10</span>
                  Suporte
                </h4>
                <div className="pl-8 text-[#aaa]">
                  <p>Suporte oficial: WhatsApp, Telegram, Sistema interno (quando disponivel).</p>
                </div>
              </section>

              <section>
                <h4 className="text-[#b8ff29] font-semibold text-base mb-3 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-md bg-[#b8ff29]/10 flex items-center justify-center text-xs">11</span>
                  Modificacoes
                </h4>
                <div className="pl-8 text-[#aaa]">
                  <p>A DRAGON pode atualizar os termos a qualquer momento.</p>
                </div>
              </section>

              {/* Aceite Final */}
              <section className="rounded-xl bg-[#b8ff29]/5 border border-[#b8ff29]/20 p-4">
                <p className="text-[#b8ff29] font-medium text-center">
                  Ao usar a plataforma, o usuario concorda com todos os termos acima.
                </p>
              </section>
            </div>
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-[#222] bg-[#0a0a0a]">
            <button
              onClick={() => {
                setAcceptedTerms(true)
                setShowTermsModal(false)
              }}
              className="w-full h-11 bg-[#b8ff29] text-[#0a0a0a] font-semibold rounded-xl hover:bg-[#a8ef19] transition-colors"
            >
              Li e Aceito os Termos
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

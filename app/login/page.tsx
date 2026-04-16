"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Loader2, Eye, EyeOff, X } from "lucide-react"
import { DragonIcon } from "@/components/dragon-icon"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(true)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const { login, session, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && session) {
      router.replace("/")
    }
  }, [isLoading, session, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!email.trim()) {
      setError("Digite seu email")
      return
    }

    if (!password) {
      setError("Digite sua senha")
      return
    }

    if (!acceptedTerms) {
      setError("Voce precisa aceitar os Termos de Uso")
      return
    }

    setIsSubmitting(true)
    try {
      await login(email.trim(), password)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Erro ao entrar")
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
      <div className="flex w-full lg:w-1/2 flex-col justify-center px-8 py-12 lg:px-16 xl:px-24">
        <div className="w-full max-w-[400px] mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Bem-vindo de volta</h1>
            <p className="text-[#888] text-base">Entre com suas credenciais para continuar.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
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
                autoFocus
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="text-sm font-medium text-[#ccc]">Senha</label>
                <Link href="#" className="text-sm text-[#888] hover:text-[#b8ff29] transition-colors">Esqueceu?</Link>
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  id="password" 
                  placeholder="Digite sua senha" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 px-4 pr-12 rounded-xl border border-[#222] bg-[#111] text-base text-white placeholder:text-[#555] focus:outline-none focus:border-[#b8ff29] focus:ring-1 focus:ring-[#b8ff29]/30 transition-all"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#555] hover:text-white transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Terms checkbox */}
            <div className="flex items-start gap-3 py-2">
              <Switch
                id="terms"
                checked={acceptedTerms}
                onCheckedChange={setAcceptedTerms}
                className="mt-0.5 data-[state=checked]:bg-[#b8ff29]"
              />
              <label htmlFor="terms" className="text-sm text-[#888] leading-relaxed">
                Ao entrar, concordo com os{" "}
                <button
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  className="text-[#b8ff29] hover:underline font-medium"
                >
                  Termos de Uso
                </button>
              </label>
            </div>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full h-12 bg-[#b8ff29] text-[#0a0a0a] text-base font-semibold rounded-xl hover:bg-[#a8ef19] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mt-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Entrar"
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-base text-[#888]">
            Nao tem conta?{" "}
            <Link href="/cadastro" className="text-[#b8ff29] font-medium hover:underline">Criar conta</Link>
          </p>
        </div>
      </div>

      {/* Terms Modal */}
      <Dialog open={showTermsModal} onOpenChange={setShowTermsModal}>
        <DialogContent className="max-w-2xl bg-[#111] border-[#222] p-0 gap-0 overflow-hidden max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-[#222]">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#b8ff29]/10 flex items-center justify-center">
                <DragonIcon className="h-5 w-5 text-[#b8ff29]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Termos de Uso</h3>
                <p className="text-xs text-[#666]">Dragon</p>
              </div>
            </div>
            <button onClick={() => setShowTermsModal(false)} className="text-[#666] hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <ScrollArea className="max-h-[65vh]">
            <div className="p-6 space-y-6 text-sm">
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

              {/* 9-11 */}
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
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t border-[#222]">
            <button
              onClick={() => { setAcceptedTerms(true); setShowTermsModal(false); }}
              className="w-full h-11 bg-[#b8ff29] text-[#0a0a0a] font-semibold rounded-xl hover:bg-[#a8ef19] transition-colors"
            >
              Li e Aceito os Termos
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* LADO DIREITO: VISUAL GEOMETRICO */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-[#0a0a0a]">
        {/* Gradiente de fundo */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f0f0f] via-[#0a0a0a] to-[#050505]" />
        
        {/* Formas geometricas */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          {/* Linhas diagonais */}
          <line x1="0" y1="100" x2="100" y2="0" stroke="#b8ff29" strokeWidth="0.1" opacity="0.3" />
          <line x1="20" y1="100" x2="100" y2="20" stroke="#b8ff29" strokeWidth="0.05" opacity="0.2" />
          <line x1="0" y1="80" x2="80" y2="0" stroke="#b8ff29" strokeWidth="0.05" opacity="0.2" />
          
          {/* Quadrado grande rotacionado */}
          <rect x="35" y="35" width="30" height="30" fill="none" stroke="#b8ff29" strokeWidth="0.15" opacity="0.4" transform="rotate(45 50 50)" />
          <rect x="40" y="40" width="20" height="20" fill="none" stroke="#b8ff29" strokeWidth="0.1" opacity="0.25" transform="rotate(45 50 50)" />
          
          {/* Circulo central */}
          <circle cx="50" cy="50" r="18" fill="none" stroke="#b8ff29" strokeWidth="0.08" opacity="0.15" />
          <circle cx="50" cy="50" r="25" fill="none" stroke="#b8ff29" strokeWidth="0.05" opacity="0.1" />
          
          {/* Pontos nos cantos */}
          <circle cx="15" cy="15" r="0.8" fill="#b8ff29" opacity="0.5" />
          <circle cx="85" cy="15" r="0.8" fill="#b8ff29" opacity="0.5" />
          <circle cx="15" cy="85" r="0.8" fill="#b8ff29" opacity="0.5" />
          <circle cx="85" cy="85" r="0.8" fill="#b8ff29" opacity="0.5" />
        </svg>



        {/* Texto inferior */}
        <div className="absolute bottom-12 left-0 right-0 text-center z-10">
          <p className="text-[#333] text-sm tracking-[0.3em] uppercase">Dragon Automacao</p>
        </div>
      </div>
    </div>
  )
}

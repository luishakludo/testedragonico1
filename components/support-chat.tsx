"use client"

import { useState, useRef, useEffect } from "react"
import { X, Send, Loader2, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  showCategories?: boolean
}

const CATEGORIES = [
  { id: "premium", label: "Planos" },
  { id: "bots", label: "Bots" },
  { id: "fluxos", label: "Fluxos" },
  { id: "pagamentos", label: "Pagamentos" },
  { id: "outro", label: "Outro" },
]

// Logo Dragon como avatar
function DragonAvatar({ size = "md" }: { size?: "sm" | "md" }) {
  const sizeClasses = size === "sm" ? "w-8 h-8" : "w-10 h-10"
  const imgSize = size === "sm" ? 16 : 20
  return (
    <div className={cn(
      sizeClasses,
      "rounded-full bg-[#bfff00] flex items-center justify-center shrink-0"
    )}>
      <Image
        src="/images/dragon-logo.png"
        alt=""
        width={imgSize}
        height={imgSize}
        className="object-contain"
      />
    </div>
  )
}

export function SupportChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus()
    }
  }, [isOpen, isMinimized])

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId)
    
    const categoryResponses: Record<string, string> = {
      premium: "Otimo! Me conta sua duvida sobre planos e assinaturas.",
      bots: "Certo! Qual o problema com seu bot?",
      fluxos: "Perfeito! Como posso ajudar com seus fluxos?",
      pagamentos: "Entendido! Qual sua duvida sobre pagamentos?",
      outro: "Sem problemas! Me conta o que precisa."
    }

    const assistantMessage: Message = {
      id: Date.now().toString(),
      role: "assistant",
      content: categoryResponses[categoryId],
      timestamp: new Date()
    }
    setMessages(prev => [...prev, assistantMessage])
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    if (messages.length === 0) {
      setTimeout(() => {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Ola! Selecione o assunto da sua duvida:",
          timestamp: new Date(),
          showCategories: true
        }
        setMessages(prev => [...prev, assistantMessage])
        setIsLoading(false)
      }, 500)
      return
    }

    setTimeout(() => {
      const responses = [
        "Entendi! Vou verificar isso pra voce. Pode me dar mais detalhes?",
        "Certo! Vou encaminhar para nossa equipe resolver.",
        "Perfeito! Ja estou analisando sua solicitacao.",
        "Obrigado pela informacao! Em breve resolvemos isso."
      ]
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
      setIsLoading(false)
    }, 800 + Math.random() * 700)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setIsMinimized(false)
    setMessages([])
    setSelectedCategory(null)
  }

  // Botao flutuante com logo Dragon
  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50 group">
        {/* Tooltip */}
        <div className="absolute bottom-full right-0 mb-3 px-4 py-2.5 rounded-xl bg-[#111] border border-[#bfff00]/30 shadow-xl shadow-black/20 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200 pointer-events-none whitespace-nowrap">
          <span className="text-white text-sm font-medium">Como podemos ajudar?</span>
          {/* Seta do tooltip */}
          <div className="absolute -bottom-1.5 right-5 w-3 h-3 bg-[#111] border-r border-b border-[#bfff00]/30 rotate-45" />
        </div>
        
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 rounded-full bg-[#bfff00] hover:bg-[#d4ff4d] flex items-center justify-center shadow-lg shadow-[#bfff00]/20 transition-all duration-200 hover:scale-105 hover:shadow-[#bfff00]/30"
          aria-label="Abrir chat de suporte"
        >
          <Image
            src="/images/dragon-logo.png"
            alt=""
            width={26}
            height={26}
            className="object-contain"
          />
        </button>
      </div>
    )
  }

  // Minimizado
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-3 py-2.5 rounded-full bg-[#111] border border-[#bfff00]/30 hover:border-[#bfff00]/60 transition-all shadow-lg"
      >
        <DragonAvatar size="sm" />
        <span className="text-white text-sm font-medium pr-1">Suporte</span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleClose()
          }}
          className="w-6 h-6 rounded-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </button>
    )
  }

  // Chat aberto - Verde + Dark
  return (
    <div className="fixed bottom-6 right-6 z-50 w-[360px] h-[500px] rounded-2xl bg-[#0d0d0d] border border-[#bfff00]/20 shadow-2xl shadow-[#bfff00]/5 overflow-hidden flex flex-col">
      {/* Header com accent verde */}
      <div className="px-4 py-3 bg-gradient-to-r from-[#bfff00]/10 to-transparent border-b border-[#bfff00]/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <DragonAvatar />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#22c55e] rounded-full border-2 border-[#0d0d0d]" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Suporte Dragon</h3>
            <span className="text-[#bfff00]/70 text-xs">Online agora</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="w-8 h-8 rounded-lg hover:bg-[#bfff00]/10 flex items-center justify-center transition-colors"
          >
            <Minus className="w-4 h-4 text-neutral-400" />
          </button>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg hover:bg-[#bfff00]/10 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-neutral-400" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0d0d0d]">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-[#bfff00] flex items-center justify-center mb-4 shadow-lg shadow-[#bfff00]/20">
              <Image
                src="/images/dragon-logo.png"
                alt=""
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            <h4 className="text-white font-semibold mb-1">Como posso ajudar?</h4>
            <p className="text-neutral-500 text-sm">Envie uma mensagem para comecar</p>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id}>
            <div
              className={cn(
                "flex gap-2.5",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <DragonAvatar size="sm" />
              )}
              
              <div className={cn(
                "max-w-[78%] px-3.5 py-2.5 text-sm",
                message.role === "user"
                  ? "bg-[#bfff00] text-[#0a0a0a] rounded-2xl rounded-br-sm font-medium"
                  : "bg-[#1a1a1a] text-white rounded-2xl rounded-bl-sm border border-[#bfff00]/10"
              )}>
                {message.content}
              </div>
            </div>

            {/* Category buttons */}
            {message.showCategories && !selectedCategory && (
              <div className="flex flex-wrap gap-2 mt-3 ml-11">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryClick(cat.id)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#1a1a1a] border border-[#bfff00]/20 text-[#bfff00] hover:bg-[#bfff00] hover:text-[#0a0a0a] hover:border-[#bfff00] transition-all"
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5 justify-start">
            <DragonAvatar size="sm" />
            <div className="px-4 py-3 rounded-2xl bg-[#1a1a1a] border border-[#bfff00]/10 rounded-bl-sm">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#bfff00]/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-[#bfff00]/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-[#bfff00]/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-[#111] border-t border-[#bfff00]/20">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            className="flex-1 px-4 py-2.5 rounded-full bg-[#1a1a1a] border border-[#bfff00]/10 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#bfff00]/40 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-full bg-[#bfff00] hover:bg-[#d4ff4d] flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#bfff00]/20"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 text-[#0a0a0a] animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-[#0a0a0a]" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

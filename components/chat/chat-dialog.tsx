"use client"

// Chat Dialog Component - v4 - WhatsApp Style
import { useState, useEffect, useRef, useCallback } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Send, Search, MessageSquare, User, Bot, RefreshCw, X } from "lucide-react"
import { cn } from "@/lib/utils"

// Cliente Supabase importado diretamente
import { supabase } from "@/lib/supabase"

interface Conversation {
  telegram_user_id: string
  telegram_chat_id: string
  first_name: string
  last_name?: string
  username?: string
  last_message?: string
  last_message_at?: string
  bot_id: string
  bot_username?: string
  unread_count?: number
}

interface Message {
  id: string
  bot_id: string
  telegram_user_id: string
  telegram_chat_id: string
  direction: "incoming" | "outgoing"
  message_type: string
  content: string
  created_at: string
}

interface ChatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  botId?: string
  initialUserId?: string
}

export function ChatDialog({ open, onOpenChange, botId, initialUserId }: ChatDialogProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevInitialUserIdRef = useRef<string | null>(null)

  // Buscar conversas usando bot_users
  const fetchConversations = useCallback(async () => {
    setLoading(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        setLoading(false)
        return
      }

      // Se tiver botId especifico, buscar so desse bot
      let botsQuery = supabase
        .from("bots")
        .select("id, username, token")
        .eq("user_id", userData.user.id)
      
      if (botId) {
        botsQuery = botsQuery.eq("id", botId)
      }

      const { data: bots } = await botsQuery

      if (!bots || bots.length === 0) {
        setLoading(false)
        return
      }

      const convList: Conversation[] = []

      // Buscar usuarios de TODOS os bots
      for (const bot of bots) {
        const { data: botUsers } = await supabase
          .from("bot_users")
          .select("*")
          .eq("bot_id", bot.id)
          .order("last_activity", { ascending: false })
          .limit(100)

        if (botUsers) {
          // Buscar ultima mensagem de cada usuario
          for (const user of botUsers) {
            const { data: lastMsg } = await supabase
              .from("bot_messages")
              .select("content, created_at")
              .eq("bot_id", bot.id)
              .eq("telegram_user_id", String(user.telegram_user_id))
              .order("created_at", { ascending: false })
              .limit(1)
              .single()

            convList.push({
              telegram_user_id: String(user.telegram_user_id),
              telegram_chat_id: String(user.chat_id || user.telegram_user_id),
              first_name: user.first_name || "Usuario",
              last_name: user.last_name,
              username: user.username,
              last_message: lastMsg?.content || `Iniciou em ${new Date(user.created_at).toLocaleDateString("pt-BR")}`,
              last_message_at: lastMsg?.created_at || user.last_activity || user.created_at,
              bot_id: bot.id,
              bot_username: bot.username,
              unread_count: 0,
            })
          }
        }
      }

      // Ordenar por ultima mensagem
      convList.sort((a, b) => {
        const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
        const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
        return dateB - dateA
      })

      setConversations(convList)

      // Se tiver initialUserId e mudou, selecionar automaticamente
      if (initialUserId && initialUserId !== prevInitialUserIdRef.current) {
        prevInitialUserIdRef.current = initialUserId
        const conv = convList.find(c => 
          c.telegram_user_id === initialUserId || c.username === initialUserId
        )
        if (conv) {
          setSelectedConversation(conv)
        }
      }
    } catch (error) {
      console.error("[v0] Erro ao buscar conversas:", error)
    } finally {
      setLoading(false)
    }
  }, [botId, initialUserId])

  // Buscar conversas quando abrir
  useEffect(() => {
    if (open) {
      fetchConversations()
    }
  }, [open, fetchConversations])

  // Buscar mensagens quando selecionar conversa
  useEffect(() => {
    if (selectedConversation) {
      fetchMessages()
    }
  }, [selectedConversation])

  // Auto-refresh a cada 10 segundos
  useEffect(() => {
    if (!open) return
    const interval = setInterval(() => {
      if (selectedConversation) {
        fetchMessages()
      }
    }, 10000)
    return () => clearInterval(interval)
  }, [open, selectedConversation])

  // Buscar mensagens da conversa selecionada
  const fetchMessages = async () => {
    if (!selectedConversation) return

    try {
      const { data, error } = await supabase
        .from("bot_messages")
        .select("*")
        .eq("bot_id", selectedConversation.bot_id)
        .eq("telegram_user_id", selectedConversation.telegram_user_id)
        .order("created_at", { ascending: true })

      if (!error && data && data.length > 0) {
        setMessages(data)
      } else {
        // Se nao houver mensagens, mostrar mensagem inicial
        setMessages([{
          id: "welcome",
          bot_id: selectedConversation.bot_id,
          telegram_user_id: selectedConversation.telegram_user_id,
          telegram_chat_id: selectedConversation.telegram_chat_id,
          direction: "outgoing",
          message_type: "text",
          content: "Nenhuma mensagem registrada ainda. Envie uma mensagem para iniciar a conversa.",
          created_at: new Date().toISOString(),
        }])
      }
      
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 100)
    } catch (error) {
      console.error("Erro ao buscar mensagens:", error)
    }
  }

  // Enviar mensagem
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return

    setSending(true)
    try {
      const response = await fetch("/api/telegram/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botId: selectedConversation.bot_id,
          chatId: selectedConversation.telegram_chat_id,
          message: newMessage.trim(),
        }),
      })

      const result = await response.json()

      if (result.success) {
        setNewMessage("")
        // Adicionar mensagem localmente
        const newMsg: Message = {
          id: `local-${Date.now()}`,
          bot_id: selectedConversation.bot_id,
          telegram_user_id: selectedConversation.telegram_user_id,
          telegram_chat_id: selectedConversation.telegram_chat_id,
          direction: "outgoing",
          message_type: "text",
          content: newMessage.trim(),
          created_at: new Date().toISOString(),
        }
        setMessages(prev => [...prev, newMsg])
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        }, 100)
      } else {
        alert("Erro ao enviar mensagem: " + result.error)
      }
    } catch (error) {
      console.error("Erro ao enviar:", error)
      alert("Erro ao enviar mensagem")
    } finally {
      setSending(false)
    }
  }

  // Filtrar conversas
  const filteredConversations = conversations.filter(conv => {
    const searchLower = searchQuery.toLowerCase()
    return (
      conv.first_name?.toLowerCase().includes(searchLower) ||
      conv.last_name?.toLowerCase().includes(searchLower) ||
      conv.username?.toLowerCase().includes(searchLower)
    )
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[80vh] p-0 gap-0 overflow-hidden">
        <div className="flex h-full">
          {/* Lista de conversas */}
          <div className="w-[380px] border-r border-border flex flex-col bg-muted/30">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                <h2 className="font-semibold">Conversas</h2>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={fetchConversations}
                disabled={loading}
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar conversa..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Lista */}
            <ScrollArea className="flex-1">
              {filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma conversa encontrada</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {filteredConversations.map((conv) => {
                    // Formatar horario da ultima mensagem
                    const lastMsgDate = conv.last_message_at ? new Date(conv.last_message_at) : null
                    const now = new Date()
                    let timeLabel = ""
                    if (lastMsgDate) {
                      const diffDays = Math.floor((now.getTime() - lastMsgDate.getTime()) / (1000 * 60 * 60 * 24))
                      if (diffDays === 0) {
                        timeLabel = lastMsgDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                      } else if (diffDays === 1) {
                        timeLabel = "Ontem"
                      } else if (diffDays < 7) {
                        timeLabel = lastMsgDate.toLocaleDateString("pt-BR", { weekday: "short" })
                      } else {
                        timeLabel = lastMsgDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                      }
                    }

                    return (
                      <button
                        key={`${conv.bot_id}_${conv.telegram_user_id}`}
                        onClick={() => setSelectedConversation(conv)}
                        className={cn(
                          "w-full p-3 text-left hover:bg-muted/50 transition-colors",
                          selectedConversation?.telegram_user_id === conv.telegram_user_id &&
                          selectedConversation?.bot_id === conv.bot_id &&
                          "bg-accent/10 border-l-2 border-l-accent"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-12 w-12 flex-shrink-0">
                            <AvatarFallback className="bg-gradient-to-br from-accent/30 to-accent/10 text-accent-foreground font-semibold">
                              {conv.first_name?.charAt(0).toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold text-foreground truncate">
                                {conv.first_name} {conv.last_name || ""}
                              </p>
                              <span className="text-[11px] text-muted-foreground flex-shrink-0">
                                {timeLabel}
                              </span>
                            </div>
                            {conv.username && (
                              <p className="text-xs text-accent truncate">@{conv.username}</p>
                            )}
                            <p className="text-sm text-muted-foreground truncate mt-0.5">
                              {conv.last_message || "Sem mensagens"}
                            </p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Area de mensagens */}
          <div className="flex-1 flex flex-col bg-background">
            {selectedConversation ? (
              <>
                {/* Header do chat */}
                <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-card">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-gradient-to-br from-accent/30 to-accent/10 text-accent-foreground font-semibold">
                        {selectedConversation.first_name?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-foreground">
                        {selectedConversation.first_name} {selectedConversation.last_name || ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedConversation.username ? `@${selectedConversation.username}` : `Telegram`}
                        {selectedConversation.bot_username && ` via @${selectedConversation.bot_username}`}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Mensagens - estilo WhatsApp */}
                <ScrollArea className="flex-1 p-4 bg-muted/20">
                  <div className="space-y-3 max-w-3xl mx-auto">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          msg.direction === "outgoing" ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[75%] rounded-xl px-3 py-2 shadow-sm relative",
                            msg.direction === "outgoing"
                              ? "bg-accent text-accent-foreground rounded-br-sm"
                              : "bg-card border border-border rounded-bl-sm"
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                          <div className={cn(
                            "flex items-center justify-end gap-1 mt-1",
                            msg.direction === "outgoing" ? "text-accent-foreground/60" : "text-muted-foreground"
                          )}>
                            <span className="text-[10px]">
                              {new Date(msg.created_at).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Input de mensagem - estilo WhatsApp */}
                <div className="p-3 border-t border-border bg-card">
                  <div className="flex gap-2 items-center max-w-3xl mx-auto">
                    <Input
                      placeholder="Digite sua mensagem..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          handleSendMessage()
                        }
                      }}
                      disabled={sending}
                      className="flex-1 rounded-full bg-muted/50 border-0 focus-visible:ring-1"
                    />
                    <Button 
                      onClick={handleSendMessage} 
                      disabled={sending || !newMessage.trim()}
                      size="icon"
                      className="rounded-full h-10 w-10 bg-accent hover:bg-accent/90"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/10">
                <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                  <MessageSquare className="h-10 w-10 opacity-50" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Selecione uma conversa</h3>
                <p className="text-sm mt-1">Escolha um contato para ver o historico de mensagens</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

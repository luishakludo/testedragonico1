"use client"

// Chat Dialog Component - v3 - REBUILD FORÇADO
import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Send, X, Search, MessageSquare, User, Bot, RefreshCw } from "lucide-react"
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

  // Buscar conversas quando abrir
  useEffect(() => {
    if (open) {
      fetchConversations()
    }
  }, [open, botId])

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
      fetchConversations()
      if (selectedConversation) {
        fetchMessages()
      }
    }, 10000)
    return () => clearInterval(interval)
  }, [open, selectedConversation])

  // Buscar conversas usando bot_users (igual a API de conversations)
  const fetchConversations = async () => {
    console.log("[v0] fetchConversations iniciado")
    setLoading(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      console.log("[v0] userData:", userData?.user?.id)
      if (!userData.user) {
        console.log("[v0] Usuario nao autenticado")
        setLoading(false)
        return
      }

      // Buscar bots do usuario
      const { data: bots, error: botsError } = await supabase
        .from("bots")
        .select("id, username, token")
        .eq("user_id", userData.user.id)

      console.log("[v0] bots encontrados:", bots?.length, "erro:", botsError)
      if (!bots || bots.length === 0) {
        console.log("[v0] Nenhum bot encontrado")
        setLoading(false)
        return
      }

      const botIds = bots.map(b => b.id)
      const convList: Conversation[] = []

      // Buscar usuarios de TODOS os bots do usuario (usando bot_users como fonte principal)
      for (const bot of bots) {
        const { data: botUsers, error: usersError } = await supabase
          .from("bot_users")
          .select("*")
          .eq("bot_id", bot.id)
          .order("last_activity", { ascending: false })
          .limit(50)

        console.log("[v0] bot_users para bot", bot.username, ":", botUsers?.length, "erro:", usersError)

        if (botUsers) {
          for (const user of botUsers) {
            convList.push({
              telegram_user_id: String(user.telegram_user_id),
              telegram_chat_id: String(user.chat_id || user.telegram_user_id),
              first_name: user.first_name || "Usuario",
              last_name: user.last_name,
              username: user.username,
              last_message: user.last_activity ? `Ativo: ${new Date(user.last_activity).toLocaleDateString("pt-BR")}` : undefined,
              last_message_at: user.last_activity,
              bot_id: bot.id,
              bot_username: bot.username,
              unread_count: 0,
            })
          }
        }
      }

      console.log("[v0] Total de conversas encontradas:", convList.length)
      setConversations(convList)

      // Se tiver initialUserId, selecionar automaticamente
      console.log("[v0] initialUserId:", initialUserId)
      if (initialUserId) {
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
  }

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
                <div className="divide-y divide-border">
                  {filteredConversations.map((conv) => (
                    <button
                      key={`${conv.bot_id}_${conv.telegram_user_id}`}
                      onClick={() => setSelectedConversation(conv)}
                      className={cn(
                        "w-full p-4 text-left hover:bg-muted/50 transition-colors",
                        selectedConversation?.telegram_user_id === conv.telegram_user_id &&
                        selectedConversation?.bot_id === conv.bot_id &&
                        "bg-accent/10"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-accent/20">
                            <User className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium truncate">
                              {conv.first_name} {conv.last_name || ""}
                            </p>
                            {conv.unread_count && conv.unread_count > 0 && (
                              <span className="bg-accent text-accent-foreground text-xs px-2 py-0.5 rounded-full">
                                {conv.unread_count}
                              </span>
                            )}
                          </div>
                          {conv.username && (
                            <p className="text-xs text-muted-foreground">@{conv.username}</p>
                          )}
                          <p className="text-sm text-muted-foreground truncate mt-0.5">
                            {conv.last_message || "Sem mensagens"}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Area de mensagens */}
          <div className="flex-1 flex flex-col">
            {selectedConversation ? (
              <>
                {/* Header do chat */}
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-accent/20">
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {selectedConversation.first_name} {selectedConversation.last_name || ""}
                      </p>
                      {selectedConversation.username && (
                        <p className="text-xs text-muted-foreground">@{selectedConversation.username}</p>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Mensagens */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex gap-2",
                          msg.direction === "outgoing" ? "justify-end" : "justify-start"
                        )}
                      >
                        {msg.direction === "incoming" && (
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-muted">
                              <User className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={cn(
                            "max-w-[70%] rounded-2xl px-4 py-2",
                            msg.direction === "outgoing"
                              ? "bg-accent text-accent-foreground"
                              : "bg-muted"
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          <p className="text-[10px] opacity-60 mt-1">
                            {new Date(msg.created_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        {msg.direction === "outgoing" && (
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-accent/20">
                              <Bot className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Input de mensagem */}
                <div className="p-4 border-t border-border">
                  <div className="flex gap-2">
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
                    />
                    <Button onClick={handleSendMessage} disabled={sending || !newMessage.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <MessageSquare className="h-16 w-16 mb-4 opacity-50" />
                <h3 className="text-lg font-medium">Selecione uma conversa</h3>
                <p className="text-sm">Escolha uma conversa na lista para ver o historico de mensagens</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

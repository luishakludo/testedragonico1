"use client"

import { useEffect, useState } from "react"
import { getSupabase } from "@/lib/supabase"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import {
  MessageSquare,
  Search,
  Loader2,
  User,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Ticket {
  id: string
  user_id: string
  subject: string
  message: string
  status: "open" | "in_progress" | "closed"
  priority: "low" | "medium" | "high"
  created_at: string
  closed_at?: string
  user?: {
    name: string
    email: string
  }
  replies?: TicketReply[]
}

interface TicketReply {
  id: string
  ticket_id: string
  message: string
  is_admin: boolean
  created_at: string
}

export default function SuportePage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<"open" | "in_progress" | "closed" | "all">("open")
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [replyMessage, setReplyMessage] = useState("")
  const [sending, setSending] = useState(false)
  const supabase = getSupabase()
  const { toast } = useToast()

  useEffect(() => {
    loadTickets()
  }, [])

  const loadTickets = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select(`*, user:users(name, email), replies:ticket_replies(*)`)
        .order("created_at", { ascending: false })

      if (error) throw error
      setTickets(data || [])
    } catch (error) {
      console.error("Error loading tickets:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleReply = async () => {
    if (!replyMessage.trim() || !selectedTicket) return

    setSending(true)
    try {
      const { error: replyError } = await supabase.from("ticket_replies").insert({
        ticket_id: selectedTicket.id,
        message: replyMessage,
        is_admin: true,
      })

      if (replyError) throw replyError

      if (selectedTicket.status === "open") {
        await supabase
          .from("support_tickets")
          .update({ status: "in_progress" })
          .eq("id", selectedTicket.id)
      }
      
      toast({ title: "Resposta enviada" })
      setReplyMessage("")
      loadTickets()
      
      const { data } = await supabase
        .from("support_tickets")
        .select(`*, user:users(name, email), replies:ticket_replies(*)`)
        .eq("id", selectedTicket.id)
        .single()
      
      if (data) setSelectedTicket(data)
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao enviar resposta", variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  const handleClose = async (id: string) => {
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", id)

      if (error) throw error
      
      toast({ title: "Ticket fechado" })
      loadTickets()
      setSelectedTicket(null)
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao fechar ticket", variant: "destructive" })
    }
  }

  const filteredTickets = tickets.filter(t => {
    const matchesTab = activeTab === "all" || t.status === activeTab
    const matchesSearch = search === "" || 
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      t.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.user?.email?.toLowerCase().includes(search.toLowerCase())
    return matchesTab && matchesSearch
  })

  const stats = {
    open: tickets.filter(t => t.status === "open").length,
    in_progress: tickets.filter(t => t.status === "in_progress").length,
    closed: tickets.filter(t => t.status === "closed").length,
  }

  const tabs = [
    { id: "open", label: "Abertos", count: stats.open },
    { id: "in_progress", label: "Em Andamento", count: stats.in_progress },
    { id: "closed", label: "Fechados", count: stats.closed },
    { id: "all", label: "Todos", count: tickets.length },
  ]

  return (
    <>
      <ScrollArea className="flex-1">
        <div className="p-6 lg:p-8 space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ 
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.1))',
                    border: '1px solid rgba(59, 130, 246, 0.2)'
                  }}
                >
                  <MessageSquare className="w-5 h-5 text-[#3b82f6]" />
                </div>
                <h1 className="text-3xl font-bold text-white tracking-tight">Suporte</h1>
              </div>
              <p className="text-[#666666] text-sm">
                Gerencie tickets de suporte dos usuarios
              </p>
            </div>
            <button
              onClick={loadTickets}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-[#a1a1a1] hover:text-white disabled:opacity-50"
              style={{ 
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)'
              }}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Atualizar
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              { icon: AlertCircle, label: "Abertos", value: stats.open, color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)" },
              { icon: Clock, label: "Em Andamento", value: stats.in_progress, color: "#3b82f6", bg: "rgba(59, 130, 246, 0.1)" },
              { icon: CheckCircle, label: "Fechados", value: stats.closed, color: "#22c55e", bg: "rgba(34, 197, 94, 0.1)" },
            ].map((stat, i) => (
              <div
                key={i}
                className="group rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1"
                style={{
                  background: '#0f0f0f',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `${stat.color}30`
                  e.currentTarget.style.boxShadow = `0 0 25px ${stat.color}15`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                    style={{ background: stat.bg }}
                  >
                    <stat.icon className="h-6 w-6" style={{ color: stat.color }} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                    <p className="text-sm text-[#666666]">{stat.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div 
            className="rounded-2xl p-5"
            style={{ 
              background: '#0f0f0f',
              border: '1px solid rgba(255,255,255,0.06)'
            }}
          >
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666666]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por assunto, nome ou email..."
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl text-sm text-white placeholder:text-[#666666] focus:outline-none focus:ring-2 focus:ring-[#95e468]/30 transition-all"
                  style={{ 
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)'
                  }}
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                      activeTab === tab.id
                        ? "text-[#050505]"
                        : "text-[#a1a1a1] hover:text-white"
                    )}
                    style={activeTab === tab.id ? {
                      background: 'linear-gradient(135deg, #95e468, #7bc752)',
                      boxShadow: '0 0 15px rgba(149, 228, 104, 0.3)'
                    } : {
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)'
                    }}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tickets List */}
          <div 
            className="rounded-2xl overflow-hidden"
            style={{ 
              background: '#0f0f0f',
              border: '1px solid rgba(255,255,255,0.06)'
            }}
          >
            <div 
              className="px-6 py-5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <h2 className="text-lg font-semibold text-white">Tickets</h2>
            </div>
            <div className="p-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-[#3b82f6]/10 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-[#3b82f6] animate-spin" />
                    </div>
                    <div className="absolute inset-0 rounded-xl bg-[#3b82f6]/20 blur-xl animate-pulse" />
                  </div>
                  <p className="text-sm text-[#666666]">Carregando tickets...</p>
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div 
                    className="w-20 h-20 rounded-2xl flex items-center justify-center"
                    style={{ 
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                      border: '1px solid rgba(255,255,255,0.06)'
                    }}
                  >
                    <MessageSquare className="h-10 w-10 text-[#444444]" />
                  </div>
                  <p className="text-sm text-[#666666]">Nenhum ticket encontrado</p>
                </div>
              ) : (
                <div>
                  {filteredTickets.map((ticket, i) => (
                    <div
                      key={ticket.id}
                      className="p-5 flex items-center gap-4 cursor-pointer transition-colors hover:bg-white/[0.02]"
                      style={{ borderBottom: i < filteredTickets.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}
                      onClick={() => setSelectedTicket(ticket)}
                    >
                      <div 
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                        style={{ 
                          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(149, 228, 104, 0.1))',
                          border: '1px solid rgba(255,255,255,0.06)'
                        }}
                      >
                        {ticket.user?.name?.charAt(0).toUpperCase() || <User className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-white">{ticket.subject}</p>
                        <p className="text-sm text-[#666666] truncate">
                          {ticket.user?.name} - {ticket.user?.email}
                        </p>
                      </div>
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-[#666666]">
                          {new Date(ticket.created_at).toLocaleDateString("pt-BR")}
                        </p>
                        <p className="text-xs text-[#444444]">
                          {ticket.replies?.length || 0} respostas
                        </p>
                      </div>
                      <span 
                        className="px-3 py-1.5 rounded-full text-xs font-medium hidden sm:inline-flex"
                        style={{ 
                          background: ticket.priority === "high" ? 'rgba(239, 68, 68, 0.1)' : ticket.priority === "medium" ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                          color: ticket.priority === "high" ? '#ef4444' : ticket.priority === "medium" ? '#f59e0b' : '#3b82f6',
                          border: `1px solid ${ticket.priority === "high" ? 'rgba(239, 68, 68, 0.2)' : ticket.priority === "medium" ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`
                        }}
                      >
                        {ticket.priority === "high" ? "Alta" : ticket.priority === "medium" ? "Media" : "Baixa"}
                      </span>
                      <span 
                        className="px-3 py-1.5 rounded-full text-xs font-medium"
                        style={{ 
                          background: ticket.status === "open" ? 'rgba(245, 158, 11, 0.1)' : ticket.status === "in_progress" ? 'rgba(59, 130, 246, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                          color: ticket.status === "open" ? '#f59e0b' : ticket.status === "in_progress" ? '#3b82f6' : '#22c55e',
                          border: `1px solid ${ticket.status === "open" ? 'rgba(245, 158, 11, 0.2)' : ticket.status === "in_progress" ? 'rgba(59, 130, 246, 0.2)' : 'rgba(34, 197, 94, 0.2)'}`
                        }}
                      >
                        {ticket.status === "open" ? "Aberto" : ticket.status === "in_progress" ? "Em Andamento" : "Fechado"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Ticket Details Modal */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent 
          className="sm:max-w-lg max-h-[90vh] p-0 gap-0 overflow-hidden rounded-2xl"
          style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {selectedTicket && (
            <>
              {/* Header */}
              <div className="p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(149, 228, 104, 0.1)' }}
                    >
                      <MessageSquare className="h-5 w-5 text-[#95e468]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{selectedTicket.subject}</h3>
                      <p className="text-sm text-[#666666]">
                        {selectedTicket.user?.name} - {selectedTicket.user?.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span 
                      className="px-3 py-1.5 rounded-full text-xs font-medium"
                      style={{ 
                        background: selectedTicket.status === "open" ? 'rgba(245, 158, 11, 0.1)' : selectedTicket.status === "in_progress" ? 'rgba(59, 130, 246, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                        color: selectedTicket.status === "open" ? '#f59e0b' : selectedTicket.status === "in_progress" ? '#3b82f6' : '#22c55e',
                      }}
                    >
                      {selectedTicket.status === "open" ? "Aberto" : selectedTicket.status === "in_progress" ? "Em Andamento" : "Fechado"}
                    </span>
                    {selectedTicket.status !== "closed" && (
                      <button
                        onClick={() => handleClose(selectedTicket.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#22c55e] hover:bg-[#22c55e]/10 transition-colors"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Fechar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="max-h-[400px] p-5">
                <div className="space-y-4">
                  {/* Original message */}
                  <div 
                    className="p-4 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <p className="text-xs text-[#666666] mb-2">
                      {new Date(selectedTicket.created_at).toLocaleString("pt-BR")}
                    </p>
                    <p className="text-sm text-white">{selectedTicket.message}</p>
                  </div>

                  {/* Replies */}
                  {selectedTicket.replies?.sort((a, b) => 
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                  ).map((reply) => (
                    <div
                      key={reply.id}
                      className={cn("p-4 rounded-xl", reply.is_admin ? "ml-6" : "mr-6")}
                      style={{ 
                        background: reply.is_admin ? 'rgba(149, 228, 104, 0.05)' : 'rgba(255,255,255,0.03)',
                        border: reply.is_admin ? '1px solid rgba(149, 228, 104, 0.15)' : '1px solid rgba(255,255,255,0.06)'
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn("text-xs font-medium", reply.is_admin ? "text-[#95e468]" : "text-white")}>
                          {reply.is_admin ? "Suporte Dragon" : selectedTicket.user?.name}
                        </span>
                        <span className="text-xs text-[#666666]">
                          {new Date(reply.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <p className="text-sm text-white">{reply.message}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Reply Input */}
              {selectedTicket.status !== "closed" && (
                <div className="p-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex gap-3">
                    <Textarea
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Digite sua resposta..."
                      rows={2}
                      className="flex-1 resize-none bg-[#111111] border-[rgba(255,255,255,0.06)] text-white placeholder:text-[#666666] rounded-xl"
                    />
                    <button
                      onClick={handleReply}
                      disabled={sending || !replyMessage.trim()}
                      className="px-4 rounded-xl text-sm font-semibold text-[#050505] transition-all duration-200 disabled:opacity-50"
                      style={{ 
                        background: 'linear-gradient(135deg, #95e468, #7bc752)',
                      }}
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

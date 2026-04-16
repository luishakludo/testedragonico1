"use client"

import { useState } from "react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { NoBotSelected } from "@/components/no-bot-selected"
import { useBots } from "@/lib/bot-context"
import { Plus, Send, Clock, CheckCircle, Image, Calendar } from "lucide-react"

const postagens = [
  { id: "p1", titulo: "Promo de verao", tipo: "imagem", status: "enviada", data: "15 Fev 2026 14:00", destinatarios: 3200 },
  { id: "p2", titulo: "Novo produto", tipo: "texto", status: "enviada", data: "14 Fev 2026 10:30", destinatarios: 2800 },
  { id: "p3", titulo: "Desconto exclusivo", tipo: "imagem", status: "agendada", data: "18 Fev 2026 09:00", destinatarios: 1500 },
  { id: "p4", titulo: "Lancamento VIP", tipo: "texto", status: "rascunho", data: "-", destinatarios: 0 },
]

const statusStyles: Record<string, string> = {
  enviada: "bg-success/10 text-success border-success/20",
  agendada: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  rascunho: "bg-secondary text-muted-foreground border-border",
}

const statusIcons: Record<string, React.ReactNode> = {
  enviada: <CheckCircle className="h-3 w-3" />,
  agendada: <Clock className="h-3 w-3" />,
  rascunho: <Clock className="h-3 w-3" />,
}

export default function PostsPage() {
  const { selectedBot } = useBots()

  if (!selectedBot) {
    return (
      <>
        
        <NoBotSelected />
      </>
    )
  }

  return (
    <>
      
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 md:gap-6 p-4 md:p-6">
          <div className="grid gap-3 md:gap-4 grid-cols-3">
            <Card className="bg-card border-border rounded-2xl">
              <CardContent className="flex items-center gap-3 md:gap-4 p-3 md:p-5">
                <div className="flex h-9 w-9 md:h-11 md:w-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
                  <Send className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Enviadas</p>
                  <p className="text-lg md:text-2xl font-bold text-foreground">2</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border rounded-2xl">
              <CardContent className="flex items-center gap-3 md:gap-4 p-3 md:p-5">
                <div className="flex h-9 w-9 md:h-11 md:w-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
                  <Calendar className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Agendadas</p>
                  <p className="text-lg md:text-2xl font-bold text-foreground">1</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border rounded-2xl">
              <CardContent className="flex items-center gap-3 md:gap-4 p-3 md:p-5">
                <div className="flex h-9 w-9 md:h-11 md:w-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
                  <Image className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Rascunhos</p>
                  <p className="text-lg md:text-2xl font-bold text-foreground">1</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Envios e agendamentos de mensagens</p>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl">
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Postagem
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Criar Postagem</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 pt-4">
                  <div className="flex flex-col gap-2">
                    <Label className="text-foreground">Titulo</Label>
                    <Input placeholder="Titulo da postagem" className="bg-secondary border-border rounded-xl" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label className="text-foreground">Mensagem</Label>
                    <Textarea placeholder="Escreva sua mensagem..." className="bg-secondary border-border rounded-xl" rows={4} />
                  </div>
                  <Button className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl">
                    <Send className="mr-2 h-4 w-4" />
                    Criar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex flex-col gap-3">
            {postagens.map((post) => (
              <Card key={post.id} className="bg-card border-border rounded-2xl">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                      {post.tipo === "imagem" ? (
                        <Image className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Send className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">{post.titulo}</h3>
                        <Badge variant="outline" className={`rounded-lg ${statusStyles[post.status]}`}>
                          {statusIcons[post.status]}
                          <span className="ml-1">{post.status}</span>
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {post.data !== "-" ? post.data : "Sem data"}
                        {post.destinatarios > 0 && ` - ${post.destinatarios.toLocaleString("pt-BR")} destinatarios`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </ScrollArea>
    </>
  )
}

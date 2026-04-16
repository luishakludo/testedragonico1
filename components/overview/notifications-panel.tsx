"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bell, CheckCircle, AlertTriangle, Info } from "lucide-react"

const notificacoes = [
  {
    icon: CheckCircle,
    titulo: "Bot ativado",
    mensagem: "FunnelBot esta online",
    tempo: "2h atras",
    type: "success",
  },
  {
    icon: AlertTriangle,
    titulo: "PIX expirado",
    mensagem: "Transacao nao completada",
    tempo: "15 min atras",
    type: "warning",
  },
  {
    icon: Info,
    titulo: "Campanha enviada",
    mensagem: "Promo Weekend entregue",
    tempo: "1h atras",
    type: "info",
  },
  {
    icon: CheckCircle,
    titulo: "Novo usuario",
    mensagem: "Carlos M. iniciou o bot",
    tempo: "3h atras",
    type: "success",
  },
]

const typeColors: Record<string, string> = {
  success: "text-success",
  warning: "text-warning",
  info: "text-muted-foreground",
}

export function NotificationsPanel() {
  return (
    <Card className="bg-card border-border rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium text-foreground">
            Notificacoes
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {notificacoes.map((n, i) => (
            <div key={i} className="flex items-start gap-3 px-5 py-3">
              <n.icon className={`mt-0.5 h-4 w-4 shrink-0 ${typeColors[n.type]}`} />
              <div>
                <p className="text-sm font-medium text-foreground">{n.titulo}</p>
                <p className="text-xs text-muted-foreground">{n.mensagem}</p>
                <p className="text-xs text-muted-foreground">{n.tempo}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

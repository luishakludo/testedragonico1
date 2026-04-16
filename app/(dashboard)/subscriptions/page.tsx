"use client"


import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { NoBotSelected } from "@/components/no-bot-selected"
import { useBots } from "@/lib/bot-context"
import { RefreshCw, Users, UserMinus } from "lucide-react"

const planos = [
  { id: "p1", nome: "Basico", preco: "R$ 19,90/mes", assinantes: 580, retencao: 92 },
  { id: "p2", nome: "Pro", preco: "R$ 49,90/mes", assinantes: 420, retencao: 88 },
  { id: "p3", nome: "VIP", preco: "R$ 97,00/mes", assinantes: 247, retencao: 95 },
]

const assinantes = [
  { id: "s1", nome: "Carlos M.", plano: "VIP", status: "ativo", renovacao: "22 Fev 2026" },
  { id: "s2", nome: "Ana P.", plano: "Pro", status: "ativo", renovacao: "25 Fev 2026" },
  { id: "s3", nome: "Lucas S.", plano: "Basico", status: "expirando", renovacao: "17 Fev 2026" },
  { id: "s4", nome: "Maria R.", plano: "VIP", status: "ativo", renovacao: "01 Mar 2026" },
  { id: "s5", nome: "Pedro L.", plano: "Pro", status: "expirado", renovacao: "-" },
  { id: "s6", nome: "Julia F.", plano: "Basico", status: "ativo", renovacao: "28 Fev 2026" },
]

const statusStyles: Record<string, string> = {
  ativo: "bg-success/10 text-success border-success/20",
  expirando: "bg-warning/10 text-warning border-warning/20",
  expirado: "bg-destructive/10 text-destructive border-destructive/20",
}

export default function SubscriptionsPage() {
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
          {/* Stats */}
          <div className="grid gap-3 md:gap-4 grid-cols-3">
            <Card className="bg-card border-border rounded-2xl">
              <CardContent className="flex items-center gap-3 md:gap-4 p-3 md:p-5">
                <div className="flex h-9 w-9 md:h-11 md:w-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
                  <Users className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Assinantes</p>
                  <p className="text-lg md:text-2xl font-bold text-foreground">1.247</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border rounded-2xl">
              <CardContent className="flex items-center gap-3 md:gap-4 p-3 md:p-5">
                <div className="flex h-9 w-9 md:h-11 md:w-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
                  <UserMinus className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Churn</p>
                  <p className="text-lg md:text-2xl font-bold text-foreground">3,2%</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border rounded-2xl">
              <CardContent className="flex items-center gap-3 md:gap-4 p-3 md:p-5">
                <div className="flex h-9 w-9 md:h-11 md:w-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
                  <RefreshCw className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Renovacoes</p>
                  <p className="text-lg md:text-2xl font-bold text-foreground">42</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Planos */}
          <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-3">
            {planos.map((plano) => (
              <Card key={plano.id} className="bg-card border-border rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-foreground">{plano.nome}</h3>
                    <span className="text-sm font-medium text-accent">{plano.preco}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{plano.assinantes} assinantes</p>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Retencao</span>
                      <span>{plano.retencao}%</span>
                    </div>
                    <Progress value={plano.retencao} className="mt-1.5 h-1.5 bg-secondary" />
                  </div>
                  <Button variant="outline" size="sm" className="mt-4 w-full border-border text-foreground rounded-xl">
                    Gerenciar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Lista de assinantes */}
          <Card className="bg-card border-border rounded-2xl">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Nome</TableHead>
                    <TableHead className="text-muted-foreground">Plano</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Renovacao</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assinantes.map((sub) => (
                    <TableRow key={sub.id} className="border-border">
                      <TableCell className="font-medium text-foreground">{sub.nome}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-border text-foreground rounded-lg">{sub.plano}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`rounded-lg ${statusStyles[sub.status]}`}>{sub.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{sub.renovacao}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </>
  )
}

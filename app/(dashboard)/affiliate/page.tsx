"use client"


import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { UserCheck, DollarSign, Users, Copy, TrendingUp } from "lucide-react"

const afiliados = [
  { nome: "Carlos Silva", vendas: 42, comissao: "R$ 1.260,00", status: "ativo" },
  { nome: "Ana Souza", vendas: 38, comissao: "R$ 1.140,00", status: "ativo" },
  { nome: "Pedro Lima", vendas: 25, comissao: "R$ 750,00", status: "ativo" },
  { nome: "Julia Costa", vendas: 12, comissao: "R$ 360,00", status: "pendente" },
  { nome: "Marcos Reis", vendas: 8, comissao: "R$ 240,00", status: "inativo" },
]

const statusStyles: Record<string, string> = {
  ativo: "bg-success/10 text-success border-success/20",
  pendente: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  inativo: "bg-secondary text-muted-foreground border-border",
}

export default function AffiliatePage() {
  return (
    <>
      
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 md:gap-6 p-4 md:p-6">
          <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
            <Card className="bg-card border-border rounded-2xl">
              <CardContent className="flex items-center gap-3 md:gap-4 p-3 md:p-5">
                <div className="flex h-9 w-9 md:h-11 md:w-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
                  <Users className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Afiliados</p>
                  <p className="text-lg md:text-2xl font-bold text-foreground">5</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border rounded-2xl">
              <CardContent className="flex items-center gap-3 md:gap-4 p-3 md:p-5">
                <div className="flex h-9 w-9 md:h-11 md:w-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
                  <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Comissoes</p>
                  <p className="text-lg md:text-2xl font-bold text-foreground">R$ 3.750</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border rounded-2xl">
              <CardContent className="flex items-center gap-3 md:gap-4 p-3 md:p-5">
                <div className="flex h-9 w-9 md:h-11 md:w-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
                  <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Vendas</p>
                  <p className="text-lg md:text-2xl font-bold text-foreground">125</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border rounded-2xl">
              <CardContent className="flex items-center gap-3 md:gap-4 p-3 md:p-5">
                <div className="flex h-9 w-9 md:h-11 md:w-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
                  <UserCheck className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Taxa</p>
                  <p className="text-lg md:text-2xl font-bold text-foreground">30%</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card border-border rounded-2xl">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-foreground">Seu Link de Afiliado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value="https://app.dragon.com/ref/seu-codigo"
                  className="bg-secondary border-border rounded-xl text-muted-foreground"
                />
                <Button variant="outline" className="border-border rounded-xl shrink-0">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border rounded-2xl">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-foreground">Afiliados</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Nome</TableHead>
                    <TableHead className="text-muted-foreground">Vendas</TableHead>
                    <TableHead className="text-muted-foreground">Comissao</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {afiliados.map((a, i) => (
                    <TableRow key={i} className="border-border">
                      <TableCell className="font-medium text-foreground">{a.nome}</TableCell>
                      <TableCell className="text-foreground">{a.vendas}</TableCell>
                      <TableCell className="text-foreground">{a.comissao}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`rounded-lg ${statusStyles[a.status]}`}>{a.status}</Badge>
                      </TableCell>
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

"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Bot, Megaphone, ShoppingCart, GitBranch } from "lucide-react"
import Link from "next/link"

const acoes = [
  { label: "Criar Bot", icon: Bot, href: "/bots" },
  { label: "Campanha", icon: Megaphone, href: "/campaigns" },
  { label: "Vendas", icon: ShoppingCart, href: "/payments" },
  { label: "Fluxo", icon: GitBranch, href: "/flows" },
]

export function QuickActions() {
  return (
    <Card className="bg-card border-border rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-foreground">
          Acoes Rapidas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {acoes.map((acao) => (
            <Button
              key={acao.label}
              variant="outline"
              className="flex h-auto flex-col items-center gap-2 border-border bg-secondary py-4 text-foreground hover:bg-accent hover:text-accent-foreground rounded-xl"
              asChild
            >
              <Link href={acao.href}>
                <acao.icon className="h-5 w-5" />
                <span className="text-xs font-medium">{acao.label}</span>
              </Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

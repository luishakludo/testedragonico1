"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Bot, Users, TrendingUp } from "lucide-react"

const stats = [
  { label: "Conversao", value: "0%", icon: TrendingUp },
  { label: "Usuarios", value: "0", icon: Users },
  { label: "Bots Ativos", value: "0", icon: Bot },
]

export function StatCards() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.label} className="bg-card border-border rounded-2xl">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-xl font-bold text-foreground tracking-tight">{stat.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

"use client"

import Link from "next/link"
import { Bell, Search, Bot } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useBots } from "@/lib/bot-context"
import { useAuth } from "@/lib/auth-context"

interface DashboardHeaderProps {
  title: string
  description?: string
}

export function DashboardHeader({ title, description }: DashboardHeaderProps) {
  const { selectedBot } = useBots()
  const { session } = useAuth()

  return (
    <header className="flex h-12 md:h-14 shrink-0 items-center justify-between border-b border-border bg-background px-3 md:px-6">
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        <div>
          <h1 className="text-sm md:text-base font-semibold text-foreground truncate">{title}</h1>
        </div>
        {selectedBot && (
          <Badge variant="outline" className="border-accent/30 bg-accent/5 text-accent rounded-lg text-xs hidden sm:flex">
            <Bot className="mr-1 h-3 w-3" />
            {selectedBot.name}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            className="w-56 bg-secondary pl-9 text-sm border-border rounded-xl"
          />
        </div>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground rounded-xl h-8 w-8 md:h-9 md:w-9">
          <Bell className="h-4 w-4" />
          <span className="sr-only">Notificacoes</span>
        </Button>
        <Link href="/settings" className="rounded-xl transition-opacity hover:opacity-80">
          <Avatar className="h-7 w-7 md:h-8 md:w-8 bg-secondary rounded-xl">
            <AvatarFallback className="bg-secondary text-foreground text-xs rounded-xl">
              {session?.email ? session.email.slice(0, 2).toUpperCase() : "TF"}
            </AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  )
}

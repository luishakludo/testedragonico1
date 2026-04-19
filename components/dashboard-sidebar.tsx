"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  DollarSign,
  Bot,
  GitBranch,
  Megaphone,
  CreditCard,
  LinkIcon,
  Gift,
  Trophy,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Target,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { BotSwitcher } from "@/components/bot-switcher"
import { useAuth } from "@/lib/auth-context"

type NavItem = {
  label: string
  description: string
  href: string
  icon: LucideIcon
  locked?: boolean
}

type NavSection = {
  category: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    category: "MENU",
    items: [
      { label: "Dashboard", description: "Visao geral", href: "/", icon: LayoutDashboard },
      { label: "Vendas", description: "Vendas e transacoes", href: "/payments", icon: DollarSign },
      { label: "Clientes", description: "Assinantes e compradores", href: "/clientes", icon: Users },
    ],
  },
  {
    category: "AUTOMACOES",
    items: [
      { label: "Meus Robos", description: "Gerenciar bots", href: "/bots", icon: Bot },
      { label: "Meus Fluxos", description: "Fluxos de venda", href: "/fluxos", icon: GitBranch },
      { label: "Remarketing", description: "Campanhas", href: "/campaigns", icon: Megaphone },
    ],
  },
  {
    category: "INTEGRACOES",
    items: [
      { label: "Gateways", description: "Pagamentos PIX", href: "/gateways", icon: CreditCard },
      { label: "Dragon Sites", description: "Crie paginas de conversao", href: "/biolink", icon: LinkIcon },
      { label: "Trackeamento", description: "Pixels e UTMs", href: "/tracking", icon: Target },
    ],
  },
  {
    category: "RECOMPENSAS",
    items: [
      { label: "Indique e Ganhe", description: "Convide amigos", href: "/referral", icon: Gift },
      { label: "Premiacoes", description: "Conquistas e premios", href: "/rewards", icon: Trophy },
    ],
  },
]

interface DashboardSidebarProps {
  onNavigate?: () => void
  defaultCollapsed?: boolean
}

export function DashboardSidebar({ onNavigate, defaultCollapsed = false }: DashboardSidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const { session, logout } = useAuth()

  const userInitial = session?.name
    ? session.name.charAt(0).toUpperCase()
    : session?.email
      ? session.email.charAt(0).toUpperCase()
      : "U"

  const userName = session?.name || session?.email?.split("@")[0] || "Usuario"

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex h-screen flex-col bg-card border-r border-border transition-all duration-300 relative",
          collapsed ? "w-[68px]" : "w-[240px]"
        )}
      >

        {/* Logo */}
        <div className="flex items-center justify-center pt-6 pb-4 px-4">
          <Image
            src="/images/logo-dragon.png"
            alt="Dragon"
            width={160}
            height={45}
            className={cn(
              "object-contain",
              collapsed ? "h-8 w-8" : "h-9 w-auto max-w-[160px]"
            )}
          />
        </div>

        {/* User Profile + Bot Switcher */}
        <div className={cn("px-4 pt-2 pb-2", collapsed && "px-2")}>
          <div className={cn(
            "rounded-xl bg-muted p-3 flex flex-col gap-3",
            collapsed && "items-center p-2 gap-2"
          )}>
            {/* Profile row */}
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/settings"
                    onClick={onNavigate}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background text-xs font-bold transition-colors hover:opacity-80"
                  >
                    {userInitial}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-card text-foreground border border-border">
                  {userName}
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/settings"
                  onClick={onNavigate}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background text-sm font-bold transition-colors hover:opacity-80"
                >
                  {userInitial}
                </Link>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[13px] font-semibold text-foreground truncate">
                    {userName}
                  </span>
                  <span className="text-[11px] text-muted-foreground truncate">
                    {session?.email || ""}
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20"
                  aria-label="Sair"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Bot Switcher */}
            <BotSwitcher collapsed={collapsed} />
          </div>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-1">
          <nav className={cn("flex flex-col gap-5", collapsed ? "px-2" : "px-3")}>
            {navSections.map((section) => (
              <div key={section.category} className="flex flex-col gap-0.5">
                {/* Category divider */}
                {!collapsed ? (
                  <div className="flex items-center gap-2.5 px-2 pb-2 pt-1">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {section.category}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-center py-1.5">
                    <div className="h-px w-5 bg-border/60" />
                  </div>
                )}

                {/* Items */}
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href))

                  if (item.locked) {
                    const lockedContent = (
                      <span
                        key={item.href}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-lg px-2.5 py-2 opacity-25 cursor-not-allowed select-none",
                          collapsed && "justify-center px-0"
                        )}
                      >
                        <span className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          collapsed ? "h-9 w-9" : ""
                        )}>
                          <item.icon className="h-[18px] w-[18px]" />
                        </span>
                        {!collapsed && (
                          <span className="text-[13px] font-medium text-foreground/70 truncate">
                            {item.label}
                          </span>
                        )}
                      </span>
                    )

                    if (collapsed) {
                      return (
                        <Tooltip key={item.href}>
                          <TooltipTrigger asChild>{lockedContent}</TooltipTrigger>
                          <TooltipContent side="right" className="bg-popover text-popover-foreground">
                            <p className="font-medium">{item.label}</p>
                            <p className="text-xs text-muted-foreground">Em breve</p>
                          </TooltipContent>
                        </Tooltip>
                      )
                    }

                    return lockedContent
                  }

                  const linkContent = (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-200",
                        collapsed && "justify-center px-0",
                        isActive
                          ? "bg-foreground text-background shadow-[0_8px_20px_-6px_hsl(var(--accent)/0.5)]"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      {/* Active indicator bar */}
                      <span className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200",
                        collapsed ? "h-9 w-9" : "",
                        isActive
                          ? "text-accent"
                          : "text-muted-foreground group-hover:text-foreground"
                      )}>
                        <item.icon className="h-[18px] w-[18px]" />
                      </span>

                      {!collapsed && (
                        <span className={cn(
                          "text-[13px] font-medium truncate transition-colors duration-200",
                          isActive
                            ? "text-background"
                            : "text-muted-foreground group-hover:text-foreground"
                        )}>
                          {item.label}
                        </span>
                      )}
                    </Link>
                  )

                  if (collapsed) {
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                        <TooltipContent side="right" className="bg-popover text-popover-foreground">
                          <p className="font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    )
                  }

                  return linkContent
                })}
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* Collapse toggle */}
        <div className={cn("px-4 pb-4 pt-1", collapsed && "px-2")}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex w-full justify-center text-muted-foreground hover:text-foreground hover:bg-muted h-7"
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  )
}

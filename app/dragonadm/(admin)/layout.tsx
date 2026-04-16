"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  Users,
  Bot,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  DollarSign,
  FileText,
  BarChart3,
  Zap,
  Home,
  ChevronRight,
} from "lucide-react"

interface AdminSession {
  email: string
  loggedAt: string
  expiresAt: string
}

// Menu reorganizado: Dashboard > Usuarios > Bots > Analytics > Financeiro
const menuItems = [
  { 
    section: "Principal",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/dragonadm" },
    ]
  },
  { 
    section: "Gestao",
    items: [
      { icon: Users, label: "Usuarios", href: "/dragonadm/users" },
      { icon: Bot, label: "Bots", href: "/dragonadm/bots" },
    ]
  },
  { 
    section: "Analises",
    items: [
      { icon: BarChart3, label: "Analytics", href: "/dragonadm/analytics" },
    ]
  },
  { 
    section: "Financeiro",
    items: [
      { icon: CreditCard, label: "Pagamentos", href: "/dragonadm/payments" },
      { icon: DollarSign, label: "Saques", href: "/dragonadm/saques-afiliados" },
    ]
  },
  { 
    section: "Sistema",
    items: [
      { icon: FileText, label: "Termos", href: "/dragonadm/termos" },
    ]
  },
]

export default function DragonAdmLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [session, setSession] = useState<AdminSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const storedSession = localStorage.getItem("dragon_adm_session")
    
    if (!storedSession) {
      router.push("/dragonadm/login")
      return
    }

    try {
      const parsed = JSON.parse(storedSession) as AdminSession
      const expiresAt = new Date(parsed.expiresAt)
      
      if (expiresAt < new Date()) {
        localStorage.removeItem("dragon_adm_session")
        router.push("/dragonadm/login")
        return
      }

      setSession(parsed)
    } catch {
      localStorage.removeItem("dragon_adm_session")
      router.push("/dragonadm/login")
      return
    }

    setIsLoading(false)
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("dragon_adm_session")
    router.push("/dragonadm/login")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-[#BFFF00]/10 flex items-center justify-center">
              <Zap className="w-6 h-6 text-[#BFFF00] animate-pulse" />
            </div>
          </div>
          <p className="text-sm text-zinc-500">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-[#0f0f0f] border-r border-zinc-800/50 transform transition-transform duration-200 lg:translate-x-0 lg:static lg:flex lg:flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#BFFF00] flex items-center justify-center">
              <Zap className="w-5 h-5 text-black" />
            </div>
            <span className="text-base font-semibold text-white">Dragon Admin</span>
          </div>
          <button
            className="lg:hidden p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          {menuItems.map((group, idx) => (
            <div key={group.section} className={cn(idx > 0 && "mt-6")}>
              <p className="px-3 mb-2 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                {group.section}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || 
                    (item.href !== "/dragonadm" && pathname.startsWith(item.href))
                  
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                        isActive
                          ? "bg-[#BFFF00] text-black"
                          : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px]" />
                      <span className="flex-1">{item.label}</span>
                      {isActive && <ChevronRight className="h-4 w-4" />}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-800/50">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="h-[18px] w-[18px]" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-4 lg:px-6 bg-[#0f0f0f]/80 backdrop-blur-sm border-b border-zinc-800/50 sticky top-0 z-30">
          <button
            className="lg:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3 ml-auto">
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Voltar</span>
            </Link>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#BFFF00]/10 border border-[#BFFF00]/20">
              <div className="w-2 h-2 rounded-full bg-[#BFFF00] animate-pulse" />
              <span className="text-xs text-[#BFFF00] font-medium">Online</span>
            </div>

            <div className="w-8 h-8 rounded-lg bg-[#BFFF00] flex items-center justify-center text-xs font-bold text-black">
              {session?.email?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

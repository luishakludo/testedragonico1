"use client"

import { useState } from "react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { BotProvider } from "@/lib/bot-context"
import { GatewayProvider } from "@/lib/gateway-context"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"

interface DashboardShellProps {
  children: React.ReactNode
  sidebarCollapsed?: boolean
}

export function DashboardShell({ children, sidebarCollapsed = false }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <BotProvider>
      <GatewayProvider>
        <div className="flex h-screen overflow-hidden bg-background">
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <DashboardSidebar defaultCollapsed={sidebarCollapsed} />
        </div>

        {/* Mobile hamburger + sheet */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-60 p-0 bg-sidebar border-border">
            <DashboardSidebar onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Mobile top bar with hamburger */}
          <div className="flex h-12 items-center border-b border-border px-3 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menu</span>
            </Button>
          </div>
          {children}
        </main>
        </div>
      </GatewayProvider>
    </BotProvider>
  )
}

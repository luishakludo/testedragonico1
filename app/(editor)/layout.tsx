import { DashboardShell } from "@/components/dashboard-shell"
import { AuthGuard } from "@/components/auth-guard"

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <DashboardShell sidebarCollapsed={true}>{children}</DashboardShell>
    </AuthGuard>
  )
}

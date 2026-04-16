import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { AuthProvider } from "@/lib/auth-context"
import { ThemeProvider } from "@/components/theme-provider"
import { SupportChat } from "@/components/support-chat"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: "Dragon - Telegram Sales Automation",
  description:
    "Plataforma de automacao de vendas via Telegram. Bots, funis, pagamentos e analytics em um so lugar.",
}

export const viewport: Viewport = {
  themeColor: "#0B0F14",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
            <SupportChat />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

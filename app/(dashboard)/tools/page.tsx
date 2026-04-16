"use client"


import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { NoBotSelected } from "@/components/no-bot-selected"
import { useBots } from "@/lib/bot-context"
import { Wrench, Image, FileText, Link2, QrCode, Palette, Download } from "lucide-react"

const ferramentas = [
  { nome: "Gerador de Imagens", descricao: "Crie imagens para campanhas e postagens", icon: Image, status: "disponivel" },
  { nome: "Editor de Texto", descricao: "Formate textos com variaveis dinamicas", icon: FileText, status: "disponivel" },
  { nome: "Encurtador de Links", descricao: "Encurte e rastreie links compartilhados", icon: Link2, status: "disponivel" },
  { nome: "Gerador de QR Code", descricao: "Crie QR codes para seus links e paginas", icon: QrCode, status: "disponivel" },
  { nome: "Editor de Criativos", descricao: "Design de banners e artes visuais", icon: Palette, status: "em breve" },
  { nome: "Exportar Dados", descricao: "Exporte leads e dados em CSV/Excel", icon: Download, status: "disponivel" },
]

export default function ToolsPage() {
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
          <p className="text-sm text-muted-foreground">Utilitarios de midia e produtividade</p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ferramentas.map((tool) => (
              <Card key={tool.nome} className="bg-card border-border rounded-2xl hover:bg-secondary/30 transition-colors cursor-pointer">
                <CardContent className="flex flex-col gap-3 p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary">
                      <tool.icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <Badge
                      variant="outline"
                      className={`rounded-lg ${
                        tool.status === "disponivel"
                          ? "bg-success/10 text-success border-success/20"
                          : "bg-secondary text-muted-foreground border-border"
                      }`}
                    >
                      {tool.status}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{tool.nome}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{tool.descricao}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </ScrollArea>
    </>
  )
}

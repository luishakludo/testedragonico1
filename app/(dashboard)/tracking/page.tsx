"use client"


import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { NoBotSelected } from "@/components/no-bot-selected"
import { useBots } from "@/lib/bot-context"
import { useState } from "react"

const pixels = [
  { nome: "Facebook Pixel", id: "FB-1234567890", tipo: "Facebook", ativo: true, cor: "#1877f2" },
  { nome: "TikTok Pixel", id: "TT-9876543210", tipo: "TikTok", ativo: true, cor: "#000000" },
  { nome: "Google Ads Tag", id: "AW-112233445566", tipo: "Google", ativo: true, cor: "#ea4335" },
  { nome: "Kwai Ads", id: "KW-445566778899", tipo: "Kwai", ativo: false, cor: "#ff6a00" },
]

const utms = [
  { nome: "Campanha Verao", source: "facebook", medium: "cpc", campaign: "verao_2026" },
  { nome: "Lancamento Bot", source: "tiktok", medium: "social", campaign: "launch_v2" },
  { nome: "Brand Search", source: "google", medium: "cpc", campaign: "brand_search" },
]

export default function TrackingPage() {
  const { selectedBot } = useBots()
  const [pixelStates, setPixelStates] = useState<Record<string, boolean>>(
    Object.fromEntries(pixels.map(p => [p.id, p.ativo]))
  )

  if (!selectedBot) {
    return (
      <>

        <NoBotSelected />
      </>
    )
  }

  const togglePixel = (id: string) => {
    setPixelStates(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <>
      <ScrollArea className="flex-1">
        <div className="p-4 md:p-8 bg-background min-h-full">
          <div className="max-w-5xl mx-auto">

            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-foreground dark:bg-card flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#a3e635]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="12" r="6"/>
                  <circle cx="12" cy="12" r="2"/>
                </svg>
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                  Rastreamento
                </h1>
                <p className="text-sm text-muted-foreground">
                  Configure pixels e UTMs para suas campanhas
                </p>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-foreground dark:bg-card text-background dark:text-foreground hover:bg-[#222] rounded-xl gap-2 px-5 h-11">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Novo Pixel
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-0 shadow-2xl sm:max-w-md rounded-[24px]">
                  <DialogHeader>
                    <DialogTitle className="text-foreground text-lg font-bold">Adicionar Pixel</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-4 pt-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-gray-700">Nome do Pixel</label>
                      <Input placeholder="Ex: Facebook Pixel" className="bg-muted border-gray-200 rounded-xl h-11" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-gray-700">ID do Pixel</label>
                      <Input placeholder="Ex: FB-123456789" className="bg-muted border-gray-200 rounded-xl h-11 font-mono" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-gray-700">Plataforma</label>
                      <div className="grid grid-cols-4 gap-2">
                        {["Facebook", "TikTok", "Google", "Kwai"].map(plat => (
                          <button key={plat} className="py-2 px-3 text-xs font-medium rounded-lg border border-gray-200 hover:border-[#a3e635] hover:bg-[#f0fdf4] transition-colors">
                            {plat}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button className="bg-foreground dark:bg-card text-background dark:text-foreground hover:bg-[#222] rounded-xl h-11 mt-2">
                      Adicionar Pixel
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Pixels Section */}
            <div className="bg-card rounded-[24px] border border-border shadow-sm overflow-hidden mb-6">
              <div className="p-5 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#a3e635]"></div>
                  <h2 className="font-semibold text-foreground">Pixels Instalados</h2>
                  <span className="text-xs text-muted-foreground ml-2">({pixels.length})</span>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {pixels.map((pixel) => (
                  <div key={pixel.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${pixel.cor}15` }}
                      >
                        {pixel.tipo === "Facebook" && (
                          <svg viewBox="0 0 24 24" className="w-5 h-5" style={{ color: pixel.cor }} fill="currentColor">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                          </svg>
                        )}
                        {pixel.tipo === "TikTok" && (
                          <svg viewBox="0 0 24 24" className="w-5 h-5" style={{ color: pixel.cor }} fill="currentColor">
                            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                          </svg>
                        )}
                        {pixel.tipo === "Google" && (
                          <svg viewBox="0 0 24 24" className="w-5 h-5" style={{ color: pixel.cor }} fill="currentColor">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34a853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fbbc05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                        )}
                        {pixel.tipo === "Kwai" && (
                          <svg viewBox="0 0 24 24" className="w-5 h-5" style={{ color: pixel.cor }} fill="currentColor">
                            <circle cx="12" cy="12" r="10"/>
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">{pixel.nome}</p>
                        <p className="text-xs text-muted-foreground font-mono">{pixel.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-xs font-medium px-2 py-1 rounded-md ${
                        pixelStates[pixel.id] 
                          ? "bg-[#f0fdf4] text-[#166534]" 
                          : "bg-gray-100 text-muted-foreground"
                      }`}>
                        {pixelStates[pixel.id] ? "Ativo" : "Pausado"}
                      </span>
                      <Switch 
                        checked={pixelStates[pixel.id]} 
                        onCheckedChange={() => togglePixel(pixel.id)}
                        className="data-[state=checked]:bg-[#a3e635]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* UTM Section */}
            <div className="bg-card rounded-[24px] border border-border shadow-sm overflow-hidden">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <h2 className="font-semibold text-foreground">Templates UTM</h2>
                  <span className="text-xs text-muted-foreground ml-2">({utms.length})</span>
                </div>
                <button className="text-xs font-medium text-muted-foreground hover:text-gray-700 flex items-center gap-1">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Novo UTM
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {utms.map((utm) => (
                  <div key={utm.nome} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <p className="font-medium text-foreground text-sm mb-1">{utm.nome}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          source={utm.source}
                        </span>
                        <span className="text-[11px] font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          medium={utm.medium}
                        </span>
                        <span className="text-[11px] font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          campaign={utm.campaign}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="text-xs font-medium text-muted-foreground hover:text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        Copiar
                      </button>
                      <button className="text-xs font-medium text-muted-foreground hover:text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        Editar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </ScrollArea>
    </>
  )
}

"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Check, Info } from "lucide-react"

export type PixelProvider = "meta" | "utmify" | null

export interface PixelConfig {
  provider: PixelProvider
  metaPixelId?: string
  utmifyToken?: string
}

interface PixelConfigPanelProps {
  config: PixelConfig
  onChange: (config: PixelConfig) => void
}

export function PixelConfigPanel({ config, onChange }: PixelConfigPanelProps) {
  const handleProviderChange = (provider: PixelProvider) => {
    // Se clicar no mesmo provider, desativa
    if (config.provider === provider) {
      onChange({ ...config, provider: null })
    } else {
      onChange({ ...config, provider })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Explicacao */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-700">
            <p className="font-medium mb-1">O que e o Pixel?</p>
            <p className="text-blue-600">
              O pixel permite rastrear eventos e conversoes dos visitantes do seu site. 
              Escolha o provedor e insira seu ID/Token para ativar.
            </p>
          </div>
        </div>
      </div>

      {/* Provider Selection */}
      <div>
        <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2.5 block">
          Escolha o Provedor
        </Label>
        <div className="grid grid-cols-2 gap-3">
          {/* Meta/Facebook Option */}
          <button
            type="button"
            onClick={() => handleProviderChange("meta")}
            className={cn(
              "relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all",
              config.provider === "meta"
                ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20"
                : "border-gray-200 hover:border-gray-300 bg-white"
            )}
          >
            {config.provider === "meta" && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-2">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-700">Meta Pixel</span>
            <span className="text-[10px] text-gray-400">Facebook/Instagram</span>
          </button>

          {/* UTMify Option */}
          <button
            type="button"
            onClick={() => handleProviderChange("utmify")}
            className={cn(
              "relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all",
              config.provider === "utmify"
                ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20"
                : "border-gray-200 hover:border-gray-300 bg-white"
            )}
          >
            {config.provider === "utmify" && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-2">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-700">UTMify</span>
            <span className="text-[10px] text-gray-400">Rastreamento UTM</span>
          </button>
        </div>
      </div>

      {/* Meta Pixel ID Input */}
      {config.provider === "meta" && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
          <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2 block">
            ID do Pixel do Meta
          </Label>
          <Input
            placeholder="Ex: 3675047522752828"
            value={config.metaPixelId || ""}
            onChange={(e) => onChange({ ...config, metaPixelId: e.target.value })}
            className="h-10 text-sm font-mono"
          />
          <p className="text-[10px] text-gray-400 mt-1.5">
            Encontre o ID do seu Pixel no Gerenciador de Eventos do Meta Business Suite
          </p>
        </div>
      )}

      {/* UTMify Token Input */}
      {config.provider === "utmify" && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
          <Label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2 block">
            Token do UTMify
          </Label>
          <Input
            placeholder="Ex: 6977e0a485f877673600790c"
            value={config.utmifyToken || ""}
            onChange={(e) => onChange({ ...config, utmifyToken: e.target.value })}
            className="h-10 text-sm font-mono"
          />
          <p className="text-[10px] text-gray-400 mt-1.5">
            Encontre o token na sua conta do UTMify, na area de integracao
          </p>
        </div>
      )}

      {/* Status */}
      {config.provider && (
        <div className={cn(
          "rounded-lg p-3 border",
          config.provider === "meta" && config.metaPixelId
            ? "bg-green-50 border-green-200"
            : config.provider === "utmify" && config.utmifyToken
            ? "bg-green-50 border-green-200"
            : "bg-amber-50 border-amber-200"
        )}>
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              (config.provider === "meta" && config.metaPixelId) || (config.provider === "utmify" && config.utmifyToken)
                ? "bg-green-500"
                : "bg-amber-500"
            )} />
            <span className={cn(
              "text-xs font-medium",
              (config.provider === "meta" && config.metaPixelId) || (config.provider === "utmify" && config.utmifyToken)
                ? "text-green-700"
                : "text-amber-700"
            )}>
              {(config.provider === "meta" && config.metaPixelId) || (config.provider === "utmify" && config.utmifyToken)
                ? "Pixel configurado e ativo"
                : `Insira o ${config.provider === "meta" ? "ID do Pixel" : "Token"} para ativar`
              }
            </span>
          </div>
        </div>
      )}

      {!config.provider && (
        <div className="rounded-lg p-3 border bg-gray-50 border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-400" />
            <span className="text-xs font-medium text-gray-500">
              Nenhum pixel configurado
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

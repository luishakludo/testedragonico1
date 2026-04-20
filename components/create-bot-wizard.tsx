"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Bot as BotIcon,
  Check,
  Loader2,
  AlertCircle,
} from "lucide-react"

interface CreateBotWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateBot: (data: {
    name: string
    token: string
    username?: string
    telegram_bot_id?: string
    photo_url?: string
    group_name?: string
    group_id?: string
    group_link?: string
  }) => Promise<void>
  isNewUser?: boolean
}

export function CreateBotWizard({
  open,
  onOpenChange,
  onCreateBot,
  isNewUser = false,
}: CreateBotWizardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState("")
  const [token, setToken] = useState("")

  const resetForm = () => {
    setToken("")
    setError("")
    setIsSubmitting(false)
    setIsValidating(false)
  }

  const handleValidateAndCreate = async () => {
    if (!token.trim()) {
      setError("Digite o token do bot")
      return
    }

    setIsValidating(true)
    setError("")

    try {
      const response = await fetch("/api/telegram/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      })

      const data = await response.json()

      if (!response.ok || !data.bot) {
        setError(data.error || "Token invalido. Verifique e tente novamente.")
        return
      }

      // Criar o bot diretamente apos validar o token
      setIsSubmitting(true)
      await onCreateBot({
        name: data.bot.name || data.bot.username || "Bot",
        token: token.trim(),
        username: data.bot.username,
        telegram_bot_id: String(data.bot.telegram_bot_id),
        photo_url: data.bot.photo_url,
      })
      onOpenChange(false)
      resetForm()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao criar bot")
    } finally {
      setIsValidating(false)
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#1c1c1e] border-[#2c2c2e] sm:max-w-md p-0 gap-0 overflow-hidden"
      >
        <div className="p-6 flex flex-col gap-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/20">
              <BotIcon className="h-7 w-7 text-accent" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {isNewUser ? "Adicione seu primeiro bot" : "Adicionar Bot"}
              </h2>
              <p className="mt-1 text-sm text-neutral-400">
                Cole o token do seu bot do Telegram
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-neutral-300 text-sm">Token do Bot</Label>
            <Input
              placeholder="123456789:ABCdefGHI..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleValidateAndCreate()}
              className="bg-[#2c2c2e] border-[#3c3c3e] h-12 font-mono text-sm text-white placeholder:text-neutral-500"
              autoFocus
            />
            <p className="text-xs text-neutral-500">
              Pegue o token com o @BotFather no Telegram
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <Button
            onClick={handleValidateAndCreate}
            disabled={isValidating || isSubmitting || !token.trim()}
            className="bg-accent text-accent-foreground hover:bg-accent/90 h-12 text-base gap-2"
          >
            {isValidating || isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isValidating ? "Validando..." : "Criando..."}
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Adicionar Bot
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

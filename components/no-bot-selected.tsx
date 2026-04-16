"use client"

import { useState, useEffect } from "react"
import { Bot, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CreateBotWizard } from "@/components/create-bot-wizard"
import { useBots } from "@/lib/bot-context"

export function NoBotSelected() {
  const { addBot, bots, isLoading } = useBots()
  const [wizardOpen, setWizardOpen] = useState(false)
  const [hasAutoOpened, setHasAutoOpened] = useState(false)

  // Auto-open wizard for new users (no bots)
  useEffect(() => {
    if (!isLoading && bots.length === 0 && !hasAutoOpened) {
      setWizardOpen(true)
      setHasAutoOpened(true)
    }
  }, [isLoading, bots.length, hasAutoOpened])

  async function handleCreateBot(data: {
    name: string
    token: string
    username?: string
    telegram_bot_id?: string
    photo_url?: string
    group_name?: string
    group_id?: string
    group_link?: string
  }) {
    const createdBot = await addBot(data)
    await fetch("/api/telegram/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ botToken: createdBot.token, action: "register" }),
    })
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
        <Bot className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-semibold text-foreground">Nenhum bot selecionado</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie seu primeiro bot para comecar a usar o painel
        </p>
      </div>
      <Button
        onClick={() => setWizardOpen(true)}
        className="bg-accent text-accent-foreground hover:bg-accent/90"
      >
        <Plus className="mr-2 h-4 w-4" />
        Criar Bot
      </Button>
      <CreateBotWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreateBot={handleCreateBot}
        isNewUser={true}
      />
    </div>
  )
}

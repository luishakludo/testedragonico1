"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"

const SELECTED_BOT_KEY = "dragon_selected_bot"

export interface Bot {
  id: string
  user_id: string
  name: string
  token: string
  group_name: string | null
  group_id: string | null
  group_link: string | null
  created_at: string
  status: "active" | "inactive"
}

interface BotContextType {
  bots: Bot[]
  selectedBot: Bot | null
  isLoading: boolean
  setSelectedBot: (bot: Bot) => void
  addBot: (data: {
    name: string
    token: string
    group_name?: string
    group_id?: string
    group_link?: string
  }) => Promise<Bot>
  updateBot: (id: string, updates: Partial<Omit<Bot, "id" | "user_id" | "created_at">>) => Promise<void>
  deleteBot: (id: string) => Promise<void>
  refreshBots: () => Promise<void>
}

const BotContext = createContext<BotContextType | null>(null)

function getStoredSelectedBotId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(SELECTED_BOT_KEY)
}

function saveSelectedBotId(id: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(SELECTED_BOT_KEY, id)
}

export function BotProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [bots, setBots] = useState<Bot[]>([])
  const [selectedBot, setSelectedBotState] = useState<Bot | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchBots = useCallback(async () => {
    if (!session) {
      setBots([])
      setSelectedBotState(null)
      setIsLoading(false)
      return
    }

    const { data, error } = await supabase
      .from("bots")
      .select("*")
      .eq("user_id", session.userId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching bots:", error)
      setIsLoading(false)
      return
    }

    const fetchedBots = (data || []) as Bot[]
    setBots(fetchedBots)

    // Auto-select
    const savedId = getStoredSelectedBotId()
    const found = fetchedBots.find((b) => b.id === savedId)
    if (found) {
      setSelectedBotState(found)
    } else if (fetchedBots.length > 0) {
      setSelectedBotState(fetchedBots[0])
      saveSelectedBotId(fetchedBots[0].id)
    } else {
      setSelectedBotState(null)
    }

    setIsLoading(false)
  }, [session])

  useEffect(() => {
    fetchBots()
  }, [fetchBots])

  const setSelectedBot = useCallback((bot: Bot) => {
    setSelectedBotState(bot)
    saveSelectedBotId(bot.id)
  }, [])

  const addBot = useCallback(
    async (data: {
      name: string
      token: string
      group_name?: string
      group_id?: string
      group_link?: string
    }): Promise<Bot> => {
      if (!session) throw new Error("Not logged in")

      // Ensure user exists in public.users before creating bot
      // This fixes the foreign key constraint error when the user profile
      // was not properly created during registration
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("id", session.userId)
        .single()

      if (!existingUser) {
        const { data: authData } = await supabase.auth.getSession()
        const authUser = authData?.session?.user
        if (authUser) {
          const { error: upsertError } = await supabase.from("users").upsert({
            id: authUser.id,
            name: authUser.user_metadata?.name || authUser.email || "",
            email: authUser.email?.toLowerCase() || "",
            phone: authUser.user_metadata?.phone || "",
            banned: false,
          }, { onConflict: "id" })

          if (upsertError) {
            console.error("Error ensuring user profile:", upsertError)
            throw new Error("Erro ao verificar perfil do usuario")
          }
        } else {
          throw new Error("Sessao expirada. Faca login novamente.")
        }
      }

      const { data: inserted, error } = await supabase
        .from("bots")
        .insert({
          user_id: session.userId,
          name: data.name,
          token: data.token,
          group_name: data.group_name || null,
          group_id: data.group_id || null,
          group_link: data.group_link || null,
          status: "active",
        })
        .select()
        .single()

      if (error) {
        console.error("Error creating bot:", error)
        throw new Error("Erro ao criar bot")
      }

      const newBot = inserted as Bot
      setBots((prev) => [newBot, ...prev])
      setSelectedBotState(newBot)
      saveSelectedBotId(newBot.id)
      return newBot
    },
    [session]
  )

  const updateBot = useCallback(
    async (id: string, updates: Partial<Omit<Bot, "id" | "user_id" | "created_at">>) => {
      const { error } = await supabase.from("bots").update(updates).eq("id", id)

      if (error) {
        console.error("Error updating bot:", error)
        throw new Error("Erro ao atualizar bot")
      }

      setBots((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...updates } : b))
      )
      if (selectedBot?.id === id) {
        setSelectedBotState((prev) => (prev ? { ...prev, ...updates } : prev))
      }
    },
    [selectedBot]
  )

  const deleteBot = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("bots").delete().eq("id", id)

      if (error) {
        console.error("Error deleting bot:", error)
        throw new Error("Erro ao deletar bot")
      }

      setBots((prev) => {
        const updated = prev.filter((b) => b.id !== id)
        if (selectedBot?.id === id) {
          if (updated.length > 0) {
            setSelectedBotState(updated[0])
            saveSelectedBotId(updated[0].id)
          } else {
            setSelectedBotState(null)
          }
        }
        return updated
      })
    },
    [selectedBot]
  )

  const refreshBots = useCallback(async () => {
    await fetchBots()
  }, [fetchBots])

  return (
    <BotContext.Provider
      value={{
        bots,
        selectedBot,
        isLoading,
        setSelectedBot,
        addBot,
        updateBot,
        deleteBot,
        refreshBots,
      }}
    >
      {children}
    </BotContext.Provider>
  )
}

export function useBots() {
  const ctx = useContext(BotContext)
  if (!ctx) throw new Error("useBots must be used within BotProvider")
  return ctx
}

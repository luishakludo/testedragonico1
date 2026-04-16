"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { useAuth } from "@/lib/auth-context"
import { useBots } from "@/lib/bot-context"
import { supabase } from "@/lib/supabase"

export interface Gateway {
  id: string
  user_id: string
  bot_id: string | null
  gateway_name: string
  access_token: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  user_id: string
  bot_id: string | null
  telegram_user_id: string | null
  gateway: string
  external_payment_id: string | null
  amount: number
  description: string | null
  qr_code: string | null
  qr_code_url: string | null
  copy_paste: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface PaymentPlan {
  id: string
  user_id: string
  bot_id: string | null
  name: string
  price: number
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// Gateways disponiveis na plataforma
export const AVAILABLE_GATEWAYS = [
  {
    id: "mercadopago",
    name: "Mercado Pago",
    description: "Pagamento via PIX",
    icon: "mercadopago",
    color: "#00bcff",
    methods: ["pix"],
    helpUrl: "https://www.mercadopago.com.br/developers/pt/docs/your-integrations/credentials",
  },
  {
    id: "pushinpay",
    name: "Pushin Pay",
    description: "PIX instantaneo",
    icon: "pushinpay",
    color: "#8b5cf6",
    methods: ["pix"],
    helpUrl: "https://pushinpay.com.br",
    comingSoon: true,
  },
  {
    id: "winpay",
    name: "Win Pay",
    description: "PIX instantaneo",
    icon: "winpay",
    color: "#f97316",
    methods: ["pix"],
    helpUrl: "https://winpay.com.br",
    comingSoon: true,
  },
] as const

interface GatewayContextType {
  gateways: Gateway[]
  payments: Payment[]
  plans: PaymentPlan[]
  isLoading: boolean
  connectGateway: (gatewayName: string, accessToken: string) => Promise<Gateway>
  disconnectGateway: (id: string) => Promise<void>
  updateGateway: (id: string, updates: Partial<Pick<Gateway, "access_token" | "is_active">>) => Promise<void>
  getGatewayByName: (name: string) => Gateway | undefined
  refreshGateways: () => Promise<void>
  refreshPayments: () => Promise<void>
  // Plans
  addPlan: (plan: { name: string; price: number; description?: string }) => Promise<PaymentPlan>
  updatePlan: (id: string, updates: Partial<Pick<PaymentPlan, "name" | "price" | "description" | "is_active">>) => Promise<void>
  deletePlan: (id: string) => Promise<void>
  refreshPlans: () => Promise<void>
}

const GatewayContext = createContext<GatewayContextType | null>(null)

export function GatewayProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const { selectedBot } = useBots()
  const [gateways, setGateways] = useState<Gateway[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [plans, setPlans] = useState<PaymentPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchGateways = useCallback(async () => {
    if (!session) {
      setGateways([])
      setIsLoading(false)
      return
    }

    // Gateway e por usuario, nao por bot - todos os bots usam o mesmo gateway
    const { data, error } = await supabase
      .from("user_gateways")
      .select("*")
      .eq("user_id", session.userId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching gateways:", error)
      setIsLoading(false)
      return
    }

    setGateways((data || []) as Gateway[])
    setIsLoading(false)
  }, [session, selectedBot])

  const fetchPayments = useCallback(async () => {
    if (!session || !selectedBot) {
      setPayments([])
      return
    }

    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("user_id", session.userId)
      .eq("bot_id", selectedBot.id)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) {
      console.error("Error fetching payments:", error)
      return
    }

    setPayments((data || []) as Payment[])
  }, [session, selectedBot])

  const fetchPlans = useCallback(async () => {
    if (!session) {
      setPlans([])
      return
    }

    let query = supabase
      .from("payment_plans")
      .select("*")
      .eq("user_id", session.userId)
      .order("created_at", { ascending: false })

    if (selectedBot) {
      query = query.or(`bot_id.eq.${selectedBot.id},bot_id.is.null`)
    }

    const { data, error } = await query

    if (error) {
      // Ignora erro se a tabela nao existe ainda (PGRST205 = table not found)
      setPlans([])
      return
    }

    setPlans((data || []) as PaymentPlan[])
  }, [session, selectedBot])

  useEffect(() => {
    fetchGateways()
  }, [fetchGateways])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  const connectGateway = useCallback(
    async (gatewayName: string, accessToken: string): Promise<Gateway> => {
      console.log("[v0] connectGateway chamado:", { gatewayName, hasToken: !!accessToken, session: session ? { userId: session.userId } : null, selectedBot: selectedBot ? { id: selectedBot.id, name: selectedBot.name } : null })
      
      if (!session) {
        console.log("[v0] ERRO: Sessao nao encontrada")
        throw new Error("Nao autenticado")
      }

      // Verifica se ja existe gateway com esse nome para o usuario (gateway e global por usuario)
      const existing = gateways.find((g) => g.gateway_name === gatewayName)
      console.log("[v0] Gateway existente encontrado:", existing ? { id: existing.id, gateway_name: existing.gateway_name } : null)

      if (existing) {
        // Atualiza o token existente
        console.log("[v0] Atualizando gateway existente:", existing.id)
        const { error } = await supabase
          .from("user_gateways")
          .update({ 
            access_token: accessToken, 
            is_active: true,
            updated_at: new Date().toISOString() 
          })
          .eq("id", existing.id)

        if (error) {
          console.error("[v0] ERRO ao atualizar gateway:", error)
          throw new Error("Erro ao atualizar gateway")
        }

        console.log("[v0] Gateway atualizado com sucesso!")
        const updated = { ...existing, access_token: accessToken, is_active: true }
        setGateways((prev) => prev.map((g) => (g.id === existing.id ? updated : g)))
        return updated
      }

      // Cria novo gateway (global por usuario, sem bot_id)
      const { data, error } = await supabase
        .from("user_gateways")
        .insert({
          user_id: session.userId,
          bot_id: null, // Gateway e global para todos os bots do usuario
          gateway_name: gatewayName,
          access_token: accessToken,
          is_active: true,
        })
        .select()
        .single()

      if (error) {
        console.error("[v0] ERRO ao criar gateway:", error)
        throw new Error("Erro ao conectar gateway")
      }

      console.log("[v0] Gateway criado com sucesso:", data)
      const newGateway = data as Gateway
      setGateways((prev) => [newGateway, ...prev])
      return newGateway
    },
    [session, selectedBot, gateways]
  )

  const disconnectGateway = useCallback(async (id: string) => {
    const { error } = await supabase.from("user_gateways").delete().eq("id", id)

    if (error) {
      console.error("Error deleting gateway:", error)
      throw new Error("Erro ao desconectar gateway")
    }

    setGateways((prev) => prev.filter((g) => g.id !== id))
  }, [])

  const updateGateway = useCallback(
    async (id: string, updates: Partial<Pick<Gateway, "access_token" | "is_active">>) => {
      const { error } = await supabase
        .from("user_gateways")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)

      if (error) {
        console.error("Error updating gateway:", error)
        throw new Error("Erro ao atualizar gateway")
      }

      setGateways((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } : g)))
    },
    []
  )

  const getGatewayByName = useCallback(
    (name: string) => {
      return gateways.find((g) => g.gateway_name === name && g.is_active)
    },
    [gateways]
  )

  const refreshGateways = useCallback(async () => {
    await fetchGateways()
  }, [fetchGateways])

  const refreshPayments = useCallback(async () => {
    await fetchPayments()
  }, [fetchPayments])

  const addPlan = useCallback(
    async (plan: { name: string; price: number; description?: string }): Promise<PaymentPlan> => {
      if (!session) throw new Error("Nao autenticado")

      const { data, error } = await supabase
        .from("payment_plans")
        .insert({
          user_id: session.userId,
          bot_id: selectedBot?.id || null,
          name: plan.name,
          price: plan.price,
          description: plan.description || null,
          is_active: true,
        })
        .select()
        .single()

      if (error) {
        console.error("Error creating plan:", error)
        throw new Error("Erro ao criar plano")
      }

      const newPlan = data as PaymentPlan
      setPlans((prev) => [newPlan, ...prev])
      return newPlan
    },
    [session, selectedBot]
  )

  const updatePlan = useCallback(
    async (id: string, updates: Partial<Pick<PaymentPlan, "name" | "price" | "description" | "is_active">>) => {
      const { error } = await supabase
        .from("payment_plans")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)

      if (error) {
        console.error("Error updating plan:", error)
        throw new Error("Erro ao atualizar plano")
      }

      setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)))
    },
    []
  )

  const deletePlan = useCallback(async (id: string) => {
    const { error } = await supabase.from("payment_plans").delete().eq("id", id)

    if (error) {
      console.error("Error deleting plan:", error)
      throw new Error("Erro ao excluir plano")
    }

    setPlans((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const refreshPlans = useCallback(async () => {
    await fetchPlans()
  }, [fetchPlans])

  return (
    <GatewayContext.Provider
      value={{
        gateways,
        payments,
        plans,
        isLoading,
        connectGateway,
        disconnectGateway,
        updateGateway,
        getGatewayByName,
        refreshGateways,
        refreshPayments,
        addPlan,
        updatePlan,
        deletePlan,
        refreshPlans,
      }}
    >
      {children}
    </GatewayContext.Provider>
  )
}

export function useGateways() {
  const ctx = useContext(GatewayContext)
  if (!ctx) throw new Error("useGateways must be used within GatewayProvider")
  return ctx
}

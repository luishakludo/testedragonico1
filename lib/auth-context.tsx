"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { Session, User } from "@supabase/supabase-js"

export interface StoredUser {
  id: string
  name: string
  email: string
  phone: string
  banned: boolean
  created_at: string
}

interface AuthSession {
  userId: string
  name: string
  email: string
  loggedInAt: number
}

interface AuthContextType {
  session: AuthSession | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: { name: string; email: string; phone: string; password: string; referralCoupon?: string }) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

function mapToAuthSession(user: User, name?: string): AuthSession {
  return {
    userId: user.id,
    name: name || user.user_metadata?.name || user.email || "",
    email: user.email || "",
    loggedInAt: Date.now(),
  }
}

// ---- Helper functions for admin page ----

export async function getAllUsers(): Promise<StoredUser[]> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching users:", error)
    return []
  }

  return data || []
}

export async function saveAllUsers(_users: StoredUser[]) {
  // No-op: updates are done individually via toggleBan
}

export async function toggleUserBan(userId: string, banned: boolean) {
  const { error } = await supabase
    .from("users")
    .update({ banned })
    .eq("id", userId)

  if (error) {
    console.error("Error toggling ban:", error)
    throw error
  }
}

// ---- Provider ----

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Check current session on mount
    supabase.auth.getSession().then(({ data: { session: supaSession } }) => {
      if (supaSession?.user) {
        setSession(mapToAuthSession(supaSession.user))
      }
      setIsLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, supaSession) => {
      if (supaSession?.user) {
        setSession(mapToAuthSession(supaSession.user))
      } else {
        setSession(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw new Error(error.message === "Invalid login credentials"
          ? "Email ou senha incorretos"
          : error.message)
      }

      // Check if banned
      const { data: userData } = await supabase
        .from("users")
        .select("banned")
        .eq("id", data.user.id)
        .single()

      if (userData?.banned) {
        await supabase.auth.signOut()
        throw new Error("Conta banida")
      }

      setSession(mapToAuthSession(data.user))
      router.push("/")
    },
    [router]
  )

  const register = useCallback(
    async (data: { name: string; email: string; phone: string; password: string; referralCoupon?: string }) => {
      // Sign up with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name,
            phone: data.phone,
          },
        },
      })

      if (authError) {
        if (authError.message.includes("already registered")) {
          throw new Error("Este email ja esta cadastrado")
        }
        throw new Error(authError.message)
      }

      if (!authData.user) {
        throw new Error("Erro ao criar conta")
      }

      // Insert into public users table (upsert to handle edge cases)
      const { error: insertError } = await supabase.from("users").upsert({
        id: authData.user.id,
        name: data.name,
        email: data.email.toLowerCase(),
        phone: data.phone,
        banned: false,
      }, { onConflict: "id" })

      if (insertError) {
        console.error("Error inserting user profile:", insertError)
        // Don't fail silently - retry once
        const { error: retryError } = await supabase.from("users").upsert({
          id: authData.user.id,
          name: data.name,
          email: data.email.toLowerCase(),
          phone: data.phone,
          banned: false,
        }, { onConflict: "id" })

        if (retryError) {
          console.error("Retry also failed:", retryError)
        }
      }

      // Handle referral coupon - link new user to referrer via server API
      // No access token needed - the API uses a SECURITY DEFINER RPC function
      if (data.referralCoupon) {
        try {
          const trackRes = await fetch("/api/referral/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              referredId: authData.user.id,
              couponCode: data.referralCoupon,
            }),
          })

          if (!trackRes.ok) {
            const trackData = await trackRes.json()
            console.error("Error tracking referral:", trackData.error)
          }
        } catch (referralError) {
          console.error("Error creating referral:", referralError)
          // Don't block registration if referral fails
        }
      }

      setSession(mapToAuthSession(authData.user, data.name))
      router.push("/")
    },
    [router]
  )

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    router.push("/login")
  }, [router])

  return (
    <AuthContext.Provider value={{ session, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

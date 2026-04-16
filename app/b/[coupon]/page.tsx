"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Loader2, XCircle } from "lucide-react"
import { DragonIcon } from "@/components/dragon-icon"

export default function ReferralLandingPage() {
  const params = useParams()
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "invalid">("loading")
  const coupon = (params.coupon as string)?.toLowerCase()

  useEffect(() => {
    if (!coupon) {
      setStatus("invalid")
      return
    }

    async function validateAndRedirect() {
      try {
        const res = await fetch(`/api/referral/validate?code=${encodeURIComponent(coupon)}`)
        const data = await res.json()

        if (data.valid) {
          // Save the coupon to localStorage as fallback
          localStorage.setItem("referral_coupon", coupon)
          // Pass the coupon in the URL so it persists visibly
          router.push(`/cadastro?ref=${encodeURIComponent(coupon)}`)
        } else {
          setStatus("invalid")
        }
      } catch {
        setStatus("invalid")
      }
    }

    validateAndRedirect()
  }, [coupon, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm text-center">
        {status === "loading" ? (
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card">
              <DragonIcon className="h-7 w-7" />
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Validando cupom...</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
              <XCircle className="h-7 w-7 text-destructive" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Cupom invalido</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                O cupom <span className="font-medium text-foreground">{`"${coupon}"`}</span> nao foi encontrado.
              </p>
            </div>
            <button
              onClick={() => router.push("/cadastro")}
              className="mt-2 text-sm text-accent hover:underline"
            >
              Cadastre-se sem cupom
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

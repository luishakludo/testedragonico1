"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { DragonIcon } from "@/components/dragon-icon"

export function PageLoading() {
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(true)
  const [isFadingOut, setIsFadingOut] = useState(false)

  useEffect(() => {
    setIsLoading(true)
    setIsFadingOut(false)

    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true)
    }, 600)

    const removeTimer = setTimeout(() => {
      setIsLoading(false)
    }, 1000)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(removeTimer)
    }
  }, [pathname])

  if (!isLoading) return null

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-background transition-opacity duration-400 ${
        isFadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl animate-pulse">
          <DragonIcon className="h-8 w-8" />
        </div>
        <span className="text-lg font-semibold text-foreground tracking-tight">
          Dragon
        </span>
      </div>
    </div>
  )
}

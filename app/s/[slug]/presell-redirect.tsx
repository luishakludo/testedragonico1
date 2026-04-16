"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

type RedirectData = {
  redirectUrl: string
  delay: number
  message: string
  fallbackText: string
  background?: {
    type: "color" | "image"
    color: string
    imageDesktop: string
    imageMobile: string
  }
}

export function PresellRedirect({ data }: { data: RedirectData }) {
  const [countdown, setCountdown] = useState(data.delay || 2)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
  }, [])

  useEffect(() => {
    if (countdown <= 0 && data.redirectUrl) {
      window.location.href = data.redirectUrl
      return
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [countdown, data.redirectUrl])

  const bgColor = data.background?.color || "#0088cc"
  const bgImage = isMobile 
    ? data.background?.imageMobile 
    : data.background?.imageDesktop

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6 bg-cover bg-center"
      style={{ 
        backgroundColor: bgColor,
        backgroundImage: data.background?.type === "image" && bgImage ? `url(${bgImage})` : undefined
      }}
    >
      <div className="text-center max-w-[90%]">
        {/* Circulo com logo do Telegram */}
        <div 
          className="w-[120px] h-[120px] rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl"
          style={{ background: "linear-gradient(180deg, #24A1DE 0%, #1c82b1 100%)" }}
        >
          <Image 
            src="/telegram-white.png" 
            alt="Telegram" 
            width={60} 
            height={60}
            className="object-contain"
          />
        </div>

        {/* Spinner de Loading */}
        <div className="w-[45px] h-[45px] border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-6" />

        {/* Texto Principal */}
        <div className="text-white text-2xl font-medium mb-5">
          {data.message || "Redirecionando..."}
        </div>

        {/* Link Manual */}
        <a 
          href={data.redirectUrl || "#"}
          className="text-white underline text-base opacity-90 hover:opacity-100 transition-opacity"
        >
          {data.fallbackText || "Clique aqui se nao for redirecionado"}
        </a>
      </div>
    </div>
  )
}

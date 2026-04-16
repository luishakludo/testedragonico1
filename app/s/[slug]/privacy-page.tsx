"use client"

import { Lock, Heart, Image as ImageIcon, Video, CheckCircle2, Instagram, Globe } from "lucide-react"

type PrivacyPost = {
  id: string
  type: "image" | "video"
  url: string
  blur?: boolean
}

// Tipos que correspondem ao editor conversion-editor
type PrivacyPageData = {
  // Profile
  username: string
  handle: string
  bio: string
  avatar: string
  coverImage: string
  isVerified: boolean
  // Stats
  stats: {
    photos: number
    videos: number
    locked: number
    likes: string
  }
  // Social Links
  socialLinks: {
    instagram?: string
    twitter?: string
    tiktok?: string
  }
  // Subscriptions
  subscriptions: {
    id: string
    name: string
    price: string
    discount?: string
  }[]
  // Posts
  postsCount: number
  mediasCount: number
  posts: PrivacyPost[]
  // CTA
  ctaUrl: string
  // Colors
  colors: {
    background: string
    text: string
    subtext: string
    accent: string
    cardBg: string
  }
}

export function PrivacyPage({ data }: { data: Partial<PrivacyPageData> }) {
  // Valores default para dados vazios
  const colors = data.colors || {
    background: "#fef7f0",
    text: "#1a1a1a",
    subtext: "#666666",
    accent: "#f97316",
    cardBg: "#ffffff"
  }

  const username = data.username || "SeuNome"
  const handle = data.handle || "@seunome"
  const bio = data.bio || "Oi meus amores! Bem-vindos ao meu perfil exclusivo..."
  const avatar = data.avatar || ""
  const coverImage = data.coverImage || ""
  const isVerified = data.isVerified !== false
  const stats = data.stats || { photos: 544, videos: 609, locked: 5, likes: "13.3K" }
  const socialLinks = data.socialLinks || {}
  const subscriptions = data.subscriptions || [
    { id: "1", name: "1 mes", price: "R$ 35,90" },
    { id: "2", name: "3 meses (10% off)", price: "R$ 96,93" },
    { id: "3", name: "6 meses (15% off)", price: "R$ 183,09" }
  ]
  const postsCount = data.postsCount || 352
  const mediasCount = data.mediasCount || 1153
  const posts = data.posts || []
  const ctaUrl = data.ctaUrl || ""

  const handlePlanClick = () => {
    if (ctaUrl) {
      window.location.href = ctaUrl
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="text-xl font-bold" style={{ color: colors.text }}>
          privacy<span style={{ color: colors.accent }}>.</span>
        </div>
        <Globe className="w-5 h-5" style={{ color: colors.subtext }} />
      </header>

      {/* Cover Image */}
      <div className="relative">
        {coverImage ? (
          <div 
            className="w-full h-32 bg-cover bg-center"
            style={{ backgroundImage: `url(${coverImage})` }}
          />
        ) : (
          <div className="w-full h-32" style={{ backgroundColor: `${colors.accent}20` }} />
        )}
        
        {/* Avatar */}
        <div className="absolute -bottom-10 left-4">
          {avatar ? (
            <img 
              src={avatar} 
              alt={username}
              className="w-20 h-20 rounded-full border-4 object-cover"
              style={{ borderColor: colors.background }}
            />
          ) : (
            <div 
              className="w-20 h-20 rounded-full border-4 flex items-center justify-center text-2xl font-bold"
              style={{ 
                backgroundColor: colors.cardBg,
                borderColor: colors.background,
                color: colors.subtext
              }}
            >
              {username.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Stats on cover */}
        <div className="absolute bottom-2 right-4 flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1 bg-white/80 px-2 py-1 rounded">
            <ImageIcon className="w-3 h-3" />
            <span>{stats.photos}</span>
          </div>
          <div className="flex items-center gap-1 bg-white/80 px-2 py-1 rounded">
            <Video className="w-3 h-3" />
            <span>{stats.videos}</span>
          </div>
          <div className="flex items-center gap-1 bg-white/80 px-2 py-1 rounded">
            <Heart className="w-3 h-3" />
            <span>{stats.likes}</span>
          </div>
        </div>
      </div>

      {/* Profile Info */}
      <div className="pt-12 px-4">
        <div className="flex items-center gap-1 mb-1">
          <h1 className="text-xl font-bold" style={{ color: colors.text }}>
            {username}
          </h1>
          {isVerified && (
            <CheckCircle2 className="w-5 h-5" style={{ color: colors.accent }} />
          )}
        </div>
        <p className="text-sm mb-2" style={{ color: colors.subtext }}>
          {handle.startsWith("@") ? handle : `@${handle}`}
        </p>
        {bio && (
          <p className="text-sm mb-1" style={{ color: colors.text }}>
            {bio.length > 80 ? bio.substring(0, 80) + "..." : bio}
          </p>
        )}
        {bio && bio.length > 80 && (
          <button className="text-sm font-medium" style={{ color: colors.accent }}>
            Ler mais
          </button>
        )}

        {/* Social Icons */}
        <div className="flex items-center gap-3 mt-4">
          {socialLinks.instagram && (
            <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" 
               className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
              <Instagram className="w-4 h-4" />
            </a>
          )}
          {socialLinks.twitter && (
            <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer"
               className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
          )}
          {socialLinks.tiktok && (
            <a href={socialLinks.tiktok} target="_blank" rel="noopener noreferrer"
               className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
              </svg>
            </a>
          )}
        </div>
      </div>

      {/* Plans Section */}
      <div className="px-4 mt-6">
        {/* Assinaturas - primeiro plano */}
        <h2 className="font-semibold mb-3" style={{ color: colors.text }}>Assinaturas</h2>
        {subscriptions.length > 0 && (
          <button
            onClick={handlePlanClick}
            className="w-full py-4 px-5 rounded-full flex items-center justify-between transition-all hover:scale-[1.01]"
            style={{ 
              background: `linear-gradient(90deg, #f97316 0%, #fed7aa 50%, #fef3e2 100%)`,
              color: "#1a1a1a"
            }}
          >
            <span className="font-medium">{subscriptions[0].name}</span>
            <span className="font-semibold">{subscriptions[0].price}</span>
          </button>
        )}

        {/* Promocoes - planos adicionais */}
        {subscriptions.length > 1 && (
          <div className="mt-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold" style={{ color: colors.text }}>Promocoes</h2>
              <svg className="w-4 h-4" style={{ color: colors.subtext }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 15l-6-6-6 6"/>
              </svg>
            </div>
            <div className="flex flex-col gap-2">
              {subscriptions.slice(1).map((plan) => (
                <button
                  key={plan.id}
                  onClick={handlePlanClick}
                  className="w-full py-4 px-5 rounded-full flex items-center justify-between transition-all hover:scale-[1.01]"
                  style={{ 
                    background: `linear-gradient(90deg, #fdba74 0%, #fed7aa 50%, #fef3e2 100%)`,
                    color: "#1a1a1a"
                  }}
                >
                  <span className="font-medium">{plan.name}</span>
                  <span className="font-semibold">{plan.price}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="mx-4 mt-6 py-3 px-4 rounded-xl" style={{ backgroundColor: colors.cardBg }}>
        <div className="flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <span className="font-bold" style={{ color: colors.accent }}>{postsCount}</span>
            <span style={{ color: colors.subtext }}>Postagens</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold" style={{ color: colors.subtext }}>{mediasCount}</span>
            <span style={{ color: colors.subtext }}>Midias</span>
          </div>
        </div>
      </div>

      {/* Posts com Blur - Full Width */}
      <div className="px-4 mt-6 pb-8">
        {posts.length > 0 ? (
          <div className="flex flex-col gap-3">
            {posts.map((post) => (
              <div key={post.id} className="w-full relative rounded-xl overflow-hidden">
                {post.type === "video" ? (
                  <video src={post.url} className="w-full h-auto" muted />
                ) : (
                  <img src={post.url} alt="" className="w-full h-auto" />
                )}
                {/* Blur overlay com cadeado - apenas se blur ativo */}
                {(post.blur !== false) && (
                  <div className="absolute inset-0 backdrop-blur-sm bg-black/10 flex items-center justify-center">
                    <Lock className="w-8 h-8 text-white/70" />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div 
            className="rounded-xl p-8 flex flex-col items-center justify-center"
            style={{ backgroundColor: `${colors.accent}10` }}
          >
            <Lock className="w-10 h-10 mb-3" style={{ color: colors.subtext }} />
            <p className="text-sm text-center" style={{ color: colors.subtext }}>
              Assine para desbloquear o conteudo exclusivo
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

import { getSupabase } from "@/lib/supabase"
import { notFound } from "next/navigation"
import { Metadata } from "next"
import { PresellAgeVerification } from "./presell-age"
import { PresellThankYou } from "./presell-thank-you"
import { PresellRedirect } from "./presell-redirect"
import { PrivacyPage } from "./privacy-page"
import { PixCheckout } from "./pix-checkout"
import { PixelScripts } from "@/components/dragon-sites/pixel-scripts"

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = getSupabase()
  
  const { data: site } = await supabase
    .from("dragon_bio_sites")
    .select("profile_name, profile_bio, nome")
    .eq("slug", slug)
    .single()

  if (!site) {
    return { title: "Site não encontrado" }
  }

  return {
    title: site.nome || site.profile_name,
    description: site.profile_bio,
  }
}

export default async function DragonBioPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = getSupabase()

  // Buscar site
  const { data: site, error } = await supabase
    .from("dragon_bio_sites")
    .select(`
      *,
      dragon_bio_links (*)
    `)
    .eq("slug", slug)
    .single()

  if (error || !site) {
    notFound()
  }

  // Se for um presell, renderiza o template correto
  if (site.presell_type && site.page_data) {
    const pageData = site.page_data

    if (site.presell_type === "age-verification" && pageData.ageData) {
      return <PresellAgeVerification data={pageData.ageData} />
    }

    if (site.presell_type === "thank-you" && pageData.thankYouData) {
      return <PresellThankYou data={pageData.thankYouData} />
    }

    if (site.presell_type === "redirect" && pageData.redirectData) {
      return <PresellRedirect data={pageData.redirectData} />
    }
  }

  // Se for uma pagina Checkout PIX (detecta pelo slug)
  const isCheckoutPage = site.slug?.startsWith("checkout-")
  if (isCheckoutPage || (site.page_data && (site.page_data.accessToken || site.page_data.pixKey || site.page_data.price))) {
    // Buscar gateway ativa do usuario para pegar o access_token
    let accessToken = site.page_data?.accessToken || ""
    
    console.log("[v0] Checkout page detected. user_id:", site.user_id, "existing accessToken:", !!accessToken)
    
    if (!accessToken && site.user_id) {
      const { data: gateway, error: gwError } = await supabase
        .from("user_gateways")
        .select("access_token, gateway_name")
        .eq("user_id", site.user_id)
        .eq("is_active", true)
        .single()
      
      console.log("[v0] Gateway query result:", gateway?.gateway_name, "error:", gwError?.message, "token exists:", !!gateway?.access_token)
      
      if (gateway?.access_token) {
        accessToken = gateway.access_token
      }
    }
    
    const checkoutData = {
      ...site.page_data,
      accessToken: accessToken,
    }
    
    console.log("[v0] Final checkoutData accessToken:", !!checkoutData.accessToken)
    
    return <PixCheckout data={checkoutData} siteId={site.id} userId={site.user_id} />
  }

  // Se for uma pagina Privacy/Conversao (detecta pelo slug ou page_data)
  const isConversionPage = site.slug?.startsWith("conversion-")
  if (isConversionPage || (site.page_data && (site.page_data.username || site.page_data.handle || site.page_data.plans))) {
    return <PrivacyPage data={site.page_data || {}} />
  }

  // Ordenar links
  const links = site.dragon_bio_links || []
  
  // Cores padrao
  const colors = site.colors || {
    primary: "#0f172a",
    secondary: "#ffffff",
    accent: "#3b82f6",
    background: "#0f172a",
    text: "#ffffff"
  }

  // Background images
  const backgroundImageMobile = site.background_image_mobile
  const backgroundImageDesktop = site.background_image_desktop

  // Background style
  const getBackgroundStyle = () => {
    const baseStyle: React.CSSProperties = { backgroundColor: colors.background }
    
    if (backgroundImageMobile || backgroundImageDesktop) {
      return {
        ...baseStyle,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    }
    
    return baseStyle
  }

return (
  <>
  {/* Pixel Tracking Scripts */}
  <PixelScripts config={site.pixel_config} />
  
  <div
  className="min-h-screen flex flex-col items-center justify-start pt-16 pb-8 px-4"
  style={getBackgroundStyle()}
  >
  {/* Background Images - Mobile first, then desktop */}
      {(backgroundImageMobile || backgroundImageDesktop) && (
        <style dangerouslySetInnerHTML={{
          __html: `
            .bg-container {
              background-image: url('${backgroundImageMobile || backgroundImageDesktop}');
            }
            @media (min-width: 768px) {
              .bg-container {
                background-image: url('${backgroundImageDesktop || backgroundImageMobile}');
              }
            }
          `
        }} />
      )}
      <div 
        className={`fixed inset-0 -z-10 ${(backgroundImageMobile || backgroundImageDesktop) ? 'bg-container bg-cover bg-center bg-no-repeat' : ''}`}
        style={{ backgroundColor: colors.background }}
      />
      {/* Profile Section */}
      <div className="flex flex-col items-center mb-8">
        {site.profile_image ? (
          <img 
            src={site.profile_image} 
            alt={site.profile_name}
            className="w-24 h-24 rounded-full object-cover mb-4 border-2"
            style={{ borderColor: colors.accent }}
          />
        ) : (
          <div 
            className="w-24 h-24 rounded-full mb-4 flex items-center justify-center text-3xl font-bold"
            style={{ 
              backgroundColor: colors.secondary,
              color: colors.background
            }}
          >
            {site.profile_name?.charAt(0)?.toUpperCase() || "D"}
          </div>
        )}
        
        <h1 
          className="text-xl font-bold mb-1"
          style={{ color: colors.text }}
        >
          {site.profile_name}
        </h1>
        
        {site.profile_bio && (
          <p 
            className="text-sm opacity-80 text-center max-w-xs"
            style={{ color: colors.text }}
          >
            {site.profile_bio}
          </p>
        )}
      </div>

      {/* Links Section */}
      <div className="w-full max-w-md space-y-3">
        {links.map((link: any) => (
          link.type === "card" ? (
            // Card com imagem
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
            >
              {link.image && (
                <div 
                  className="w-full h-40 bg-cover bg-center"
                  style={{ backgroundImage: `url(${link.image})` }}
                />
              )}
              <div 
                className="py-3 px-4 font-medium"
                style={{ 
                  backgroundColor: colors.secondary + "20",
                  color: colors.text 
                }}
              >
                {link.title}
              </div>
            </a>
          ) : (
            // Botao normal
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-4 px-6 text-center font-medium rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
              style={{ 
                backgroundColor: colors.secondary,
                color: colors.primary,
              }}
            >
              {link.title}
            </a>
          )
        ))}
      </div>

      {/* Footer */}
      <div className="mt-auto pt-8">
        <p 
          className="text-xs opacity-50"
          style={{ color: colors.text }}
        >
dragon.bio
  </p>
  </div>
  </div>
  </>
  )
}

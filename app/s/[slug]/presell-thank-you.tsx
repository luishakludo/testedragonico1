"use client"

type ThankYouData = {
  headline: string
  description: string
  buttonText: string
  buttonUrl: string
  showFooter: boolean
  footerText: string
  footerLinkText: string
  footerLinkUrl: string
  background: {
    type: "color" | "image"
    color: string
    gradientFrom: string
    gradientTo: string
  }
  buttonColor: string
}

export function PresellThankYou({ data }: { data: ThankYouData }) {
  const gradientFrom = data.background?.gradientFrom || "#f8fafc"
  const gradientTo = data.background?.gradientTo || "#e2e8f0"
  const buttonColor = data.buttonColor || "#2563eb"

  const handleClick = () => {
    if (data.buttonUrl) {
      window.location.href = data.buttonUrl
    }
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ 
        background: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)`
      }}
    >
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center transition-all hover:shadow-xl">
        {/* Icone de Sucesso */}
        <div className="mb-6 flex justify-center">
          <div className="bg-green-100 p-4 rounded-full animate-pulse">
            <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
        </div>

        {/* Titulo */}
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          {data.headline || "Muito Obrigado!"}
        </h1>

        {/* Descricao */}
        <p className="text-gray-600 mb-8 leading-relaxed">
          {data.description || "Sua acao foi concluida com sucesso. Agradecemos pela confianca e por fazer parte da nossa jornada."}
        </p>

        {/* Botao de Acao */}
        {data.buttonText && (
          <button
            onClick={handleClick}
            className="inline-block w-full py-4 px-6 text-white font-semibold rounded-xl transition-colors duration-300 shadow-lg hover:shadow-blue-200 active:scale-95"
            style={{ backgroundColor: buttonColor }}
          >
            {data.buttonText}
          </button>
        )}

        {/* Rodape opcional */}
        {data.showFooter !== false && data.footerText && (
          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-sm text-gray-400">
              {data.footerText}{" "}
              {data.footerLinkText && (
                <a 
                  href={data.footerLinkUrl || "#"}
                  className="text-blue-500 hover:underline"
                >
                  {data.footerLinkText}
                </a>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

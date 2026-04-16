"use client"

type AgeVerificationData = {
  headline: string
  yesButtonText: string
  noButtonText: string
  yesButtonUrl: string
  noButtonUrl: string
  background: {
    type: "color" | "image"
    color: string
    imageDesktop: string
    imageMobile: string
  }
}

export function PresellAgeVerification({ data }: { data: AgeVerificationData }) {
  const bgColor = data.background?.color || "#ffffff"
  const hasImage = data.background?.type === "image" && (data.background.imageDesktop || data.background.imageMobile)

  const handleYes = () => {
    if (data.yesButtonUrl) {
      window.location.href = data.yesButtonUrl
    }
  }

  const handleNo = () => {
    if (data.noButtonUrl) {
      window.location.href = data.noButtonUrl
    }
  }

  return (
    <>
      {hasImage && (
        <style dangerouslySetInnerHTML={{
          __html: `
            .presell-bg {
              background-image: url('${data.background.imageMobile || data.background.imageDesktop}');
            }
            @media (min-width: 768px) {
              .presell-bg {
                background-image: url('${data.background.imageDesktop || data.background.imageMobile}');
              }
            }
          `
        }} />
      )}
      <div 
        className={`min-h-screen flex items-center justify-center p-4 ${hasImage ? 'presell-bg bg-cover bg-center bg-no-repeat' : ''}`}
        style={{ backgroundColor: hasImage ? undefined : bgColor }}
      >
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8">
            {data.headline || "Voce tem 18 anos ou mais?"}
          </h1>

          <div className="flex flex-col gap-4">
            <button
              onClick={handleYes}
              className="w-full py-4 px-6 bg-green-500 hover:bg-green-600 text-white font-bold text-lg rounded-xl transition-all duration-200 hover:scale-[1.02] shadow-lg"
            >
              {data.yesButtonText || "TENHO 18"}
            </button>

            <button
              onClick={handleNo}
              className="w-full py-4 px-6 bg-red-500 hover:bg-red-600 text-white font-bold text-lg rounded-xl transition-all duration-200 hover:scale-[1.02] shadow-lg"
            >
              {data.noButtonText || "NAO TENHO 18"}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

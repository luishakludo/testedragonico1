import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const mediaType = formData.get("mediaType") as string | null

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })
    }

    // Validate file type
    const allowedImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    const allowedVideoTypes = ["video/mp4", "video/webm", "video/quicktime"]
    const allAllowed = [...allowedImageTypes, ...allowedVideoTypes]

    if (!allAllowed.includes(file.type)) {
      return NextResponse.json(
        { error: "Tipo de arquivo nao suportado. Use JPG, PNG, GIF, WEBP, MP4, WEBM ou MOV." },
        { status: 400 },
      )
    }

    if (mediaType === "photo" && !allowedImageTypes.includes(file.type)) {
      return NextResponse.json({ error: "Selecione um arquivo de imagem valido." }, { status: 400 })
    }

    if (mediaType === "video" && !allowedVideoTypes.includes(file.type)) {
      return NextResponse.json({ error: "Selecione um arquivo de video valido." }, { status: 400 })
    }

    // Max 10MB para imagens, 20MB para videos (base64 aumenta ~33% o tamanho)
    const maxSize = mediaType === "video" ? 20 * 1024 * 1024 : 10 * 1024 * 1024
    const maxLabel = mediaType === "video" ? "20MB" : "10MB"

    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `Arquivo muito grande. Maximo ${maxLabel}.` },
        { status: 400 },
      )
    }

    // Converter para Base64 Data URL para salvar diretamente no banco
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    // Converter Uint8Array para string base64
    let binary = ""
    const chunkSize = 8192
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize)
      binary += String.fromCharCode(...chunk)
    }
    const base64 = btoa(binary)

    const dataUrl = `data:${file.type};base64,${base64}`

    return NextResponse.json({ url: dataUrl })
  } catch (err) {
    console.error("Upload route error:", err)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

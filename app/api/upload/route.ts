import { type NextRequest, NextResponse } from 'next/server'
import { supabase } from "@/lib/supabase"
import { v4 as uuidv4 } from 'uuid'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const userId = formData.get('userId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime'
    ]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Tipo de arquivo invalido. Permitido: JPG, PNG, GIF, WEBP, MP4, WEBM, MOV' 
      }, { status: 400 })
    }

    // Validate file size (max 50MB para videos, 10MB para imagens)
    const isVideo = file.type.startsWith('video')
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: `Arquivo muito grande. Maximo ${isVideo ? '50MB' : '10MB'}` 
      }, { status: 400 })
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg')
    const uniqueId = uuidv4()
    const folder = isVideo ? 'videos' : 'images'
    const filePath = `deliverables/${folder}/${uniqueId}.${ext}`

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // Upload to Supabase Storage (flow-media bucket)
    const { error: uploadError } = await supabase.storage
      .from('flow-media')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ 
        error: uploadError.message || 'Erro no upload' 
      }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('flow-media')
      .getPublicUrl(filePath)

    const publicUrl = urlData.publicUrl

    return NextResponse.json({
      url: publicUrl,
      filename: file.name,
      size: file.size,
      type: file.type,
      isVideo: isVideo,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

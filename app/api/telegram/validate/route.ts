import { NextRequest, NextResponse } from "next/server"

interface TelegramUser {
  id: number
  is_bot: boolean
  first_name: string
  username?: string
  can_join_groups?: boolean
  can_read_all_group_messages?: boolean
  supports_inline_queries?: boolean
}

interface TelegramPhoto {
  file_id: string
  file_unique_id: string
  width: number
  height: number
}

interface TelegramResponse<T> {
  ok: boolean
  result?: T
  description?: string
}

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Token é obrigatório" },
        { status: 400 }
      )
    }

    const baseUrl = `https://api.telegram.org/bot${token}`

    // Fetch bot info using getMe
    const getMeResponse = await fetch(`${baseUrl}/getMe`)
    const getMeData: TelegramResponse<TelegramUser> = await getMeResponse.json()

    if (!getMeData.ok || !getMeData.result) {
      return NextResponse.json(
        { error: "Token inválido ou bot não encontrado" },
        { status: 400 }
      )
    }

    const botInfo = getMeData.result

    // Fetch profile photos
    let photoUrl: string | null = null
    try {
      const photosResponse = await fetch(
        `${baseUrl}/getUserProfilePhotos?user_id=${botInfo.id}&limit=1`
      )
      const photosData: TelegramResponse<{ total_count: number; photos: TelegramPhoto[][] }> = 
        await photosResponse.json()

      if (photosData.ok && photosData.result && photosData.result.photos.length > 0) {
        const photo = photosData.result.photos[0]
        // Get the largest photo (last in the array)
        const largestPhoto = photo[photo.length - 1]
        
        // Get file path
        const fileResponse = await fetch(`${baseUrl}/getFile?file_id=${largestPhoto.file_id}`)
        const fileData: TelegramResponse<{ file_path: string }> = await fileResponse.json()
        
        if (fileData.ok && fileData.result?.file_path) {
          photoUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`
        }
      }
    } catch {
      // Photo fetch failed, continue without it
    }

    // Fetch bot name
    let botName = botInfo.first_name
    try {
      const nameResponse = await fetch(`${baseUrl}/getMyName`)
      const nameData: TelegramResponse<{ name: string }> = await nameResponse.json()
      if (nameData.ok && nameData.result?.name) {
        botName = nameData.result.name
      }
    } catch {
      // Use first_name as fallback
    }

    // Fetch description
    let description = ""
    try {
      const descResponse = await fetch(`${baseUrl}/getMyDescription`)
      const descData: TelegramResponse<{ description: string }> = await descResponse.json()
      if (descData.ok && descData.result?.description) {
        description = descData.result.description
      }
    } catch {
      // No description
    }

    // Fetch short description
    let shortDescription = ""
    try {
      const shortDescResponse = await fetch(`${baseUrl}/getMyShortDescription`)
      const shortDescData: TelegramResponse<{ short_description: string }> = 
        await shortDescResponse.json()
      if (shortDescData.ok && shortDescData.result?.short_description) {
        shortDescription = shortDescData.result.short_description
      }
    } catch {
      // No short description
    }

    // Fetch commands
    let commands: Array<{ command: string; description: string }> = []
    try {
      const commandsResponse = await fetch(`${baseUrl}/getMyCommands`)
      const commandsData: TelegramResponse<Array<{ command: string; description: string }>> = 
        await commandsResponse.json()
      if (commandsData.ok && commandsData.result) {
        commands = commandsData.result
      }
    } catch {
      // No commands
    }

    return NextResponse.json({
      success: true,
      bot: {
        telegram_bot_id: botInfo.id,
        name: botName,
        username: botInfo.username || "",
        description,
        short_description: shortDescription,
        photo_url: photoUrl,
        can_join_groups: botInfo.can_join_groups || false,
        can_read_all_group_messages: botInfo.can_read_all_group_messages || false,
        supports_inline_queries: botInfo.supports_inline_queries || false,
        commands,
      },
    })
  } catch (error) {
    console.error("Error validating telegram token:", error)
    return NextResponse.json(
      { error: "Erro ao validar token" },
      { status: 500 }
    )
  }
}

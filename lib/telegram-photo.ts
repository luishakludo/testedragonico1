import FormData from "form-data"
import axios from "axios"

export interface UpdateBotPhotoResult {
  success: boolean
  error?: string
  response?: unknown
}

export interface UpdateBotPhotoOptions {
  /** Numero maximo de tentativas (default: 3) */
  maxRetries?: number
  /** Tamanho maximo em bytes (default: 5MB) */
  maxSize?: number
}

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024 // 5MB
const DEFAULT_MAX_RETRIES = 3

/**
 * Atualiza a foto de perfil de um bot do Telegram
 * 
 * Este formato foi testado e confirmado funcionando:
 * - photo_file: Buffer da imagem
 * - photo: JSON { type: "static", photo: "attach://photo_file" }
 * - Envio via axios com multipart/form-data
 * 
 * @param imageBuffer - Buffer da imagem (JPEG ou PNG)
 * @param token - Token do bot do Telegram
 * @param options - Opcoes de configuracao (retry, tamanho max)
 * @returns Resultado da operacao
 */
export async function updateBotProfilePhoto(
  imageBuffer: Buffer,
  token: string,
  options: UpdateBotPhotoOptions = {}
): Promise<UpdateBotPhotoResult> {
  const { maxRetries = DEFAULT_MAX_RETRIES, maxSize = DEFAULT_MAX_SIZE } = options
  
  // Validacao de tamanho
  if (imageBuffer.length > maxSize) {
    return {
      success: false,
      error: `Imagem muito grande: ${(imageBuffer.length / 1024 / 1024).toFixed(2)}MB (max: ${(maxSize / 1024 / 1024).toFixed(0)}MB)`
    }
  }
  
  // Validacao minima (imagem vazia)
  if (imageBuffer.length < 100) {
    return {
      success: false,
      error: "Buffer de imagem invalido ou vazio"
    }
  }
  const baseUrl = `https://api.telegram.org/bot${token}`
  
  let lastError: string | undefined
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const form = new FormData()
      
      // Anexar o buffer da imagem com nome "photo_file"
      form.append("photo_file", imageBuffer, {
        filename: "avatar.jpg",
        contentType: "image/jpeg",
      })
      
      // O parametro "photo" deve ser um JSON com InputProfilePhotoStatic
      // FORMATO CORRETO VALIDADO: { type: "static", photo: "attach://photo_file" }
      form.append("photo", JSON.stringify({
        type: "static",
        photo: "attach://photo_file"
      }))
      
      const response = await axios.post(`${baseUrl}/setMyProfilePhoto`, form, {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 15000 // 15 segundos timeout (padrao recomendado)
      })
      
      if (response.data.ok) {
        return {
          success: true,
          response: response.data
        }
      } else {
        lastError = response.data.description || "Unknown error"
        // Se nao for erro de rede, nao faz retry
        if (!lastError.includes("retry") && !lastError.includes("timeout")) {
          return {
            success: false,
            error: lastError,
            response: response.data
          }
        }
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        lastError = err.response?.data?.description || err.message
        // Retry apenas em erros de rede/timeout
        if (err.code !== "ECONNRESET" && err.code !== "ETIMEDOUT" && !err.message.includes("timeout")) {
          return {
            success: false,
            error: lastError,
            response: err.response?.data
          }
        }
      } else {
        lastError = err instanceof Error ? err.message : String(err)
      }
    }
    
    // Espera exponencial antes de retry (1s, 2s, 4s...)
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000))
    }
  }
  
  return {
    success: false,
    error: `Falha apos ${maxRetries} tentativas: ${lastError}`
  }
}

/**
 * Deleta uma foto de perfil do bot pelo file_id
 * 
 * @param fileId - ID do arquivo da foto a ser deletada
 * @param token - Token do bot do Telegram
 * @returns Resultado da operacao
 */
export async function deleteBotProfilePhoto(
  fileId: string,
  token: string
): Promise<UpdateBotPhotoResult> {
  const baseUrl = `https://api.telegram.org/bot${token}`
  
  try {
    const response = await axios.post(`${baseUrl}/deleteMyProfilePhoto`, {
      file_id: fileId
    })
    
    if (response.data.ok) {
      return {
        success: true,
        response: response.data
      }
    } else {
      return {
        success: false,
        error: response.data.description || "Unknown error",
        response: response.data
      }
    }
  } catch (err) {
    if (axios.isAxiosError(err)) {
      return {
        success: false,
        error: err.response?.data?.description || err.message,
        response: err.response?.data
      }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}

/**
 * Busca as fotos de perfil atuais do bot
 * 
 * @param token - Token do bot do Telegram
 * @returns Lista de fotos ou erro
 */
export async function getBotProfilePhotos(token: string): Promise<{
  success: boolean
  photos?: Array<{ file_id: string; width: number; height: number }>
  totalCount?: number
  error?: string
}> {
  const baseUrl = `https://api.telegram.org/bot${token}`
  const botUserId = token.split(":")[0]
  
  try {
    const response = await axios.post(`${baseUrl}/getUserProfilePhotos`, {
      user_id: parseInt(botUserId)
    })
    
    if (response.data.ok) {
      const photos = response.data.result.photos.flat()
      return {
        success: true,
        photos,
        totalCount: response.data.result.total_count
      }
    } else {
      return {
        success: false,
        error: response.data.description || "Unknown error"
      }
    }
  } catch (err) {
    if (axios.isAxiosError(err)) {
      return {
        success: false,
        error: err.response?.data?.description || err.message
      }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}

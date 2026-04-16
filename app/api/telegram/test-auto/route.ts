import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

export const runtime = "nodejs"

// API de teste automatico - acessa /api/telegram/test-auto
// Testa upload de foto em TODOS os bots do banco
export async function GET(_request: NextRequest) {
  const logs: string[] = []
  const log = (msg: string) => {
    console.log(msg)
    logs.push(msg)
  }

  log("========== TESTE AUTOMATICO DE UPLOAD DE FOTO ==========")
  log("Testando TODOS os bots do banco...")
  log("")

  try {
    // 1. Buscar TODOS os bots do banco
    log("PASSO 1: Buscando todos os bots no banco de dados...")
    
    const supabase = getSupabaseAdmin()
    const { data: bots, error: dbError } = await supabase
      .from("bots")
      .select("id, name, token")
    
    if (dbError) {
      log(`ERRO NO BANCO: ${dbError.message}`)
      return new NextResponse(logs.join("\n"), { headers: { "Content-Type": "text/plain" } })
    }
    
    if (!bots || bots.length === 0) {
      log("ERRO: Nenhum bot encontrado no banco")
      return new NextResponse(logs.join("\n"), { headers: { "Content-Type": "text/plain" } })
    }
    
    log(`Total de bots encontrados: ${bots.length}`)
    log("")

    // 2. Criar uma imagem de teste (PNG vermelho 100x100)
    log("PASSO 2: Criando imagem de teste (PNG 100x100)...")
    
    const pngRedPixel = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x00, 0x64,
      0x08, 0x02, 0x00, 0x00, 0x00, 0xFF, 0x80, 0x02,
      0x03, 0x00, 0x00, 0x00, 0x19, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9C, 0xED, 0xC1, 0x01, 0x0D, 0x00,
      0x00, 0x00, 0xC2, 0xA0, 0xF7, 0x4F, 0x6D, 0x0E,
      0x37, 0xA0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0xBE, 0x0D, 0x21, 0x00, 0x00, 0x01,
      0x9A, 0x60, 0xE1, 0xD5, 0x00, 0x00, 0x00, 0x00,
      0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ])
    
    log(`Imagem criada: ${pngRedPixel.length} bytes`)
    log("")

    // 3. Testar cada bot
    for (let i = 0; i < bots.length; i++) {
      const bot = bots[i]
      log(`========== BOT ${i + 1}/${bots.length}: ${bot.name} ==========`)
      log(`ID: ${bot.id}`)
      log(`Token: ${bot.token.substring(0, 10)}...${bot.token.substring(bot.token.length - 5)}`)
      log("")

      try {
        // Criar FormData nativo com Blob
        log("Criando FormData nativo com Blob...")
        const blob = new Blob([pngRedPixel], { type: "image/png" })
        const formData = new FormData()
        formData.append("photo", blob, "profile.png")
        
        log(`Blob size: ${blob.size} bytes`)
        log("")

        // Enviar para o Telegram
        log("Enviando para Telegram (setMyProfilePhoto)...")
        const telegramUrl = `https://api.telegram.org/bot${bot.token}/setMyProfilePhoto`
        
        const response = await fetch(telegramUrl, {
          method: "POST",
          body: formData,
        })
        
        log(`Status: ${response.status} ${response.statusText}`)

        const responseText = await response.text()
        log(`Resposta: ${responseText}`)

        try {
          const result = JSON.parse(responseText)
          if (result.ok) {
            log("RESULTADO: SUCESSO")
          } else {
            log(`RESULTADO: FALHOU - ${result.description}`)
          }
        } catch {
          log(`RESULTADO: ERRO ao parsear resposta`)
        }
      } catch (err) {
        log(`RESULTADO: EXCECAO - ${String(err)}`)
      }

      log("")
    }

    log("========== FIM DO TESTE ==========")
    log(`Total testados: ${bots.length}`)
    
    return new NextResponse(logs.join("\n"), { 
      headers: { "Content-Type": "text/plain; charset=utf-8" } 
    })

  } catch (error) {
    log(`EXCECAO GERAL: ${String(error)}`)
    log(`Stack: ${(error as Error)?.stack || "N/A"}`)
    return new NextResponse(logs.join("\n"), { 
      headers: { "Content-Type": "text/plain; charset=utf-8" } 
    })
  }
}

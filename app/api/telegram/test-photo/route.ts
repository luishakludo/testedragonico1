import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import FormData from "form-data"
import axios from "axios"

export const runtime = "nodejs"

// GET - Pagina de diagnostico automatica (so acessar no navegador)
// Uso: /api/telegram/test-photo?token=BOT_TOKEN
//   ou /api/telegram/test-photo?botId=UUID_DO_BOT
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const botId = searchParams.get("botId")
  const directToken = searchParams.get("token")
  
  const logs: string[] = []
  const log = (msg: string) => {
    console.log(msg)
    logs.push(msg)
  }
  
  log("========================================")
  log("TELEGRAM PHOTO UPLOAD - DIAGNOSTIC")
  log("========================================")
  log("")
  
  // STEP 1: Buscar bot do banco OU usar token direto
  log("STEP 1: Obtendo token do bot...")
  
  let bot: { id: string; token: string; name: string; username?: string } | null = null
  
  // Se passou token direto, usar ele
  if (directToken) {
    log("Usando token passado via query parameter")
    bot = {
      id: "direct-token",
      token: directToken,
      name: "Token Direto",
      username: undefined
    }
  } else if (botId) {
    const { data, error } = await supabase
      .from("bots")
      .select("id, token, name, username")
      .eq("id", botId)
      .single()
    
    if (error || !data) {
      log(`ERROR: Bot ${botId} nao encontrado`)
      return renderHTML(logs, "Bot nao encontrado")
    }
    bot = data
  } else {
    const { data, error } = await supabase
      .from("bots")
      .select("id, token, name, username")
      .limit(1)
      .single()
    
    if (error || !data) {
      log("ERROR: Nenhum bot encontrado no banco")
      log("")
      log("DICA: Passe o token diretamente:")
      log("/api/telegram/test-photo?token=SEU_BOT_TOKEN")
      return renderHTML(logs, "Nenhum bot no banco. Use ?token=SEU_BOT_TOKEN para testar diretamente.")
    }
    bot = data
  }
  
  log(`OK - Bot: ${bot.name} (@${bot.username || "sem username"})`)
  log(`ID: ${bot.id}`)
  log(`Token: ${bot.token.substring(0, 15)}...`)
  log("")
  
  const baseUrl = `https://api.telegram.org/bot${bot.token}`
  const botUserId = bot.token.split(":")[0]
  
  // STEP 2: Testar conexao com getMe
  log("STEP 2: Testando conexao (getMe)...")
  
  try {
    const res = await fetch(`${baseUrl}/getMe`)
    const data = await res.json()
    
    if (data.ok) {
      log(`OK - @${data.result.username} conectado`)
      log(`can_join_groups: ${data.result.can_join_groups}`)
      log(`can_read_all_group_messages: ${data.result.can_read_all_group_messages}`)
    } else {
      log(`FALHOU: ${data.description}`)
      return renderHTML(logs, "Token invalido")
    }
  } catch (err) {
    log(`EXCEPTION: ${err}`)
    return renderHTML(logs, "Erro de conexao")
  }
  log("")
  
  // STEP 3: Ver fotos atuais
  log("STEP 3: Fotos de perfil atuais...")
  
  try {
    const res = await fetch(`${baseUrl}/getUserProfilePhotos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: parseInt(botUserId) })
    })
    const data = await res.json()
    
    if (data.ok) {
      log(`Total de fotos: ${data.result.total_count}`)
    } else {
      log(`Erro: ${data.description}`)
    }
  } catch (err) {
    log(`EXCEPTION: ${err}`)
  }
  log("")
  
  // STEP 4: Baixar imagem real para teste
  log("STEP 4: Baixando imagem de teste (200x200)...")
  
  let imageBuffer: Buffer
  try {
    const imgRes = await fetch("https://picsum.photos/200/200")
    const imgArrayBuffer = await imgRes.arrayBuffer()
    imageBuffer = Buffer.from(imgArrayBuffer)
    log(`OK - Imagem baixada: ${imageBuffer.length} bytes`)
    
    // Verificar magic bytes
    const isJpeg = imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8
    const isPng = imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50
    log(`Formato detectado: ${isJpeg ? "JPEG" : isPng ? "PNG" : "OUTRO"}`)
  } catch (err) {
    log(`FALHOU ao baixar imagem: ${err}`)
    return renderHTML(logs, "Erro ao baixar imagem de teste")
  }
  log("")
  
  // STEP 5A: Teste com AXIOS + InputProfilePhoto (Bot API 9.4+)
  // O formato correto e: photo = { type: "static", photo: "attach://photo_file" }
  log("STEP 5A: setMyProfilePhoto (InputProfilePhotoStatic)...")
  
  let test5aOk = false
  let test5aError = ""
  try {
    const form = new FormData()
    // O campo do arquivo DEVE ter um nome que sera referenciado no attach://
    form.append("photo_file", imageBuffer, {
      filename: "avatar.jpg",
      contentType: "image/jpeg",
    })
    // O parametro "photo" e um JSON com InputProfilePhotoStatic
    // FORMATO CORRETO CONFIRMADO: { type: "static", photo: "attach://photo_file" }
    // CRITICO: Adicionar contentType: "application/json" para Telegram interpretar corretamente!
    const photoJson = JSON.stringify({
      type: "static",
      photo: "attach://photo_file"
    })
    form.append("photo", photoJson, { contentType: "application/json" })
    
    log("FormData fields:")
    log(`  - photo_file: Buffer (${imageBuffer.length} bytes)`)
    log(`  - photo: ${photoJson}`)
    
    // DEBUG CRITICO: Verificar campos do FormData
    const formKeys: string[] = []
    const boundaryMatch = form.getHeaders()["content-type"]?.match(/boundary=(.+)/)
    log(`Content-Type: ${form.getHeaders()["content-type"]}`)
    
    // Listar todas as chaves do FormData (form-data lib)
    // @ts-expect-error - _streams e interno do form-data
    if (form._streams) {
      // @ts-expect-error
      for (const stream of form._streams) {
        if (typeof stream === "string" && stream.includes("name=")) {
          const match = stream.match(/name="([^"]+)"/)
          if (match) formKeys.push(match[1])
        }
      }
    }
    log(`FormData keys encontradas: [${formKeys.join(", ")}]`)
    
    if (!formKeys.includes("photo")) {
      log("ALERTA: Campo 'photo' NAO encontrado no FormData!")
    }
    if (!formKeys.includes("photo_file")) {
      log("ALERTA: Campo 'photo_file' NAO encontrado no FormData!")
    }
    
    // DEBUG CRITICO: Ver o raw multipart body
    const rawBody = form.getBuffer().toString()
    log("--- RAW MULTIPART BODY (primeiros 1000 chars) ---")
    log(rawBody.substring(0, 1000))
    log("--- FIM RAW BODY ---")
    
    // Verificar se o campo photo esta correto
    if (rawBody.includes('name="photo"')) {
      log("OK: Campo 'photo' encontrado no body")
      // Verificar se o JSON esta la
      if (rawBody.includes('{"type":"static","photo":"attach://photo_file"}')) {
        log("OK: JSON do InputProfilePhotoStatic esta correto!")
      } else {
        log("ALERTA: JSON nao encontrado ou diferente do esperado")
      }
    } else {
      log("ERRO: Campo 'photo' NAO encontrado no raw body!")
    }
    
    const response = await axios.post(`${baseUrl}/setMyProfilePhoto`, form, {
      headers: {
        ...form.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    })
    
    log(`Status: ${response.status}`)
    log(`Response: ${JSON.stringify(response.data)}`)
    
    test5aOk = response.data.ok
    test5aError = response.data.description || ""
    
    if (response.data.ok) {
      log("SUCESSO!")
    } else {
      log(`FALHOU: ${response.data.description}`)
    }
  } catch (err) {
    if (axios.isAxiosError(err)) {
      log(`AXIOS ERROR: ${err.response?.status} - ${JSON.stringify(err.response?.data)}`)
      test5aError = err.response?.data?.description || String(err)
    } else {
      log(`EXCEPTION: ${err}`)
      test5aError = String(err)
    }
  }
  log("")
  
  // STEP 5B: Pular (5A ja usa o metodo correto)
  log("STEP 5B: Pulado (5A ja testou com axios)")
  log("")
  
  const test5bOk = test5aOk
  const test5bError = test5aError
  
  // STEP 5C: Controle - sendPhoto para o proprio bot (usando AXIOS)
  log("STEP 5C: CONTROLE - sendPhoto (AXIOS)...")
  
  let test5cOk = false
  let test5cError = ""
  try {
    const form = new FormData()
    form.append("chat_id", botUserId)
    form.append("photo", imageBuffer, {
      filename: "test.jpg",
      contentType: "image/jpeg",
    })
    
    const response = await axios.post(`${baseUrl}/sendPhoto`, form, {
      headers: {
        ...form.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    })
    
    log(`Status: ${response.status}`)
    log(`Response: ${JSON.stringify(response.data).substring(0, 200)}...`)
    
    test5cOk = response.data.ok
    test5cError = response.data.description || ""
    
    if (response.data.ok) {
      log("SUCESSO!")
    } else {
      log(`FALHOU: ${response.data.description}`)
    }
  } catch (err) {
    if (axios.isAxiosError(err)) {
      log(`AXIOS ERROR: ${err.response?.status} - ${JSON.stringify(err.response?.data)}`)
      test5cError = err.response?.data?.description || String(err)
    } else {
      log(`EXCEPTION: ${err}`)
      test5cError = String(err)
    }
  }
  log("")
  
  // CONCLUSAO
  log("========================================")
  log("CONCLUSAO")
  log("========================================")
  
  let conclusion = ""
  
  if (test5aOk || test5bOk) {
    conclusion = "SUCESSO - Upload de foto de perfil funcionou!"
  } else if (test5cOk) {
    conclusion = `LIMITACAO DO TELEGRAM - O multipart funciona (sendPhoto OK), mas setMyProfilePhoto falha. Erro: "${test5aError || test5bError}". Isso pode ser uma restricao da API do Telegram para bots.`
  } else {
    conclusion = `PROBLEMA NO MULTIPART - Tanto setMyProfilePhoto quanto sendPhoto falharam. Erro setProfile: "${test5aError}". Erro sendPhoto: "${test5cError}"`
  }
  
  log(conclusion)
  log("")
  log("Para testar com token: ?token=SEU_BOT_TOKEN")
  log("Para testar bot do banco: ?botId=SEU_BOT_ID")
  
  return renderHTML(logs, conclusion)
}

function renderHTML(logs: string[], conclusion: string) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Telegram Photo Diagnostic</title>
  <meta charset="utf-8">
  <style>
    body { 
      font-family: 'Monaco', 'Menlo', monospace; 
      background: #0d1117; 
      color: #c9d1d9; 
      padding: 20px; 
      line-height: 1.5;
    }
    h1 { color: #58a6ff; margin-bottom: 5px; }
    pre { 
      background: #161b22; 
      padding: 15px; 
      border-radius: 6px;
      overflow-x: auto;
      border: 1px solid #30363d;
    }
    .success { color: #3fb950; font-weight: bold; }
    .error { color: #f85149; }
    .info { color: #58a6ff; }
    .warn { color: #d29922; }
    .conclusion {
      background: #21262d;
      padding: 15px;
      border-radius: 6px;
      margin: 20px 0;
      border-left: 4px solid ${conclusion.includes("SUCESSO") ? "#3fb950" : "#f85149"};
    }
  </style>
</head>
<body>
  <h1>Telegram Photo Upload Diagnostic</h1>
  <p style="color:#8b949e">Teste automatico de upload de foto de perfil do bot</p>
  
  <div class="conclusion">
    <strong>${conclusion.includes("SUCESSO") ? "SUCESSO" : "RESULTADO"}:</strong><br>
    ${conclusion}
  </div>
  
  <h2>Logs Detalhados</h2>
  <pre>${logs.map(l => {
    if (l.includes("SUCESSO") || l.includes("OK -")) return `<span class="success">${escapeHtml(l)}</span>`
    if (l.includes("FALHOU") || l.includes("ERROR") || l.includes("EXCEPTION")) return `<span class="error">${escapeHtml(l)}</span>`
    if (l.includes("STEP")) return `<span class="info">${escapeHtml(l)}</span>`
    if (l.includes("===")) return `<span class="warn">${escapeHtml(l)}</span>`
    return escapeHtml(l)
  }).join("\n")}</pre>
</body>
</html>`
  
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  })
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

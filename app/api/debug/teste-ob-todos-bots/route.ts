import { getSupabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

// GET = mostra pagina HTML com botao para criar pagamentos
// POST = cria um pagamento REAL de Order Bump para cada bot (aparece no painel)
export async function GET() {
  const supabase = getSupabaseAdmin()
  
  // Buscar TODOS os bots
  const { data: bots, error: botsError } = await supabase
    .from("bots")
    .select("id, name, user_id, token")
    .order("created_at", { ascending: false })
  
  if (botsError) {
    return new Response(`<html><body><h1>Erro</h1><p>${botsError.message}</p></body></html>`, {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    })
  }
  
  // Para cada bot, buscar o flow ativo
  const resultado = []
  
  for (const bot of bots || []) {
    const { data: flow } = await supabase
      .from("flows")
      .select("id, name, user_id, config")
      .eq("bot_id", bot.id)
      .eq("is_active", true)
      .limit(1)
      .single()
    
    let userId = bot.user_id
    if (!userId && flow?.user_id) {
      userId = flow.user_id
    }
    
    let temGateway = false
    if (userId) {
      const { data: gateway } = await supabase
        .from("user_gateways")
        .select("id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1)
        .single()
      temGateway = !!gateway
    }
    
    const { count: obCount } = await supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("bot_id", bot.id)
      .eq("product_type", "order_bump")
    
    resultado.push({
      bot_id: bot.id,
      bot_nome: bot.name,
      bot_user_id: bot.user_id,
      flow_id: flow?.id || null,
      flow_nome: flow?.name || null,
      user_id_final: userId,
      tem_gateway: temGateway,
      pagamentos_ob: obCount || 0,
      pode_criar: !!userId && temGateway,
      status: !userId ? "SEM DONO" : !temGateway ? "SEM GATEWAY" : "OK"
    })
  }
  
  const botsOk = resultado.filter(b => b.status === "OK").length
  
  // Gerar HTML
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Teste Order Bump - Todos os Bots</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #fff; padding: 20px; margin: 0; }
    h1 { color: #22c55e; margin-bottom: 10px; }
    .stats { display: flex; gap: 20px; margin-bottom: 20px; }
    .stat { background: #1a1a1a; padding: 15px 25px; border-radius: 8px; }
    .stat-value { font-size: 32px; font-weight: bold; }
    .stat-label { color: #888; font-size: 14px; }
    .ok { color: #22c55e; }
    .erro { color: #ef4444; }
    table { width: 100%; border-collapse: collapse; background: #1a1a1a; border-radius: 8px; overflow: hidden; margin-bottom: 20px; }
    th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #333; }
    th { background: #222; color: #888; font-weight: 500; font-size: 12px; text-transform: uppercase; }
    .badge { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .badge-ok { background: #14532d; color: #22c55e; }
    .badge-erro { background: #450a0a; color: #ef4444; }
    .btn { background: #22c55e; color: #000; border: none; padding: 15px 40px; font-size: 16px; font-weight: 600; border-radius: 8px; cursor: pointer; }
    .btn:hover { background: #16a34a; }
    .btn:disabled { background: #333; color: #666; cursor: not-allowed; }
    #resultado { margin-top: 20px; padding: 20px; background: #1a1a1a; border-radius: 8px; display: none; }
    #resultado.show { display: block; }
    .loading { display: none; }
    .loading.show { display: inline-block; margin-left: 10px; }
  </style>
</head>
<body>
  <h1>Teste Order Bump - Todos os Bots</h1>
  <p style="color:#888;margin-bottom:20px;">Cria um pagamento REAL de Order Bump (R$ 19,90 aprovado) para cada bot configurado corretamente.</p>
  
  <div class="stats">
    <div class="stat">
      <div class="stat-value">${resultado.length}</div>
      <div class="stat-label">Total de Bots</div>
    </div>
    <div class="stat">
      <div class="stat-value ok">${botsOk}</div>
      <div class="stat-label">Podem Criar Pagamento</div>
    </div>
    <div class="stat">
      <div class="stat-value erro">${resultado.length - botsOk}</div>
      <div class="stat-label">Com Problema</div>
    </div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>Bot</th>
        <th>Flow</th>
        <th>User ID</th>
        <th>Gateway</th>
        <th>OB Existentes</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${resultado.map(b => `
        <tr>
          <td><strong>${b.bot_nome || "Sem nome"}</strong><br><small style="color:#666">${b.bot_id.slice(0,8)}...</small></td>
          <td>${b.flow_nome || "<span style='color:#666'>-</span>"}</td>
          <td>${b.user_id_final ? b.user_id_final.slice(0,8) + "..." : "<span style='color:#ef4444'>NULL</span>"}</td>
          <td>${b.tem_gateway ? "<span class='ok'>Sim</span>" : "<span class='erro'>Nao</span>"}</td>
          <td>${b.pagamentos_ob}</td>
          <td><span class="badge ${b.status === "OK" ? "badge-ok" : "badge-erro"}">${b.status}</span></td>
        </tr>
      `).join("")}
    </tbody>
  </table>
  
  <button class="btn" id="btnCriar" ${botsOk === 0 ? "disabled" : ""} onclick="criarPagamentos()">
    CRIAR PAGAMENTOS DE ORDER BUMP (${botsOk} bots)
  </button>
  <span class="loading" id="loading">Criando...</span>
  
  <div id="resultado"></div>
  
  <script>
    async function criarPagamentos() {
      const btn = document.getElementById("btnCriar");
      const loading = document.getElementById("loading");
      const resultado = document.getElementById("resultado");
      
      btn.disabled = true;
      loading.classList.add("show");
      resultado.classList.remove("show");
      
      try {
        const res = await fetch(window.location.href, { method: "POST" });
        const data = await res.json();
        
        let html = "<h3 style='margin-top:0;color:#22c55e'>Resultado</h3>";
        html += "<p>Criados: <strong>" + data.criados + "</strong> | Pulados: " + data.pulados + " | Erros: " + data.erros + "</p>";
        html += "<ul style='margin:0;padding-left:20px'>";
        data.resultados.forEach(r => {
          if (r.status === "CRIADO") {
            html += "<li style='color:#22c55e'><strong>" + r.bot_nome + "</strong> - R$ 19,90 criado! (vai aparecer no painel)</li>";
          } else {
            html += "<li style='color:#888'>" + r.bot_nome + " - " + r.motivo + "</li>";
          }
        });
        html += "</ul>";
        
        resultado.innerHTML = html;
        resultado.classList.add("show");
      } catch (err) {
        resultado.innerHTML = "<p style='color:#ef4444'>Erro: " + err.message + "</p>";
        resultado.classList.add("show");
      }
      
      btn.disabled = false;
      loading.classList.remove("show");
    }
  </script>
</body>
</html>
  `
  
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  })
}

export async function POST() {
  const supabase = getSupabaseAdmin()
  
  // Buscar TODOS os bots
  const { data: bots, error: botsError } = await supabase
    .from("bots")
    .select("id, name, user_id")
    .order("created_at", { ascending: false })
  
  if (botsError) {
    return NextResponse.json({ error: "Erro ao buscar bots", details: botsError.message }, { status: 500 })
  }
  
  const resultados = []
  
  for (const bot of bots || []) {
    // Buscar flow do bot
    const { data: flow } = await supabase
      .from("flows")
      .select("id, name, user_id")
      .eq("bot_id", bot.id)
      .eq("is_active", true)
      .limit(1)
      .single()
    
    // Determinar user_id (do bot ou do flow)
    let userId = bot.user_id
    if (!userId && flow?.user_id) {
      userId = flow.user_id
    }
    
    // Se nao tem user_id, pular
    if (!userId) {
      resultados.push({
        bot_nome: bot.name,
        bot_id: bot.id,
        status: "PULADO",
        motivo: "Sem user_id"
      })
      continue
    }
    
    // Verificar se tem gateway
    const { data: gateway } = await supabase
      .from("user_gateways")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .single()
    
    if (!gateway) {
      resultados.push({
        bot_nome: bot.name,
        bot_id: bot.id,
        status: "PULADO",
        motivo: "Sem gateway"
      })
      continue
    }
    
    // CRIAR PAGAMENTO REAL DE ORDER BUMP
    // Schema correto: user_id, amount, status, payment_method, gateway, external_payment_id, product_type, bot_id
    const paymentData = {
      bot_id: bot.id,
      user_id: userId,
      amount: 19.90,
      status: "approved",
      product_type: "order_bump",
      payment_method: "pix",
      gateway: "mercadopago",
      external_payment_id: "teste_ob_" + bot.id.slice(0,8) + "_" + Date.now()
    }
    
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert(paymentData)
      .select()
      .single()
    
    if (paymentError) {
      resultados.push({
        bot_nome: bot.name,
        bot_id: bot.id,
        user_id: userId,
        status: "ERRO",
        motivo: paymentError.message
      })
    } else {
      resultados.push({
        bot_nome: bot.name,
        bot_id: bot.id,
        user_id: userId,
        status: "CRIADO",
        payment_id: payment.id,
        valor: 19.90,
        vai_aparecer_no_painel: true
      })
    }
  }
  
  return NextResponse.json({
    mensagem: "Pagamentos de Order Bump criados!",
    total_processados: resultados.length,
    criados: resultados.filter(r => r.status === "CRIADO").length,
    pulados: resultados.filter(r => r.status === "PULADO").length,
    erros: resultados.filter(r => r.status === "ERRO").length,
    resultados
  })
}

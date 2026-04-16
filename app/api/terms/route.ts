import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Default terms if none in database
const defaultTerms = {
  sections: [
    { title: "1. Aceitacao dos Termos", content: "Ao acessar ou utilizar a plataforma DRAGON, o usuario declara que leu, compreendeu e concorda com todos os termos." },
    { title: "2. Elegibilidade", content: "E obrigatorio ter 18 anos ou mais. O uso por menores e estritamente proibido." },
    { title: "3. Uso da Plataforma", content: "O usuario concorda em nao utilizar a plataforma para atividades ilegais, nao fraudar pagamentos, nao burlar sistemas." },
    { title: "4. Conta do Usuario", content: "O usuario e responsavel pela seguranca da conta. A DRAGON pode suspender contas suspeitas." },
    { title: "5. Politica de Conteudo", content: "A DRAGON proibe totalmente conteudo com menores de 18 anos, violencia extrema, conteudo ilegal." },
    { title: "6. Pagamentos e Taxas", content: "Taxa fixa de R$0,50 por venda. Pagamentos sao processados por terceiros." },
    { title: "7. Penalidades", content: "Em caso de violacao: remocao de conteudo, suspensao da conta, banimento permanente." },
    { title: "8. Privacidade (LGPD)", content: "Coletamos: nome, email, dados de pagamento. O usuario pode solicitar exclusao de dados." },
  ]
}

const defaultPrivacy = {
  sections: [
    { title: "1. Coleta de Dados", content: "Coletamos informacoes que voce fornece diretamente, como nome, email, telefone e dados de pagamento." },
    { title: "2. Uso dos Dados", content: "Usamos seus dados para processar transacoes e melhorar nossos servicos." },
    { title: "3. Compartilhamento", content: "Nao vendemos seus dados. Compartilhamos apenas com parceiros essenciais." },
    { title: "4. Seus Direitos", content: "Voce pode acessar, corrigir ou excluir seus dados a qualquer momento." },
    { title: "5. Seguranca", content: "Utilizamos criptografia e outras medidas para proteger seus dados." },
  ]
}

// GET - Public endpoint to get terms
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") || "terms_of_use"
  const supabase = getSupabaseAdmin()
  
  try {
    const { data, error } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", type)
      .single()
    
    if (error || !data) {
      // Return defaults
      if (type === "privacy_policy") {
        return NextResponse.json(defaultPrivacy)
      }
      return NextResponse.json(defaultTerms)
    }
    
    return NextResponse.json(data.value)
  } catch {
    // Return defaults on error
    if (type === "privacy_policy") {
      return NextResponse.json(defaultPrivacy)
    }
    return NextResponse.json(defaultTerms)
  }
}

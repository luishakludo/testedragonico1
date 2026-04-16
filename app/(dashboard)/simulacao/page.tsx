"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, MessageCircle, RefreshCw, ExternalLink, Check, AlertTriangle, Database, Bot, Layers, Package, DollarSign, Loader2 } from "lucide-react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

// Interface para dados da API
interface FlowData {
  flow_id: string
  flow_name: string
  flow_status: string
  vinculo_bot: {
    tem_vinculo: boolean
    bot_id: string | null
    bot_name: string | null
    bot_username: string | null
    tipo_vinculo: string
  }
  planos: {
    total: number
    fonte: string
    lista: Array<{
      id: string
      name: string
      price: number
      description: string | null
      is_active: boolean
      fonte: string
      telegram_button: { text: string; callback_data: string }
    }>
  }
  order_bumps: {
    inicial: {
      enabled: boolean
      name?: string
      price?: number
      description?: string
      acceptText?: string
      rejectText?: string
      RESULTADO: string
      motivo?: string
      simulacao_callbacks?: {
        callback_aceitar: string
        callback_recusar: string
        total_se_aceitar: number
        total_se_recusar: number
      }
    }
    packs: {
      enabled: boolean
      name?: string
      price?: number
      RESULTADO: string
    }
  }
  packs: {
    enabled: boolean
    total: number
    lista: Array<{
      id: string
      name: string
      price: number
      emoji?: string
    }>
  }
}

interface BotData {
  id: string
  name: string
  username: string
  status: string
  flows_vinculados: Array<{ flow_id: string; flow_name: string }>
}

interface SimulacaoData {
  titulo: string
  timestamp: string
  resumo: {
    total_bots: number
    total_flows: number
  }
  bots: BotData[]
  flows: FlowData[]
  diagnosticos: {
    flows_sem_vinculo: Array<{ flow_id: string; flow_name: string; problema: string }>
    flows_com_order_bump_ativo: Array<{ flow_id: string; flow_name: string; order_bump_name: string; order_bump_price: number }>
  }
}

// Dados simulados de planos (fallback)
const MOCK_PLANS = [
  {
    id: "plan_1",
    name: "Plano Basico",
    price: 29.90,
    description: "Acesso basico ao conteudo",
    order_bumps: [
      {
        id: "ob_1",
        name: "Bonus Extra",
        price: 19.90,
        description: "Adicione o Bonus Extra por apenas R$ 19,90 e tenha acesso a conteudos exclusivos!",
        acceptText: "QUERO",
        rejectText: "NAO QUERO"
      }
    ]
  },
  {
    id: "plan_2",
    name: "Plano Premium",
    price: 59.90,
    description: "Acesso completo + bonus",
    order_bumps: [
      {
        id: "ob_2",
        name: "Mentoria Individual",
        price: 99.90,
        description: "Adicione 1 hora de mentoria individual por apenas R$ 99,90!",
        acceptText: "QUERO SIM",
        rejectText: "AGORA NAO"
      },
      {
        id: "ob_3",
        name: "Grupo VIP",
        price: 49.90,
        description: "Acesso ao grupo VIP no Telegram por apenas R$ 49,90!",
        acceptText: "QUERO",
        rejectText: "NAO QUERO"
      }
    ]
  },
  {
    id: "plan_3",
    name: "Plano VIP",
    price: 149.90,
    description: "Tudo incluido + suporte prioritario",
    order_bumps: [
      {
        id: "ob_4",
        name: "Consultoria 1:1",
        price: 199.90,
        description: "Sessao de consultoria personalizada por apenas R$ 199,90!",
        acceptText: "QUERO",
        rejectText: "NAO QUERO"
      },
      {
        id: "ob_5",
        name: "Acesso Vitalicio",
        price: 299.90,
        description: "Acesso vitalicio a todos os conteudos por apenas R$ 299,90!",
        acceptText: "QUERO",
        rejectText: "PULAR"
      },
      {
        id: "ob_6",
        name: "Certificado Premium",
        price: 29.90,
        description: "Certificado premium personalizado por apenas R$ 29,90!",
        acceptText: "QUERO",
        rejectText: "NAO QUERO"
      }
    ]
  }
]

type Step = "idle" | "plans" | "order_bumps" | "summary" | "payment" | "success"

interface Message {
  id: string
  type: "bot" | "user" | "system"
  content: string
  buttons?: Array<{
    text: string
    action: string
    variant?: "default" | "destructive" | "outline"
  }>
  image?: string
}

export default function SimulacaoPage() {
  const [step, setStep] = useState<Step>("idle")
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedPlan, setSelectedPlan] = useState<typeof MOCK_PLANS[0] | null>(null)
  const [selectedBumps, setSelectedBumps] = useState<string[]>([])
  const [currentBumpIndex, setCurrentBumpIndex] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  
  // Estado para dados reais da API
  const [apiData, setApiData] = useState<SimulacaoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null)
  
  // Carregar dados reais da API
  useEffect(() => {
    fetchApiData()
  }, [])
  
  const fetchApiData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/simulacao")
      if (!res.ok) throw new Error("Erro ao carregar dados")
      const data = await res.json()
      setApiData(data)
      // Selecionar primeiro flow automaticamente
      if (data.flows?.length > 0) {
        setSelectedFlowId(data.flows[0].flow_id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setLoading(false)
    }
  }
  
  // Flow selecionado
  const selectedFlow = apiData?.flows?.find(f => f.flow_id === selectedFlowId)

  const addMessage = (message: Omit<Message, "id">) => {
    setMessages(prev => [...prev, { ...message, id: `msg_${Date.now()}_${Math.random()}` }])
  }

  const handleStart = () => {
    setStep("plans")
    setMessages([])
    setSelectedPlan(null)
    setSelectedBumps([])
    setCurrentBumpIndex(0)
    setTotalAmount(0)

    addMessage({
      type: "bot",
      content: "Bem-vindo! Escolha um dos planos disponiveis:",
      buttons: MOCK_PLANS.map(plan => ({
        text: `${plan.name} - R$ ${plan.price.toFixed(2).replace(".", ",")}`,
        action: `select_plan_${plan.id}`
      }))
    })
  }

  const handleSelectPlan = (planId: string) => {
    const plan = MOCK_PLANS.find(p => p.id === planId)
    if (!plan) return

    setSelectedPlan(plan)
    setTotalAmount(plan.price)
    setStep("order_bumps")
    setCurrentBumpIndex(0)
    setSelectedBumps([])

    addMessage({
      type: "user",
      content: `Selecionei: ${plan.name}`
    })

    // Se tem order bumps, mostrar
    if (plan.order_bumps.length > 0) {
      const hasMultiple = plan.order_bumps.length > 1

      // Enviar cada order bump como mensagem separada
      plan.order_bumps.forEach((bump, index) => {
        const buttons: Message["buttons"] = [
          { text: bump.acceptText, action: `add_bump_${bump.id}` }
        ]
        
        // Se tem apenas 1 order bump, mostrar botao de recusar
        if (!hasMultiple) {
          buttons.push({ text: bump.rejectText, action: `decline_bump_${bump.id}`, variant: "outline" })
        }

        addMessage({
          type: "bot",
          content: bump.description,
          buttons
        })
      })

      // Mensagem de resumo
      addMessage({
        type: "bot",
        content: `*Resumo do Pedido:*\n\n${plan.name}: R$ ${plan.price.toFixed(2).replace(".", ",")}\n\n_Clique nos adicionais acima para incluir no pedido_`,
        buttons: [
          { text: `PROSSEGUIR - R$ ${plan.price.toFixed(2).replace(".", ",")}`, action: "proceed" }
        ]
      })
    } else {
      // Sem order bumps, ir direto para pagamento
      handleProceed()
    }
  }

  const handleAddBump = (bumpId: string) => {
    if (!selectedPlan) return

    const bump = selectedPlan.order_bumps.find(b => b.id === bumpId)
    if (!bump || selectedBumps.includes(bumpId)) return

    setSelectedBumps(prev => [...prev, bumpId])
    const newTotal = totalAmount + bump.price
    setTotalAmount(newTotal)

    // Atualizar a mensagem do bump para mostrar "ADICIONADO"
    setMessages(prev => prev.map(msg => {
      if (msg.buttons?.some(b => b.action === `add_bump_${bumpId}`)) {
        return {
          ...msg,
          content: `${bump.description}\n\n*ADICIONADO* (+R$ ${bump.price.toFixed(2).replace(".", ",")})`,
          buttons: undefined // Remove os botoes
        }
      }
      return msg
    }))

    // Atualizar a mensagem de resumo
    setMessages(prev => prev.map(msg => {
      if (msg.buttons?.some(b => b.action === "proceed")) {
        const allSelectedBumps = [...selectedBumps, bumpId]
        let resumoText = `*Resumo do Pedido:*\n\n${selectedPlan.name}: R$ ${selectedPlan.price.toFixed(2).replace(".", ",")}`
        
        allSelectedBumps.forEach(id => {
          const b = selectedPlan.order_bumps.find(ob => ob.id === id)
          if (b) {
            resumoText += `\n+ ${b.name}: R$ ${b.price.toFixed(2).replace(".", ",")}`
          }
        })
        
        resumoText += `\n\n*TOTAL: R$ ${newTotal.toFixed(2).replace(".", ",")}*`

        return {
          ...msg,
          content: resumoText,
          buttons: [
            { text: `PROSSEGUIR - R$ ${newTotal.toFixed(2).replace(".", ",")}`, action: "proceed" }
          ]
        }
      }
      return msg
    }))
  }

  const handleDeclineBump = (bumpId: string) => {
    if (!selectedPlan) return

    const bump = selectedPlan.order_bumps.find(b => b.id === bumpId)
    if (!bump) return

    // Atualizar a mensagem do bump para mostrar "RECUSADO"
    setMessages(prev => prev.map(msg => {
      if (msg.buttons?.some(b => b.action === `add_bump_${bumpId}`)) {
        return {
          ...msg,
          content: `${bump.description}\n\n_Recusado_`,
          buttons: undefined
        }
      }
      return msg
    }))

    // Ir para pagamento
    handleProceed()
  }

  const handleProceed = () => {
    if (!selectedPlan) return

    setStep("payment")

    addMessage({
      type: "user",
      content: "Prosseguir"
    })

    addMessage({
      type: "bot",
      content: `*Gerando pagamento PIX...*\n\nValor: R$ ${totalAmount.toFixed(2).replace(".", ",")}`
    })

    // Simular geracao do PIX
    setTimeout(() => {
      addMessage({
        type: "bot",
        content: `*PIX Gerado com Sucesso!*\n\nValor: R$ ${totalAmount.toFixed(2).replace(".", ",")}\n\nChave PIX:\n\`00020126580014br.gov.bcb.pix0136${Math.random().toString(36).substring(7)}5204000053039865802BR5925SIMULACAO6009SAO PAULO62070503***6304\`\n\n_Copie a chave acima e pague no seu banco_`,
        buttons: [
          { text: "COPIAR CHAVE PIX", action: "copy_pix" },
          { text: "JA PAGUEI", action: "confirm_payment" }
        ]
      })
    }, 1500)
  }

  const handleConfirmPayment = () => {
    setStep("success")

    addMessage({
      type: "user",
      content: "Ja paguei"
    })

    addMessage({
      type: "bot",
      content: `*Pagamento Confirmado!*\n\nObrigado pela sua compra!\n\nResumo:\n- ${selectedPlan?.name}: R$ ${selectedPlan?.price.toFixed(2).replace(".", ",")}\n${selectedBumps.map(id => {
        const bump = selectedPlan?.order_bumps.find(b => b.id === id)
        return bump ? `- ${bump.name}: R$ ${bump.price.toFixed(2).replace(".", ",")}` : ""
      }).join("\n")}\n\n*Total: R$ ${totalAmount.toFixed(2).replace(".", ",")}*`
    })
  }

  const handleButtonClick = (action: string) => {
    if (action.startsWith("select_plan_")) {
      const planId = action.replace("select_plan_", "")
      handleSelectPlan(planId)
    } else if (action.startsWith("add_bump_")) {
      const bumpId = action.replace("add_bump_", "")
      handleAddBump(bumpId)
    } else if (action.startsWith("decline_bump_")) {
      const bumpId = action.replace("decline_bump_", "")
      handleDeclineBump(bumpId)
    } else if (action === "proceed") {
      handleProceed()
    } else if (action === "confirm_payment") {
      handleConfirmPayment()
    } else if (action === "copy_pix") {
      addMessage({ type: "system", content: "Chave PIX copiada!" })
    }
  }

  const handleReset = () => {
    setStep("idle")
    setMessages([])
    setSelectedPlan(null)
    setSelectedBumps([])
    setCurrentBumpIndex(0)
    setTotalAmount(0)
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/fluxos">
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Simulacao do Fluxo - Dados Reais</h1>
              <p className="text-muted-foreground text-sm">Visualize e teste planos, order bumps e fluxos de producao</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchApiData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <a href="/api/simulacao" target="_blank" rel="noopener noreferrer">
              <Button variant="outline">
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver API JSON
              </Button>
            </a>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <Card className="mb-6">
            <CardContent className="py-8 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Carregando dados de producao...</span>
            </CardContent>
          </Card>
        )}
        
        {/* Error state */}
        {error && (
          <Card className="mb-6 border-red-500/30 bg-red-500/5">
            <CardContent className="pt-4">
              <p className="text-sm text-red-600">{error}</p>
            </CardContent>
          </Card>
        )}
        
        {/* Dados carregados */}
        {!loading && apiData && (
          <Tabs defaultValue="dashboard" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="flows">Fluxos ({apiData.flows?.length || 0})</TabsTrigger>
              <TabsTrigger value="bots">Bots ({apiData.bots?.length || 0})</TabsTrigger>
              <TabsTrigger value="simulador">Simulador Chat</TabsTrigger>
            </TabsList>
            
            {/* TAB: Dashboard */}
            <TabsContent value="dashboard" className="space-y-6">
              {/* Cards de resumo */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Bot className="h-4 w-4" />
                      Total Bots
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{apiData.resumo?.total_bots || 0}</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      Total Fluxos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{apiData.resumo?.total_flows || 0}</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Order Bumps Ativos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-green-600">{apiData.diagnosticos?.flows_com_order_bump_ativo?.length || 0}</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Flows sem Vinculo
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-3xl font-bold ${(apiData.diagnosticos?.flows_sem_vinculo?.length || 0) > 0 ? "text-red-600" : "text-green-600"}`}>
                      {apiData.diagnosticos?.flows_sem_vinculo?.length || 0}
                    </p>
                  </CardContent>
                </Card>
              </div>
              
              {/* Order Bumps ativos */}
              {apiData.diagnosticos?.flows_com_order_bump_ativo?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-green-600" />
                      Order Bumps Ativos
                    </CardTitle>
                    <CardDescription>Fluxos com Order Bump configurado e funcionando</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {apiData.diagnosticos.flows_com_order_bump_ativo.map((flow) => (
                        <div key={flow.flow_id} className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                          <div>
                            <p className="font-medium">{flow.flow_name}</p>
                            <p className="text-sm text-muted-foreground">Order Bump: {flow.order_bump_name}</p>
                          </div>
                          <Badge variant="outline" className="bg-green-500/20 text-green-600 border-green-500/30">
                            R$ {flow.order_bump_price?.toFixed(2).replace(".", ",")}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Problemas detectados */}
              {apiData.diagnosticos?.flows_sem_vinculo?.length > 0 && (
                <Card className="border-red-500/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="h-5 w-5" />
                      Problemas Detectados
                    </CardTitle>
                    <CardDescription>Fluxos que precisam de atencao</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {apiData.diagnosticos.flows_sem_vinculo.map((flow) => (
                        <div key={flow.flow_id} className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                          <div>
                            <p className="font-medium">{flow.flow_name}</p>
                            <p className="text-sm text-red-600">{flow.problema}</p>
                          </div>
                          <Link href={`/fluxos/${flow.flow_id}`}>
                            <Button size="sm" variant="outline">Corrigir</Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            {/* TAB: Fluxos */}
            <TabsContent value="flows" className="space-y-4">
              {apiData.flows?.map((flow) => (
                <Card key={flow.flow_id} className={flow.vinculo_bot.tem_vinculo ? "" : "border-red-500/30"}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {flow.flow_name}
                          <Badge variant={flow.flow_status === "ativo" || flow.flow_status === "active" ? "default" : "secondary"}>
                            {flow.flow_status || "ativo"}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {flow.vinculo_bot.tem_vinculo ? (
                            <span className="text-green-600">Vinculado a: @{flow.vinculo_bot.bot_username || flow.vinculo_bot.bot_name}</span>
                          ) : (
                            <span className="text-red-600">SEM VINCULO COM BOT</span>
                          )}
                        </CardDescription>
                      </div>
                      <Link href={`/fluxos/${flow.flow_id}`}>
                        <Button variant="outline" size="sm">Editar</Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Planos */}
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Planos ({flow.planos.total})
                        <Badge variant="outline" className="text-xs">{flow.planos.fonte}</Badge>
                      </h4>
                      {flow.planos.lista.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          {flow.planos.lista.map((plano) => (
                            <div key={plano.id} className="p-3 bg-muted/50 rounded-lg">
                              <p className="font-medium">{plano.name}</p>
                              <p className="text-sm text-green-600 font-semibold">R$ {plano.price.toFixed(2).replace(".", ",")}</p>
                              <code className="text-xs text-muted-foreground">{plano.telegram_button.callback_data}</code>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhum plano configurado</p>
                      )}
                    </div>
                    
                    <Separator />
                    
                    {/* Order Bump Inicial */}
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Order Bump Inicial
                        <Badge variant={flow.order_bumps.inicial.enabled && flow.order_bumps.inicial.price && flow.order_bumps.inicial.price > 0 ? "default" : "secondary"} className={flow.order_bumps.inicial.RESULTADO.includes("VAI MOSTRAR") ? "bg-green-600" : ""}>
                          {flow.order_bumps.inicial.RESULTADO}
                        </Badge>
                      </h4>
                      {flow.order_bumps.inicial.enabled ? (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="font-medium">{flow.order_bumps.inicial.name}</p>
                          <p className="text-sm text-green-600 font-semibold">R$ {flow.order_bumps.inicial.price?.toFixed(2).replace(".", ",")}</p>
                          <p className="text-xs text-muted-foreground mt-1">{flow.order_bumps.inicial.description}</p>
                          {flow.order_bumps.inicial.simulacao_callbacks && (
                            <div className="mt-2 text-xs space-y-1">
                              <p className="text-muted-foreground">Callbacks gerados:</p>
                              <code className="block bg-background p-1 rounded">Aceitar: {flow.order_bumps.inicial.simulacao_callbacks.callback_aceitar}</code>
                              <code className="block bg-background p-1 rounded">Recusar: {flow.order_bumps.inicial.simulacao_callbacks.callback_recusar}</code>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nao configurado ou desabilitado</p>
                      )}
                    </div>
                    
                    {/* Order Bump Packs */}
                    {flow.packs.enabled && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-medium mb-2 flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Order Bump Packs
                            <Badge variant={flow.order_bumps.packs.enabled ? "default" : "secondary"}>
                              {flow.order_bumps.packs.RESULTADO}
                            </Badge>
                          </h4>
                          {flow.order_bumps.packs.enabled && (
                            <div className="p-3 bg-muted/50 rounded-lg">
                              <p className="font-medium">{flow.order_bumps.packs.name}</p>
                              <p className="text-sm text-green-600 font-semibold">R$ {flow.order_bumps.packs.price?.toFixed(2).replace(".", ",")}</p>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                    
                    {/* Packs */}
                    {flow.packs.enabled && flow.packs.total > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-medium mb-2">Packs ({flow.packs.total})</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            {flow.packs.lista.map((pack) => (
                              <div key={pack.id} className="p-3 bg-muted/50 rounded-lg">
                                <p className="font-medium">{pack.emoji} {pack.name}</p>
                                <p className="text-sm text-green-600 font-semibold">R$ {pack.price.toFixed(2).replace(".", ",")}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
            
            {/* TAB: Bots */}
            <TabsContent value="bots" className="space-y-4">
              {apiData.bots?.map((bot) => (
                <Card key={bot.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Bot className="h-5 w-5" />
                          {bot.name || "Bot sem nome"}
                          <Badge variant={bot.status === "active" ? "default" : "secondary"}>
                            {bot.status || "active"}
                          </Badge>
                        </CardTitle>
                        {bot.username && (
                          <CardDescription>@{bot.username}</CardDescription>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div>
                      <h4 className="font-medium mb-2">Fluxos Vinculados ({bot.flows_vinculados?.length || 0})</h4>
                      {bot.flows_vinculados?.length > 0 ? (
                        <div className="space-y-2">
                          {bot.flows_vinculados.map((flow) => (
                            <Link key={flow.flow_id} href={`/fluxos/${flow.flow_id}`}>
                              <div className="p-2 bg-muted/50 rounded hover:bg-muted transition-colors">
                                <p className="font-medium">{flow.flow_name}</p>
                                <code className="text-xs text-muted-foreground">{flow.flow_id}</code>
                              </div>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhum fluxo vinculado</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
            
            {/* TAB: Simulador Chat */}
            <TabsContent value="simulador">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Seletor de Flow */}
                <Card>
                  <CardHeader>
                    <CardTitle>Selecione um Fluxo para Simular</CardTitle>
                    <CardDescription>Escolha o fluxo que deseja testar no simulador de chat</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-2">
                        {apiData.flows?.map((flow) => (
                          <Button
                            key={flow.flow_id}
                            variant={selectedFlowId === flow.flow_id ? "default" : "outline"}
                            className="w-full justify-start"
                            onClick={() => setSelectedFlowId(flow.flow_id)}
                          >
                            <div className="text-left">
                              <p className="font-medium">{flow.flow_name}</p>
                              <p className="text-xs opacity-70">{flow.planos.total} planos - OB: {flow.order_bumps.inicial.RESULTADO}</p>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
                
                {/* Info do Flow selecionado */}
                {selectedFlow && (
                  <Card>
                    <CardHeader>
                      <CardTitle>{selectedFlow.flow_name}</CardTitle>
                      <CardDescription>Detalhes do fluxo selecionado</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">Planos Disponiveis</h4>
                        <div className="space-y-2">
                          {selectedFlow.planos.lista.map((plano) => (
                            <div key={plano.id} className="p-2 bg-muted/50 rounded flex justify-between items-center">
                              <span>{plano.name}</span>
                              <Badge>R$ {plano.price.toFixed(2).replace(".", ",")}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {selectedFlow.order_bumps.inicial.enabled && (
                        <div>
                          <h4 className="font-medium mb-2">Order Bump</h4>
                          <div className="p-2 bg-green-500/10 rounded border border-green-500/20">
                            <p className="font-medium">{selectedFlow.order_bumps.inicial.name}</p>
                            <p className="text-sm text-green-600">+R$ {selectedFlow.order_bumps.inicial.price?.toFixed(2).replace(".", ",")}</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
              
              {/* Chat simulado (existente) */}
              <div className="mt-6">
                <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
                  <CardContent className="pt-4">
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      Este e um simulador de chat com dados mock. Para testar com dados reais, use os fluxos acima ou acesse{" "}
                      <Link href="/fluxos" className="underline font-medium">
                        /fluxos
                      </Link>
                      {" "}e selecione o fluxo desejado.
                    </p>
                  </CardContent>
                </Card>

        {/* Area do chat simulado */}
        <Card className="bg-[#0e1621] border-neutral-800">
          <CardHeader className="border-b border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-white text-base">Bot de Vendas</CardTitle>
                <p className="text-neutral-400 text-xs">Simulacao</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Mensagens */}
            <div className="h-[500px] overflow-y-auto p-4 space-y-4">
              {step === "idle" && (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <p className="text-neutral-400 text-center">
                    Clique em START para iniciar a simulacao do fluxo de compra
                  </p>
                  <Button onClick={handleStart} className="bg-blue-600 hover:bg-blue-700">
                    START
                  </Button>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-3 ${
                      msg.type === "user"
                        ? "bg-blue-600 text-white"
                        : msg.type === "system"
                        ? "bg-neutral-700 text-neutral-300 text-sm"
                        : "bg-neutral-800 text-white"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm">
                      {msg.content.split(/(\*[^*]+\*|_[^_]+_|`[^`]+`)/).map((part, i) => {
                        if (part.startsWith("*") && part.endsWith("*")) {
                          return <strong key={i}>{part.slice(1, -1)}</strong>
                        }
                        if (part.startsWith("_") && part.endsWith("_")) {
                          return <em key={i} className="text-neutral-400">{part.slice(1, -1)}</em>
                        }
                        if (part.startsWith("`") && part.endsWith("`")) {
                          return <code key={i} className="bg-neutral-700 px-1 rounded text-xs break-all">{part.slice(1, -1)}</code>
                        }
                        return part
                      })}
                    </p>

                    {msg.buttons && msg.buttons.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {msg.buttons.map((btn, idx) => (
                          <Button
                            key={idx}
                            variant={btn.variant === "outline" ? "outline" : "default"}
                            className={`w-full text-sm ${
                              btn.variant === "outline"
                                ? "border-neutral-600 text-neutral-300 hover:bg-neutral-700"
                                : "bg-purple-600 hover:bg-purple-700 text-white"
                            }`}
                            onClick={() => handleButtonClick(btn.action)}
                          >
                            {btn.text}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Estado atual */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Estado Atual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Step</p>
                <Badge variant="outline">{step}</Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Plano</p>
                <p className="font-medium">{selectedPlan?.name || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Bumps Adicionados</p>
                <p className="font-medium">{selectedBumps.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total</p>
                <p className="font-medium text-green-600">R$ {totalAmount.toFixed(2).replace(".", ",")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Links para fluxos */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Links Uteis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Link href="/fluxos" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Ver todos os fluxos
                </Button>
              </Link>
              <p className="text-xs text-muted-foreground mt-2">
                Para editar um fluxo especifico, acesse: <code className="bg-muted px-1 rounded">/fluxos/[id]</code>
              </p>
            </div>
          </CardContent>
        </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}

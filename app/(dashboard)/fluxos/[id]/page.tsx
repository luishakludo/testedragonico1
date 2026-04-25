"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/lib/auth-context"
import { useBots } from "@/lib/bot-context"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { FlowBuilder } from "@/components/flow-builder"
import {
  ArrowLeft, Bot, MessageSquare, CreditCard, TrendingUp, TrendingDown,
  Package, Wallet, Crown, Save, Loader2, Plus, Trash2, RefreshCw,
  Users, DollarSign, HelpCircle, AlertTriangle, Lock, Pencil,
  Globe, Link2, Settings2, Zap, Image as ImageIcon, Bold, Italic,
  Underline, Strikethrough, Code, Link as LinkIcon, Quote, Smile,
  ExternalLink, MessageCircle, Copy, ChevronDown, ChevronRight, Clock,
  Check, X, Workflow, Gift, Video, Music, BarChart3, CheckCircle
} from "lucide-react"

// Types
interface Flow {
  id: string
  user_id: string
  name: string
  flow_type: "basic" | "complete" | "n8n"
  status: "active" | "paused" | "ativo"
  config: FlowConfig
  welcome_message?: string
  media_cache_chat_id?: string
  support_username?: string
  created_at: string
  updated_at: string
}

interface DeliveryConfig {
  type: "media" | "vip_group" | "link" | null
  medias?: string[]
  link?: string
  linkText?: string
  vipGroupId?: string
  vipGroupName?: string
  vipAutoAdd?: boolean
  vipAutoRemoveOnExpire?: boolean
}

interface Deliverable {
  id: string
  name: string
  type: "media" | "vip_group" | "link"
  // Media
  medias?: string[]
  // Link
  link?: string
  linkText?: string
  // VIP Group
  vipGroupChatId?: string
  vipGroupName?: string
  vipAutoAdd?: boolean
  vipAutoRemove?: boolean
}

interface FlowConfig {
  welcomeMessage?: string
  welcomeMedias?: string[]
  ctaButtonText?: string
  ctaButtonEnabled?: boolean // false = mostrar planos direto na boas-vindas
  redirectButton?: {
  enabled: boolean
  text: string
  url: string
  }
  secondaryMessage?: {
  enabled: boolean
  message: string
  }
  plans?: FlowPlan[]
  upsell?: UpsellConfig
  downsell?: DownsellConfig
  downsellPix?: DownsellPixConfig
  orderBump?: OrderBumpConfig
  packs?: PackConfig[]
  payments?: PaymentConfig
  subscription?: SubscriptionConfig
  delivery?: DeliveryConfig
  // Entregaveis reutilizaveis
  deliverables?: Deliverable[]
  mainDeliverableId?: string
  // Payment Messages Config
  paymentMessages?: {
    pixGeneratedMessage?: string
    messageBeforeCode?: string
    showPlanBeforePix?: boolean
    qrCodeDisplay?: string
    pixCodeFormat?: string
    showCopyButton?: boolean
    verifyStatusButtonText?: string
    approvedMessage?: string
    approvedMedias?: string[]
    accessButtonText?: string
    accessButtonUrl?: string
  }
  }

interface PlanOrderBump {
  id: string
  enabled: boolean
  name: string
  price: number | string
  description: string
  acceptText: string
  rejectText: string
  ctaMessage: string
  deliveryType: "same" | "custom"
  deliverableId?: string // ID do entregavel especifico para este order bump
  medias: string[]
}

interface FlowPlan {
  id: string
  name: string
  price: number | string
  duration_days: number
  duration_type: "daily" | "weekly" | "monthly" | "yearly" | "lifetime"
  description?: string
  active: boolean
  delivery_type: "default" | "custom"
  deliverableId?: string // ID do entregavel especifico para este plano
  custom_delivery?: string
  // Legado (manter para compatibilidade)
  order_bump_custom: boolean
  order_bump_name?: string
  order_bump_price?: number | string
  order_bump_description?: string
  order_bump_accept_text?: string
  order_bump_reject_text?: string
  order_bump_cta_message?: string
  order_bump_delivery?: "same" | "custom"
  order_bump_medias?: string[]
  // Novo: array de order bumps (ate 5)
  order_bumps?: PlanOrderBump[]
}

interface UpsellPlan {
  id: string
  buttonText: string
  price: number
  duration_days?: number
  duration_type?: "daily" | "weekly" | "monthly" | "yearly" | "lifetime"
}

interface UpsellSequence {
  id: string
  message: string
  medias: string[]
  sendTiming: "immediate" | "custom"
  sendDelayValue?: number
  sendDelayUnit?: "minutes" | "hours" | "days"
  plans: UpsellPlan[]
  useDefaultPlans?: boolean // Se true, usa os planos do boas vindas com desconto
  discountPercent?: number // Desconto padrao para todos os planos
  showPriceInButton?: boolean // Mostrar preco no botao (ex: "Mensal por R$ 20,00")
  deliveryType: "global" | "custom"
  deliverableId?: string // ID do entregavel selecionado (se custom)
  customDelivery?: string
}

interface UpsellConfig {
  enabled: boolean
  message?: string
  media_url?: string
  plans?: FlowPlan[]
  sequences?: UpsellSequence[]
  deliveryType?: "same" | "custom"
  customDelivery?: string
}

interface DownsellPlan {
  id: string
  buttonText: string
  price: number
  // Campos completos para planos personalizados
  duration_days?: number
  duration_type?: "daily" | "weekly" | "monthly" | "yearly" | "lifetime"
  // Referencia ao plano original (quando usando planos padrao)
  originalPlanId?: string
  discountPercent?: number
}

interface DownsellSequence {
  id: string
  message: string
  medias: string[]
  sendTiming: "immediate" | "custom"
  sendDelayValue?: number
  sendDelayUnit?: "minutes" | "hours" | "days"
  plans: DownsellPlan[]
  useDefaultPlans: boolean // Se true, usa os planos do boas vindas com desconto
  discountPercent?: number // Desconto padrao para todos os planos
  showPriceInButton?: boolean // Mostrar preco no botao (ex: "Mensal por R$ 20,00")
  deliveryType: "global" | "custom"
  deliverableId?: string // ID do entregavel selecionado (se custom)
  customDelivery?: string
}

interface DownsellConfig {
  enabled: boolean
  message?: string
  sequences?: DownsellSequence[]
  deliveryType?: "same" | "custom"
  customDelivery?: string
}

// Downsell PIX Gerado - dispara quando o cliente gera um PIX mas ainda não pagou
interface DownsellPixSequence {
  id: string
  message: string
  medias: string[]
  sendTiming: "immediate" | "custom"
  sendDelayValue?: number
  sendDelayUnit?: "minutes" | "hours" | "days"
  plans: DownsellPlan[]
  useDefaultPlans: boolean // Se true, usa os planos do boas vindas com desconto
  discountPercent?: number // Desconto padrao para todos os planos
  showPriceInButton?: boolean // Mostrar preco no botao (ex: "Mensal por R$ 20,00")
  deliveryType: "global" | "custom"
  deliverableId?: string
  customDelivery?: string
}

interface DownsellPixConfig {
  enabled: boolean
  sequences?: DownsellPixSequence[]
  deliveryType?: "same" | "custom"
  customDelivery?: string
}

interface Pack {
  id: string
  emoji: string
  name: string
  price: number
  description: string
  previewMedias: string[] // Array de midias de preview (ate 10)
  buttonText: string // Texto do botao personalizado
  deliveryDestination: string
  deliverableId?: string // ID do entregavel associado
  active: boolean
  }

interface OrderBumpItem {
  enabled: boolean
  name: string
  price: number
  description: string
  acceptText: string
  rejectText: string
  ctaMessage: string
  deliveryType: "same" | "custom"
  deliverableId?: string // ID do entregavel especifico para este order bump
  medias: string[]
}

interface OrderBumpConfig {
  enabled: boolean
  name?: string
  price?: number
  inicial?: OrderBumpItem
  upsell?: OrderBumpItem
  downsell?: OrderBumpItem
  packs?: OrderBumpItem
  applyInicialTo?: {
    upsell: boolean
    downsell: boolean
    packs: boolean
  }
}

interface PackConfig {
  id: string
  name: string
  items: string[]
  price: number
  discount_percent?: number
  deliverableId?: string // ID do entregavel especifico para este pack
  }

interface PaymentConfig {
  gateway?: string
  pix_key?: string
}

interface SubscriptionConfig {
  enabled: boolean
  plans?: {
    id: string
    name: string
    price: number
    interval: "monthly" | "yearly"
  }[]
}

interface FlowBot {
  id: string
  flow_id: string
  bot_id: string
  bot?: {
    id: string
    username: string
    first_name: string
    photo_url?: string
  }
}

interface AvailableBot {
  id: string
  username: string
  first_name: string
  photo_url?: string
}

interface TelegramChat {
  id: string
  title: string
  type: string
}

// Opcoes de duracao disponiveis
const DURATION_OPTIONS = [
  { value: "1_daily", days: 1, label: "Diario (1 dia)", shortLabel: "1 dia" },
  { value: "7_weekly", days: 7, label: "Semanal (7 dias)", shortLabel: "7 dias" },
  { value: "15_monthly", days: 15, label: "Quinzenal (15 dias)", shortLabel: "15 dias" },
  { value: "30_monthly", days: 30, label: "Mensal (30 dias)", shortLabel: "30 dias" },
  { value: "60_monthly", days: 60, label: "Bimestral (60 dias)", shortLabel: "60 dias" },
  { value: "90_monthly", days: 90, label: "Trimestral (90 dias)", shortLabel: "90 dias" },
  { value: "180_monthly", days: 180, label: "Semestral (180 dias)", shortLabel: "180 dias" },
  { value: "365_yearly", days: 365, label: "Anual (365 dias)", shortLabel: "365 dias" },
  { value: "0_lifetime", days: 0, label: "Vitalicio (sem expiracao)", shortLabel: "Vitalicio" },
] as const

// Helper: Normaliza o valor da duracao para o formato correto do Select
// Sempre retorna um valor valido que existe nas opcoes do Select
function getDurationSelectValue(days: number | undefined | null): string {
  // Default para 30 dias (mensal) se nao especificado
  const d = typeof days === "number" ? days : 30
  
  // Procura a opcao correspondente aos dias
  const option = DURATION_OPTIONS.find(opt => opt.days === d)
  if (option) return option.value
  
  // Se nao encontrou, retorna o valor mais proximo ou default para mensal
  // Isso garante que valores invalidos nao quebrem o Select
  return "30_monthly"
}

// Helper: Retorna o label da duracao para exibicao
function getDurationLabel(days: number | undefined | null): string {
  const d = typeof days === "number" ? days : 30
  const option = DURATION_OPTIONS.find(opt => opt.days === d)
  return option ? option.shortLabel.replace(" dias", "").replace("Vitalicio", "Vitalicio") : "Mensal"
}

// Helper: Retorna o label completo da duracao para exibicao
function getDurationLabelFull(days: number | undefined | null): string {
  const d = typeof days === "number" ? days : 30
  const labels: Record<number, string> = {
    0: "Vitalicio",
    1: "Diario",
    7: "Semanal",
    15: "Quinzenal",
    30: "Mensal",
    60: "Bimestral",
    90: "Trimestral",
    180: "Semestral",
    365: "Anual"
  }
  return labels[d] || "Mensal"
}

// Componente de input de desconto com estado local para permitir edicao livre
function DiscountInput({ 
  value, 
  onChange, 
  className 
}: { 
  value: number
  onChange: (value: number) => void
  className?: string 
}) {
  const [localValue, setLocalValue] = useState(value.toString())
  
  useEffect(() => {
    setLocalValue(value.toString())
  }, [value])
  
  return (
    <Input
      type="text"
      inputMode="numeric"
      value={localValue}
      onChange={(e) => {
        const val = e.target.value.replace(/[^0-9]/g, '')
        setLocalValue(val)
      }}
      onBlur={() => {
        const numValue = parseInt(localValue) || 0
        const clampedValue = Math.min(99, Math.max(1, numValue))
        setLocalValue(clampedValue.toString())
        onChange(clampedValue)
      }}
      className={className}
      min={1}
      max={99}
    />
  )
}

export default function FlowEditorPage() {
  const params = useParams()
  const router = useRouter()
  const { session, isLoading: isAuthLoading } = useAuth()
  const { bots: userBots, addBot, refreshBots, isLoading: isBotsLoading } = useBots()
  const { toast } = useToast()
  const flowId = params.id as string

  // State
  const [flow, setFlow] = useState<Flow | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("bots")
  const [hasChanges, setHasChanges] = useState(false)
  const [changeCount, setChangeCount] = useState(0)
  const [showSavedNotification, setShowSavedNotification] = useState(false)

  // Edit name
  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState("")
  
  // Bots
  const [flowBots, setFlowBots] = useState<FlowBot[]>([])
  const [availableBots, setAvailableBots] = useState<AvailableBot[]>([])
  const [selectedBotToAdd, setSelectedBotToAdd] = useState<string>("")
  const [showAddBotDialog, setShowAddBotDialog] = useState(false)
  const [isLoadingBots, setIsLoadingBots] = useState(false)
  
  // Create bot inline
  const [showCreateBotForm, setShowCreateBotForm] = useState(false)
  const [newBotToken, setNewBotToken] = useState("")
  const [isCreatingBot, setIsCreatingBot] = useState(false)
  


  // Welcome message
  const [welcomeMessage, setWelcomeMessage] = useState("")
  const [welcomeMedias, setWelcomeMedias] = useState<string[]>([])
  const [secondaryMessageEnabled, setSecondaryMessageEnabled] = useState(false)
  const [secondaryMessage, setSecondaryMessage] = useState("")
  const [ctaButtonEnabled, setCtaButtonEnabled] = useState(true) // true = mostra botao CTA, false = planos direto
  const [ctaButtonText, setCtaButtonText] = useState("Ver Planos")
  const [ctaButtonUrl, setCtaButtonUrl] = useState("")
  const [redirectButtonEnabled, setRedirectButtonEnabled] = useState(false)
  const [redirectButtonText, setRedirectButtonText] = useState("")
  const [redirectButtonUrl, setRedirectButtonUrl] = useState("")

// Plans
const [plans, setPlans] = useState<FlowPlan[]>([])
const [showPriceInButton, setShowPriceInButton] = useState(false)
const [expandedPlan, setExpandedPlan] = useState<string | null>(null)

  // Upsell
  const [upsellEnabled, setUpsellEnabled] = useState(false)
  const [upsellMessage, setUpsellMessage] = useState("")
  const [upsellSequences, setUpsellSequences] = useState<UpsellSequence[]>([])
  const [upsellDeliveryType, setUpsellDeliveryType] = useState<"same" | "custom">("same")
  const [upsellCustomDelivery, setUpsellCustomDelivery] = useState("")
  const [expandedSequence, setExpandedSequence] = useState<string | null>(null)
  const [uploadingUpsellMedia, setUploadingUpsellMedia] = useState<string | null>(null)

  // Downsell
  const [downsellEnabled, setDownsellEnabled] = useState(false)
  const [downsellMessage, setDownsellMessage] = useState("")
  const [downsellSequences, setDownsellSequences] = useState<DownsellSequence[]>([])
  const [downsellDeliveryType, setDownsellDeliveryType] = useState<"same" | "custom">("same")
  const [expandedDownsellSequence, setExpandedDownsellSequence] = useState<string | null>(null)
  const [uploadingDownsellMedia, setUploadingDownsellMedia] = useState<string | null>(null)

  // Downsell PIX Gerado - dispara quando o cliente gera um PIX
  const [downsellSubTab, setDownsellSubTab] = useState<"normal" | "pix">("normal")
  const [downsellPixEnabled, setDownsellPixEnabled] = useState(false)
  const [downsellPixSequences, setDownsellPixSequences] = useState<DownsellPixSequence[]>([])
  const [downsellPixDeliveryType, setDownsellPixDeliveryType] = useState<"same" | "custom">("same")
  const [expandedDownsellPixSequence, setExpandedDownsellPixSequence] = useState<string | null>(null)
  const [uploadingDownsellPixMedia, setUploadingDownsellPixMedia] = useState<string | null>(null)

  // Entregaveis
  const [deliverables, setDeliverables] = useState<Deliverable[]>([])
  const [mainDeliverableId, setMainDeliverableId] = useState<string>("")
  const [expandedDeliverable, setExpandedDeliverable] = useState<string | null>(null)
  const [uploadingDeliverableMedia, setUploadingDeliverableMedia] = useState<string | null>(null)
  const [deliverableModalOpen, setDeliverableModalOpen] = useState(false)
  const [deliverableModalStep, setDeliverableModalStep] = useState<"select" | "form">("select")
  const [editingDeliverable, setEditingDeliverable] = useState<Deliverable | null>(null)
  const [isTestingVipGroup, setIsTestingVipGroup] = useState(false)
  const [vipTestResult, setVipTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [tempDeliverable, setTempDeliverable] = useState<Deliverable>({
    id: "",
    name: "",
    type: "media",
    medias: [],
    link: "",
    linkText: "",
    vipGroupChatId: "",
    vipGroupName: "",
    vipAutoAdd: true,
    vipAutoRemove: true,
  })

  // Order Bump
  const [orderBumpEnabled, setOrderBumpEnabled] = useState(false)
  const [orderBumpName, setOrderBumpName] = useState("")
  const [orderBumpPrice, setOrderBumpPrice] = useState("")
  
const defaultOrderBumpItem: OrderBumpItem = {
  enabled: false,
  name: "",
  price: 0,
  description: "",
  acceptText: "QUERO",
  rejectText: "NAO QUERO",
  ctaMessage: "",
  deliveryType: "same",
  deliverableId: "",
  medias: [],
  }
  
  const [orderBumpInicial, setOrderBumpInicial] = useState<OrderBumpItem>(defaultOrderBumpItem)
  const [orderBumpUpsell, setOrderBumpUpsell] = useState<OrderBumpItem>(defaultOrderBumpItem)
  const [orderBumpDownsell, setOrderBumpDownsell] = useState<OrderBumpItem>(defaultOrderBumpItem)
  const [orderBumpPacks, setOrderBumpPacks] = useState<OrderBumpItem>(defaultOrderBumpItem)
  const [applyInicialTo, setApplyInicialTo] = useState({ upsell: false, downsell: false, packs: false })
  const [uploadingOrderBumpMedia, setUploadingOrderBumpMedia] = useState<string | null>(null)

  // Packs
  const [packsEnabled, setPacksEnabled] = useState(false)
  const [packsList, setPacksList] = useState<Pack[]>([])
  const [expandedPack, setExpandedPack] = useState<string | null>(null)
  const [packsButtonText, setPacksButtonText] = useState("Packs Disponiveis")

  // Payment Messages
  const [showPlanBeforePix, setShowPlanBeforePix] = useState(false)
  const [pixGeneratedMedia, setPixGeneratedMedia] = useState("")
  const [pixGeneratedMessage, setPixGeneratedMessage] = useState(`<b>Como realizar o pagamento:</b>

1. Abra o aplicativo do seu banco.
2. Selecione a opcao "Pagar" ou "PIX".
3. Escolha "PIX Copia e Cola".
4. Cole a chave que esta abaixo e finalize o pagamento com seguranca.`)
  const [qrCodeDisplay, setQrCodeDisplay] = useState("image")
  const [pixCodeFormat, setPixCodeFormat] = useState("monospace")
  const [showCopyButton, setShowCopyButton] = useState(false)
  const [messageBeforeCode, setMessageBeforeCode] = useState("Copie o codigo abaixo:")
  const [verifyStatusButtonText, setVerifyStatusButtonText] = useState("Verificar Status")
  const [approvedMedias, setApprovedMedias] = useState<string[]>([])
  const [approvedMessage, setApprovedMessage] = useState(`<b>Pagamento Aprovado!</b>

Parabens {nome}! Seu pagamento foi confirmado.

Voce ja tem acesso ao conteudo!`)
  const [accessButtonText, setAccessButtonText] = useState("Acessar Conteudo")
  const [accessButtonUrl, setAccessButtonUrl] = useState("")
  const [uploadingApprovedMedia, setUploadingApprovedMedia] = useState(false)

  // Refs for textareas
  const pixGeneratedMessageRef = useRef<HTMLTextAreaElement>(null)
  const approvedMessageRef = useRef<HTMLTextAreaElement>(null)

  // Helper function to mark changes
  const markChange = useCallback(() => {
    setHasChanges(true)
    setChangeCount(prev => prev + 1)
  }, [])

  // Insert variable at cursor position
  const insertVariable = (variable: string, textareaRef: React.RefObject<HTMLTextAreaElement | null>, setValue: (value: string) => void, currentValue: string) => {
    const textarea = textareaRef.current
    if (!textarea) {
      setValue(currentValue + variable)
      markChange()
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newValue = currentValue.substring(0, start) + variable + currentValue.substring(end)
    setValue(newValue)
    markChange()

    // Restore cursor position after the inserted variable
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + variable.length, start + variable.length)
    }, 0)
  }

  // Renewal System
  const [renewalDeliveryEnabled, setRenewalDeliveryEnabled] = useState(false)
  const [renewalDeliverableId, setRenewalDeliverableId] = useState("")
  const [notifyBeforeExpireEnabled, setNotifyBeforeExpireEnabled] = useState(true)
  const [daysBeforeExpire, setDaysBeforeExpire] = useState<string[]>(["7 dias", "3 dias", "1 dia", "No dia"])
  const [renewalMediaType, setRenewalMediaType] = useState("none")
  const [renewalMediaUrl, setRenewalMediaUrl] = useState("")
  const [uploadingRenewalMedia, setUploadingRenewalMedia] = useState(false)
  const [renewalMessage, setRenewalMessage] = useState(`Ola {nome}!

Sua assinatura do plano {plano} expira em {dias} dias.

Renove agora e continue aproveitando todos os beneficios!`)
  const [notifyOnDayEnabled, setNotifyOnDayEnabled] = useState(true)
  const [notificationCount, setNotificationCount] = useState("3")
  const [selectedHours, setSelectedHours] = useState<string[]>(["09:00", "15:00", "21:00"])
  const [expireMessageEnabled, setExpireMessageEnabled] = useState(true)
  const [expireMediaType, setExpireMediaType] = useState("none")
  const [expireMediaUrl, setExpireMediaUrl] = useState("")
  const [uploadingExpireMedia, setUploadingExpireMedia] = useState(false)
  const [expireMessage, setExpireMessage] = useState(`{nome}, sua assinatura expirou!

Renove agora para continuar com acesso ao conteudo exclusivo.

Clique no botao abaixo para renovar com desconto especial!`)
  const [useFlowPlans, setUseFlowPlans] = useState(true)
  const [renewalDiscount, setRenewalDiscount] = useState("20%")
  const [kickFromGroup, setKickFromGroup] = useState(true)
  const [removeVipStatus, setRemoveVipStatus] = useState(true)

  // Conversions
  const [conversionsPeriod, setConversionsPeriod] = useState("all")
  const [conversionsData, setConversionsData] = useState<{
    payments: Array<{
      id: string
      amount: number
      status: string
      payer_name: string
      payer_email: string
      created_at: string
      bot_name?: string
    }>
    stats: {
      total: number
      totalAmount: number
    }
  }>({ payments: [], stats: { total: 0, totalAmount: 0 } })
  const [loadingConversions, setLoadingConversions] = useState(false)

  // Packs
  const [packs, setPacks] = useState<PackConfig[]>([])

  // Payments
  const [paymentGateway, setPaymentGateway] = useState("")
  const [pixKey, setPixKey] = useState("")

  // Subscription
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false)

  // Sidebar
  const [mediaCacheChat, setMediaCacheChat] = useState<string>("")
  const [supportUsername, setSupportUsername] = useState("")
  const [telegramChats, setTelegramChats] = useState<TelegramChat[]>([])
  const [isLoadingChats, setIsLoadingChats] = useState(false)

  // Entregaveis (Delivery)
  const [showDeliveryConfig, setShowDeliveryConfig] = useState(false)
  const [deliveryType, setDeliveryType] = useState<"media" | "vip_group" | "link" | null>(null)
  const [deliveryMedias, setDeliveryMedias] = useState<string[]>([])
  const [deliveryLink, setDeliveryLink] = useState("")
  const [deliveryLinkText, setDeliveryLinkText] = useState("Acessar Conteudo")
  const [vipGroupId, setVipGroupId] = useState("")
  const [vipGroupName, setVipGroupName] = useState("")
  const [vipAutoAdd, setVipAutoAdd] = useState(true)
  const [vipAutoRemoveOnExpire, setVipAutoRemoveOnExpire] = useState(true)

  // Stats reais do fluxo
  const [stats, setStats] = useState({ leads: 0, vips: 0, revenue: 0 })
  const [loadingStats, setLoadingStats] = useState(false)

  // Delete flow
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch flow
  const fetchFlow = useCallback(async () => {
    if (!flowId || !session?.userId || isAuthLoading) {
      return
    }

    setIsLoading(true)
    
    const { data, error } = await supabase
      .from("flows")
      .select("*")
      .eq("id", flowId)
      .eq("user_id", session.userId)
      .single()

    if (error || !data) {
      if (!isAuthLoading) {
        router.push("/fluxos")
      }
      return
    }

    const flowData = data as Flow
    
    setFlow(flowData)
    setEditName(flowData.name)
    setWelcomeMessage(flowData.welcome_message || "")
    setMediaCacheChat(flowData.media_cache_chat_id || "")
    setSupportUsername(flowData.support_username || "")
    
    // Set default tab based on flow type
    if (flowData.flow_type === "n8n") {
      setActiveTab("n8n")
    } else {
      setActiveTab("bots")
    }

// Parse config
  const config = flowData.config || {}
setPlans(config.plans || [])
setShowPriceInButton(config.showPriceInButton || false)
setUpsellEnabled(config.upsell?.enabled || false)
  setUpsellMessage(config.upsell?.message || "")
  setUpsellSequences(config.upsell?.sequences || [])
  setDownsellEnabled(config.downsell?.enabled || false)
  setDownsellMessage(config.downsell?.message || "")
  setDownsellSequences(config.downsell?.sequences || [])
  setDownsellDeliveryType(config.downsell?.deliveryType || "same")
  // Downsell PIX Gerado
  setDownsellPixEnabled(config.downsellPix?.enabled || false)
  setDownsellPixSequences(config.downsellPix?.sequences || [])
  setDownsellPixDeliveryType(config.downsellPix?.deliveryType || "same")
  // Entregaveis
  setDeliverables(config.deliverables || [])
  setMainDeliverableId(config.mainDeliverableId || "")
  setOrderBumpEnabled(config.orderBump?.enabled || false)
        setOrderBumpName(config.orderBump?.name || "")
        setOrderBumpPrice(config.orderBump?.price?.toString() || "")
        if (config.orderBump?.inicial) setOrderBumpInicial(config.orderBump.inicial)
        if (config.orderBump?.upsell) setOrderBumpUpsell(config.orderBump.upsell)
        if (config.orderBump?.downsell) setOrderBumpDownsell(config.orderBump.downsell)
  if (config.orderBump?.packs) setOrderBumpPacks(config.orderBump.packs)
  if (config.orderBump?.applyInicialTo) setApplyInicialTo(config.orderBump.applyInicialTo)
  // Carregar configuracao de Packs
  if (typeof config.packs === 'object' && config.packs !== null && 'enabled' in config.packs) {
    setPacksEnabled(config.packs.enabled || false)
    setPacksButtonText(config.packs.buttonText || "Packs Disponiveis")
    setPacksList(config.packs.list || [])
  } else {
    // Compatibilidade com formato antigo
    setPacks(Array.isArray(config.packs) ? config.packs : [])
  }
  setPaymentGateway(config.payments?.gateway || "")
    setPixKey(config.payments?.pix_key || "")
    setSubscriptionEnabled(config.subscription?.enabled || false)
    // Load subscription renewal settings
    if (config.subscription) {
      setRenewalDeliveryEnabled(config.subscription.renewalDeliveryEnabled || false)
      setRenewalDeliverableId(config.subscription.renewalDeliverableId || "")
      setNotifyBeforeExpireEnabled(config.subscription.notifyBeforeExpireEnabled !== false)
      if (config.subscription.daysBeforeExpire) setDaysBeforeExpire(config.subscription.daysBeforeExpire)
      setRenewalMediaType(config.subscription.renewalMediaType || "none")
      setRenewalMediaUrl(config.subscription.renewalMediaUrl || "")
      if (config.subscription.renewalMessage) setRenewalMessage(config.subscription.renewalMessage)
      setNotifyOnDayEnabled(config.subscription.notifyOnDayEnabled !== false)
      setNotificationCount(config.subscription.notificationCount || "3")
      if (config.subscription.selectedHours) setSelectedHours(config.subscription.selectedHours)
      setExpireMessageEnabled(config.subscription.expireMessageEnabled !== false)
      setExpireMediaType(config.subscription.expireMediaType || "none")
      setExpireMediaUrl(config.subscription.expireMediaUrl || "")
      if (config.subscription.expireMessage) setExpireMessage(config.subscription.expireMessage)
      setUseFlowPlans(config.subscription.useFlowPlans !== false)
      setRenewalDiscount(config.subscription.renewalDiscount || "20%")
      setKickFromGroup(config.subscription.kickFromGroup !== false)
      setRemoveVipStatus(config.subscription.removeVipStatus !== false)
    }
    setSecondaryMessageEnabled(config.secondaryMessage?.enabled || false)
    setSecondaryMessage(config.secondaryMessage?.message || "")
    setWelcomeMedias(config.welcomeMedias || [])
    setCtaButtonEnabled(config.ctaButtonEnabled !== false) // default true (mostra botao)
    setCtaButtonText(config.ctaButtonText || "Ver Planos")
setRedirectButtonEnabled(config.redirectButton?.enabled || false)
  setRedirectButtonText(config.redirectButton?.text || "")
  setRedirectButtonUrl(config.redirectButton?.url || "")
  
  // Load delivery config
  if (config.delivery) {
    setDeliveryType(config.delivery.type || null)
    setDeliveryMedias(config.delivery.medias || [])
    setDeliveryLink(config.delivery.link || "")
    setDeliveryLinkText(config.delivery.linkText || "Acessar Conteudo")
    setVipGroupId(config.delivery.vipGroupId || "")
    setVipGroupName(config.delivery.vipGroupName || "")
    setVipAutoAdd(config.delivery.vipAutoAdd !== false)
    setVipAutoRemoveOnExpire(config.delivery.vipAutoRemoveOnExpire !== false)
    if (config.delivery.type) {
      setShowDeliveryConfig(true)
    }
  }

  // Load payment messages config
  if (config.paymentMessages) {
    setPixGeneratedMessage(config.paymentMessages.pixGeneratedMessage || pixGeneratedMessage)
    setMessageBeforeCode(config.paymentMessages.messageBeforeCode || messageBeforeCode)
    setShowPlanBeforePix(config.paymentMessages.showPlanBeforePix || false)
    setQrCodeDisplay(config.paymentMessages.qrCodeDisplay || "image")
    setPixCodeFormat(config.paymentMessages.pixCodeFormat || "monospace")
    setShowCopyButton(config.paymentMessages.showCopyButton === true)
    setVerifyStatusButtonText(config.paymentMessages.verifyStatusButtonText || "Verificar Status")
    setApprovedMessage(config.paymentMessages.approvedMessage || approvedMessage)
    setApprovedMedias(config.paymentMessages.approvedMedias || [])
    setAccessButtonText(config.paymentMessages.accessButtonText || "Acessar Conteudo")
    setAccessButtonUrl(config.paymentMessages.accessButtonUrl || "")
  }

    setIsLoading(false)
  }, [flowId, session?.userId, router, isAuthLoading])

  // Fetch flow bots - using correct column names from bots table
  const fetchFlowBots = useCallback(async () => {
    if (!flowId) return

    const { data, error } = await supabase
      .from("flow_bots")
      .select(`
        id,
        flow_id,
        bot_id,
        created_at,
        bots:bot_id (
          id,
          name,
          token,
          status
        )
      `)
      .eq("flow_id", flowId)

    if (data) {
      // Map to expected FlowBot format
      const mapped = data.map((fb: any) => ({
        id: fb.id,
        flow_id: fb.flow_id,
        bot_id: fb.bot_id,
        linked_at: fb.created_at, // Data que o bot foi vinculado ao fluxo
        bot: fb.bots ? {
          id: fb.bots.id,
          username: fb.bots.name,
          first_name: fb.bots.name,
          photo_url: null
        } : null
      }))
      setFlowBots(mapped)
    }
  }, [flowId])

  // Fetch available bots (bots that are not linked to ANY flow)
  const fetchAvailableBots = useCallback(async () => {
    if (!session?.userId) return

    setIsLoadingBots(true)
    
    // Get user's bots - using correct column names from bots table
    const { data: userBotsData, error: botsError } = await supabase
      .from("bots")
      .select("id, name, token, status")
      .eq("user_id", session.userId)

    if (!userBotsData || userBotsData.length === 0) {
      setAvailableBots([])
      setIsLoadingBots(false)
      return
    }
    
    // Get ALL bots linked to ANY flow (from flow_bots table)
    const { data: allLinkedBots } = await supabase
      .from("flow_bots")
      .select("bot_id")
    
    const linkedBotIds = new Set((allLinkedBots || []).map(fb => fb.bot_id))
    
    // Also check bots linked via bot_id column in flows table
    const { data: flowsWithBots } = await supabase
      .from("flows")
      .select("bot_id")
      .not("bot_id", "is", null)
    
    if (flowsWithBots) {
      flowsWithBots.forEach(f => {
        if (f.bot_id) linkedBotIds.add(f.bot_id)
      })
    }
    
    // Filter: exclude bots already linked to ANY flow
    // Map to AvailableBot format
    const available = userBotsData
      .filter(b => !linkedBotIds.has(b.id))
      .map(b => ({
        id: b.id,
        username: b.name,
        first_name: b.name,
        photo_url: null
      }))
    
    setAvailableBots(available)
    setIsLoadingBots(false)
  }, [session?.userId])

  useEffect(() => {
    if (!isAuthLoading && session?.userId) {
      fetchFlow()
      fetchFlowBots()
    }
  }, [fetchFlow, fetchFlowBots, isAuthLoading, session?.userId])
  
  // Fetch conversions (approved payments) for all bots in this flow
  const fetchConversions = useCallback(async () => {
    if (flowBots.length === 0) {
      setConversionsData({ payments: [], stats: { total: 0, totalAmount: 0 } })
      return
    }
    
    setLoadingConversions(true)
    
    try {
      const allPayments: Array<{
        id: string
        amount: number
        status: string
        payer_name: string
        payer_email: string
        created_at: string
        bot_name?: string
      }> = []
      
      // Fetch payments for each bot connected to this flow
      for (const fb of flowBots) {
        const res = await fetch(`/api/payments/list?botId=${fb.bot_id}&limit=100`)
        const data = await res.json()
        
        if (data?.payments) {
          // Filter only approved payments and add bot info
          const approvedPayments = data.payments
            .filter((p: { status: string }) => p.status === "approved")
            .map((p: { id: string; amount: number; status: string; payer_name: string; payer_email: string; created_at: string }) => ({
              ...p,
              bot_name: fb.bot_username || fb.bot_name || "Bot"
            }))
          allPayments.push(...approvedPayments)
        }
      }
      
      // Filter by period
      const now = new Date()
      const filteredPayments = allPayments.filter(p => {
        const paymentDate = new Date(p.created_at)
        switch (conversionsPeriod) {
          case "today":
            return paymentDate.toDateString() === now.toDateString()
          case "7days":
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            return paymentDate >= sevenDaysAgo
          case "30days":
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            return paymentDate >= thirtyDaysAgo
          default:
            return true
        }
      })
      
      // Sort by date descending
      filteredPayments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      
      const totalAmount = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0)
      
      setConversionsData({
        payments: filteredPayments,
        stats: {
          total: filteredPayments.length,
          totalAmount
        }
      })
    } catch (error) {
      console.error("Error fetching conversions:", error)
    } finally {
      setLoadingConversions(false)
    }
  }, [flowBots, conversionsPeriod])
  
  // Reload conversions when period or bots change
  useEffect(() => {
    if (flowBots.length > 0) {
      fetchConversions()
    }
  }, [flowBots, conversionsPeriod, fetchConversions])

  // Fetch flow stats (leads, vips, revenue) from all bots in this flow
  // IMPORTANTE: Só conta dados a partir da data que o bot foi vinculado ao fluxo
  const fetchFlowStats = useCallback(async () => {
    if (flowBots.length === 0) {
      setStats({ leads: 0, vips: 0, revenue: 0 })
      return
    }
    
    setLoadingStats(true)
    
    try {
      // Buscar usuarios unicos (leads) e pagamentos de todos os bots do fluxo
      let totalLeads = 0
      let totalVips = 0
      let totalRevenue = 0
      const uniqueLeadIds = new Set<string>()
      const uniqueVipIds = new Set<string>()
      
      for (const flowBot of flowBots) {
        const botId = flowBot.bot_id
        // Data que o bot foi vinculado ao fluxo - so conta dados a partir dessa data
        const linkedAt = (flowBot as any).linked_at
        const sinceParam = linkedAt ? `&since=${encodeURIComponent(linkedAt)}` : ""
        
        // Buscar usuarios do bot (leads = quem deu start) - filtra por data de vinculacao
        const usersRes = await fetch(`/api/bots/${botId}/users?${sinceParam ? sinceParam.substring(1) : ""}`)
        const usersData = await usersRes.json()
        
        if (usersData?.users) {
          // Adicionar telegram_user_id ao set para contar unicos
          // Filtra tambem no frontend por seguranca
          usersData.users.forEach((u: { telegram_user_id: string; payment_status?: string; created_at?: string }) => {
            // Se linkedAt existe, verifica se o usuario foi criado depois
            if (linkedAt && u.created_at) {
              const userDate = new Date(u.created_at)
              const linkDate = new Date(linkedAt)
              if (userDate < linkDate) return // Ignora usuarios anteriores ao vinculo
            }
            
            uniqueLeadIds.add(u.telegram_user_id)
            // VIPs = quem pagou pelo menos uma vez
            if (u.payment_status === "paid" || u.payment_status === "approved") {
              uniqueVipIds.add(u.telegram_user_id)
            }
          })
        }
        
        // Buscar pagamentos aprovados do bot (receita) - filtra por data de vinculacao
        const paymentsRes = await fetch(`/api/payments/list?botId=${botId}&limit=1000${sinceParam}`)
        const paymentsData = await paymentsRes.json()
        
        if (paymentsData?.payments) {
          paymentsData.payments.forEach((p: { status: string; amount: number; telegram_user_id?: string; created_at?: string }) => {
            // Se linkedAt existe, verifica se o pagamento foi criado depois
            if (linkedAt && p.created_at) {
              const paymentDate = new Date(p.created_at)
              const linkDate = new Date(linkedAt)
              if (paymentDate < linkDate) return // Ignora pagamentos anteriores ao vinculo
            }
            
            if (p.status === "approved" || p.status === "paid") {
              totalRevenue += Number(p.amount) || 0
              // Tambem adicionar ao VIPs pelo pagamento
              if (p.telegram_user_id) {
                uniqueVipIds.add(p.telegram_user_id)
              }
            }
          })
        }
      }
      
      totalLeads = uniqueLeadIds.size
      totalVips = uniqueVipIds.size
      
      setStats({
        leads: totalLeads,
        vips: totalVips,
        revenue: totalRevenue
      })
    } catch (error) {
      console.error("Error fetching flow stats:", error)
    } finally {
      setLoadingStats(false)
    }
  }, [flowBots])
  
  // Reload stats when bots change
  useEffect(() => {
    fetchFlowStats()
  }, [flowBots, fetchFlowStats])

  // Adjust selected hours when notification count changes
  useEffect(() => {
    const maxHours = parseInt(notificationCount)
    if (selectedHours.length > maxHours) {
      setSelectedHours(selectedHours.slice(0, maxHours))
    }
  }, [notificationCount, selectedHours])

  // Save flow
  const handleSave = async () => {
    if (!flow) {
      alert("Erro: Flow nao carregado")
      return
    }

    setIsSaving(true)

    console.log("[v0] SALVANDO Order Bump Inicial:", JSON.stringify(orderBumpInicial, null, 2))

    const config: FlowConfig = {
      welcomeMessage: welcomeMessage,
      welcomeMedias: welcomeMedias,
      ctaButtonEnabled: ctaButtonEnabled,
      ctaButtonText: ctaButtonText,
      redirectButton: {
        enabled: redirectButtonEnabled,
        text: redirectButtonText,
        url: redirectButtonUrl,
      },
      secondaryMessage: {
        enabled: secondaryMessageEnabled,
        message: secondaryMessage,
      },
plans,
  showPriceInButton,
  upsell: {
  enabled: upsellEnabled,
  message: upsellMessage,
  sequences: upsellSequences,
  },
  downsell: {
  enabled: downsellEnabled,
  message: downsellMessage,
  sequences: downsellSequences,
  deliveryType: downsellDeliveryType,
  },
      downsellPix: {
        enabled: downsellPixEnabled,
        sequences: downsellPixSequences,
        deliveryType: downsellPixDeliveryType,
      },
      orderBump: {
        enabled: orderBumpEnabled,
        name: orderBumpName,
        price: parseFloat(orderBumpPrice) || 0,
        inicial: orderBumpInicial,
        upsell: orderBumpUpsell,
        downsell: orderBumpDownsell,
        packs: orderBumpPacks,
        applyInicialTo,
      },
      packs: {
        enabled: packsEnabled,
        buttonText: packsButtonText,
        list: packsList,
      },
      payments: {
        gateway: paymentGateway,
        pix_key: pixKey,
      },
      subscription: {
        enabled: subscriptionEnabled,
        renewalDeliveryEnabled,
        renewalDeliverableId,
        notifyBeforeExpireEnabled,
        daysBeforeExpire,
        renewalMediaType,
        renewalMediaUrl,
        renewalMessage,
        notifyOnDayEnabled,
        notificationCount,
        selectedHours,
        expireMessageEnabled,
        expireMediaType,
        expireMediaUrl,
        expireMessage,
        useFlowPlans,
        renewalDiscount,
        kickFromGroup,
        removeVipStatus,
      },
      delivery: {
        type: deliveryType,
        medias: deliveryMedias,
        link: deliveryLink,
        linkText: deliveryLinkText,
        vipGroupId: vipGroupId,
        vipGroupName: vipGroupName,
        vipAutoAdd: vipAutoAdd,
        vipAutoRemoveOnExpire: vipAutoRemoveOnExpire,
      },
      // Entregaveis
      deliverables,
      mainDeliverableId,
      // Payment Messages
      paymentMessages: {
        pixGeneratedMessage,
        messageBeforeCode,
        showPlanBeforePix,
        qrCodeDisplay,
        pixCodeFormat,
        showCopyButton,
        verifyStatusButtonText,
        approvedMessage,
        approvedMedias,
        accessButtonText,
        accessButtonUrl,
      },
    }

    const updatePayload = {
      name: editName,
      welcome_message: welcomeMessage,
      media_cache_chat_id: mediaCacheChat && mediaCacheChat.trim() ? mediaCacheChat.trim() : null,
      support_username: supportUsername || null,
      config,
      updated_at: new Date().toISOString(),
    }

    console.log("[v0] Update payload orderBump:", JSON.stringify(updatePayload.config.orderBump, null, 2))
    console.log("[v0] SALVANDO ENTREGAVEIS:")
    console.log("[v0]   mainDeliverableId:", mainDeliverableId)
    console.log("[v0]   deliverables count:", deliverables.length)
    if (deliverables.length > 0) {
      deliverables.forEach((del, i) => {
        console.log(`[v0]   [${i}] ID: ${del.id}, Nome: ${del.name}, Tipo: ${del.type}`)
        if (del.type === "vip_group") {
          console.log(`[v0]       vipGroupChatId: ${del.vipGroupChatId}`)
          console.log(`[v0]       vipGroupName: ${del.vipGroupName}`)
        }
        if (del.type === "media") {
          console.log(`[v0]       medias: ${del.medias?.length || 0} arquivos`)
        }
        if (del.type === "link") {
          console.log(`[v0]       link: ${del.link}`)
        }
      })
    }

    const { data, error } = await supabase
      .from("flows")
      .update(updatePayload)
      .eq("id", flow.id)
      .select()

    console.log("[v0] Supabase update result - data:", data, "error:", error)

    if (error) {
      console.log("[v0] ERRO ao salvar:", error.message)
      toast({
        title: "Erro",
        description: `Nao foi possivel salvar: ${error.message}`,
        variant: "destructive",
      })
    } else if (!data || data.length === 0) {
      console.log("[v0] ERRO: Nenhuma linha atualizada")
      toast({
        title: "Erro",
        description: "Nenhuma linha foi atualizada",
        variant: "destructive",
      })
    } else {
      console.log("[v0] SUCESSO! Dados salvos:", JSON.stringify(data[0]?.config?.orderBump, null, 2))
      setHasChanges(false)
      setChangeCount(0)
      // Mostrar notificacao de sucesso
      setShowSavedNotification(true)
      setTimeout(() => setShowSavedNotification(false), 3000)
    }

    setIsSaving(false)
  }

  // Create bot inline and add to flow
  const handleCreateBotInline = async () => {
    if (!newBotToken.trim()) {
      toast({ title: "Erro", description: "Digite o token do bot", variant: "destructive" })
      return
    }

    setIsCreatingBot(true)

    try {
      // Validate token with Telegram API
      const response = await fetch(`https://api.telegram.org/bot${newBotToken.trim()}/getMe`)
      const result = await response.json()

      if (!result.ok) {
        toast({ title: "Token invalido", description: "Verifique o token e tente novamente", variant: "destructive" })
        setIsCreatingBot(false)
        return
      }

      const botInfo = result.result
      
      // Create bot using context
      const newBot = await addBot({
        name: botInfo.first_name || "Bot",
        token: newBotToken.trim(),
      })
      
      // Link to this flow - registra created_at para filtrar stats corretamente
      const { error } = await supabase
        .from("flow_bots")
        .insert({
          flow_id: flowId,
          bot_id: newBot.id,
          created_at: new Date().toISOString(),
        })

      if (error) {
        toast({ title: "Erro", description: "Bot criado mas nao foi possivel vincular ao fluxo", variant: "destructive" })
      } else {
        toast({ title: "Sucesso!", description: "Bot criado e vinculado ao fluxo" })
        setNewBotToken("")
        setShowCreateBotForm(false)
        fetchFlowBots()
        refreshBots()
      }
    } catch {
      toast({ title: "Erro", description: "Erro ao criar bot", variant: "destructive" })
    }

    setIsCreatingBot(false)
  }

  // Add existing bot to flow
  const handleAddBot = async () => {
    if (!selectedBotToAdd || !flowId) return

    // Check max 5 bots
    if (flowBots.length >= 5) {
      toast({
        title: "Limite atingido",
        description: "Maximo de 5 bots por fluxo",
        variant: "destructive",
      })
      return
    }

    // Registra created_at para filtrar stats corretamente (so conta dados a partir dessa data)
    const { data, error } = await supabase
      .from("flow_bots")
      .insert({
        flow_id: flowId,
        bot_id: selectedBotToAdd,
        created_at: new Date().toISOString(),
      })
      .select()

    if (error) {
      toast({
        title: "Erro",
        description: error.message || "Nao foi possivel adicionar o bot",
        variant: "destructive",
      })
    } else {
      toast({ title: "Bot vinculado!" })
      setShowAddBotDialog(false)
      setSelectedBotToAdd("")
      fetchFlowBots()
      fetchAvailableBots()
    }
  }

  // Remove bot from flow
  const handleRemoveBot = async (flowBotId: string) => {
    const { error } = await supabase
      .from("flow_bots")
      .delete()
      .eq("id", flowBotId)

    if (error) {
      console.error("[v0] Error removing bot:", error)
    } else {
      fetchFlowBots()
    }
  }

  // Refresh telegram chats
  const handleRefreshChats = async () => {
    setIsLoadingChats(true)
    // TODO: Implement telegram chat fetching
    setTimeout(() => {
      setTelegramChats([])
      setIsLoadingChats(false)
    }, 1000)
  }

  // Test VIP Group - verifica se o bot e admin e pode criar links
  const handleTestVipGroup = async () => {
    if (!tempDeliverable.vipGroupChatId) {
      setVipTestResult({ success: false, message: "Digite o Chat ID do grupo" })
      return
    }

    // Pegar o token do primeiro bot do fluxo
    if (flowBots.length === 0) {
      setVipTestResult({ success: false, message: "Nenhum bot vinculado ao fluxo. Adicione um bot primeiro." })
      return
    }

    setIsTestingVipGroup(true)
    setVipTestResult(null)

    try {
      // Buscar o token do bot
      const { data: bot, error: botError } = await supabase
        .from("bots")
        .select("token, username")
        .eq("id", flowBots[0].bot_id)
        .single()

      if (botError || !bot?.token) {
        setVipTestResult({ success: false, message: "Erro ao buscar token do bot" })
        setIsTestingVipGroup(false)
        return
      }

      // Verificar se o bot e admin do grupo
      const chatInfoRes = await fetch(`https://api.telegram.org/bot${bot.token}/getChat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: tempDeliverable.vipGroupChatId }),
      })
      const chatInfo = await chatInfoRes.json()

      if (!chatInfo.ok) {
        setVipTestResult({ 
          success: false, 
          message: `Grupo nao encontrado: ${chatInfo.description || "Verifique o Chat ID"}` 
        })
        setIsTestingVipGroup(false)
        return
      }

      // Verificar permissoes do bot
      const memberRes = await fetch(`https://api.telegram.org/bot${bot.token}/getChatMember`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          chat_id: tempDeliverable.vipGroupChatId,
          user_id: bot.token.split(":")[0] // Bot ID e a primeira parte do token
        }),
      })
      const memberInfo = await memberRes.json()

      if (!memberInfo.ok) {
        setVipTestResult({ 
          success: false, 
          message: `Bot nao esta no grupo. Adicione @${bot.username || "o bot"} ao grupo como admin.` 
        })
        setIsTestingVipGroup(false)
        return
      }

      const status = memberInfo.result?.status
      const canInvite = memberInfo.result?.can_invite_users

      if (status !== "administrator" && status !== "creator") {
        setVipTestResult({ 
          success: false, 
          message: `Bot precisa ser ADMIN do grupo. Status atual: ${status}` 
        })
        setIsTestingVipGroup(false)
        return
      }

      if (!canInvite && status !== "creator") {
        setVipTestResult({ 
          success: false, 
          message: "Bot nao tem permissao para convidar usuarios. Ative a permissao 'Invite Users via Link' nas configs do admin." 
        })
        setIsTestingVipGroup(false)
        return
      }

      // Tentar criar um link de convite de teste
      const inviteRes = await fetch(`https://api.telegram.org/bot${bot.token}/createChatInviteLink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: tempDeliverable.vipGroupChatId,
          name: `Teste - ${Date.now()}`,
          member_limit: 1,
          expire_date: Math.floor(Date.now() / 1000) + 60, // Expira em 1 minuto
        }),
      })
      const inviteData = await inviteRes.json()

      if (!inviteData.ok) {
        setVipTestResult({ 
          success: false, 
          message: `Erro ao criar link: ${inviteData.description}` 
        })
        setIsTestingVipGroup(false)
        return
      }

      // Revogar o link de teste
      await fetch(`https://api.telegram.org/bot${bot.token}/revokeChatInviteLink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: tempDeliverable.vipGroupChatId,
          invite_link: inviteData.result.invite_link,
        }),
      })

      // Salvar o nome do grupo se nao tiver
      if (!tempDeliverable.vipGroupName && chatInfo.result?.title) {
        setTempDeliverable({ ...tempDeliverable, vipGroupName: chatInfo.result.title })
      }

      setVipTestResult({ 
        success: true, 
        message: `Tudo certo! Grupo "${chatInfo.result?.title}" configurado. Bot e admin e pode criar links.` 
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido"
      setVipTestResult({ success: false, message: `Erro: ${errorMessage}` })
    } finally {
      setIsTestingVipGroup(false)
    }
  }

  // Add plan
  const handleAddPlan = () => {
  const newPlanId = crypto.randomUUID()
  setPlans([
  ...plans,
  {
      id: newPlanId,
      name: "",
      price: 0,
      duration_days: 30,
      duration_type: "monthly",
  active: true,
  delivery_type: "default",
  order_bump_custom: false,
  order_bump_name: "",
  order_bump_price: 0,
  order_bump_description: "",
  order_bumps: [], // Array de order bumps (ate 5)
        order_bump_accept_text: "QUERO",
        order_bump_reject_text: "NAO QUERO",
        order_bump_cta_message: "",
        order_bump_delivery: "same",
        order_bump_medias: [],
      },
    ])
    setExpandedPlan(newPlanId)
    markChange()
  }

  // Remove plan
  const handleRemovePlan = (id: string) => {
    setPlans(plans.filter(p => p.id !== id))
    markChange()
  }

// Update plan
  const handleUpdatePlan = (id: string, field: keyof FlowPlan, value: FlowPlan[keyof FlowPlan]) => {
  setPlans(prevPlans => prevPlans.map(p => p.id === id ? { ...p, [field]: value } : p))
  markChange()
  }

  // Add upsell sequence (mesma estrutura do downsell)
  const handleAddUpsellSequence = () => {
  if (upsellSequences.length >= 20) return
  const newSequence: UpsellSequence = {
  id: `up-seq-${Date.now()}`,
  message: "",
  medias: [],
  sendTiming: "custom",
  sendDelayValue: 1,
  sendDelayUnit: "minutes",
      plans: [{ id: `plan-${Date.now()}`, buttonText: "Plano 1", price: 0, duration_days: 30, duration_type: "monthly" }],
  useDefaultPlans: true,
  discountPercent: 20,
  deliveryType: "global",
  }
  setUpsellSequences([...upsellSequences, newSequence])
  setExpandedSequence(newSequence.id)
  markChange()
  }

// Add plan to upsell sequence
const handleAddUpsellPlan = (seqId: string) => {
  const seq = upsellSequences.find(s => s.id === seqId)
  if (!seq || (seq.plans?.length || 0) >= 5) return
  const newPlan: UpsellPlan = {
  id: `plan-${Date.now()}`,
    buttonText: `Plano ${(seq.plans?.length || 0) + 1}`,
    price: 0,
    duration_days: 30,
    duration_type: "monthly"
    }
    handleUpdateUpsellSequence(seqId, "plans", [...(seq.plans || []), newPlan])
  }

  // Remove plan from upsell sequence
  const handleRemoveUpsellPlan = (seqId: string, planId: string) => {
    const seq = upsellSequences.find(s => s.id === seqId)
    if (!seq) return
    handleUpdateUpsellSequence(seqId, "plans", (seq.plans || []).filter(p => p.id !== planId))
  }

  // Update plan in upsell sequence
  const handleUpdateUpsellPlan = (seqId: string, planId: string, field: keyof UpsellPlan, value: string | number) => {
    const seq = upsellSequences.find(s => s.id === seqId)
    if (!seq) return
    const updatedPlans = (seq.plans || []).map(p => p.id === planId ? { ...p, [field]: value } : p)
    handleUpdateUpsellSequence(seqId, "plans", updatedPlans)
  }
  
  // Update multiple fields in a plan in upsell sequence (para evitar race conditions)
  const handleUpdateUpsellPlanMulti = (seqId: string, planId: string, updates: Partial<UpsellPlan>) => {
    const seq = upsellSequences.find(s => s.id === seqId)
    if (!seq) return
    const updatedPlans = (seq.plans || []).map(p => p.id === planId ? { ...p, ...updates } : p)
    handleUpdateUpsellSequence(seqId, "plans", updatedPlans)
  }

  // Remove upsell sequence
  const handleRemoveUpsellSequence = (id: string) => {
    setUpsellSequences(upsellSequences.filter(s => s.id !== id))
    if (expandedSequence === id) setExpandedSequence(null)
    markChange()
  }

  // Update upsell sequence
  const handleUpdateUpsellSequence = (id: string, field: keyof UpsellSequence, value: unknown) => {
    setUpsellSequences(upsellSequences.map(s => s.id === id ? { ...s, [field]: value } : s))
    markChange()
  }

  // Duplicate upsell sequence
  const handleDuplicateUpsellSequence = (seq: UpsellSequence) => {
  if (upsellSequences.length >= 20) return
  const newSequence = { ...seq, id: `seq-${Date.now()}` }
  setUpsellSequences([...upsellSequences, newSequence])
  markChange()
  }

  // Upload media for upsell sequence
  const handleUploadUpsellMedia = async (seqId: string, file: File) => {
    if (!file || !flow) return
    
    const currentSeq = upsellSequences.find(s => s.id === seqId)
    if (!currentSeq || (currentSeq.medias?.length || 0) >= 3) {
      toast({
        title: "Limite atingido",
        description: "Maximo de 3 midias permitido",
        variant: "destructive",
      })
      return
    }

    setUploadingUpsellMedia(seqId)
    
    try {
      // Upload para Supabase Storage (igual boas-vindas)
      const fileExt = file.name.split('.').pop()
      const fileName = `${flow.id}/upsell_${seqId}_${Date.now()}.${fileExt}`
      
      const { data, error } = await supabase.storage
        .from('flow-medias')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })
      
      if (error) {
        console.error('Upload error:', error)
        toast({
          title: "Erro no upload",
          description: error.message,
          variant: "destructive",
        })
        return
      }
      
      // Pegar URL publica
      const { data: urlData } = supabase.storage
        .from('flow-medias')
        .getPublicUrl(fileName)

      // Adicionar a URL da midia ao array de midias
      const updatedMedias = [...(currentSeq.medias || []), urlData.publicUrl]
      handleUpdateUpsellSequence(seqId, "medias", updatedMedias)
    } catch (error) {
      console.error("Erro ao fazer upload:", error)
      toast({
        title: "Erro",
        description: "Falha ao fazer upload da midia",
        variant: "destructive",
      })
    } finally {
      setUploadingUpsellMedia(null)
    }
  }

  // Remove media from upsell sequence
  const handleRemoveUpsellMedia = (seqId: string, mediaIndex: number) => {
    const currentSeq = upsellSequences.find(s => s.id === seqId)
    if (!currentSeq) return
    
    const updatedMedias = (currentSeq.medias || []).filter((_, i) => i !== mediaIndex)
    handleUpdateUpsellSequence(seqId, "medias", updatedMedias)
  }
  
  // Add downsell sequence
  const handleAddDownsellSequence = () => {
  if (downsellSequences.length >= 20) return
  const newSequence: DownsellSequence = {
  id: `ds-seq-${Date.now()}`,
  message: "",
  medias: [],
  sendTiming: "custom",
  sendDelayValue: 1,
  sendDelayUnit: "minutes",
  plans: [],
  useDefaultPlans: true,
  discountPercent: 20,
  deliveryType: "global",
  }
  setDownsellSequences([...downsellSequences, newSequence])
  setExpandedDownsellSequence(newSequence.id)
  markChange()
  }

  // Add plan to downsell sequence
  const handleAddDownsellPlan = (seqId: string) => {
    const seq = downsellSequences.find(s => s.id === seqId)
    if (!seq || (seq.plans?.length || 0) >= 5) return
    const newPlan: DownsellPlan = {
      id: `plan-${Date.now()}`,
    buttonText: `Plano ${(seq.plans?.length || 0) + 1}`,
    price: 0,
    duration_days: 30,
    duration_type: "monthly"
    }
    handleUpdateDownsellSequence(seqId, "plans", [...(seq.plans || []), newPlan])
  }

  // Remove plan from downsell sequence
  const handleRemoveDownsellPlan = (seqId: string, planId: string) => {
    const seq = downsellSequences.find(s => s.id === seqId)
    if (!seq) return
    handleUpdateDownsellSequence(seqId, "plans", (seq.plans || []).filter(p => p.id !== planId))
  }

  // Update plan in downsell sequence
  const handleUpdateDownsellPlan = (seqId: string, planId: string, field: keyof DownsellPlan, value: string | number) => {
    const seq = downsellSequences.find(s => s.id === seqId)
    if (!seq) return
    const updatedPlans = (seq.plans || []).map(p => p.id === planId ? { ...p, [field]: value } : p)
    handleUpdateDownsellSequence(seqId, "plans", updatedPlans)
  }
  
  // Update multiple fields in a plan in downsell sequence (para evitar race conditions)
  const handleUpdateDownsellPlanMulti = (seqId: string, planId: string, updates: Partial<DownsellPlan>) => {
    const seq = downsellSequences.find(s => s.id === seqId)
    if (!seq) return
    const updatedPlans = (seq.plans || []).map(p => p.id === planId ? { ...p, ...updates } : p)
    handleUpdateDownsellSequence(seqId, "plans", updatedPlans)
  }

  // Remove downsell sequence
  const handleRemoveDownsellSequence = (id: string) => {
    setDownsellSequences(downsellSequences.filter(s => s.id !== id))
    if (expandedDownsellSequence === id) setExpandedDownsellSequence(null)
    markChange()
  }

  // Update downsell sequence
  const handleUpdateDownsellSequence = (id: string, field: keyof DownsellSequence, value: unknown) => {
    setDownsellSequences(downsellSequences.map(s => s.id === id ? { ...s, [field]: value } : s))
    markChange()
  }

  // Duplicate downsell sequence
  const handleDuplicateDownsellSequence = (seq: DownsellSequence) => {
  if (downsellSequences.length >= 20) return
  const newSequence = { ...seq, id: `ds-seq-${Date.now()}` }
  setDownsellSequences([...downsellSequences, newSequence])
  markChange()
  }

  // Upload media for downsell sequence
  const handleUploadDownsellMedia = async (seqId: string, file: File) => {
    if (!file || !flow) return
    
    const currentSeq = downsellSequences.find(s => s.id === seqId)
    if (!currentSeq || (currentSeq.medias?.length || 0) >= 3) {
      toast({
        title: "Limite atingido",
        description: "Maximo de 3 midias permitido",
        variant: "destructive",
      })
      return
    }

    setUploadingDownsellMedia(seqId)
    
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${flow.id}/downsell_${seqId}_${Date.now()}.${fileExt}`
      
      const { error } = await supabase.storage
        .from('flow-medias')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })
      
      if (error) {
        toast({
          title: "Erro no upload",
          description: error.message,
          variant: "destructive",
        })
        return
      }
      
      const { data: urlData } = supabase.storage
        .from('flow-medias')
        .getPublicUrl(fileName)

      const updatedMedias = [...(currentSeq.medias || []), urlData.publicUrl]
      handleUpdateDownsellSequence(seqId, "medias", updatedMedias)
    } catch (error) {
      console.error("Erro ao fazer upload:", error)
      toast({
        title: "Erro",
        description: "Falha ao fazer upload da midia",
        variant: "destructive",
      })
    } finally {
      setUploadingDownsellMedia(null)
    }
  }

  // Remove media from downsell sequence
  const handleRemoveDownsellMedia = (seqId: string, mediaIndex: number) => {
    const currentSeq = downsellSequences.find(s => s.id === seqId)
    if (!currentSeq) return
    
    const updatedMedias = (currentSeq.medias || []).filter((_, i) => i !== mediaIndex)
    handleUpdateDownsellSequence(seqId, "medias", updatedMedias)
  }

  // ========== DOWNSELL PIX GERADO ==========
  
// Add downsell PIX sequence
  const handleAddDownsellPixSequence = () => {
  if (downsellPixSequences.length >= 20) return
  const newSequence: DownsellPixSequence = {
  id: `dspix-seq-${Date.now()}`,
  message: "",
  medias: [],
  sendTiming: "custom",
  sendDelayValue: 5,
  sendDelayUnit: "minutes",
  plans: [],
  useDefaultPlans: true,
  discountPercent: 20,
  deliveryType: "global",
  }
  setDownsellPixSequences([...downsellPixSequences, newSequence])
  setExpandedDownsellPixSequence(newSequence.id)
  markChange()
  }

// Add plan to downsell PIX sequence
  const handleAddDownsellPixPlan = (seqId: string) => {
  const seq = downsellPixSequences.find(s => s.id === seqId)
  if (!seq || (seq.plans?.length || 0) >= 5) return
  const newPlan: DownsellPlan = {
  id: `plan-${Date.now()}`,
    buttonText: `Plano ${(seq.plans?.length || 0) + 1}`,
    price: 0,
    duration_days: 30,
    duration_type: "monthly"
    }
    handleUpdateDownsellPixSequence(seqId, "plans", [...(seq.plans || []), newPlan])
  }

  // Remove plan from downsell PIX sequence
  const handleRemoveDownsellPixPlan = (seqId: string, planId: string) => {
    const seq = downsellPixSequences.find(s => s.id === seqId)
    if (!seq) return
    handleUpdateDownsellPixSequence(seqId, "plans", (seq.plans || []).filter(p => p.id !== planId))
  }

  // Update plan in downsell PIX sequence
  const handleUpdateDownsellPixPlan = (seqId: string, planId: string, field: keyof DownsellPlan, value: string | number) => {
    const seq = downsellPixSequences.find(s => s.id === seqId)
    if (!seq) return
    const updatedPlans = (seq.plans || []).map(p => p.id === planId ? { ...p, [field]: value } : p)
    handleUpdateDownsellPixSequence(seqId, "plans", updatedPlans)
  }
  
  // Update multiple fields in a plan in downsell PIX sequence (para evitar race conditions)
  const handleUpdateDownsellPixPlanMulti = (seqId: string, planId: string, updates: Partial<DownsellPlan>) => {
    const seq = downsellPixSequences.find(s => s.id === seqId)
    if (!seq) return
    const updatedPlans = (seq.plans || []).map(p => p.id === planId ? { ...p, ...updates } : p)
    handleUpdateDownsellPixSequence(seqId, "plans", updatedPlans)
  }

  // Remove downsell PIX sequence
  const handleRemoveDownsellPixSequence = (id: string) => {
    setDownsellPixSequences(downsellPixSequences.filter(s => s.id !== id))
    if (expandedDownsellPixSequence === id) setExpandedDownsellPixSequence(null)
    markChange()
  }

  // Update downsell PIX sequence
  const handleUpdateDownsellPixSequence = (id: string, field: keyof DownsellPixSequence, value: unknown) => {
    setDownsellPixSequences(downsellPixSequences.map(s => s.id === id ? { ...s, [field]: value } : s))
    markChange()
  }

  // Duplicate downsell PIX sequence
  const handleDuplicateDownsellPixSequence = (seq: DownsellPixSequence) => {
    if (downsellPixSequences.length >= 20) return
    const newSequence = { ...seq, id: `dspix-seq-${Date.now()}` }
    setDownsellPixSequences([...downsellPixSequences, newSequence])
    markChange()
  }

  // Upload media for downsell PIX sequence
  const handleUploadDownsellPixMedia = async (seqId: string, file: File) => {
    if (!file || !flow) return
    
    const currentSeq = downsellPixSequences.find(s => s.id === seqId)
    if (!currentSeq || (currentSeq.medias?.length || 0) >= 3) {
      toast({
        title: "Limite atingido",
        description: "Maximo de 3 midias permitido",
        variant: "destructive",
      })
      return
    }

    setUploadingDownsellPixMedia(seqId)
    
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${flow.id}/downsellpix_${seqId}_${Date.now()}.${fileExt}`
      
      const { error } = await supabase.storage
        .from('flow-medias')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })
      
      if (error) {
        toast({
          title: "Erro no upload",
          description: error.message,
          variant: "destructive",
        })
        return
      }
      
      const { data: urlData } = supabase.storage
        .from('flow-medias')
        .getPublicUrl(fileName)

      const updatedMedias = [...(currentSeq.medias || []), urlData.publicUrl]
      handleUpdateDownsellPixSequence(seqId, "medias", updatedMedias)
    } catch (error) {
      console.error("Erro ao fazer upload:", error)
      toast({
        title: "Erro",
        description: "Falha ao fazer upload da midia",
        variant: "destructive",
      })
    } finally {
      setUploadingDownsellPixMedia(null)
    }
  }

  // Remove media from downsell PIX sequence
  const handleRemoveDownsellPixMedia = (seqId: string, mediaIndex: number) => {
    const currentSeq = downsellPixSequences.find(s => s.id === seqId)
    if (!currentSeq) return
    
    const updatedMedias = (currentSeq.medias || []).filter((_, i) => i !== mediaIndex)
    handleUpdateDownsellPixSequence(seqId, "medias", updatedMedias)
  }

  // Upload media for order bump (inicial, upsell, downsell, packs)
  const handleUploadOrderBumpMedia = async (bumpType: "inicial" | "upsell" | "downsell" | "packs", file: File) => {
    if (!file || !flow) return
    const getCurrentBump = () => {
      switch (bumpType) {
        case "inicial": return orderBumpInicial
        case "upsell": return orderBumpUpsell
        case "downsell": return orderBumpDownsell
        case "packs": return orderBumpPacks
      }
    }
    const currentBump = getCurrentBump()
    if ((currentBump.medias?.length || 0) >= 3) {
      toast({ title: "Limite atingido", description: "Maximo de 3 midias permitido", variant: "destructive" })
      return
    }
    setUploadingOrderBumpMedia(bumpType)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${flow.id}/orderbump_${bumpType}_${Date.now()}.${fileExt}`
      const { error } = await supabase.storage.from('flow-medias').upload(fileName, file, { cacheControl: '3600', upsert: false })
      if (error) { toast({ title: "Erro no upload", description: error.message, variant: "destructive" }); return }
      const { data: urlData } = supabase.storage.from('flow-medias').getPublicUrl(fileName)
      const updatedMedias = [...(currentBump.medias || []), urlData.publicUrl]
      switch (bumpType) {
        case "inicial": setOrderBumpInicial({ ...orderBumpInicial, medias: updatedMedias }); break
        case "upsell": setOrderBumpUpsell({ ...orderBumpUpsell, medias: updatedMedias }); break
        case "downsell": setOrderBumpDownsell({ ...orderBumpDownsell, medias: updatedMedias }); break
        case "packs": setOrderBumpPacks({ ...orderBumpPacks, medias: updatedMedias }); break
      }
      markChange()
    } catch { toast({ title: "Erro", description: "Falha ao fazer upload", variant: "destructive" }) }
    finally { setUploadingOrderBumpMedia(null) }
  }
  
  // Remove media from order bump
  const handleRemoveOrderBumpMedia = (bumpType: "inicial" | "upsell" | "downsell" | "packs", mediaIndex: number) => {
    switch (bumpType) {
      case "inicial": { const m = (orderBumpInicial.medias || []).filter((_, i) => i !== mediaIndex); setOrderBumpInicial({ ...orderBumpInicial, medias: m }); break }
      case "upsell": { const m = (orderBumpUpsell.medias || []).filter((_, i) => i !== mediaIndex); setOrderBumpUpsell({ ...orderBumpUpsell, medias: m }); break }
      case "downsell": { const m = (orderBumpDownsell.medias || []).filter((_, i) => i !== mediaIndex); setOrderBumpDownsell({ ...orderBumpDownsell, medias: m }); break }
      case "packs": { const m = (orderBumpPacks.medias || []).filter((_, i) => i !== mediaIndex); setOrderBumpPacks({ ...orderBumpPacks, medias: m }); break }
    }
    markChange()
  }


  
  // Add pack
  const handleAddPack = () => {
  if (packsList.length >= 20) return
  const newPack: Pack = {
  id: `pack-${Date.now()}`,
  emoji: "📦",
  name: "",
  price: 0,
  description: "",
  previewMedias: [],
  buttonText: "Comprar Pack",
  deliveryDestination: "",
  active: true,
  }
  setPacksList([...packsList, newPack])
  setExpandedPack(newPack.id)
  markChange()
  }

  // Remove pack
  const handleRemovePack = (id: string) => {
  setPacksList(packsList.filter(p => p.id !== id))
  if (expandedPack === id) setExpandedPack(null)
  markChange()
  }
  
  // Estado para upload de midia do pack
  const [uploadingPackMedia, setUploadingPackMedia] = useState<string | null>(null)
  
  // Upload media for pack
  const handleUploadPackMedia = async (packId: string, file: File) => {
    if (!file || !flow) return
    
    const currentPack = packsList.find(p => p.id === packId)
    if (!currentPack || (currentPack.previewMedias?.length || 0) >= 10) {
      toast({
        title: "Limite atingido",
        description: "Maximo de 10 midias por pack",
        variant: "destructive",
      })
      return
    }

    setUploadingPackMedia(packId)
    
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${flow.id}/pack_${packId}_${Date.now()}.${fileExt}`
      
      const { error } = await supabase.storage
        .from('flow-medias')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })
      
      if (error) {
        toast({
          title: "Erro no upload",
          description: error.message,
          variant: "destructive",
        })
        return
      }
      
      const { data: urlData } = supabase.storage
        .from('flow-medias')
        .getPublicUrl(fileName)

      const updatedMedias = [...(currentPack.previewMedias || []), urlData.publicUrl]
      handleUpdatePack(packId, "previewMedias", updatedMedias)
    } catch (error) {
      console.error("Erro ao fazer upload:", error)
      toast({
        title: "Erro",
        description: "Falha ao fazer upload da midia",
        variant: "destructive",
      })
    } finally {
      setUploadingPackMedia(null)
    }
  }

  // Remove media from pack
  const handleRemovePackMedia = (packId: string, mediaIndex: number) => {
    const currentPack = packsList.find(p => p.id === packId)
    if (!currentPack) return
    
    const updatedMedias = (currentPack.previewMedias || []).filter((_, i) => i !== mediaIndex)
    handleUpdatePack(packId, "previewMedias", updatedMedias)
  }

  // Update pack
  const handleUpdatePack = (id: string, field: keyof Pack, value: unknown) => {
    setPacksList(packsList.map(p => p.id === id ? { ...p, [field]: value } : p))
    markChange()
  }

  // Delete flow
  const handleDeleteFlow = async () => {
    if (!flow || !session?.userId) return

    setIsDeleting(true)
    try {
      // First delete flow_bots
      await supabase
        .from("flow_bots")
        .delete()
        .eq("flow_id", flow.id)

      // Delete the flow
      const { error } = await supabase
        .from("flows")
        .delete()
        .eq("id", flow.id)
        .eq("user_id", session.userId)

      if (error) throw error

      toast({ title: "Fluxo excluido com sucesso" })
      router.push("/fluxos")
    } catch (error: any) {
      console.error("[v0] Error deleting flow:", error)
      toast({ 
        title: "Erro ao excluir fluxo", 
        description: error.message, 
        variant: "destructive" 
      })
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  // Show loading while auth or bots are loading
  if (isAuthLoading || isBotsLoading || isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
      </div>
    )
  }

  if (!flow) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <p className="text-neutral-500">Fluxo nao encontrado</p>
      </div>
    )
  }

  // Tabs for basic/complete flows (normal editor)
  const basicTabs = [
    { id: "bots", label: "Bots", icon: Bot },
    { id: "welcome", label: "Boas-vindas", icon: MessageSquare, locked: false },
    { id: "plans", label: "Planos", icon: CreditCard, locked: false },
    { id: "upsell", label: "Upsell", icon: TrendingUp, locked: false },
    { id: "downsell", label: "Downsell", icon: TrendingDown, locked: false },
    { id: "orderbump", label: "Order Bump", icon: Package, locked: false },
    { id: "packs", label: "Packs", icon: Package, locked: false },
    { id: "payments", label: "Pagamentos", icon: Wallet, locked: false },
    { id: "subscription", label: "Assinatura", icon: Crown, locked: false },
    { id: "deliverables", label: "Entregaveis", icon: Gift, locked: false },
  ]

  // Tabs for n8n flows (visual flow builder)
  const n8nTabs = [
    { id: "n8n", label: "Editor de Fluxo", icon: Workflow, locked: false },
    { id: "bots", label: "Bots", icon: Bot },
  ]

  // Select tabs based on flow type
  const isN8nFlow = flow?.flow_type === "n8n"
  const tabs = isN8nFlow ? n8nTabs : basicTabs

  return (
    <div className="flex h-full flex-col bg-[#f5f5f7]">
      {/* Header - Clean White Design */}
      <div className="bg-white border-b border-neutral-200/80 sticky top-0 z-40">
        <div className="max-w-[1200px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <button 
                onClick={() => router.push("/fluxos")}
                className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 transition-colors text-sm font-semibold"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Fluxos</span>
              </button>

              <div className="h-5 w-px bg-neutral-200" />

              <div className="flex items-center gap-2">
                {isEditingName ? (
                  <Input
                    value={editName}
                    onChange={(e) => {
                      setEditName(e.target.value)
                      markChange()
                    }}
                    onBlur={() => setIsEditingName(false)}
                    onKeyDown={(e) => e.key === "Enter" && setIsEditingName(false)}
                    className="w-56 h-9 bg-neutral-50 border-neutral-200 text-neutral-900 text-base font-semibold focus:border-[#bfff00] focus:ring-[#bfff00]/20"
                    autoFocus
                  />
                ) : (
                  <button
                    className="flex items-center gap-2 hover:bg-neutral-100 px-3 py-1.5 rounded-lg transition-colors group"
                    onClick={() => setIsEditingName(true)}
                  >
                    <h1 className="text-lg font-bold text-neutral-900">{editName}</h1>
                    <Pencil className="h-3.5 w-3.5 text-neutral-400 group-hover:text-[#8fb300]" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Contador de mudancas */}
              {changeCount > 0 && (
                <span className="text-xs text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-lg">
                  {changeCount} {changeCount === 1 ? 'mudanca' : 'mudancas'}
                </span>
              )}
              
              {/* Notificacao de salvo */}
              {showSavedNotification && (
                <span className="text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2 duration-200">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Salvo
                </span>
              )}

              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 bg-[#bfff00] hover:bg-[#d4ff4d] text-neutral-900 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-[0_0_20px_rgba(190,255,0,0.25)] hover:shadow-[0_0_25px_rgba(190,255,0,0.4)] disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs - Fixed White Bar */}
      <div className="bg-white border-b border-neutral-200/80 sticky top-[73px] z-30">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex items-center gap-1 py-2.5 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              const isLocked = tab.locked

              return (
                <button
                  key={tab.id}
                  onClick={() => !isLocked && setActiveTab(tab.id)}
                  disabled={isLocked}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-neutral-900 text-white"
                      : isLocked
                      ? "text-neutral-300 cursor-not-allowed"
                      : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                  }`}
                >
                  {isLocked ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* N8N Flow Builder Tab - Full Width */}
        {activeTab === "n8n" && (
          <div className="h-full">
            <FlowBuilder flowName={flow?.name || "Novo Fluxo"} />
          </div>
        )}

        {/* Main Content for other tabs */}
        {activeTab !== "n8n" && (
        <div className="max-w-[900px] mx-auto px-6 py-8">
          {/* Bots Tab */}
          {activeTab === "bots" && (
            <div className="space-y-6">
              {/* Stats Row - White cards with colored accents */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-sm font-semibold text-neutral-500">Leads</span>
                  </div>
                  <p className="text-3xl font-bold text-neutral-900">
                    {loadingStats ? <RefreshCw className="h-6 w-6 animate-spin text-neutral-300" /> : stats.leads.toLocaleString()}
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#bfff00] to-[#8fb300] flex items-center justify-center shadow-lg shadow-[#bfff00]/30">
                      <Crown className="h-5 w-5 text-neutral-900" />
                    </div>
                    <span className="text-sm font-semibold text-neutral-500">VIPs</span>
                  </div>
                  <p className="text-3xl font-bold text-neutral-900">
                    {loadingStats ? <RefreshCw className="h-6 w-6 animate-spin text-neutral-300" /> : stats.vips.toLocaleString()}
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                      <DollarSign className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-sm font-semibold text-neutral-500">Receita</span>
                  </div>
                  <p className="text-3xl font-bold text-neutral-900">
                    {loadingStats ? <RefreshCw className="h-6 w-6 animate-spin text-neutral-300" /> : `R$ ${stats.revenue.toFixed(2)}`}
                  </p>
                </div>
              </div>

              {/* Bots Section - White Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-neutral-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#bfff00] to-[#8fb300] flex items-center justify-center shadow-lg shadow-[#bfff00]/30">
                        <Bot className="h-5 w-5 text-neutral-900" />
                      </div>
                      <div>
                        <h3 className="font-bold text-neutral-900">Bots Vinculados</h3>
                        <p className="text-sm text-neutral-500">Gerencie os bots que executam este fluxo</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-neutral-900 bg-[#bfff00] px-3 py-1 rounded-full">{flowBots.length}/5</span>
                  </div>
                </div>
                
                <div className="p-6">
                  {flowBots.length === 0 ? (
                    <div className="text-center py-10">
                      <div className="h-16 w-16 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                        <Bot className="h-8 w-8 text-neutral-400" />
                      </div>
                      <h4 className="font-bold text-neutral-900 mb-1">Nenhum bot vinculado</h4>
                      <p className="text-sm text-neutral-500 mb-6">Adicione bots para executar este fluxo</p>
                      
                      {userBots.length === 0 ? (
                        showCreateBotForm ? (
                          <div className="max-w-sm mx-auto space-y-4 text-left">
                            <div className="space-y-2">
                              <Label htmlFor="bot-token" className="text-neutral-700 font-medium">Token do Bot</Label>
                              <Input
                                id="bot-token"
                                value={newBotToken}
                                onChange={(e) => setNewBotToken(e.target.value)}
                                placeholder="Cole o token do BotFather aqui..."
                                className="bg-neutral-50 border-neutral-200 focus:border-[#bfff00] focus:ring-[#bfff00]/20"
                              />
                              <p className="text-xs text-neutral-500">
                                Obtenha o token no @BotFather do Telegram
                              </p>
                            </div>
                            <div className="flex gap-3">
                              <button
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition-colors"
                                onClick={() => {
                                  setShowCreateBotForm(false)
                                  setNewBotToken("")
                                }}
                              >
                                Cancelar
                              </button>
                              <button
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-[#bfff00] hover:bg-[#d4ff4d] text-neutral-900 transition-colors disabled:opacity-50"
                                onClick={handleCreateBotInline}
                                disabled={isCreatingBot || !newBotToken.trim()}
                              >
                                {isCreatingBot ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                Criar Bot
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#bfff00] hover:bg-[#d4ff4d] text-neutral-900 transition-colors shadow-[0_0_20px_rgba(190,255,0,0.25)]"
                            onClick={() => setShowCreateBotForm(true)}
                          >
                            <Plus className="h-4 w-4" />
                            Criar Bot
                          </button>
                        )
                      ) : (
                        <button
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#bfff00] hover:bg-[#d4ff4d] text-neutral-900 transition-colors shadow-[0_0_20px_rgba(190,255,0,0.25)]"
                          onClick={() => {
                            fetchAvailableBots()
                            setShowAddBotDialog(true)
                          }}
                        >
                          <Plus className="h-4 w-4" />
                          Selecionar Bot
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {flowBots.map((fb) => (
                        <div
                          key={fb.id}
                          className="flex items-center justify-between p-4 rounded-xl bg-neutral-50 border border-neutral-100 hover:border-[#bfff00]/50 hover:bg-[#bfff00]/5 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            {fb.bot?.photo_url ? (
                              <img 
                                src={fb.bot.photo_url} 
                                alt={fb.bot.first_name}
                                className="h-12 w-12 rounded-xl object-cover"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-xl bg-[#bfff00]/20 flex items-center justify-center">
                                <Bot className="h-6 w-6 text-[#8fb300]" />
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-neutral-900">
                                {fb.bot?.first_name || "Bot"}
                              </p>
                              <p className="text-sm text-neutral-500">
                                @{fb.bot?.username || "unknown"}
                              </p>
                            </div>
                          </div>
                          <button
                            className="h-9 w-9 rounded-lg flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            onClick={() => handleRemoveBot(fb.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}

                      {flowBots.length < 5 && (
                        <div className="flex gap-3 pt-2">
                          {userBots.length > flowBots.length && (
                            <button
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border-2 border-dashed border-neutral-200 text-neutral-500 hover:border-[#bfff00]/50 hover:text-neutral-900 hover:bg-[#bfff00]/5 transition-all"
                              onClick={() => {
                                fetchAvailableBots()
                                setShowAddBotDialog(true)
                              }}
                            >
                              <Plus className="h-4 w-4" />
                              Selecionar Bot
                            </button>
                          )}
                          <button
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border-2 border-dashed border-neutral-200 text-neutral-500 hover:border-[#bfff00]/50 hover:text-neutral-900 hover:bg-[#bfff00]/5 transition-all"
                            onClick={() => setShowCreateBotForm(true)}
                          >
                            <Plus className="h-4 w-4" />
                            Criar Bot
                          </button>
                        </div>
                      )}
                      
                      {showCreateBotForm && (
                        <div className="p-5 rounded-xl bg-neutral-50 border border-neutral-200 space-y-4 mt-3">
                          <div className="space-y-2">
                            <Label htmlFor="bot-token-inline" className="text-neutral-700 font-medium">Token do Bot</Label>
                            <Input
                              id="bot-token-inline"
                              value={newBotToken}
                              onChange={(e) => setNewBotToken(e.target.value)}
                              placeholder="Cole o token do BotFather aqui..."
                              className="bg-white border-neutral-200 focus:border-[#bfff00] focus:ring-[#bfff00]/20"
                            />
                            <p className="text-xs text-neutral-500">
                              Obtenha o token no @BotFather do Telegram
                            </p>
                          </div>
                          <div className="flex gap-3">
                            <button
                              className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-200 transition-colors"
                              onClick={() => {
                                setShowCreateBotForm(false)
                                setNewBotToken("")
                              }}
                            >
                              Cancelar
                            </button>
                            <button
                              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-[#bfff00] hover:bg-[#d4ff4d] text-neutral-900 transition-colors disabled:opacity-50"
                              onClick={handleCreateBotInline}
                              disabled={isCreatingBot || !newBotToken.trim()}
                            >
                              {isCreatingBot ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                              Criar e Vincular
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Entregaveis Quick Access - White Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-neutral-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-[#bfff00] flex items-center justify-center">
                        <Gift className="h-5 w-5 text-neutral-900" />
                      </div>
                      <div>
                        <h3 className="font-bold text-neutral-900">Entregaveis</h3>
                        <p className="text-sm text-neutral-500">{deliverables.length} cadastrados</p>
                      </div>
                    </div>
                    {deliverables.length > 0 && (
                      <button 
                        onClick={() => setActiveTab("deliverables")}
                        className="text-sm font-bold text-[#8fb300] hover:text-[#7a9900] transition-colors"
                      >
                        Gerenciar
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-6">
                  {deliverables.length === 0 ? (
                    <div className="space-y-4">
                      <p className="text-sm text-neutral-500 text-center">Nenhum entregavel configurado ainda</p>
                      <div className="grid grid-cols-3 gap-3">
                        <button
                          onClick={() => {
                            setEditingDeliverable(null)
                            setDeliverableModalStep("form")
                            setTempDeliverable({
                              id: `del-${Date.now()}`,
                              name: "Midia",
                              type: "media",
                              medias: [],
                              link: "",
                              linkText: "",
                              vipGroupChatId: "",
                              vipGroupName: "",
                              vipAutoAdd: true,
                              vipAutoRemove: true,
                            })
                            setDeliverableModalOpen(true)
                          }}
                          className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-neutral-200 hover:border-[#bfff00] hover:bg-[#bfff00]/5 transition-all group"
                        >
                          <div className="h-10 w-10 rounded-lg bg-[#bfff00] flex items-center justify-center group-hover:bg-neutral-900 transition-colors">
                            <ImageIcon className="h-5 w-5 text-neutral-900 group-hover:text-white" />
                          </div>
                          <span className="text-sm font-medium text-neutral-700">Midia</span>
                        </button>
                        <button
                          onClick={() => {
                            setEditingDeliverable(null)
                            setDeliverableModalStep("form")
                            setTempDeliverable({
                              id: `del-${Date.now()}`,
                              name: "Link",
                              type: "link",
                              medias: [],
                              link: "",
                              linkText: "",
                              vipGroupChatId: "",
                              vipGroupName: "",
                              vipAutoAdd: true,
                              vipAutoRemove: true,
                            })
                            setDeliverableModalOpen(true)
                          }}
                          className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-neutral-200 hover:border-[#bfff00] hover:bg-[#bfff00]/5 transition-all group"
                        >
                          <div className="h-10 w-10 rounded-lg bg-[#bfff00] flex items-center justify-center group-hover:bg-neutral-900 transition-colors">
                            <Link2 className="h-5 w-5 text-neutral-900 group-hover:text-white" />
                          </div>
                          <span className="text-sm font-medium text-neutral-700">Link</span>
                        </button>
                        <button
                          onClick={() => {
                            setEditingDeliverable(null)
                            setDeliverableModalStep("form")
                            setTempDeliverable({
                              id: `del-${Date.now()}`,
                              name: "Grupo VIP",
                              type: "vip_group",
                              medias: [],
                              link: "",
                              linkText: "",
                              vipGroupChatId: "",
                              vipGroupName: "",
                              vipAutoAdd: true,
                              vipAutoRemove: true,
                            })
                            setDeliverableModalOpen(true)
                          }}
                          className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-neutral-200 hover:border-[#bfff00] hover:bg-[#bfff00]/5 transition-all group"
                        >
                          <div className="h-10 w-10 rounded-lg bg-[#bfff00] flex items-center justify-center group-hover:bg-neutral-900 transition-colors">
                            <Users className="h-5 w-5 text-neutral-900 group-hover:text-white" />
                          </div>
                          <span className="text-sm font-medium text-neutral-700">Grupo VIP</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {deliverables.slice(0, 5).map((d) => (
                          <button
                            key={d.id}
                            onClick={() => {
                              setEditingDeliverable(d)
                              setDeliverableModalStep("form")
                              setTempDeliverable({ ...d })
                              setDeliverableModalOpen(true)
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-50 border border-neutral-200 text-sm text-neutral-700 font-medium hover:border-[#bfff00] hover:bg-[#bfff00]/5 transition-all"
                          >
                            {d.type === "media" && <ImageIcon className="h-3.5 w-3.5 text-neutral-900" />}
                            {d.type === "link" && <Link2 className="h-3.5 w-3.5 text-neutral-900" />}
                            {d.type === "vip_group" && <Users className="h-3.5 w-3.5 text-neutral-900" />}
                            {d.name}
                          </button>
                        ))}
                        {deliverables.length > 5 && (
                          <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-neutral-100 text-sm text-neutral-500">
                            +{deliverables.length - 5} mais
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setEditingDeliverable(null)
                          setDeliverableModalStep("select")
                          setTempDeliverable({
                            id: `del-${Date.now()}`,
                            name: `Entregavel ${deliverables.length + 1}`,
                            type: "media",
                            medias: [],
                            link: "",
                            linkText: "",
                            vipGroupChatId: "",
                            vipGroupName: "",
                            vipAutoAdd: true,
                            vipAutoRemove: true,
                          })
                          setDeliverableModalOpen(true)
                        }}
                        disabled={deliverables.length >= 10}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed border-neutral-200 hover:border-[#bfff00] hover:bg-[#bfff00]/5 transition-all text-sm font-medium text-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="h-4 w-4" />
                        Adicionar entregavel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Welcome Tab */}
          {activeTab === "welcome" && (
            <div className="space-y-6">
              {/* Midias Section - White Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-neutral-100">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                      <ImageIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-neutral-900">Midias</h3>
                      <p className="text-sm text-neutral-500">Adicione ate 3 midias para a mensagem de boas-vindas</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex gap-4">
                    {welcomeMedias.map((media, index) => (
                      <div key={index} className="relative w-28 h-28 rounded-xl border border-neutral-200 overflow-hidden group">
                        <img src={media} alt={`Media ${index + 1}`} className="w-full h-full object-cover" />
                        <button
                          onClick={() => {
                            setWelcomeMedias(welcomeMedias.filter((_, i) => i !== index))
                            markChange()
                          }}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        >
                          <Trash2 className="h-5 w-5 text-white" />
                        </button>
                      </div>
                    ))}
                    {welcomeMedias.length < 3 && (
                      <label className="w-28 h-28 rounded-xl border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center cursor-pointer hover:border-[#bfff00]/50 hover:bg-[#bfff00]/5 transition-all">
                        <Plus className="h-6 w-6 text-neutral-400 mb-1" />
                        <span className="text-xs text-neutral-500">{welcomeMedias.length}/3</span>
                        <input
                          type="file"
                          accept="image/*,video/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (file && flow) {
                              try {
                                const fileExt = file.name.split('.').pop()
                                const fileName = `${flow.id}/${Date.now()}.${fileExt}`
                                
                                const { data, error } = await supabase.storage
                                  .from('flow-medias')
                                  .upload(fileName, file, {
                                    cacheControl: '3600',
                                    upsert: false
                                  })
                                
                                if (error) {
                                  console.error('Upload error:', error)
                                  toast({
                                    title: "Erro no upload",
                                    description: error.message,
                                    variant: "destructive",
                                  })
                                  return
                                }
                                
                                const { data: urlData } = supabase.storage
                                  .from('flow-medias')
                                  .getPublicUrl(fileName)
                                
                                setWelcomeMedias([...welcomeMedias, urlData.publicUrl])
                                markChange()
                              } catch (err) {
                                console.error('Upload failed:', err)
                                toast({
                                  title: "Erro",
                                  description: "Falha ao fazer upload da midia",
                                  variant: "destructive",
                                })
                              }
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Message Section - White Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-neutral-100">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                      <MessageSquare className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-neutral-900">Mensagem de Boas-vindas <span className="text-red-500">*</span></h3>
                      <p className="text-sm text-neutral-500">Primeira mensagem enviada ao usuario</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <RichTextEditor
                    value={welcomeMessage}
                    onChange={(value) => {
                      setWelcomeMessage(value)
                      markChange()
                    }}
                    placeholder="Ola {nome}! Bem-vindo ao @{bot.username}"
                    rows={6}
                    maxLength={4000}
                    className="bg-neutral-50 border-neutral-200 font-mono text-sm"
                    variables={[
                      { label: "{nome}", value: "{nome}" },
                      { label: "{username}", value: "{username}" }
                    ]}
                  />
                </div>
              </div>

              {/* CTA Button Section - White Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-neutral-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#bfff00] to-[#8fb300] flex items-center justify-center shadow-lg shadow-[#bfff00]/30">
                        <ExternalLink className="h-5 w-5 text-neutral-900" />
                      </div>
                      <div>
                        <h3 className="font-bold text-neutral-900">Botao de Acao (CTA)</h3>
                        <p className="text-sm text-neutral-500">
                          {ctaButtonEnabled 
                            ? "Botao exibido apos a mensagem para ver os planos" 
                            : "Planos aparecem direto na mensagem de boas-vindas"}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={ctaButtonEnabled}
                      onCheckedChange={(checked) => {
                        setCtaButtonEnabled(checked)
                        markChange()
                      }}
                      className="data-[state=checked]:bg-[#bfff00]"
                    />
                  </div>
                </div>
                {ctaButtonEnabled && (
                  <div className="p-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-neutral-700 font-medium">Texto do Botao</Label>
                        <Input
                          value={ctaButtonText}
                          onChange={(e) => {
                            setCtaButtonText(e.target.value)
                            markChange()
                          }}
                          placeholder="Ver Planos"
                          className="bg-neutral-50 border-neutral-200 focus:border-[#bfff00] focus:ring-[#bfff00]/20"
                        />
                      </div>
                      <div className="flex items-start gap-3 p-4 rounded-xl bg-[#bfff00]/10 border border-[#bfff00]/20">
                        <HelpCircle className="h-4 w-4 text-[#8fb300] shrink-0 mt-0.5" />
                        <p className="text-sm text-neutral-700">
                          Este botao sera exibido ao usuario apos a mensagem de boas-vindas para que ele possa ver os planos disponiveis.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                  {!ctaButtonEnabled && (
                    <div className="p-6">
                      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
                        <HelpCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-neutral-700">
                          Os planos configurados aparecerao como botoes diretamente na mensagem de boas-vindas, sem precisar de um botao intermediario. Redirect e Packs continuam aparecendo normalmente.
                        </p>
                      </div>
                    </div>
                  )}
              </div>

              {/* Opcoes Avancadas - Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Mensagem Secundaria */}
                <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
                  <div className="px-6 py-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-[#bfff00] flex items-center justify-center">
                          <MessageCircle className="h-5 w-5 text-neutral-900" />
                        </div>
                        <div>
                          <h3 className="font-bold text-neutral-900 text-sm">Mensagem Secundaria</h3>
                          <p className="text-xs text-neutral-500">Mensagem separada para botoes</p>
                        </div>
                      </div>
                      <Switch
                        checked={secondaryMessageEnabled}
                        onCheckedChange={(checked) => {
                          setSecondaryMessageEnabled(checked)
                          markChange()
                        }}
                        className="data-[state=checked]:bg-[#bfff00]"
                      />
                    </div>
                    {secondaryMessageEnabled && (
                      <div className="mt-4">
                        <RichTextEditor
                          value={secondaryMessage}
                          onChange={(value) => {
                            setSecondaryMessage(value)
                            markChange()
                          }}
                          placeholder="Digite a mensagem secundaria..."
                          rows={3}
                          maxLength={4000}
                          className="bg-neutral-50 border-neutral-200 text-sm"
                          variables={[
                            { label: "{nome}", value: "{nome}" },
                            { label: "{username}", value: "{username}" }
                          ]}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Botao Redirect */}
                <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
                  <div className="px-6 py-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-[#bfff00] flex items-center justify-center">
                          <ExternalLink className="h-5 w-5 text-neutral-900" />
                        </div>
                        <div>
                          <h3 className="font-bold text-neutral-900 text-sm">Botao Redirect</h3>
                          <p className="text-xs text-neutral-500">Redireciona para canal</p>
                        </div>
                      </div>
                      <Switch
                        checked={redirectButtonEnabled}
                        onCheckedChange={(checked) => {
                          setRedirectButtonEnabled(checked)
                          markChange()
                        }}
                        className="data-[state=checked]:bg-[#bfff00]"
                      />
                    </div>
                    {redirectButtonEnabled && (
                      <div className="mt-4 space-y-3">
                        <Input
                          value={redirectButtonText}
                          onChange={(e) => {
                            setRedirectButtonText(e.target.value)
                            markChange()
                          }}
                          placeholder="Texto do botao"
                          className="bg-neutral-50 border-neutral-200 focus:border-[#bfff00] focus:ring-[#bfff00]"
                        />
                        <Input
                          value={redirectButtonUrl}
                          onChange={(e) => {
                            setRedirectButtonUrl(e.target.value)
                            markChange()
                          }}
                          placeholder="@canal ou https://t.me/canal"
                          className="bg-neutral-50 border-neutral-200 focus:border-[#bfff00] focus:ring-[#bfff00]"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Plans Tab */}
          {activeTab === "plans" && (
            <div className="space-y-6">
              {/* Planos de Pagamento - White Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-neutral-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                        <CreditCard className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-neutral-900">Planos de Pagamento</h3>
                        <p className="text-sm text-neutral-500">Configure ate 10 planos com entregas personalizadas</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-neutral-900 bg-[#bfff00] px-3 py-1 rounded-full">{plans.length}/10</span>
                      {plans.length > 0 && plans.length < 10 && (
                        <button
                          onClick={handleAddPlan}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-[#bfff00] hover:bg-[#d4ff4d] text-neutral-900 transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                          Adicionar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  {/* Opcao mostrar preco no botao */}
                  {plans.length > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 border border-neutral-100">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-neutral-600">Mostrar preco no botao</span>
                        <span className="text-xs text-neutral-400">(ex: &quot;Mensal por R$ 20,00&quot;)</span>
                      </div>
                      <Switch
                        checked={showPriceInButton}
                        onCheckedChange={(checked) => { setShowPriceInButton(checked); markChange() }}
                      />
                    </div>
                  )}
                  
                  {plans.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="h-16 w-16 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                        <CreditCard className="h-8 w-8 text-neutral-400" />
                      </div>
                      <h4 className="font-bold text-neutral-900 mb-1">Nenhum plano configurado</h4>
                      <p className="text-sm text-neutral-500 mb-6">Crie planos para seus clientes comprarem</p>
                      <button
                        onClick={handleAddPlan}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#bfff00] hover:bg-[#d4ff4d] text-neutral-900 transition-colors shadow-[0_0_20px_rgba(190,255,0,0.25)]"
                      >
                        <Plus className="h-4 w-4" />
                        Adicionar Plano
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {plans.map((plan, index) => (
                        <div
                          key={plan.id}
                          className="rounded-xl border border-neutral-100 bg-neutral-50 overflow-hidden hover:border-[#bfff00]/50 hover:bg-[#bfff00]/5 transition-colors"
                        >
                          {/* Plan Header - Collapsible */}
                          <div
                            className="flex items-center justify-between p-4 cursor-pointer"
                            onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
                          >
                            <div className="flex items-center gap-4">
                              <div className="h-12 w-12 rounded-xl bg-white border border-neutral-200 flex items-center justify-center">
                                <Package className="h-5 w-5 text-neutral-600" />
                              </div>
                              <div>
<p className="font-semibold text-neutral-900">{plan.name || `Plano ${index + 1}`}</p>
                                    <p className="text-sm text-neutral-500">
                                      R$ {Number(plan.price || 0).toFixed(2)} • {getDurationLabelFull(plan.duration_days)}
                                    </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                className="h-8 w-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRemovePlan(plan.id)
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              <ChevronDown className={`h-5 w-5 text-neutral-400 transition-transform ${expandedPlan === plan.id ? "rotate-180" : ""}`} />
                            </div>
                          </div>

                          {/* Expanded Content */}
                          {expandedPlan === plan.id && (
                            <div className="px-4 pb-4 space-y-6 border-t border-neutral-100 pt-4">
                              {/* Nome, Preco, Duracao */}
                              <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <Label className="text-sm text-neutral-600">Nome do Plano</Label>
                                  <Input
                                    value={plan.name}
                                    onChange={(e) => handleUpdatePlan(plan.id, "name", e.target.value)}
                                    placeholder="Ex: Plano Mensal"
                                    className="bg-white border-neutral-200"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-sm text-neutral-600">Preco (R$)</Label>
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={plan.price || ""}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[^0-9.,]/g, "").replace(",", ".")
                                      handleUpdatePlan(plan.id, "price", val === "" ? 0 : val)
                                    }}
                                    onBlur={(e) => {
                                      const num = parseFloat(String(plan.price).replace(",", ".")) || 0
                                      handleUpdatePlan(plan.id, "price", num)
                                    }}
                                    placeholder="0.00"
                                    className="bg-white border-neutral-200"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-sm text-neutral-600">Duracao do Acesso</Label>
                                  <Select
                                    value={getDurationSelectValue(plan.duration_days) || "30_monthly"}
                                    onValueChange={(value) => {
                                      const [daysStr, type] = value.split("_")
                                      const days = parseInt(daysStr, 10)
                                      handleUpdatePlan(plan.id, "duration_days", days)
                                      handleUpdatePlan(plan.id, "duration_type", type)
                                    }}
                                  >
                                    <SelectTrigger className="bg-white border-neutral-200">
                                      <SelectValue placeholder="Mensal (30 dias)" />
                                    </SelectTrigger>
                                    <SelectContent position="popper" sideOffset={4}>
                                      <SelectItem value="1_daily">Diario (1 dia)</SelectItem>
                                      <SelectItem value="7_weekly">Semanal (7 dias)</SelectItem>
                                      <SelectItem value="15_monthly">Quinzenal (15 dias)</SelectItem>
                                      <SelectItem value="30_monthly">Mensal (30 dias)</SelectItem>
                                      <SelectItem value="60_monthly">Bimestral (60 dias)</SelectItem>
                                      <SelectItem value="90_monthly">Trimestral (90 dias)</SelectItem>
                                      <SelectItem value="180_monthly">Semestral (180 dias)</SelectItem>
                                      <SelectItem value="365_yearly">Anual (365 dias)</SelectItem>
                                      <SelectItem value="0_lifetime">Vitalicio (sem expiracao)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              {/* Entrega deste Plano */}
                              <div className="space-y-3 p-4 rounded-xl bg-white border border-neutral-200">
                                <div className="flex items-center gap-2">
                                  <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                                    <Gift className="h-4 w-4 text-emerald-600" />
                                  </div>
                                  <span className="font-medium text-neutral-900">Entregavel</span>
                                </div>
                                <p className="text-xs text-neutral-500">
                                  Selecione qual entregavel sera enviado ao comprar este plano
                                </p>
                                <Select
                                  value={plan.delivery_type || "default"}
                                  onValueChange={(value: "default" | "custom") => {
                                    handleUpdatePlan(plan.id, "delivery_type", value)
                                    if (value === "default") {
                                        handleUpdatePlan(plan.id, "deliverableId", "")
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="bg-white border-neutral-200">
                                      <div className="flex items-center gap-2">
                                        <Gift className="h-4 w-4 text-neutral-500" />
                                        <SelectValue />
                                      </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="default">Usar entregavel principal</SelectItem>
                                      <SelectItem value="custom">Selecionar entregavel</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  
                                  {(plan.delivery_type || "default") === "custom" && (
                                    <div className="pt-2">
                                      {deliverables.length === 0 ? (
                                        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
                                          <div className="flex items-start gap-2">
                                            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                                            <div className="text-xs">
                                              <p className="font-medium text-amber-500">Nenhum entregavel</p>
                                              <p className="text-neutral-500">Crie entregaveis na aba &quot;Entregaveis&quot;</p>
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        <Select
                                          value={plan.deliverableId || "none"}
                                          onValueChange={(value) => handleUpdatePlan(plan.id, "deliverableId", value === "none" ? "" : value)}
                                        >
                                          <SelectTrigger className="bg-white border-neutral-200">
                                            <SelectValue placeholder="Selecione..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="none">Nenhum selecionado</SelectItem>
                                            {deliverables.map((d) => (
                                              <SelectItem key={d.id} value={d.id}>
                                                <div className="flex items-center gap-2">
                                                  {d.type === "media" && <ImageIcon className="h-3 w-3" />}
                                                  {d.type === "link" && <Link2 className="h-3 w-3" />}
                                                  {d.type === "vip_group" && <Users className="h-3 w-3" />}
                                                  {d.name}
                                                </div>
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Order Bumps do Plano */}
                                <div className="space-y-3 pt-4 border-t border-neutral-200">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                                        <Package className="h-4 w-4 text-purple-500" />
                                      </div>
                                      <span className="font-medium">Order Bumps</span>
                                      <span className="text-xs text-neutral-500">({(plan.order_bumps || []).length}/5)</span>
                                    </div>
                                    {(plan.order_bumps || []).length < 5 && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          const newBump: PlanOrderBump = {
                                            id: `bump-${Date.now()}`,
                                            enabled: true,
                                            name: "",
                                            price: 0,
                                            description: "",
                                            acceptText: "QUERO",
                                            rejectText: "NAO QUERO",
                                            ctaMessage: "",
                                            deliveryType: "same",
                                            medias: []
                                          }
                                          const currentBumps = plan.order_bumps || []
                                          handleUpdatePlan(plan.id, "order_bumps", [...currentBumps, newBump])
                                        }}
                                        className="border-purple-500/30 text-purple-500 hover:bg-purple-500/10"
                                      >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Adicionar
                                      </Button>
                                    )}
                                  </div>
                                  <p className="text-xs text-neutral-500">
                                    Produtos adicionais oferecidos antes do pagamento deste plano
                                  </p>
                                  
                                  {(plan.order_bumps || []).length === 0 ? (
                                    <div className="text-center py-4 border border-dashed border-neutral-200 rounded-lg">
                                      <Package className="h-6 w-6 text-neutral-500/50 mx-auto mb-2" />
                                      <p className="text-sm text-neutral-500">Nenhum order bump configurado</p>
                                    </div>
                                  ) : (
                                    <div className="space-y-3">
                                      {(plan.order_bumps || []).map((bump, bumpIndex) => (
                                        <div key={bump.id} className="p-3 rounded-lg border border-purple-500/20 bg-purple-500/5">
                                          <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                              <Switch
                                                checked={bump.enabled}
                                                onCheckedChange={(checked) => {
                                                  const updatedBumps = [...(plan.order_bumps || [])]
                                                  updatedBumps[bumpIndex] = { ...bump, enabled: checked }
                                                  handleUpdatePlan(plan.id, "order_bumps", updatedBumps)
                                                }}
                                              />
                                              <span className="font-medium text-sm">{bump.name || `Order Bump ${bumpIndex + 1}`}</span>
                                              {Number(bump.price) > 0 && (
                                                <Badge variant="outline" className="text-xs">R$ {Number(bump.price).toFixed(2)}</Badge>
                                              )}
                                            </div>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                const updatedBumps = (plan.order_bumps || []).filter((_, i) => i !== bumpIndex)
                                                handleUpdatePlan(plan.id, "order_bumps", updatedBumps)
                                              }}
                                              className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </div>
                                          
                                          <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                              <Label className="text-xs text-neutral-500">Nome</Label>
                                              <Input
                                                value={bump.name}
                                                onChange={(e) => {
                                                  const updatedBumps = [...(plan.order_bumps || [])]
                                                  updatedBumps[bumpIndex] = { ...bump, name: e.target.value }
                                                  handleUpdatePlan(plan.id, "order_bumps", updatedBumps)
                                                }}
                                                placeholder="Ex: Pack Extra"
                                                className="h-8 text-sm bg-secondary/30"
                                              />
                                            </div>
                                            <div className="space-y-1">
                                              <Label className="text-xs text-neutral-500">Preco (R$)</Label>
                                              <Input
                                                type="text"
                                                inputMode="decimal"
                                                value={bump.price || ""}
                                                onChange={(e) => {
                                                  const val = e.target.value.replace(/[^0-9.,]/g, "").replace(",", ".")
                                                  const updatedBumps = [...(plan.order_bumps || [])]
                                                  const newPrice = val === "" ? 0 : val as unknown as number
                                                  updatedBumps[bumpIndex] = { ...bump, price: newPrice }
                                                  handleUpdatePlan(plan.id, "order_bumps", updatedBumps)
                                                }}
                                                onBlur={() => {
                                                  const num = parseFloat(String(bump.price).replace(",", ".")) || 0
                                                  const updatedBumps = [...(plan.order_bumps || [])]
                                                  updatedBumps[bumpIndex] = { ...bump, price: num }
                                                  handleUpdatePlan(plan.id, "order_bumps", updatedBumps)
                                                }}
                                                placeholder="0.00"
                                                className="h-8 text-sm bg-secondary/30"
                                              />
                                            </div>
                                          </div>
                                          
                                          <div className="mt-3 space-y-1">
                                            <Label className="text-xs text-neutral-500">Descricao</Label>
                                            <RichTextEditor
                                              value={bump.description || ""}
                                              onChange={(value) => {
                                                const updatedBumps = [...(plan.order_bumps || [])]
                                                updatedBumps[bumpIndex] = { ...bump, description: value }
                                                handleUpdatePlan(plan.id, "order_bumps", updatedBumps)
                                              }}
                                              placeholder="Descricao do order bump..."
                                              rows={2}
                                              maxLength={4000}
                                              className="text-sm bg-secondary/30"
                                              showCharCount={false}
                                            />
                                          </div>
                                          
                                          <div className="grid grid-cols-2 gap-3 mt-3">
                                            <div className="space-y-1">
                                              <Label className="text-xs text-neutral-500">Texto Aceitar</Label>
                                              <Input
                                                value={bump.acceptText}
                                                onChange={(e) => {
                                                  const updatedBumps = [...(plan.order_bumps || [])]
                                                  updatedBumps[bumpIndex] = { ...bump, acceptText: e.target.value }
                                                  handleUpdatePlan(plan.id, "order_bumps", updatedBumps)
                                                }}
                                                placeholder="QUERO"
                                                className="h-8 text-sm bg-secondary/30"
                                              />
                                            </div>
<div className="space-y-1">
  <Label className="text-xs text-neutral-500">
    Texto Recusar
    {(plan.order_bumps || []).length > 1 && (
      <span className="text-amber-500 ml-1">(desabilitado com +1 bump)</span>
    )}
  </Label>
  <Input
  value={bump.rejectText}
  onChange={(e) => {
  const updatedBumps = [...(plan.order_bumps || [])]
  updatedBumps[bumpIndex] = { ...bump, rejectText: e.target.value }
  handleUpdatePlan(plan.id, "order_bumps", updatedBumps)
  }}
  placeholder="NAO QUERO"
  className="h-8 text-sm bg-secondary/30"
  disabled={(plan.order_bumps || []).length > 1}
  />
  </div>
                                          </div>
                                          
                                          {/* Mensagem do Resumo (apenas no primeiro order bump quando tem mais de 1) */}
                                          {bumpIndex === 0 && (plan.order_bumps || []).length > 1 && (
                                            <div className="mt-3 space-y-1">
                                              <Label className="text-xs text-neutral-500">Mensagem do Resumo</Label>
                                              <Input
                                                value={bump.ctaMessage || ""}
                                                onChange={(e) => {
                                                  const updatedBumps = [...(plan.order_bumps || [])]
                                                  updatedBumps[bumpIndex] = { ...bump, ctaMessage: e.target.value }
                                                  handleUpdatePlan(plan.id, "order_bumps", updatedBumps)
                                                }}
                                                placeholder="Escolha um dos produtos acima ou continue com o conteudo principal"
                                                className="h-8 text-sm bg-secondary/30"
                                              />
                                              <p className="text-[10px] text-neutral-500">Mensagem exibida no resumo do pedido abaixo dos order bumps</p>
                                            </div>
                                          )}
                                          
                                          {/* Entregavel do Order Bump */}
                                          <div className="mt-3 space-y-2 p-3 rounded-lg bg-emerald-50/50 border border-emerald-200/50">
                                            <div className="flex items-center gap-2">
                                              <Gift className="h-4 w-4 text-emerald-600" />
                                              <Label className="text-xs text-neutral-700 font-medium">Entregavel do Order Bump</Label>
                                            </div>
                                            <p className="text-[10px] text-neutral-500">
                                              Selecione qual conteudo sera entregue quando este order bump for comprado
                                            </p>
                                            {deliverables.length === 0 ? (
                                              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2">
                                                <div className="flex items-start gap-2">
                                                  <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5" />
                                                  <p className="text-[10px] text-amber-600">Nenhum entregavel. Crie na aba Entregaveis.</p>
                                                </div>
                                              </div>
                                            ) : (
                                              <Select
                                                value={bump.deliverableId || "none"}
                                                onValueChange={(value) => {
                                                  const updatedBumps = [...(plan.order_bumps || [])]
                                                  updatedBumps[bumpIndex] = { ...bump, deliverableId: value === "none" ? "" : value }
                                                  handleUpdatePlan(plan.id, "order_bumps", updatedBumps)
                                                }}
                                              >
                                                <SelectTrigger className="h-8 text-sm bg-white border-neutral-200">
                                                  <SelectValue placeholder="Selecione um entregavel..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="none">Nenhum (nao entrega nada)</SelectItem>
                                                  {deliverables.map((d) => (
                                                    <SelectItem key={d.id} value={d.id}>
                                                      <div className="flex items-center gap-2">
                                                        {d.type === "media" && <ImageIcon className="h-3 w-3 text-purple-500" />}
                                                        {d.type === "link" && <Link2 className="h-3 w-3 text-blue-500" />}
                                                        {d.type === "vip_group" && <Users className="h-3 w-3 text-emerald-500" />}
                                                        {d.name}
                                                      </div>
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            )}
                                          </div>

                                          {/* Midias do Order Bump (ate 3) */}
                                          <div className="mt-3 space-y-2">
                                            <div className="flex items-center justify-between">
                                              <Label className="text-xs text-neutral-500">Midias ({(bump.medias || []).length}/3)</Label>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                              {(bump.medias || []).map((media, mediaIndex) => (
                                                <div key={mediaIndex} className="relative group">
                                                  <div className="w-16 h-16 rounded-lg overflow-hidden border border-neutral-200 bg-secondary/30">
                                                    {media.match(/\.(mp4|webm|mov)$/i) ? (
                                                      <video src={media} className="w-full h-full object-cover" />
                                                    ) : (
                                                      <img src={media} alt="" className="w-full h-full object-cover" />
                                                    )}
                                                  </div>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      const updatedMedias = [...(bump.medias || [])].filter((_, i) => i !== mediaIndex)
                                                      const updatedBumps = [...(plan.order_bumps || [])]
                                                      updatedBumps[bumpIndex] = { ...bump, medias: updatedMedias }
                                                      handleUpdatePlan(plan.id, "order_bumps", updatedBumps)
                                                    }}
                                                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                  >
                                                    <X className="h-3 w-3" />
                                                  </button>
                                                </div>
                                              ))}
                                              {(bump.medias || []).length < 3 && (
                                                <label className="w-16 h-16 rounded-lg border-2 border-dashed border-neutral-200 flex items-center justify-center cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 transition-colors">
                                                  <input
                                                    type="file"
                                                    accept="image/*,video/*"
                                                    className="hidden"
                                                    onChange={async (e) => {
                                                      const file = e.target.files?.[0]
                                                      if (!file) return
                                                      
                                                      const fileExt = file.name.split('.').pop()
                                                      const fileName = `${flow.id}/planbump_${plan.id}_${bump.id}_${Date.now()}.${fileExt}`
                                                      
                                                      const { error } = await supabase.storage
                                                        .from('flow-medias')
                                                        .upload(fileName, file, { cacheControl: '3600', upsert: false })
                                                      
                                                      if (error) {
                                                        toast({ title: "Erro no upload", description: error.message, variant: "destructive" })
                                                        return
                                                      }
                                                      
                                                      const { data: urlData } = supabase.storage.from('flow-medias').getPublicUrl(fileName)
                                                      const updatedMedias = [...(bump.medias || []), urlData.publicUrl]
                                                      const updatedBumps = [...(plan.order_bumps || [])]
                                                      updatedBumps[bumpIndex] = { ...bump, medias: updatedMedias }
                                                      handleUpdatePlan(plan.id, "order_bumps", updatedBumps)
                                                    }}
                                                  />
                                                  <Plus className="h-4 w-4 text-neutral-500" />
                                                </label>
                                              )}
                                            </div>
                                            <p className="text-[10px] text-neutral-500">Imagens ou videos para exibir no order bump</p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Remover Plano */}
                                <Button
                                  variant="outline"
                                  className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
                                  onClick={() => handleRemovePlan(plan.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remover Plano
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                        {plans.length < 10 && (
                          <Button 
                            variant="outline" 
                            onClick={handleAddPlan}
                            className="w-full border-dashed"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Adicionar Plano
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Resumo de Entregaveis */}
                <Card className="border-neutral-200 bg-gradient-to-br from-emerald-500/5 to-transparent">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                          <Gift className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div>
                          <p className="font-semibold">Entregaveis</p>
                          <p className="text-sm text-neutral-500">
                            {deliverables.length === 0 
                              ? "Configure o que entregar apos o pagamento" 
                              : `${deliverables.length} entregavel${deliverables.length > 1 ? "is" : ""} configurado${deliverables.length > 1 ? "s" : ""}`
                            }
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => setActiveTab("deliverables")}
                        className="border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                      >
                        <Gift className="h-4 w-4 mr-2" />
                        Gerenciar Entregaveis
                      </Button>
                    </div>
                    
                    {mainDeliverableId && deliverables.find(d => d.id === mainDeliverableId) && (
                      <div className="mt-4 p-3 rounded-lg bg-secondary/30 border border-neutral-200">
                        <div className="flex items-center gap-2 text-sm">
                          <Crown className="h-4 w-4 text-amber-500" />
                          <span className="text-neutral-500">Entregavel Principal:</span>
                          <span className="font-medium">{deliverables.find(d => d.id === mainDeliverableId)?.name}</span>
                          <Badge variant="outline" className="ml-auto text-xs">
                            {deliverables.find(d => d.id === mainDeliverableId)?.type === "media" ? "Midia" : 
                             deliverables.find(d => d.id === mainDeliverableId)?.type === "link" ? "Link" : "Grupo VIP"}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

            </div>
          )}

          {/* Upsell Tab */}
          {activeTab === "upsell" && (
            <div className="space-y-6">
              {/* Upsell Main Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-neutral-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#bfff00] to-[#8fb300] flex items-center justify-center shadow-lg shadow-[#bfff00]/30">
                        <TrendingUp className="h-5 w-5 text-neutral-900" />
                      </div>
                      <div>
                        <h3 className="font-bold text-neutral-900">Upsell</h3>
                        <p className="text-sm text-neutral-500">Aumente suas vendas com ofertas especiais</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-neutral-900 bg-[#bfff00] px-3 py-1 rounded-full">{upsellSequences.length}/20</span>
                      <Switch
                        checked={upsellEnabled}
                        onCheckedChange={(checked) => {
                          setUpsellEnabled(checked)
                          markChange()
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Info sobre upsell */}
                <div className="px-6 py-3 bg-neutral-50 border-b border-neutral-100 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#8fb300]" />
                  <span className="text-xs text-neutral-500">
                    Sequencias enviadas automaticamente apos o pagamento ser aprovado
                  </span>
                </div>

                {upsellEnabled && (
                  <div className="px-6 py-4 bg-neutral-50 border-b border-neutral-100">
                    <div className="flex items-center gap-6">
                      <div className="flex-1">
                        <Label className="text-sm font-medium text-neutral-700">Entrega do Upsell</Label>
                        <Select
                          value={upsellDeliveryType}
                          onValueChange={(value: "same" | "custom") => {
                            setUpsellDeliveryType(value)
                            markChange()
                          }}
                        >
                          <SelectTrigger className="bg-white border-neutral-200 mt-1.5">
                            <div className="flex items-center gap-2">
                              <RefreshCw className="h-4 w-4 text-neutral-500" />
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="same">Mesmo do fluxo principal</SelectItem>
                            <SelectItem value="custom">Entrega personalizada</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1 p-3 rounded-xl bg-[#bfff00]/10 border border-[#bfff00]/20">
                        <p className="text-xs font-medium text-[#8fb300] mb-1">Como funciona?</p>
                        <p className="text-xs text-neutral-600">Upsell e enviado apos o cliente pagar, oferecendo produtos complementares.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sequences Section */}
                <div className="p-6">

                {!upsellEnabled ? (
                  <div className="text-center py-12">
                    <div className="h-16 w-16 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                      <TrendingUp className="h-8 w-8 text-neutral-400" />
                    </div>
                    <h4 className="font-bold text-neutral-900 mb-1">Upsell desativado</h4>
                    <p className="text-sm text-neutral-500">Ative o upsell acima para configurar sequencias de ofertas</p>
                  </div>
                ) : upsellSequences.length === 0 ? (
                  <Card className="bg-white border-neutral-100 shadow-sm rounded-2xl">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                      <Plus className="h-10 w-10 text-neutral-500/30 mb-4" />
                      <p className="text-neutral-500 mb-4">
                        Nenhuma sequencia de upsell configurada
                      </p>
                      <Button onClick={handleAddUpsellSequence} className="bg-[#bfff00] hover:bg-[#d4ff4d] text-neutral-900">
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Sequencia
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {upsellSequences.map((seq, index) => (
                      <Card key={seq.id} className="border-neutral-200">
                        {/* Sequence Header */}
                        <div
                          className="flex items-center justify-between p-4 cursor-pointer"
                          onClick={() => setExpandedSequence(expandedSequence === seq.id ? null : seq.id)}
                        >
                          <div className="flex items-center gap-2">
                            {expandedSequence === seq.id ? (
                              <ChevronDown className="h-4 w-4 text-neutral-500" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-neutral-500" />
                            )}
                            <span className="font-medium">Sequencia {index + 1}</span>
                            {(seq.plans?.length || 0) > 0 && (
                              <span className="text-xs text-neutral-500 bg-secondary/50 px-2 py-0.5 rounded">
                                {seq.plans?.length} {seq.plans?.length === 1 ? "plano" : "planos"}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDuplicateUpsellSequence(seq)
                              }}
                            >
                              <Copy className="h-4 w-4 text-neutral-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRemoveUpsellSequence(seq.id)
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>

                        {/* Expanded Content */}
                        {expandedSequence === seq.id && (
                          <CardContent className="pt-0 space-y-6">
                            {/* Midias */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm text-neutral-500">
                                <ImageIcon className="h-4 w-4" />
                                <span>Midias (ate 3)</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {/* Midias existentes */}
                                {(seq.medias || []).map((media, mediaIndex) => (
                                  <div key={mediaIndex} className="relative w-24 h-20 rounded-lg overflow-hidden group">
                                    {media.includes("video") || media.includes("mp4") ? (
                                      <video src={media} className="w-full h-full object-cover" muted />
                                    ) : (
                                      <img src={media} alt={`Midia ${mediaIndex + 1}`} className="w-full h-full object-cover" />
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveUpsellMedia(seq.id, mediaIndex)}
                                      className="absolute top-1 right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <X className="h-3 w-3 text-white" />
                                    </button>
                                  </div>
                                ))}
                                
                                {/* Botao de adicionar */}
                                {(seq.medias?.length || 0) < 3 && (
                                  <label className="w-24 h-20 border-2 border-dashed border-neutral-200 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#BEFF00]/50 transition-colors">
                                    {uploadingUpsellMedia === seq.id ? (
                                      <div className="animate-spin h-5 w-5 border-2 border-[#BEFF00] border-t-transparent rounded-full" />
                                    ) : (
                                      <>
                                        <Plus className="h-5 w-5 text-neutral-500" />
                                        <span className="text-xs text-neutral-500 mt-1">Adicionar</span>
                                      </>
                                    )}
                                    <input
                                      type="file"
                                      accept="image/*,video/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        if (file) handleUploadUpsellMedia(seq.id, file)
                                        e.target.value = ""
                                      }}
                                      disabled={uploadingUpsellMedia === seq.id}
                                    />
                                  </label>
                                )}
                              </div>
                            </div>

                            {/* Enviar + Preco */}
                            <div className="flex flex-wrap gap-4">
                              {/* Tempo de envio */}
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-neutral-500">
                                  <Clock className="h-4 w-4" />
                                  <span>Enviar apos:</span>
                                </div>
                                <div className="flex gap-2">
                                  <Input
                                    type="number"
                                    min="1"
                                    value={seq.sendDelayValue || 1}
                                    onChange={(e) => handleUpdateUpsellSequence(seq.id, "sendDelayValue", parseInt(e.target.value) || 1)}
                                    className="w-20 bg-secondary/50 border-neutral-200"
                                  />
                                  <Select
                                    value={seq.sendDelayUnit || "minutes"}
                                    onValueChange={(value: "minutes" | "hours" | "days") => handleUpdateUpsellSequence(seq.id, "sendDelayUnit", value)}
                                  >
                                    <SelectTrigger className="w-28 bg-secondary/50 border-neutral-200">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="minutes">Minutos</SelectItem>
                                      <SelectItem value="hours">Horas</SelectItem>
                                      <SelectItem value="days">Dias</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                            </div>

                            {/* Planos de Assinatura */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Crown className="h-4 w-4 text-amber-500" />
                                  <h4 className="font-medium">Planos</h4>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs text-neutral-500">Usar planos padrao</Label>
                                  <Switch
                                    checked={seq.useDefaultPlans !== false}
                                    onCheckedChange={(checked) => handleUpdateUpsellSequence(seq.id, "useDefaultPlans", checked)}
                                  />
                                </div>
                              </div>
                              
                              {/* Switch mostrar preco no botao */}
                              <div className="flex items-center justify-between p-2 rounded-lg bg-violet-50 border border-violet-100">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-violet-600">Mostrar preco no botao</span>
                                </div>
                                <Switch
                                  checked={seq.showPriceInButton || false}
                                  onCheckedChange={(checked) => handleUpdateUpsellSequence(seq.id, "showPriceInButton", checked)}
                                />
                              </div>
                              
                              {seq.useDefaultPlans !== false ? (
                                // Modo planos padrao - usa planos do boas vindas com desconto
                                <div className="space-y-3">
                                  <p className="text-sm text-neutral-500">
                                    Os planos do Boas Vindas serao exibidos com desconto automatico.
                                  </p>
                                  
                                  {/* Campo de desconto */}
                                  <div className="flex items-center gap-3 p-3 rounded-lg bg-violet-50 border border-violet-200">
                                    <div className="flex-1">
                                      <Label className="text-xs text-violet-700">Desconto aplicado (%)</Label>
                                      <div className="flex items-center gap-2 mt-1">
                                        <DiscountInput
                                          value={seq.discountPercent || 20}
                                          onChange={(val) => handleUpdateUpsellSequence(seq.id, "discountPercent", val)}
                                          className="w-24 bg-white border-violet-200 h-8 text-sm"
                                        />
                                        <span className="text-sm text-violet-600 font-medium">%</span>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Preview dos planos com desconto */}
                                  {plans.length > 0 ? (
                                    <div className="space-y-2">
                                      <Label className="text-xs text-neutral-500">Preview dos planos:</Label>
                                      {plans.map((plan) => {
                                        const originalPrice = Number(plan.price) || 0
                                        const discount = seq.discountPercent || 20
                                        const discountedPrice = originalPrice * (1 - discount / 100)
                                        return (
                                          <div key={plan.id} className="flex items-center justify-between p-2 rounded bg-secondary/30 text-sm">
                                            <span>{plan.name || "Plano"}</span>
                                            <div className="flex items-center gap-2">
                                              <span className="text-neutral-400 line-through">R$ {originalPrice.toFixed(2)}</span>
                                              <span className="text-violet-600 font-medium">R$ {discountedPrice.toFixed(2)}</span>
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                                      Nenhum plano configurado em Boas Vindas. Configure os planos primeiro.
                                    </p>
                                  )}
                                </div>
                              ) : (
                                // Modo planos personalizados
                                <div className="space-y-3">
                                  <p className="text-sm text-neutral-500">
                                    Configure planos personalizados para esta sequencia de upsell.
                                  </p>
                                  
                                  <div className="space-y-2">
                                    {(seq.plans || []).map((plan) => (
                                      <div key={plan.id} className="rounded-lg bg-secondary/30 p-3 space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                          <div className="space-y-1">
                                            <Label className="text-xs text-neutral-500">Nome do Plano</Label>
                                            <Input
                                              value={plan.buttonText}
                                              onChange={(e) => handleUpdateUpsellPlan(seq.id, plan.id, "buttonText", e.target.value)}
                                              placeholder="Ex: Mensal"
                                              className="bg-secondary/50 border-neutral-200 h-8 text-sm"
                                            />
                                            {seq.showPriceInButton && plan.price > 0 && (
                                              <p className="text-xs text-violet-500">Preview: {plan.buttonText} por R$ {Number(plan.price).toFixed(2)}</p>
                                            )}
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs text-neutral-500">Valor (R$)</Label>
                                            <Input
                                              type="text"
                                              inputMode="decimal"
                                              value={plan.price || ""}
                                              onChange={(e) => {
                                                const val = e.target.value.replace(/[^0-9.,]/g, "").replace(",", ".")
                                                handleUpdateUpsellPlan(seq.id, plan.id, "price", val === "" ? 0 : val)
                                              }}
                                              onBlur={() => {
                                                const num = parseFloat(String(plan.price).replace(",", ".")) || 0
                                                handleUpdateUpsellPlan(seq.id, plan.id, "price", num)
                                              }}
                                              placeholder="0.00"
                                              className="bg-secondary/50 border-neutral-200 h-8 text-sm"
                                            />
                                          </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                          <div className="space-y-1">
                                            <Label className="text-xs text-neutral-500">Duracao do Acesso</Label>
                                            <Select
                                              value={getDurationSelectValue(plan.duration_days) || "30_monthly"}
                                              onValueChange={(value) => {
                                                const [daysStr, type] = value.split("_")
                                                const days = parseInt(daysStr, 10)
                                                // Usar funcao que atualiza multiplos campos de uma vez para evitar race condition
                                                handleUpdateUpsellPlanMulti(seq.id, plan.id, { 
                                                  duration_days: days, 
                                                  duration_type: type as UpsellPlan["duration_type"] 
                                                })
                                              }}
                                            >
                                              <SelectTrigger className="bg-secondary/50 border-neutral-200 h-8 text-sm">
                                                <SelectValue placeholder="30 dias" />
                                              </SelectTrigger>
                                              <SelectContent position="popper" sideOffset={4}>
                                                <SelectItem value="1_daily">Diario (1 dia)</SelectItem>
                                                <SelectItem value="7_weekly">Semanal (7 dias)</SelectItem>
                                                <SelectItem value="15_monthly">Quinzenal (15 dias)</SelectItem>
                                                <SelectItem value="30_monthly">Mensal (30 dias)</SelectItem>
                                                <SelectItem value="60_monthly">Bimestral (60 dias)</SelectItem>
                                                <SelectItem value="90_monthly">Trimestral (90 dias)</SelectItem>
                                                <SelectItem value="180_monthly">Semestral (180 dias)</SelectItem>
                                                <SelectItem value="365_yearly">Anual (365 dias)</SelectItem>
                                                <SelectItem value="0_lifetime">Vitalicio (sem expiracao)</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <div className="flex items-end">
                                            {(seq.plans?.length || 0) > 1 && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive hover:text-destructive"
                                                onClick={() => handleRemoveUpsellPlan(seq.id, plan.id)}
                                              >
                                                <Trash2 className="h-4 w-4 mr-1" />
                                                Remover
                                              </Button>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  {(seq.plans?.length || 0) < 5 && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="w-full border-dashed"
                                      onClick={() => handleAddUpsellPlan(seq.id)}
                                    >
                                      <Plus className="h-4 w-4 mr-2" />
                                      Adicionar Plano
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Mensagem */}
                            <div className="space-y-2">
                              <Label>Mensagem <span className="text-destructive">*</span></Label>
                              <RichTextEditor
                                value={seq.message}
                                onChange={(value) => handleUpdateUpsellSequence(seq.id, "message", value)}
                                placeholder="Oferta especial para voce! Aproveite esse bonus exclusivo..."
                                rows={4}
                                maxLength={4000}
                                className="bg-neutral-50 border-neutral-200"
                                variables={[
                                  { label: "{nome}", value: "{nome}" },
                                  { label: "{username}", value: "{username}" }
                                ]}
                              />
                            </div>

                            <div className="border-t border-neutral-200 pt-4" />

                            {/* Entrega */}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-[#BEFF00]" />
                                <h4 className="font-medium">Entrega desta sequencia</h4>
                              </div>
                              <Select
                                value={seq.deliveryType || "global"}
                                onValueChange={(value: "global" | "custom") => handleUpdateUpsellSequence(seq.id, "deliveryType", value)}
                              >
                                <SelectTrigger className="bg-secondary/50 border-neutral-200">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="global">Usar entrega global do upsell</SelectItem>
                                  <SelectItem value="custom">Entrega personalizada</SelectItem>
                                </SelectContent>
                              </Select>
                              
                              {seq.deliveryType === "custom" && (
                                <div className="space-y-2">
                                  <Label className="text-xs text-neutral-500">Selecione um entregavel</Label>
                                  <Select
                                    value={seq.deliverableId || ""}
                                    onValueChange={(value) => handleUpdateUpsellSequence(seq.id, "deliverableId", value)}
                                  >
                                    <SelectTrigger className="bg-secondary/50 border-neutral-200">
                                      <SelectValue placeholder="Selecione um entregavel" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {deliverables.map((d) => (
                                        <SelectItem key={d.id} value={d.id}>
                                          {d.name} ({d.type === "media" ? "Midia" : d.type === "link" ? "Link" : "Grupo VIP"})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    ))}

                    {/* Add Sequence Button */}
                    {upsellSequences.length < 20 && (
                      <Button onClick={handleAddUpsellSequence} className="w-full bg-[#bfff00] hover:bg-[#d4ff4d] text-neutral-900">
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Sequencia
                      </Button>
                    )}
                  </div>
                )}
                </div>
              </div>
            </div>
          )}

{/* Downsell Tab */}
  {activeTab === "downsell" && (
  <div className="space-y-6">
  {/* Downsell Main Card */}
  <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
  <div className="px-6 py-5 border-b border-neutral-100">
  <div className="flex items-center justify-between">
  <div className="flex items-center gap-3">
  <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${downsellSubTab === "normal" ? "from-pink-500 to-pink-600 shadow-pink-500/25" : "from-orange-500 to-orange-600 shadow-orange-500/25"} flex items-center justify-center shadow-lg`}>
  <TrendingDown className="h-5 w-5 text-white" />
  </div>
  <div>
  <h3 className="font-bold text-neutral-900">Downsell</h3>
  <p className="text-sm text-neutral-500">Recupere vendas com ofertas alternativas</p>
  </div>
  </div>
  <div className="flex items-center gap-3">
  <span className="text-sm font-bold text-neutral-900 bg-[#bfff00] px-3 py-1 rounded-full">
  {downsellSubTab === "normal" ? downsellSequences.length : downsellPixSequences.length}/20
  </span>
  <Switch
  checked={downsellSubTab === "normal" ? downsellEnabled : downsellPixEnabled}
  onCheckedChange={(checked) => {
  if (downsellSubTab === "normal") {
    setDownsellEnabled(checked)
  } else {
    setDownsellPixEnabled(checked)
  }
  markChange()
  }}
  />
  </div>
  </div>
  </div>

  {/* Sub-tabs Normal / PIX Gerado */}
  <div className="px-6 py-3 bg-neutral-50 border-b border-neutral-100 flex items-center gap-3">
  <button
    type="button"
    onClick={() => setDownsellSubTab("normal")}
    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
      downsellSubTab === "normal"
        ? "bg-pink-500 text-white shadow-sm"
        : "bg-white text-neutral-600 border border-neutral-200 hover:border-pink-300"
    }`}
  >
    Normal
  </button>
  <button
    type="button"
    onClick={() => setDownsellSubTab("pix")}
    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
      downsellSubTab === "pix"
        ? "bg-orange-500 text-white shadow-sm"
        : "bg-white text-neutral-600 border border-neutral-200 hover:border-orange-300"
    }`}
  >
    PIX Gerado
  </button>
  </div>
  
  {/* Info sobre downsell */}
  <div className="px-6 py-3 bg-neutral-50 border-b border-neutral-100 flex items-center gap-2">
  <Clock className={`h-4 w-4 ${downsellSubTab === "normal" ? "text-pink-500" : "text-orange-500"}`} />
  <span className="text-xs text-neutral-500">
  {downsellSubTab === "normal" 
    ? "Sequencias enviadas automaticamente apos o /start para quem nao pagou"
    : "Sequencias enviadas quando o cliente gera um PIX mas ainda nao pagou"}
  </span>
  </div>

                {/* ===== DOWNSELL NORMAL ===== */}
                {downsellSubTab === "normal" && (
                  <>
                {downsellEnabled && (
                  <div className="px-6 py-4 bg-neutral-50 border-b border-neutral-100">
                    <div className="flex items-center gap-6">
                      <div className="flex-1">
                        <Label className="text-sm font-medium text-neutral-700">Entrega do Downsell</Label>
                        <Select
                          value={downsellDeliveryType}
                          onValueChange={(value: "same" | "custom") => {
                            setDownsellDeliveryType(value)
                            markChange()
                          }}
                        >
                          <SelectTrigger className="bg-white border-neutral-200 mt-1.5">
                            <div className="flex items-center gap-2">
                              <RefreshCw className="h-4 w-4 text-neutral-500" />
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="same">Mesmo do fluxo principal</SelectItem>
                            <SelectItem value="custom">Entrega personalizada</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1 p-3 rounded-xl bg-pink-500/10 border border-pink-500/20">
                        <p className="text-xs font-medium text-pink-500 mb-1">Como funciona?</p>
                        <p className="text-xs text-neutral-600">Downsell e enviado automaticamente se o cliente nao comprar.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sequences Section */}
                <div className="p-6">

                  {!downsellEnabled ? (
                    <Card className="bg-white border-neutral-100 shadow-sm rounded-2xl">
                      <CardContent className="flex flex-col items-center justify-center py-16">
                        <TrendingDown className="h-10 w-10 text-neutral-500/30 mb-4" />
                        <p className="text-neutral-500">Ative o Downsell para configurar sequencias</p>
                      </CardContent>
                    </Card>
                  ) : downsellSequences.length === 0 ? (
                    <Card className="bg-white border-neutral-100 shadow-sm rounded-2xl">
                      <CardContent className="flex flex-col items-center justify-center py-16">
                        <Plus className="h-10 w-10 text-neutral-500/30 mb-4" />
                        <p className="text-neutral-500 mb-4">
                          Nenhuma sequencia de downsell configurada
                        </p>
                        <Button onClick={handleAddDownsellSequence} className="bg-pink-500 hover:bg-pink-600">
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Sequencia
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {downsellSequences.map((seq, index) => (
                        <Card key={seq.id} className="border-neutral-200">
                          {/* Sequence Header */}
                          <div
                            className="flex items-center justify-between p-4 cursor-pointer"
                            onClick={() => setExpandedDownsellSequence(expandedDownsellSequence === seq.id ? null : seq.id)}
                          >
                            <div className="flex items-center gap-2">
  {expandedDownsellSequence === seq.id ? (
  <ChevronDown className="h-4 w-4 text-neutral-500" />
  ) : (
  <ChevronRight className="h-4 w-4 text-neutral-500" />
  )}
  <span className="font-medium">Sequencia {index + 1}</span>
  {(seq.plans?.length || 0) > 0 && (
    <span className="text-xs text-neutral-500 bg-secondary/50 px-2 py-0.5 rounded">
      {seq.plans?.length} {seq.plans?.length === 1 ? "plano" : "planos"}
    </span>
  )}
  </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDuplicateDownsellSequence(seq)
                                }}
                              >
                                <Copy className="h-4 w-4 text-neutral-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRemoveDownsellSequence(seq.id)
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>

                          {/* Expanded Content */}
                          {expandedDownsellSequence === seq.id && (
                            <CardContent className="pt-0 space-y-6">
                              {/* Midias */}
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-neutral-500">
                                  <ImageIcon className="h-4 w-4" />
                                  <span>Midias (ate 3)</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {/* Midias existentes */}
                                  {(seq.medias || []).map((media, mediaIndex) => (
                                    <div key={mediaIndex} className="relative w-24 h-20 rounded-lg overflow-hidden group">
                                      {media.includes("video") || media.includes("mp4") ? (
                                        <video src={media} className="w-full h-full object-cover" muted />
                                      ) : (
                                        <img src={media} alt={`Midia ${mediaIndex + 1}`} className="w-full h-full object-cover" />
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveDownsellMedia(seq.id, mediaIndex)}
                                        className="absolute top-1 right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <X className="h-3 w-3 text-white" />
                                      </button>
                                    </div>
                                  ))}
                                  
                                  {/* Botao de adicionar */}
                                  {(seq.medias?.length || 0) < 3 && (
                                    <label className="w-24 h-20 border-2 border-dashed border-neutral-200 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-pink-500/50 transition-colors">
                                      {uploadingDownsellMedia === seq.id ? (
                                        <div className="animate-spin h-5 w-5 border-2 border-pink-500 border-t-transparent rounded-full" />
                                      ) : (
                                        <>
                                          <Plus className="h-5 w-5 text-neutral-500" />
                                          <span className="text-xs text-neutral-500 mt-1">Adicionar</span>
                                        </>
                                      )}
                                      <input
                                        type="file"
                                        accept="image/*,video/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0]
                                          if (file) handleUploadDownsellMedia(seq.id, file)
                                          e.target.value = ""
                                        }}
                                        disabled={uploadingDownsellMedia === seq.id}
                                      />
                                    </label>
                                  )}
                                </div>
                              </div>

                              {/* Enviar + Preco */}
                              <div className="flex flex-wrap gap-4">
                                {/* Tempo de envio */}
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-sm text-neutral-500">
                                    <Clock className="h-4 w-4" />
                                    <span>Enviar apos:</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <Input
                                      type="number"
                                      value={seq.sendDelayValue || 1}
                                      onChange={(e) => handleUpdateDownsellSequence(seq.id, "sendDelayValue", parseInt(e.target.value) || 1)}
                                      className="w-20 bg-secondary/50 border-neutral-200"
                                      min={1}
                                    />
                                    <Select
                                      value={seq.sendDelayUnit || "minutes"}
                                      onValueChange={(value: "minutes" | "hours" | "days") => handleUpdateDownsellSequence(seq.id, "sendDelayUnit", value)}
                                    >
                                      <SelectTrigger className="w-28 bg-secondary/50 border-neutral-200">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="minutes">Minutos</SelectItem>
                                        <SelectItem value="hours">Horas</SelectItem>
                                        <SelectItem value="days">Dias</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                              </div>

                              {/* Planos de Assinatura */}
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Crown className="h-4 w-4 text-amber-500" />
                                    <h4 className="font-medium">Planos</h4>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Label className="text-xs text-neutral-500">Usar planos padrao</Label>
                                    <Switch
                                      checked={seq.useDefaultPlans !== false}
                                      onCheckedChange={(checked) => handleUpdateDownsellSequence(seq.id, "useDefaultPlans", checked)}
                                    />
                                  </div>
                                </div>
                                
                                {/* Switch mostrar preco no botao */}
                                <div className="flex items-center justify-between p-2 rounded-lg bg-pink-50 border border-pink-100">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-pink-600">Mostrar preco no botao</span>
                                  </div>
                                  <Switch
                                    checked={seq.showPriceInButton || false}
                                    onCheckedChange={(checked) => handleUpdateDownsellSequence(seq.id, "showPriceInButton", checked)}
                                  />
                                </div>
                                
                                {seq.useDefaultPlans !== false ? (
                                  // Modo planos padrao - usa planos do boas vindas com desconto
                                  <div className="space-y-3">
                                    <p className="text-sm text-neutral-500">
                                      Os planos do Boas Vindas serao exibidos com desconto automatico.
                                    </p>
                                    
                                    {/* Campo de desconto */}
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-pink-50 border border-pink-200">
                                      <div className="flex-1">
                                        <Label className="text-xs text-pink-700">Desconto aplicado (%)</Label>
                                        <div className="flex items-center gap-2 mt-1">
                                          <DiscountInput
                                            value={seq.discountPercent || 20}
                                            onChange={(val) => handleUpdateDownsellSequence(seq.id, "discountPercent", val)}
                                            className="w-24 bg-white border-pink-200 h-8 text-sm"
                                          />
                                          <span className="text-sm text-pink-600 font-medium">%</span>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Preview dos planos com desconto */}
                                    {plans.length > 0 ? (
                                      <div className="space-y-2">
                                        <Label className="text-xs text-neutral-500">Preview dos planos:</Label>
                                        {plans.map((plan) => {
                                          const originalPrice = Number(plan.price) || 0
                                          const discount = seq.discountPercent || 20
                                          const discountedPrice = originalPrice * (1 - discount / 100)
                                          return (
                                            <div key={plan.id} className="flex items-center justify-between p-2 rounded bg-secondary/30 text-sm">
                                              <span>{plan.name || "Plano"}</span>
                                              <div className="flex items-center gap-2">
                                                <span className="text-neutral-400 line-through">R$ {originalPrice.toFixed(2)}</span>
                                                <span className="text-pink-600 font-medium">R$ {discountedPrice.toFixed(2)}</span>
                                              </div>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                                        Nenhum plano configurado em Boas Vindas. Configure os planos primeiro.
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  // Modo planos personalizados
                                  <div className="space-y-3">
                                    <p className="text-sm text-neutral-500">
                                      Configure planos personalizados para esta sequencia de downsell.
                                    </p>
                                    
                                    <div className="space-y-2">
                                      {(seq.plans || []).map((plan) => (
                                        <div key={plan.id} className="rounded-lg bg-secondary/30 p-3 space-y-3">
                                          <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                              <Label className="text-xs text-neutral-500">Nome do Plano</Label>
                                              <Input
                                                value={plan.buttonText}
                                                onChange={(e) => handleUpdateDownsellPlan(seq.id, plan.id, "buttonText", e.target.value)}
                                                placeholder="Ex: Mensal"
                                                className="bg-secondary/50 border-neutral-200 h-8 text-sm"
                                              />
                                            </div>
                                            <div className="space-y-1">
                                              <Label className="text-xs text-neutral-500">Valor (R$)</Label>
                                              <Input
                                                type="text"
                                                inputMode="decimal"
                                                value={plan.price || ""}
                                                onChange={(e) => {
                                                  const val = e.target.value.replace(/[^0-9.,]/g, "").replace(",", ".")
                                                  handleUpdateDownsellPlan(seq.id, plan.id, "price", val === "" ? 0 : val)
                                                }}
                                                onBlur={() => {
                                                  const num = parseFloat(String(plan.price).replace(",", ".")) || 0
                                                  handleUpdateDownsellPlan(seq.id, plan.id, "price", num)
                                                }}
                                                placeholder="0.00"
                                                className="bg-secondary/50 border-neutral-200 h-8 text-sm"
                                              />
                                            </div>
                                          </div>
                                          <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                              <Label className="text-xs text-neutral-500">Duracao do Acesso</Label>
                                              <Select
                                                value={getDurationSelectValue(plan.duration_days) || "30_monthly"}
                                                onValueChange={(value) => {
                                                  const [daysStr, type] = value.split("_")
                                                  const days = parseInt(daysStr, 10)
                                                  // Usar funcao que atualiza multiplos campos de uma vez para evitar race condition
                                                  handleUpdateDownsellPlanMulti(seq.id, plan.id, { 
                                                    duration_days: days, 
                                                    duration_type: type as DownsellPlan["duration_type"] 
                                                  })
                                                }}
                                              >
                                                <SelectTrigger className="bg-secondary/50 border-neutral-200 h-8 text-sm">
                                                  <SelectValue placeholder="30 dias" />
                                                </SelectTrigger>
                                                <SelectContent position="popper" sideOffset={4}>
                                                  <SelectItem value="1_daily">Diario (1 dia)</SelectItem>
                                                  <SelectItem value="7_weekly">Semanal (7 dias)</SelectItem>
                                                  <SelectItem value="15_monthly">Quinzenal (15 dias)</SelectItem>
                                                  <SelectItem value="30_monthly">Mensal (30 dias)</SelectItem>
                                                  <SelectItem value="60_monthly">Bimestral (60 dias)</SelectItem>
                                                  <SelectItem value="90_monthly">Trimestral (90 dias)</SelectItem>
                                                  <SelectItem value="180_monthly">Semestral (180 dias)</SelectItem>
                                                  <SelectItem value="365_yearly">Anual (365 dias)</SelectItem>
                                                  <SelectItem value="0_lifetime">Vitalicio (sem expiracao)</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>
                                            <div className="flex items-end">
                                              {(seq.plans?.length || 0) > 1 && (
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="text-destructive hover:text-destructive"
                                                  onClick={() => handleRemoveDownsellPlan(seq.id, plan.id)}
                                                >
                                                  <Trash2 className="h-4 w-4 mr-1" />
                                                  Remover
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>

                                    {(seq.plans?.length || 0) < 5 && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full border-dashed"
                                        onClick={() => handleAddDownsellPlan(seq.id)}
                                      >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Adicionar Plano
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Mensagem */}
                              <div className="space-y-2">
                                <Label>Mensagem <span className="text-destructive">*</span></Label>
                                <RichTextEditor
                                  value={seq.message}
                                  onChange={(value) => handleUpdateDownsellSequence(seq.id, "message", value)}
                                  placeholder="Nao conseguiu pagar? Temos uma oferta especial..."
                                  rows={4}
                                  maxLength={4000}
                                  className="bg-neutral-50 border-neutral-200"
                                  variables={[
                                    { label: "{nome}", value: "{nome}" },
                                    { label: "{username}", value: "{username}" }
                                  ]}
                                />
                              </div>

                              <div className="border-t border-neutral-200 pt-4" />

                              {/* Entrega */}
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-medium">Entrega</h4>
                                  <span className="text-sm text-neutral-500">Opcional</span>
                                </div>
                                <p className="text-sm text-neutral-500">
                                  Por padrao, usa o entregavel principal. Selecione outro entregavel para esta sequencia.
                                </p>
                                <Select
                                  value={seq.deliveryType || "global"}
                                  onValueChange={(value: "global" | "custom") => {
                                    handleUpdateDownsellSequence(seq.id, "deliveryType", value)
                                    if (value === "global") {
                                      handleUpdateDownsellSequence(seq.id, "deliverableId", "")
                                    }
                                  }}
                                >
                                  <SelectTrigger className="bg-white border-neutral-200">
                                    <div className="flex items-center gap-2">
                                      <RefreshCw className="h-4 w-4 text-neutral-500" />
                                      <SelectValue />
                                    </div>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="global">Usar entregavel principal</SelectItem>
                                    <SelectItem value="custom">Selecionar entregavel</SelectItem>
                                  </SelectContent>
                                </Select>

                                {/* Seletor de entregavel */}
                                {(seq.deliveryType || "global") === "custom" && (
                                  <div className="space-y-2 pt-2">
                                    {deliverables.length === 0 ? (
                                      <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
                                        <div className="flex items-start gap-2">
                                          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                                          <div className="text-sm">
                                            <p className="font-medium text-amber-500">Nenhum entregavel cadastrado</p>
                                            <p className="text-neutral-500">
                                              Va para a aba &quot;Entregaveis&quot; para criar entregaveis reutilizaveis.
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <Label className="text-sm">Selecione o entregavel</Label>
                                        <Select
                                          value={seq.deliverableId || "none"}
                                          onValueChange={(value) => handleUpdateDownsellSequence(seq.id, "deliverableId", value === "none" ? "" : value)}
                                        >
                                          <SelectTrigger className="bg-white border-neutral-200">
                                            <SelectValue placeholder="Selecione..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="none">Nenhum selecionado</SelectItem>
                                            {deliverables.map((d) => (
                                              <SelectItem key={d.id} value={d.id}>
                                                <div className="flex items-center gap-2">
                                                  {d.type === "media" && <ImageIcon className="h-3 w-3" />}
                                                  {d.type === "link" && <Link2 className="h-3 w-3" />}
                                                  {d.type === "vip_group" && <Users className="h-3 w-3" />}
                                                  {d.name}
                                                </div>
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        {seq.deliverableId && (
                                          <p className="text-xs text-neutral-500">
                                            Tipo: {deliverables.find(d => d.id === seq.deliverableId)?.type === "media" ? "Midia" : deliverables.find(d => d.id === seq.deliverableId)?.type === "link" ? "Link" : "Grupo VIP"}
                                          </p>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      ))}

                      {/* Add Sequence Button */}
                      {downsellSequences.length < 20 && (
                        <Button
                          variant="outline"
                          className="w-full border-dashed"
                          onClick={handleAddDownsellSequence}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Sequencia
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                  </>
                )}

                {/* ===== DOWNSELL PIX GERADO ===== */}
                {downsellSubTab === "pix" && (
                  <>
                {downsellPixEnabled && (
                  <div className="px-6 py-4 bg-neutral-50 border-b border-neutral-100">
                    <div className="flex items-center gap-6">
                      <div className="flex-1">
                        <Label className="text-sm font-medium text-neutral-700">Entrega do Downsell PIX</Label>
                        <Select
                          value={downsellPixDeliveryType}
                          onValueChange={(value: "same" | "custom") => {
                            setDownsellPixDeliveryType(value)
                            markChange()
                          }}
                        >
                          <SelectTrigger className="bg-white border-neutral-200 mt-1.5">
                            <div className="flex items-center gap-2">
                              <RefreshCw className="h-4 w-4 text-neutral-500" />
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="same">Mesmo do fluxo principal</SelectItem>
                            <SelectItem value="custom">Entrega personalizada</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sequences Section */}
                <div className="p-6">
                  {!downsellPixEnabled ? (
                    <Card className="bg-white border-neutral-100 shadow-sm rounded-2xl">
                      <CardContent className="flex flex-col items-center justify-center py-16">
                        <TrendingDown className="h-10 w-10 text-neutral-500/30 mb-4" />
                        <p className="text-neutral-500">Ative o Downsell PIX para configurar sequencias</p>
                      </CardContent>
                    </Card>
                  ) : downsellPixSequences.length === 0 ? (
                    <Card className="bg-white border-neutral-100 shadow-sm rounded-2xl">
                      <CardContent className="flex flex-col items-center justify-center py-16">
                        <Plus className="h-10 w-10 text-neutral-500/30 mb-4" />
                        <p className="text-neutral-500 mb-4">
                          Nenhuma sequencia de downsell PIX configurada
                        </p>
                        <Button onClick={handleAddDownsellPixSequence} className="bg-orange-500 hover:bg-orange-600">
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Sequencia
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {downsellPixSequences.map((seq, index) => (
                        <Card key={seq.id} className="border-neutral-200">
                          {/* Sequence Header */}
                          <div
                            className="flex items-center justify-between p-4 cursor-pointer"
                            onClick={() => setExpandedDownsellPixSequence(expandedDownsellPixSequence === seq.id ? null : seq.id)}
                          >
                            <div className="flex items-center gap-2">
                              {expandedDownsellPixSequence === seq.id ? (
                                <ChevronDown className="h-4 w-4 text-neutral-500" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-neutral-500" />
                              )}
                              <span className="font-medium">Sequencia {index + 1}</span>
                              {(seq.plans?.length || 0) > 0 && (
                                <span className="text-xs text-neutral-500 bg-secondary/50 px-2 py-0.5 rounded">
                                  {seq.plans?.length} {seq.plans?.length === 1 ? "plano" : "planos"}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDuplicateDownsellPixSequence(seq)
                                }}
                              >
                                <Copy className="h-4 w-4 text-neutral-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRemoveDownsellPixSequence(seq.id)
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>

                          {/* Expanded Content */}
                          {expandedDownsellPixSequence === seq.id && (
                            <CardContent className="pt-0 space-y-6">
                              {/* Midias */}
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-neutral-500">
                                  <ImageIcon className="h-4 w-4" />
                                  <span>Midias (ate 3)</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {(seq.medias || []).map((media, mediaIndex) => (
                                    <div key={mediaIndex} className="relative w-24 h-20 rounded-lg overflow-hidden group">
                                      {media.includes("video") || media.includes("mp4") ? (
                                        <video src={media} className="w-full h-full object-cover" muted />
                                      ) : (
                                        <img src={media} alt={`Midia ${mediaIndex + 1}`} className="w-full h-full object-cover" />
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveDownsellPixMedia(seq.id, mediaIndex)}
                                        className="absolute top-1 right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <X className="h-3 w-3 text-white" />
                                      </button>
                                    </div>
                                  ))}
                                  
                                  {(seq.medias?.length || 0) < 3 && (
                                    <label className="w-24 h-20 border-2 border-dashed border-neutral-200 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-orange-500/50 transition-colors">
                                      {uploadingDownsellPixMedia === seq.id ? (
                                        <div className="animate-spin h-5 w-5 border-2 border-orange-500 border-t-transparent rounded-full" />
                                      ) : (
                                        <>
                                          <Plus className="h-5 w-5 text-neutral-500" />
                                          <span className="text-xs text-neutral-500 mt-1">Adicionar</span>
                                        </>
                                      )}
                                      <input
                                        type="file"
                                        accept="image/*,video/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0]
                                          if (file) handleUploadDownsellPixMedia(seq.id, file)
                                          e.target.value = ""
                                        }}
                                        disabled={uploadingDownsellPixMedia === seq.id}
                                      />
                                    </label>
                                  )}
                                </div>
                              </div>

                              {/* Mensagem */}
                              <div className="space-y-3">
                                <Label className="text-sm text-neutral-500">Mensagem</Label>
                                <RichTextEditor
                                  value={seq.message}
                                  onChange={(value) => handleUpdateDownsellPixSequence(seq.id, "message", value)}
                                  rows={4}
                                  maxLength={4000}
                                  placeholder="Digite a mensagem de downsell..."
                                  className="bg-secondary/50 border-neutral-200"
                                  variables={[
                                    { label: "{nome}", value: "{nome}" },
                                    { label: "{username}", value: "{username}" }
                                  ]}
                                />
                              </div>

                              {/* Tempo de envio */}
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-neutral-500">
                                  <Clock className="h-4 w-4" />
                                  <span>Enviar apos gerar PIX:</span>
                                </div>
                                <div className="flex gap-2">
                                  <Input
                                    type="number"
                                    value={seq.sendDelayValue || 5}
                                    onChange={(e) => handleUpdateDownsellPixSequence(seq.id, "sendDelayValue", parseInt(e.target.value) || 1)}
                                    className="w-20 bg-secondary/50 border-neutral-200"
                                    min={1}
                                  />
                                  <Select
                                    value={seq.sendDelayUnit || "minutes"}
                                    onValueChange={(value: "minutes" | "hours" | "days") => handleUpdateDownsellPixSequence(seq.id, "sendDelayUnit", value)}
                                  >
                                    <SelectTrigger className="w-28 bg-secondary/50 border-neutral-200">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="minutes">Minutos</SelectItem>
                                      <SelectItem value="hours">Horas</SelectItem>
                                      <SelectItem value="days">Dias</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

{/* Planos */}
  <div className="space-y-3">
  <div className="flex items-center justify-between">
  <div className="flex items-center gap-2">
  <Crown className="h-4 w-4 text-amber-500" />
  <h4 className="font-medium">Planos</h4>
  </div>
  <div className="flex items-center gap-2">
  <Label className="text-xs text-neutral-500">Usar planos padrao</Label>
  <Switch
  checked={seq.useDefaultPlans !== false}
  onCheckedChange={(checked) => handleUpdateDownsellPixSequence(seq.id, "useDefaultPlans", checked)}
  />
  </div>
  </div>
  
  {/* Switch mostrar preco no botao */}
  <div className="flex items-center justify-between p-2 rounded-lg bg-orange-50 border border-orange-100">
  <div className="flex items-center gap-2">
  <span className="text-xs text-orange-600">Mostrar preco no botao</span>
  </div>
  <Switch
  checked={seq.showPriceInButton || false}
  onCheckedChange={(checked) => handleUpdateDownsellPixSequence(seq.id, "showPriceInButton", checked)}
  />
  </div>
  
  {seq.useDefaultPlans !== false ? (
  // Modo planos padrao - usa planos do boas vindas com desconto
  <div className="space-y-3">
  <p className="text-sm text-neutral-500">
  Os planos do Boas Vindas serao exibidos com desconto automatico.
  </p>
                                    
                                    {/* Campo de desconto */}
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 border border-orange-200">
                                      <div className="flex-1">
                                        <Label className="text-xs text-orange-700">Desconto aplicado (%)</Label>
                                        <div className="flex items-center gap-2 mt-1">
                                          <DiscountInput
                                            value={seq.discountPercent || 20}
                                            onChange={(val) => handleUpdateDownsellPixSequence(seq.id, "discountPercent", val)}
                                            className="w-24 bg-white border-orange-200 h-8 text-sm"
                                          />
                                          <span className="text-sm text-orange-600 font-medium">%</span>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Preview dos planos com desconto */}
                                    {plans.length > 0 ? (
                                      <div className="space-y-2">
                                        <Label className="text-xs text-neutral-500">Preview dos planos:</Label>
                                        {plans.map((plan) => {
                                          const originalPrice = Number(plan.price) || 0
                                          const discount = seq.discountPercent || 20
                                          const discountedPrice = originalPrice * (1 - discount / 100)
                                          return (
                                            <div key={plan.id} className="flex items-center justify-between p-2 rounded bg-secondary/30 text-sm">
                                              <span>{plan.name || "Plano"}</span>
                                              <div className="flex items-center gap-2">
                                                <span className="text-neutral-400 line-through">R$ {originalPrice.toFixed(2)}</span>
                                                <span className="text-orange-600 font-medium">R$ {discountedPrice.toFixed(2)}</span>
                                              </div>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                                        Nenhum plano configurado em Boas Vindas. Configure os planos primeiro.
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  // Modo planos personalizados
                                  <div className="space-y-3">
                                    <p className="text-sm text-neutral-500">
                                      Configure planos personalizados para esta sequencia de downsell.
                                    </p>
                                    
                                    <div className="space-y-2">
                                      {(seq.plans || []).map((plan) => (
                                        <div key={plan.id} className="rounded-lg bg-secondary/30 p-3 space-y-3">
                                          <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                              <Label className="text-xs text-neutral-500">Nome do Plano</Label>
                                              <Input
                                                value={plan.buttonText}
                                                onChange={(e) => handleUpdateDownsellPixPlan(seq.id, plan.id, "buttonText", e.target.value)}
                                                placeholder="Ex: Mensal"
                                                className="bg-secondary/50 border-neutral-200 h-8 text-sm"
                                              />
                                            </div>
                                            <div className="space-y-1">
                                              <Label className="text-xs text-neutral-500">Valor (R$)</Label>
                                              <Input
                                                type="text"
                                                inputMode="decimal"
                                                value={plan.price || ""}
                                                onChange={(e) => {
                                                  const val = e.target.value.replace(/[^0-9.,]/g, "").replace(",", ".")
                                                  handleUpdateDownsellPixPlan(seq.id, plan.id, "price", val === "" ? 0 : val)
                                                }}
                                                onBlur={() => {
                                                  const num = parseFloat(String(plan.price).replace(",", ".")) || 0
                                                  handleUpdateDownsellPixPlan(seq.id, plan.id, "price", num)
                                                }}
                                                placeholder="0.00"
                                                className="bg-secondary/50 border-neutral-200 h-8 text-sm"
                                              />
                                            </div>
                                          </div>
                                          <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                              <Label className="text-xs text-neutral-500">Duracao do Acesso</Label>
                                              <Select
                                                value={getDurationSelectValue(plan.duration_days) || "30_monthly"}
                                                onValueChange={(value) => {
                                                  const [daysStr, type] = value.split("_")
                                                  const days = parseInt(daysStr, 10)
                                                  // Usar funcao que atualiza multiplos campos de uma vez para evitar race condition
                                                  handleUpdateDownsellPixPlanMulti(seq.id, plan.id, { 
                                                    duration_days: days, 
                                                    duration_type: type as DownsellPlan["duration_type"] 
                                                  })
                                                }}
                                              >
                                                <SelectTrigger className="bg-secondary/50 border-neutral-200 h-8 text-sm">
                                                  <SelectValue placeholder="30 dias" />
                                                </SelectTrigger>
                                                <SelectContent position="popper" sideOffset={4}>
                                                  <SelectItem value="1_daily">Diario (1 dia)</SelectItem>
                                                  <SelectItem value="7_weekly">Semanal (7 dias)</SelectItem>
                                                  <SelectItem value="15_monthly">Quinzenal (15 dias)</SelectItem>
                                                  <SelectItem value="30_monthly">Mensal (30 dias)</SelectItem>
                                                  <SelectItem value="60_monthly">Bimestral (60 dias)</SelectItem>
                                                  <SelectItem value="90_monthly">Trimestral (90 dias)</SelectItem>
                                                  <SelectItem value="180_monthly">Semestral (180 dias)</SelectItem>
                                                  <SelectItem value="365_yearly">Anual (365 dias)</SelectItem>
                                                  <SelectItem value="0_lifetime">Vitalicio (sem expiracao)</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>
                                            <div className="flex items-end">
                                              {(seq.plans?.length || 0) > 1 && (
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="text-destructive hover:text-destructive"
                                                  onClick={() => handleRemoveDownsellPixPlan(seq.id, plan.id)}
                                                >
                                                  <Trash2 className="h-4 w-4 mr-1" />
                                                  Remover
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>

                                    {(seq.plans?.length || 0) < 5 && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full border-dashed"
                                        onClick={() => handleAddDownsellPixPlan(seq.id)}
                                      >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Adicionar Plano
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Entrega */}
                              <div className="space-y-2">
                                <Label className="text-sm text-neutral-500">Entrega desta sequencia</Label>
                                <Select
                                  value={seq.deliveryType || "global"}
                                  onValueChange={(value: "global" | "custom") => handleUpdateDownsellPixSequence(seq.id, "deliveryType", value)}
                                >
                                  <SelectTrigger className="bg-secondary/50 border-neutral-200">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="global">Usar entrega global</SelectItem>
                                    <SelectItem value="custom">Entrega personalizada</SelectItem>
                                  </SelectContent>
                                </Select>
                                
                                {seq.deliveryType === "custom" && (
                                  <div className="space-y-2">
                                    <Label className="text-xs text-neutral-500">Selecione um entregavel</Label>
                                    <Select
                                      value={seq.deliverableId || ""}
                                      onValueChange={(value) => handleUpdateDownsellPixSequence(seq.id, "deliverableId", value)}
                                    >
                                      <SelectTrigger className="bg-secondary/50 border-neutral-200">
                                        <SelectValue placeholder="Selecione um entregavel" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {deliverables.map((d) => (
                                          <SelectItem key={d.id} value={d.id}>
                                            {d.name} ({d.type === "media" ? "Midia" : d.type === "link" ? "Link" : "Grupo VIP"})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      ))}

                      {/* Add Sequence Button */}
                      {downsellPixSequences.length < 20 && (
                        <Button onClick={handleAddDownsellPixSequence} className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Sequencia
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Order Bump Tab */}
          {activeTab === "orderbump" && (
            <div className="space-y-6">
              {/* Order Bump Main Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-neutral-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                        <Wallet className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-neutral-900">Order Bump</h3>
                        <p className="text-sm text-neutral-500">Produto adicional oferecido no checkout antes do pagamento</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-neutral-900 bg-[#bfff00] px-3 py-1 rounded-full">4 etapas</span>
                    </div>
                  </div>
                </div>

                {/* Info and settings */}
                <div className="px-6 py-4 bg-neutral-50 border-b border-neutral-100">
                  <div className="flex items-center gap-6">
                    <div className="flex-1 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                      <p className="text-xs font-medium text-purple-600 mb-1">Como funciona?</p>
                      <p className="text-xs text-neutral-600">Configure Order Bumps diferentes para cada etapa do funil.</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-neutral-700 mb-2">Aplicar Order Bump Inicial em:</p>
                      <div className="flex gap-3">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="rounded border-neutral-300 text-[#bfff00] focus:ring-[#bfff00]"
                            checked={applyInicialTo.upsell}
                            onChange={(e) => {
                              setApplyInicialTo({...applyInicialTo, upsell: e.target.checked})
                              markChange()
                            }}
                          />
                          <TrendingUp className="h-3.5 w-3.5 text-[#8fb300]" />
                          <span className="text-xs text-[#8fb300]">Upsell</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="rounded border-neutral-300 text-pink-500 focus:ring-pink-500"
                            checked={applyInicialTo.downsell}
                            onChange={(e) => {
                              setApplyInicialTo({...applyInicialTo, downsell: e.target.checked})
                              markChange()
                            }}
                          />
                          <TrendingDown className="h-3.5 w-3.5 text-pink-500" />
                          <span className="text-xs text-pink-500">Downsell</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="rounded border-neutral-300 text-emerald-500 focus:ring-emerald-500"
                            checked={applyInicialTo.packs}
                            onChange={(e) => {
                              setApplyInicialTo({...applyInicialTo, packs: e.target.checked})
                              markChange()
                            }}
                          />
                          <Package className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-xs text-emerald-500">Packs</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Order Bump Cards */}
                <div className="p-6 space-y-4">
                {/* Fluxo Inicial */}
                <Card className="bg-white border-neutral-100 shadow-sm rounded-2xl">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Crown className="h-5 w-5 text-blue-400" />
                        <span className="font-semibold">Fluxo Inicial</span>
                      </div>
                      <Switch
                        checked={orderBumpInicial.enabled}
                        onCheckedChange={(checked) => {
                          setOrderBumpInicial({...orderBumpInicial, enabled: checked})
                          markChange()
                        }}
                      />
                    </div>
                    <p className="text-sm text-neutral-500">
                      Exibido quando o cliente seleciona um plano principal
                    </p>
                  </CardHeader>
                  {orderBumpInicial.enabled && (
                    <CardContent className="space-y-4">
                      {/* Nome e Preco */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-neutral-500">Nome do Produto</Label>
                          <Input
                            value={orderBumpInicial.name}
                            onChange={(e) => {
                              setOrderBumpInicial({...orderBumpInicial, name: e.target.value})
                              markChange()
                            }}
                            placeholder="Ex: Acesso ao grupo exclusivo"
                            className="bg-white border-neutral-200"
                          />
                        </div>
<div className="space-y-2">
                              <Label className="text-neutral-500">Preco (R$)</Label>
<Input
                                  type="text"
                                  inputMode="decimal"
                                  value={orderBumpInicial.price || ""}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9.,]/g, "").replace(",", ".")
                                    setOrderBumpInicial({...orderBumpInicial, price: val === "" ? 0 : val as unknown as number})
                                    markChange()
                                  }}
                                  onBlur={() => {
                                    const num = parseFloat(String(orderBumpInicial.price).replace(",", ".")) || 0
                                    setOrderBumpInicial({...orderBumpInicial, price: num})
                                  }}
                                placeholder="0.00"
                                className="bg-white border-neutral-200"
                              />
                            </div>
                      </div>

                      {/* Descricao */}
                      <div className="space-y-2">
                        <Label className="text-neutral-500">Descricao/Mensagem do Order Bump</Label>
                        <RichTextEditor
                          value={orderBumpInicial.description}
                          onChange={(value) => {
                            setOrderBumpInicial({...orderBumpInicial, description: value})
                            markChange()
                          }}
                          placeholder="Descricao completa do produto adicional que sera enviada ao cliente..."
                          rows={4}
                          maxLength={4000}
                          className="bg-secondary/50 border-neutral-200"
                          variables={[
                            { label: "{nome}", value: "{nome}" },
                            { label: "{username}", value: "{username}" }
                          ]}
                        />
                      </div>

                      {/* Botoes */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-neutral-500">Botao Aceitar</Label>
                          <div className="flex items-center gap-2 rounded-lg bg-secondary/50 p-3 border border-neutral-200">
                            <Check className="h-4 w-4 text-emerald-500" />
                            <Input
                              value={orderBumpInicial.acceptText}
                              onChange={(e) => {
                                setOrderBumpInicial({...orderBumpInicial, acceptText: e.target.value})
                                markChange()
                              }}
                              className="bg-transparent border-0 p-0 h-auto focus-visible:ring-0 uppercase font-medium"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-neutral-500">Botao Recusar</Label>
                          <div className="flex items-center gap-2 rounded-lg bg-secondary/50 p-3 border border-neutral-200">
                            <X className="h-4 w-4 text-destructive" />
                            <Input
                              value={orderBumpInicial.rejectText}
                              onChange={(e) => {
                                setOrderBumpInicial({...orderBumpInicial, rejectText: e.target.value})
                                markChange()
                              }}
                              className="bg-transparent border-0 p-0 h-auto focus-visible:ring-0 uppercase font-medium"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Entregavel do Order Bump */}
                      <div className="space-y-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                        <div className="flex items-center gap-2">
                          <Gift className="h-5 w-5 text-emerald-600" />
                          <Label className="text-neutral-700 font-medium">Entregavel do Order Bump</Label>
                        </div>
                        <p className="text-xs text-neutral-500">
                          Selecione qual conteudo sera entregue quando este order bump for comprado (junto com o entregavel principal do plano)
                        </p>
                        <Select
                          value={orderBumpInicial.deliveryType || "same"}
                          onValueChange={(value: OrderBumpItem["deliveryType"]) => {
                            setOrderBumpInicial({...orderBumpInicial, deliveryType: value, deliverableId: value === "same" ? "" : orderBumpInicial.deliverableId})
                            markChange()
                          }}
                        >
                          <SelectTrigger className="bg-white border-neutral-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="same">Usar mesmo do plano principal</SelectItem>
                            <SelectItem value="custom">Selecionar entregavel especifico</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        {(orderBumpInicial.deliveryType || "same") === "custom" && (
                          <div className="pt-2">
                            {deliverables.length === 0 ? (
                              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
                                <div className="flex items-start gap-2">
                                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                                  <div className="text-xs">
                                    <p className="font-medium text-amber-500">Nenhum entregavel configurado</p>
                                    <p className="text-neutral-500">Crie entregaveis na aba &quot;Entregaveis&quot; para poder selecionar aqui</p>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <Select
                                value={orderBumpInicial.deliverableId || "none"}
                                onValueChange={(value) => {
                                  setOrderBumpInicial({...orderBumpInicial, deliverableId: value === "none" ? "" : value})
                                  markChange()
                                }}
                              >
                                <SelectTrigger className="bg-white border-neutral-200">
                                  <SelectValue placeholder="Selecione um entregavel..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Nenhum selecionado</SelectItem>
                                  {deliverables.map((d) => (
                                    <SelectItem key={d.id} value={d.id}>
                                      <div className="flex items-center gap-2">
                                        {d.type === "media" && <ImageIcon className="h-3 w-3 text-purple-500" />}
                                        {d.type === "link" && <Link2 className="h-3 w-3 text-blue-500" />}
                                        {d.type === "vip_group" && <Users className="h-3 w-3 text-emerald-500" />}
                                        {d.name}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Midias do Order Bump inicial */}
                      <div className="space-y-2 pt-4 border-t border-neutral-200">
                        <Label className="text-neutral-500 flex items-center gap-2">
                          <ImageIcon className="h-4 w-4" />
                          Midias (ate 3)
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {(orderBumpInicial.medias || []).map((media, idx) => (
                            <div key={idx} className="relative group">
                              {media.includes('video') ? (
                                <video src={media} className="h-20 w-20 object-cover rounded-lg border border-neutral-200" />
                              ) : (
                                <img src={media} alt={`Media ${idx + 1}`} className="h-20 w-20 object-cover rounded-lg border border-neutral-200" />
                              )}
                              <button type="button" onClick={() => handleRemoveOrderBumpMedia("inicial", idx)} className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          {(orderBumpInicial.medias?.length || 0) < 3 && (
                            <label className="h-20 w-20 border-2 border-dashed border-neutral-200 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#BEFF00] transition-colors">
                              {uploadingOrderBumpMedia === "inicial" ? (
                                <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
                              ) : (
                                <>
                                  <Plus className="h-5 w-5 text-neutral-500" />
                                  <span className="text-[10px] text-neutral-500">Adicionar</span>
                                </>
                              )}
                              <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadOrderBumpMedia("inicial", file); e.target.value = "" }} />
                            </label>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500">{orderBumpInicial.medias?.length || 0}/3 midias</p>
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* Upsell */}
                <Card className="bg-white border-neutral-100 shadow-sm rounded-2xl">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <TrendingUp className="h-5 w-5 text-[#8fb300]" />
                        <span className="font-semibold">Upsell</span>
                      </div>
                      <Switch
                        checked={orderBumpUpsell.enabled}
                        onCheckedChange={(checked) => {
                          setOrderBumpUpsell({...orderBumpUpsell, enabled: checked})
                          markChange()
                        }}
                      />
                    </div>
                    <p className="text-sm text-neutral-500">
                      Exibido quando o cliente aceita uma oferta de upsell
                    </p>
                  </CardHeader>
                  {orderBumpUpsell.enabled && (
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-neutral-500">Nome do Produto</Label>
                          <Input value={orderBumpUpsell.name} onChange={(e) => { setOrderBumpUpsell({...orderBumpUpsell, name: e.target.value}); markChange() }} placeholder="Ex: Pack Extra" className="bg-white border-neutral-200" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-neutral-500">Preco (R$)</Label>
                          <Input type="text" inputMode="decimal" value={orderBumpUpsell.price || ""} onChange={(e) => { const val = e.target.value.replace(/[^0-9.,]/g, "").replace(",", "."); setOrderBumpUpsell({...orderBumpUpsell, price: val === "" ? 0 : val as unknown as number}); markChange() }} onBlur={() => { const num = parseFloat(String(orderBumpUpsell.price).replace(",", ".")) || 0; setOrderBumpUpsell({...orderBumpUpsell, price: num}) }} placeholder="0.00" className="bg-white border-neutral-200" />
                        </div>
                      </div>
<div className="space-y-2">
                      <Label className="text-neutral-500">Descricao/Mensagem do Order Bump</Label>
                      <RichTextEditor
                        value={orderBumpUpsell.description || ""}
                        onChange={(value) => { setOrderBumpUpsell({...orderBumpUpsell, description: value}); markChange() }}
                        placeholder="Descricao completa do produto adicional que sera enviada ao cliente..."
                        rows={3}
                        maxLength={4000}
                        className="bg-white border-neutral-200"
                        variables={[
                          { label: "{nome}", value: "{nome}" },
                          { label: "{username}", value: "{username}" }
                        ]}
                      />
                      </div>

                      {/* Botoes */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-neutral-500">Botao Aceitar</Label>
                          <div className="flex items-center gap-2 rounded-lg bg-secondary/50 p-3 border border-neutral-200">
                            <Check className="h-4 w-4 text-emerald-500" />
                            <Input
                              value={orderBumpUpsell.acceptText}
                              onChange={(e) => {
                                setOrderBumpUpsell({...orderBumpUpsell, acceptText: e.target.value})
                                markChange()
                              }}
                              className="bg-transparent border-0 p-0 h-auto focus-visible:ring-0 uppercase font-medium"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-neutral-500">Botao Recusar</Label>
                          <div className="flex items-center gap-2 rounded-lg bg-secondary/50 p-3 border border-neutral-200">
                            <X className="h-4 w-4 text-destructive" />
                            <Input
                              value={orderBumpUpsell.rejectText}
                              onChange={(e) => {
                                setOrderBumpUpsell({...orderBumpUpsell, rejectText: e.target.value})
                                markChange()
                              }}
                              className="bg-transparent border-0 p-0 h-auto focus-visible:ring-0 uppercase font-medium"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Entregavel do Order Bump Upsell */}
                      <div className="space-y-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                        <div className="flex items-center gap-2">
                          <Gift className="h-5 w-5 text-emerald-600" />
                          <Label className="text-neutral-700 font-medium">Entregavel</Label>
                        </div>
                        <Select
                          value={orderBumpUpsell.deliveryType || "same"}
                          onValueChange={(value: OrderBumpItem["deliveryType"]) => {
                            setOrderBumpUpsell({...orderBumpUpsell, deliveryType: value, deliverableId: value === "same" ? "" : orderBumpUpsell.deliverableId})
                            markChange()
                          }}
                        >
                          <SelectTrigger className="bg-white border-neutral-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="same">Usar mesmo do plano principal</SelectItem>
                            <SelectItem value="custom">Selecionar entregavel especifico</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        {(orderBumpUpsell.deliveryType || "same") === "custom" && (
                          <Select
                            value={orderBumpUpsell.deliverableId || "none"}
                            onValueChange={(value) => {
                              setOrderBumpUpsell({...orderBumpUpsell, deliverableId: value === "none" ? "" : value})
                              markChange()
                            }}
                          >
                            <SelectTrigger className="bg-white border-neutral-200">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nenhum</SelectItem>
                              {deliverables.map((d) => (
                                <SelectItem key={d.id} value={d.id}>
                                  <div className="flex items-center gap-2">
                                    {d.type === "media" && <ImageIcon className="h-3 w-3" />}
                                    {d.type === "link" && <Link2 className="h-3 w-3" />}
                                    {d.type === "vip_group" && <Users className="h-3 w-3" />}
                                    {d.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      
                      {/* Midias do Order Bump Upsell */}
                      <div className="space-y-2 pt-4 border-t border-neutral-200">
                        <Label className="text-neutral-500 flex items-center gap-2">
                          <ImageIcon className="h-4 w-4" />
                          Midias (ate 3)
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {(orderBumpUpsell.medias || []).map((media, idx) => (
                            <div key={idx} className="relative group">
                              {media.includes('video') ? (
                                <video src={media} className="h-20 w-20 object-cover rounded-lg border border-neutral-200" />
                              ) : (
                                <img src={media} alt={`Media ${idx + 1}`} className="h-20 w-20 object-cover rounded-lg border border-neutral-200" />
                              )}
                              <button type="button" onClick={() => handleRemoveOrderBumpMedia("upsell", idx)} className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          {(orderBumpUpsell.medias?.length || 0) < 3 && (
                            <label className="h-20 w-20 border-2 border-dashed border-neutral-200 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#BEFF00] transition-colors">
                              {uploadingOrderBumpMedia === "upsell" ? (
                                <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
                              ) : (
                                <>
                                  <Plus className="h-5 w-5 text-neutral-500" />
                                  <span className="text-[10px] text-neutral-500">Adicionar</span>
                                </>
                              )}
                              <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadOrderBumpMedia("upsell", file); e.target.value = "" }} />
                            </label>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500">{orderBumpUpsell.medias?.length || 0}/3 midias</p>
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* Downsell */}
                <Card className="bg-white border-neutral-100 shadow-sm rounded-2xl">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <TrendingDown className="h-5 w-5 text-pink-500" />
                        <span className="font-semibold">Downsell</span>
                      </div>
                      <Switch
                        checked={orderBumpDownsell.enabled}
                        onCheckedChange={(checked) => {
                          setOrderBumpDownsell({...orderBumpDownsell, enabled: checked})
                          markChange()
                        }}
                      />
                    </div>
                    <p className="text-sm text-neutral-500">
                      Exibido quando o cliente aceita uma oferta de downsell
                    </p>
                  </CardHeader>
                  {orderBumpDownsell.enabled && (
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-neutral-500">Nome do Produto</Label>
                          <Input value={orderBumpDownsell.name} onChange={(e) => { setOrderBumpDownsell({...orderBumpDownsell, name: e.target.value}); markChange() }} placeholder="Ex: Pack Extra" className="bg-white border-neutral-200" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-neutral-500">Preco (R$)</Label>
                          <Input type="text" inputMode="decimal" value={orderBumpDownsell.price || ""} onChange={(e) => { const val = e.target.value.replace(/[^0-9.,]/g, "").replace(",", "."); setOrderBumpDownsell({...orderBumpDownsell, price: val === "" ? 0 : val as unknown as number}); markChange() }} onBlur={() => { const num = parseFloat(String(orderBumpDownsell.price).replace(",", ".")) || 0; setOrderBumpDownsell({...orderBumpDownsell, price: num}) }} placeholder="0.00" className="bg-white border-neutral-200" />
                        </div>
                      </div>
<div className="space-y-2">
                      <Label className="text-neutral-500">Descricao/Mensagem do Order Bump</Label>
                      <RichTextEditor
                        value={orderBumpDownsell.description || ""}
                        onChange={(value) => { setOrderBumpDownsell({...orderBumpDownsell, description: value}); markChange() }}
                        placeholder="Descricao completa do produto adicional que sera enviada ao cliente..."
                        rows={3}
                        maxLength={4000}
                        className="bg-white border-neutral-200"
                        variables={[
                          { label: "{nome}", value: "{nome}" },
                          { label: "{username}", value: "{username}" }
                        ]}
                      />
                      </div>

                      {/* Botoes */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-neutral-500">Botao Aceitar</Label>
                          <div className="flex items-center gap-2 rounded-lg bg-secondary/50 p-3 border border-neutral-200">
                            <Check className="h-4 w-4 text-emerald-500" />
                            <Input
                              value={orderBumpDownsell.acceptText}
                              onChange={(e) => {
                                setOrderBumpDownsell({...orderBumpDownsell, acceptText: e.target.value})
                                markChange()
                              }}
                              className="bg-transparent border-0 p-0 h-auto focus-visible:ring-0 uppercase font-medium"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-neutral-500">Botao Recusar</Label>
                          <div className="flex items-center gap-2 rounded-lg bg-secondary/50 p-3 border border-neutral-200">
                            <X className="h-4 w-4 text-destructive" />
                            <Input
                              value={orderBumpDownsell.rejectText}
                              onChange={(e) => {
                                setOrderBumpDownsell({...orderBumpDownsell, rejectText: e.target.value})
                                markChange()
                              }}
                              className="bg-transparent border-0 p-0 h-auto focus-visible:ring-0 uppercase font-medium"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Entregavel do Order Bump Downsell */}
                      <div className="space-y-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                        <div className="flex items-center gap-2">
                          <Gift className="h-5 w-5 text-emerald-600" />
                          <Label className="text-neutral-700 font-medium">Entregavel</Label>
                        </div>
                        <Select
                          value={orderBumpDownsell.deliveryType || "same"}
                          onValueChange={(value: OrderBumpItem["deliveryType"]) => {
                            setOrderBumpDownsell({...orderBumpDownsell, deliveryType: value, deliverableId: value === "same" ? "" : orderBumpDownsell.deliverableId})
                            markChange()
                          }}
                        >
                          <SelectTrigger className="bg-white border-neutral-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="same">Usar mesmo do plano principal</SelectItem>
                            <SelectItem value="custom">Selecionar entregavel especifico</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        {(orderBumpDownsell.deliveryType || "same") === "custom" && (
                          <Select
                            value={orderBumpDownsell.deliverableId || "none"}
                            onValueChange={(value) => {
                              setOrderBumpDownsell({...orderBumpDownsell, deliverableId: value === "none" ? "" : value})
                              markChange()
                            }}
                          >
                            <SelectTrigger className="bg-white border-neutral-200">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nenhum</SelectItem>
                              {deliverables.map((d) => (
                                <SelectItem key={d.id} value={d.id}>
                                  <div className="flex items-center gap-2">
                                    {d.type === "media" && <ImageIcon className="h-3 w-3" />}
                                    {d.type === "link" && <Link2 className="h-3 w-3" />}
                                    {d.type === "vip_group" && <Users className="h-3 w-3" />}
                                    {d.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      
                      {/* Midias do Order Bump Downsell */}
                      <div className="space-y-2 pt-4 border-t border-neutral-200">
                        <Label className="text-neutral-500 flex items-center gap-2">
                          <ImageIcon className="h-4 w-4" />
                          Midias (ate 3)
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {(orderBumpDownsell.medias || []).map((media, idx) => (
                            <div key={idx} className="relative group">
                              {media.includes('video') ? (
                                <video src={media} className="h-20 w-20 object-cover rounded-lg border border-neutral-200" />
                              ) : (
                                <img src={media} alt={`Media ${idx + 1}`} className="h-20 w-20 object-cover rounded-lg border border-neutral-200" />
                              )}
                              <button type="button" onClick={() => handleRemoveOrderBumpMedia("downsell", idx)} className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          {(orderBumpDownsell.medias?.length || 0) < 3 && (
                            <label className="h-20 w-20 border-2 border-dashed border-neutral-200 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#BEFF00] transition-colors">
                              {uploadingOrderBumpMedia === "downsell" ? (
                                <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
                              ) : (
                                <>
                                  <Plus className="h-5 w-5 text-neutral-500" />
                                  <span className="text-[10px] text-neutral-500">Adicionar</span>
                                </>
                              )}
                              <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadOrderBumpMedia("downsell", file); e.target.value = "" }} />
                            </label>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500">{orderBumpDownsell.medias?.length || 0}/3 midias</p>
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* Packs */}
                <Card className="bg-white border-neutral-100 shadow-sm rounded-2xl">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-emerald-500" />
                        <span className="font-semibold">Packs</span>
                      </div>
                      <Switch
                        checked={orderBumpPacks.enabled}
                        onCheckedChange={(checked) => {
                          setOrderBumpPacks({...orderBumpPacks, enabled: checked})
                          markChange()
                        }}
                      />
                    </div>
                    <p className="text-sm text-neutral-500">
                      Exibido quando o cliente seleciona um pack avulso
                    </p>
                  </CardHeader>
                  {orderBumpPacks.enabled && (
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-neutral-500">Nome do Produto</Label>
                          <Input value={orderBumpPacks.name} onChange={(e) => { setOrderBumpPacks({...orderBumpPacks, name: e.target.value}); markChange() }} placeholder="Ex: Pack Extra" className="bg-white border-neutral-200" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-neutral-500">Preco (R$)</Label>
                          <Input type="text" inputMode="decimal" value={orderBumpPacks.price || ""} onChange={(e) => { const val = e.target.value.replace(/[^0-9.,]/g, "").replace(",", "."); setOrderBumpPacks({...orderBumpPacks, price: val === "" ? 0 : val as unknown as number}); markChange() }} onBlur={() => { const num = parseFloat(String(orderBumpPacks.price).replace(",", ".")) || 0; setOrderBumpPacks({...orderBumpPacks, price: num}) }} placeholder="0.00" className="bg-white border-neutral-200" />
                        </div>
                      </div>
<div className="space-y-2">
                      <Label className="text-neutral-500">Descricao</Label>
                      <RichTextEditor
                        value={orderBumpPacks.description || ""}
                        onChange={(value) => { setOrderBumpPacks({...orderBumpPacks, description: value}); markChange() }}
                        placeholder="Descricao do pack que sera exibida na previa..."
                        rows={3}
                        maxLength={4000}
                        className="bg-white border-neutral-200"
                        variables={[
                          { label: "{nome}", value: "{nome}" },
                          { label: "{username}", value: "{username}" }
                        ]}
                      />
                      </div>
                      
                      {/* Botoes */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-neutral-500">Botao Aceitar</Label>
                          <Input value={orderBumpPacks.acceptText} onChange={(e) => { setOrderBumpPacks({...orderBumpPacks, acceptText: e.target.value}); markChange() }} placeholder="QUERO" className="bg-secondary/50 uppercase font-medium" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-neutral-500">Botao Recusar</Label>
                          <Input value={orderBumpPacks.rejectText} onChange={(e) => { setOrderBumpPacks({...orderBumpPacks, rejectText: e.target.value}); markChange() }} placeholder="NAO QUERO" className="bg-secondary/50 uppercase font-medium" />
                        </div>
                      </div>
                      
                      {/* Entrega */}
                      {/* Entregavel do Order Bump Packs */}
                      <div className="space-y-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                        <div className="flex items-center gap-2">
                          <Gift className="h-5 w-5 text-emerald-600" />
                          <Label className="text-neutral-700 font-medium">Entregavel</Label>
                        </div>
                        <Select
                          value={orderBumpPacks.deliveryType || "same"}
                          onValueChange={(value: OrderBumpItem["deliveryType"]) => {
                            setOrderBumpPacks({...orderBumpPacks, deliveryType: value, deliverableId: value === "same" ? "" : orderBumpPacks.deliverableId})
                            markChange()
                          }}
                        >
                          <SelectTrigger className="bg-white border-neutral-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="same">Usar mesmo do plano principal</SelectItem>
                            <SelectItem value="custom">Selecionar entregavel especifico</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        {(orderBumpPacks.deliveryType || "same") === "custom" && (
                          <Select
                            value={orderBumpPacks.deliverableId || "none"}
                            onValueChange={(value) => {
                              setOrderBumpPacks({...orderBumpPacks, deliverableId: value === "none" ? "" : value})
                              markChange()
                            }}
                          >
                            <SelectTrigger className="bg-white border-neutral-200">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nenhum</SelectItem>
                              {deliverables.map((d) => (
                                <SelectItem key={d.id} value={d.id}>
                                  <div className="flex items-center gap-2">
                                    {d.type === "media" && <ImageIcon className="h-3 w-3" />}
                                    {d.type === "link" && <Link2 className="h-3 w-3" />}
                                    {d.type === "vip_group" && <Users className="h-3 w-3" />}
                                    {d.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      
                      {/* Midias do Order Bump Packs */}
                      <div className="space-y-2 pt-4 border-t border-neutral-200">
                        <Label className="text-neutral-500 flex items-center gap-2">
                          <ImageIcon className="h-4 w-4" />
                          Midias (ate 3)
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {(orderBumpPacks.medias || []).map((media, idx) => (
                            <div key={idx} className="relative group">
                              {media.includes('video') ? (
                                <video src={media} className="h-20 w-20 object-cover rounded-lg border border-neutral-200" />
                              ) : (
                                <img src={media} alt={`Media ${idx + 1}`} className="h-20 w-20 object-cover rounded-lg border border-neutral-200" />
                              )}
                              <button type="button" onClick={() => handleRemoveOrderBumpMedia("packs", idx)} className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          {(orderBumpPacks.medias?.length || 0) < 3 && (
                            <label className="h-20 w-20 border-2 border-dashed border-neutral-200 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#BEFF00] transition-colors">
                              {uploadingOrderBumpMedia === "packs" ? (
                                <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
                              ) : (
                                <>
                                  <Plus className="h-5 w-5 text-neutral-500" />
                                  <span className="text-[10px] text-neutral-500">Adicionar</span>
                                </>
                              )}
                              <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadOrderBumpMedia("packs", file); e.target.value = "" }} />
                            </label>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500">{orderBumpPacks.medias?.length || 0}/3 midias</p>
                      </div>
                    </CardContent>
                  )}
                </Card>
                </div>
              </div>
            </div>
          )}

          {/* Packs Tab */}
          {activeTab === "packs" && (
            <div className="space-y-6">
              {/* Packs Main Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-neutral-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                        <Package className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-neutral-900">Packs</h3>
                        <p className="text-sm text-neutral-500">Venda conteudos avulsos alem das assinaturas</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-neutral-900 bg-[#bfff00] px-3 py-1 rounded-full">{packsList.length}/20</span>
                      <Switch
                        checked={packsEnabled}
                        onCheckedChange={(checked) => {
                          setPacksEnabled(checked)
                          markChange()
                        }}
                      />
                    </div>
                  </div>
                </div>

                {packsEnabled && (
                  <div className="px-6 py-4 bg-neutral-50 border-b border-neutral-100">
                    <div className="flex items-center gap-6">
                      <div className="flex-1">
                        <Label className="text-sm font-medium text-neutral-700">Texto do Botao</Label>
                        <div className="flex items-center gap-2 rounded-lg bg-white p-3 border border-neutral-200 mt-1.5">
                          <span className="text-lg">📦</span>
                          <Input
                            value={packsButtonText}
                            onChange={(e) => {
                              setPacksButtonText(e.target.value)
                              markChange()
                            }}
                            className="bg-transparent border-0 p-0 h-auto focus-visible:ring-0 font-medium"
                          />
                        </div>
                      </div>
                      <div className="flex-1 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <p className="text-xs font-medium text-emerald-600 mb-1">Como funciona?</p>
                        <p className="text-xs text-neutral-600">Packs sao conteudos avulsos que o cliente pode comprar alem das assinaturas.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Packs List */}
                <div className="p-6">
                {!packsEnabled ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="h-14 w-14 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
                      <Package className="h-7 w-7 text-neutral-400" />
                    </div>
                    <p className="text-neutral-500">Ative os Packs para configurar</p>
                  </div>
                ) : packsList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="h-14 w-14 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
                      <Plus className="h-7 w-7 text-neutral-400" />
                    </div>
                    <p className="text-neutral-500 mb-4">Nenhum pack configurado</p>
                    <button
                      onClick={handleAddPack}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#bfff00] hover:bg-[#d4ff4d] text-neutral-900 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar Pack
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {packsList.map((pack, index) => (
                      <Card key={pack.id} className="border-neutral-200">
                        {/* Pack Header */}
                        <div
                          className="flex items-center justify-between p-4 cursor-pointer"
                          onClick={() => setExpandedPack(expandedPack === pack.id ? null : pack.id)}
                        >
                          <div className="flex items-center gap-3">
                            {expandedPack === pack.id ? (
                              <ChevronDown className="h-4 w-4 text-neutral-500" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-neutral-500" />
                            )}
                            <span className="text-lg">{pack.emoji}</span>
                            <span className="font-medium">{pack.name || `Pack ${index + 1}`}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={pack.active}
                              onCheckedChange={(checked) => {
                                handleUpdatePack(pack.id, "active", checked)
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRemovePack(pack.id)
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>

                        {/* Expanded Content */}
                        {expandedPack === pack.id && (
                          <CardContent className="pt-0 space-y-6">
                            {/* Emoji, Nome, Preco */}
                            <div className="grid grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label className="text-neutral-500">Emoji</Label>
                                <Input
                                  value={pack.emoji}
                                  onChange={(e) => handleUpdatePack(pack.id, "emoji", e.target.value)}
                                  className="bg-secondary/50 text-center text-lg"
                                  maxLength={2}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-neutral-500">Nome do Pack</Label>
                                <Input
                                  value={pack.name}
                                  onChange={(e) => handleUpdatePack(pack.id, "name", e.target.value)}
                                  placeholder="Pack Especial"
                                  className="bg-white border-neutral-200"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-neutral-500">Preco (R$)</Label>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={pack.price || ""}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9.,]/g, "").replace(",", ".")
                                    handleUpdatePack(pack.id, "price", val === "" ? 0 : val)
                                  }}
                                  onBlur={() => {
                                    const num = parseFloat(String(pack.price).replace(",", ".")) || 0
                                    handleUpdatePack(pack.id, "price", num)
                                  }}
                                  placeholder="0.00"
                                  className="bg-white border-neutral-200"
                                />
                              </div>
                            </div>

                            {/* Descricao */}
                            <div className="space-y-2">
                              <Label className="text-neutral-500">Descricao</Label>
                              <RichTextEditor
                                value={pack.description}
                                onChange={(value) => handleUpdatePack(pack.id, "description", value)}
                                placeholder="Descricao do pack que sera exibida na previa..."
                                rows={3}
                                maxLength={4000}
                                className="bg-secondary/50 border-neutral-200"
                                showCharCount={false}
                              />
                            </div>

                            {/* Texto do Botao Personalizado */}
                            <div className="space-y-2">
                              <Label className="text-neutral-500">Texto do Botao</Label>
                              <Input
                                value={pack.buttonText || "Comprar Pack"}
                                onChange={(e) => handleUpdatePack(pack.id, "buttonText", e.target.value)}
                                placeholder="Comprar Pack"
                                className="bg-white border-neutral-200"
                              />
                              <p className="text-xs text-neutral-500">Texto exibido no botao de compra deste pack</p>
                            </div>

                            {/* Entregavel do Pack */}
                            <Card className="border-neutral-200 bg-emerald-500/5">
                              <CardContent className="pt-4 space-y-3">
                                <div className="flex items-center gap-2">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                                    <Gift className="h-4 w-4 text-emerald-500" />
                                  </div>
                                  <div>
                                    <span className="font-medium text-sm">Entregavel do Pack</span>
                                    <p className="text-xs text-neutral-500">O que sera enviado apos a compra</p>
                                  </div>
                                </div>
                                
                                {deliverables.length === 0 ? (
                                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
                                    <div className="flex items-start gap-2">
                                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                                      <div className="text-xs">
                                        <p className="font-medium text-amber-500">Nenhum entregavel cadastrado</p>
                                        <p className="text-neutral-500">Crie entregaveis na aba &quot;Entregaveis&quot; para associar a este pack</p>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <Select
                                    value={pack.deliverableId || "none"}
                                    onValueChange={(value) => handleUpdatePack(pack.id, "deliverableId", value === "none" ? "" : value)}
                                  >
                                    <SelectTrigger className="bg-white border-neutral-200">
                                      <SelectValue placeholder="Selecione um entregavel..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Nenhum (usar principal)</SelectItem>
                                      {deliverables.map((d) => (
                                        <SelectItem key={d.id} value={d.id}>
                                          <div className="flex items-center gap-2">
                                            {d.type === "media" && <ImageIcon className="h-3 w-3" />}
                                            {d.type === "link" && <Link2 className="h-3 w-3" />}
                                            {d.type === "vip_group" && <Users className="h-3 w-3" />}
                                            {d.name}
                                            <span className="text-neutral-500 text-xs">
                                              ({d.type === "media" ? "Midia" : d.type === "link" ? "Link" : "Grupo VIP"})
                                            </span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                                
                                {pack.deliverableId && deliverables.find(d => d.id === pack.deliverableId) && (
                                  <div className="rounded-lg bg-secondary/30 p-2 text-xs text-neutral-500">
                                    Tipo: {deliverables.find(d => d.id === pack.deliverableId)?.type === "media" 
                                      ? "Midias serao enviadas" 
                                      : deliverables.find(d => d.id === pack.deliverableId)?.type === "link" 
                                        ? "Link com botao sera enviado" 
                                        : "Convite unico para grupo VIP"}
                                  </div>
                                )}
                              </CardContent>
                            </Card>

                            {/* Midias de Preview */}
                            <Card className="border-neutral-200 bg-secondary/10">
                              <CardContent className="pt-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-sm">
                                    <ImageIcon className="h-4 w-4 text-neutral-500" />
                                    <span>Midias de Preview (ate 3 - exibidas antes da compra)</span>
                                  </div>
                                  <span className="text-xs text-neutral-500">{(pack.previewMedias?.length || 0)}/3</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {/* Midias existentes */}
                                  {(pack.previewMedias || []).map((media, mediaIndex) => (
                                    <div key={mediaIndex} className="relative w-24 h-20 rounded-lg overflow-hidden group">
                                      {media.includes("video") || media.includes("mp4") ? (
                                        <video src={media} className="w-full h-full object-cover" muted />
                                      ) : (
                                        <img src={media} alt={`Preview ${mediaIndex + 1}`} className="w-full h-full object-cover" />
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleRemovePackMedia(pack.id, mediaIndex)}
                                        className="absolute top-1 right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <X className="h-3 w-3 text-white" />
                                      </button>
                                    </div>
                                  ))}
                                  
                                  {/* Botao de adicionar */}
                                  {(pack.previewMedias?.length || 0) < 3 && (
                                    <label className="w-24 h-20 border-2 border-dashed border-neutral-200 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500/50 transition-colors">
                                      {uploadingPackMedia === pack.id ? (
                                        <div className="animate-spin h-5 w-5 border-2 border-emerald-500 border-t-transparent rounded-full" />
                                      ) : (
                                        <>
                                          <Plus className="h-5 w-5 text-neutral-500" />
                                          <span className="text-xs text-neutral-500 mt-1">Adicionar</span>
                                        </>
                                      )}
                                      <input
                                        type="file"
                                        accept="image/*,video/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0]
                                          if (file) handleUploadPackMedia(pack.id, file)
                                          e.target.value = ""
                                        }}
                                        disabled={uploadingPackMedia === pack.id}
                                      />
                                    </label>
                                  )}
                                </div>
                              </CardContent>
                            </Card>

                            
                          </CardContent>
                        )}
                      </Card>
                    ))}

                    {/* Add Pack Button */}
                    {packsList.length < 20 && (
                      <Button
                        variant="outline"
                        className="w-full border-dashed"
                        onClick={handleAddPack}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Pack
                      </Button>
                    )}
                  </div>
                )}
                </div>
              </div>
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === "payments" && (
            <div className="space-y-6">
              {/* Header Card */}
              <Card className="border border-neutral-200 bg-white">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#BEFF00]/10">
                      <DollarSign className="h-5 w-5 text-[#8fb300]" />
                    </div>
                    <span className="font-semibold text-lg">Configuracoes de Pagamento</span>
                  </div>
                  <p className="text-sm text-neutral-500">
                    Configure as mensagens enviadas durante o processo de pagamento PIX
                  </p>
                </CardContent>
              </Card>

              {/* 1. Mensagem do PIX Gerado */}
              <div className="space-y-4">
                <h3 className="font-semibold">1. Mensagem do PIX Gerado</h3>

{/* Mensagem Personalizada */}
                <div className="space-y-3">
                  <Label className="text-neutral-500">Mensagem Personalizada</Label>
                  <RichTextEditor
                    value={pixGeneratedMessage}
                    onChange={(value) => { setPixGeneratedMessage(value); markChange() }}
                    rows={6}
                    maxLength={4000}
                    className="bg-white border border-neutral-200 font-mono text-sm"
                    variables={[
                      { label: "{nome}", value: "{nome}" },
                      { label: "{username}", value: "{username}" }
                    ]}
                  />
                </div>
              </div>

              {/* 2. Configuracoes do QR Code e Codigo PIX */}
              <div className="space-y-4">
                <h3 className="font-semibold">2. Configuracoes do QR Code e Codigo PIX</h3>
                
                <div className="space-y-2">
                  <Label className="text-neutral-500">Exibicao do QR Code</Label>
                  <Select value={qrCodeDisplay} onValueChange={(v) => { setQrCodeDisplay(v); markChange() }}>
                    <SelectTrigger className="bg-white border border-neutral-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">Na mensagem (imagem)</SelectItem>
                      <SelectItem value="link">Link separado</SelectItem>
                      <SelectItem value="none">Nao exibir</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-neutral-500">QR Code enviado junto com a mensagem</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-neutral-500">Formato do Codigo PIX</Label>
                  <Select value={pixCodeFormat} onValueChange={(v) => { setPixCodeFormat(v); markChange() }}>
                    <SelectTrigger className="bg-white border border-neutral-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monospace">`Codigo` (monoespa&#231;ado)</SelectItem>
                      <SelectItem value="normal">Texto normal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>

              {/* 3. Botao Copiar PIX */}
              <Card className="border border-neutral-200 bg-white">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                        <Copy className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-semibold">Botao Copiar PIX</p>
                        <p className="text-sm text-neutral-500">Adiciona um botao para copiar o codigo facilmente</p>
                      </div>
                    </div>
                    <Switch 
                      checked={showCopyButton} 
                      onCheckedChange={(c) => { setShowCopyButton(c); markChange() }} 
                    />
                  </div>
                  <p className="text-xs text-neutral-500 bg-neutral-50 p-3 rounded-lg">
                    Quando ativado, envia um botao clicavel que copia automaticamente o codigo PIX para a area de transferencia do cliente, 
                    junto com uma mensagem de reforco explicando como usar o codigo copiado no app do banco.
                  </p>
                </CardContent>
              </Card>

              {/* 4. Mensagem antes do Código PIX */}
              <Card className="border border-neutral-200 bg-white">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                      <MessageSquare className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <p className="font-semibold">Mensagem antes do Código PIX</p>
                      <p className="text-sm text-neutral-500">Texto exibido acima do código copiável</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-neutral-500">Esta mensagem aparece logo acima do código PIX copiável na conversa</p>
                    <Label className="text-neutral-700 font-medium">Texto da Mensagem</Label>
                    <Input
                      value={messageBeforeCode}
                      onChange={(e) => { setMessageBeforeCode(e.target.value); markChange() }}
                      placeholder="Ex: Copie o código abaixo:"
                      className="bg-white border border-neutral-200"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 5. Botão Verificar Status */}
              <Card className="border border-neutral-200 bg-white">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                      <Check className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="font-semibold">Botão Verificar Status</p>
                      <p className="text-sm text-neutral-500">Texto exibido no botão de verificação</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-neutral-500">Este texto aparece dentro do botão que o cliente clica para verificar o pagamento</p>
                    <Label className="text-neutral-700 font-medium">Texto do Botão</Label>
                    <Input
                      value={verifyStatusButtonText}
                      onChange={(e) => { setVerifyStatusButtonText(e.target.value); markChange() }}
                      placeholder="Ex: Verificar Status"
                      className="bg-white border border-neutral-200"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 6. Mensagem de Pagamento Aprovado */}
              <Card className="border border-neutral-200 bg-white">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                      <Check className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="font-semibold">Mensagem de Pagamento Aprovado</p>
                      <p className="text-sm text-neutral-500">Enviada quando o pagamento e confirmado</p>
                    </div>
                  </div>

                  {/* Midias - ate 3 */}
                  <div className="space-y-2">
                    <Label className="text-neutral-500">Midias (opcional - ate 3)</Label>
                    <div className="flex gap-3 flex-wrap">
                      {approvedMedias.map((media, index) => (
                        <div key={index} className="relative w-24 h-24 rounded-lg border border-neutral-200 overflow-hidden group">
                          {media.match(/\.(mp4|webm|mov)$/i) ? (
                            <video src={media} className="w-full h-full object-cover" />
                          ) : (
                            <img src={media} alt={`Media ${index + 1}`} className="w-full h-full object-cover" />
                          )}
                          <button
                            onClick={() => {
                              setApprovedMedias(approvedMedias.filter((_, i) => i !== index))
                              markChange()
                            }}
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                          >
                            <Trash2 className="h-5 w-5 text-white" />
                          </button>
                        </div>
                      ))}
                      {approvedMedias.length < 3 && (
                        <label className="w-24 h-24 rounded-lg border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-colors">
                          {uploadingApprovedMedia ? (
                            <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
                          ) : (
                            <>
                              <Plus className="h-6 w-6 text-neutral-500 mb-1" />
                              <span className="text-xs text-neutral-500">Adicionar</span>
                              <span className="text-xs text-neutral-500">({approvedMedias.length}/3)</span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*,video/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (!file || !flow) return
                              
                              setUploadingApprovedMedia(true)
                              
                              try {
                                const fileExt = file.name.split('.').pop()
                                const fileName = `${flow.id}/approved_${Date.now()}.${fileExt}`
                                
                                const { error } = await supabase.storage
                                  .from('flow-medias')
                                  .upload(fileName, file, {
                                    cacheControl: '3600',
                                    upsert: false
                                  })
                                
                                if (error) {
                                  toast({
                                    title: "Erro",
                                    description: "Falha no upload: " + error.message,
                                    variant: "destructive",
                                  })
                                  return
                                }
                                
                                const { data: urlData } = supabase.storage
                                  .from('flow-medias')
                                  .getPublicUrl(fileName)
                                
                                setApprovedMedias([...approvedMedias, urlData.publicUrl])
                                markChange()
                              } catch (err) {
                                console.error('Upload failed:', err)
                                toast({
                                  title: "Erro",
                                  description: "Erro ao fazer upload",
                                  variant: "destructive",
                                })
                              } finally {
                                setUploadingApprovedMedia(false)
                              }
                              
                              e.target.value = ""
                            }}
                          />
                        </label>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500">Imagens ou videos enviados junto com a mensagem de aprovacao</p>
                  </div>

                  {/* Mensagem */}
                  <div className="space-y-3">
                    <Label className="text-neutral-500">Mensagem Personalizada</Label>
                    <RichTextEditor
                      value={approvedMessage}
                      onChange={(value) => { setApprovedMessage(value); markChange() }}
                      rows={5}
                      maxLength={4000}
                      className="bg-white border border-neutral-200 font-mono text-sm"
                      variables={[
                        { label: "{nome}", value: "{nome}" },
                        { label: "{username}", value: "{username}" }
                      ]}
                    />
                  </div>

                  {/* Botao de Acesso ao Entregavel */}
                  <div className="border-t border-neutral-200 pt-4 space-y-4">
                    <p className="font-semibold">Botao de Acessar Conteudo (Entregavel)</p>
                    <p className="text-sm text-neutral-500">Este botao aparece apos o pagamento aprovado e libera o acesso ao conteudo configurado nos Entregaveis.</p>
                    
                    <div className="space-y-2">
                      <Label className="text-neutral-500">Texto do Botao</Label>
                      <div className="flex items-center gap-2 rounded-lg bg-white p-3 border border-neutral-200">
                        <Gift className="h-4 w-4 text-orange-500" />
                        <Input
                          value={accessButtonText}
                          onChange={(e) => { setAccessButtonText(e.target.value); markChange() }}
                          className="bg-transparent border-0 p-0 h-auto focus-visible:ring-0"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-neutral-500">Link do Entregavel (opcional)</Label>
                      <Input
                        value={accessButtonUrl}
                        onChange={(e) => { setAccessButtonUrl(e.target.value); markChange() }}
                        placeholder="https://exemplo.com/conteudo ou deixe vazio para usar Entregaveis"
                        className="bg-white border border-neutral-200"
                      />
                      <p className="text-xs text-neutral-500">Se preenchido, sobrescreve o entregavel configurado. Deixe vazio para usar os Entregaveis do fluxo.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Subscription Tab */}
          {activeTab === "subscription" && (
            <div className="space-y-6">
              {/* Subscription Main Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-neutral-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
                        <RefreshCw className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-neutral-900">Sistema de Renovacao</h3>
                        <p className="text-sm text-neutral-500">Configure notificacoes de renovacao e acoes quando a assinatura expirar</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Notificacoes Antes de Expirar */}
                  <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <Clock className="h-4 w-4 text-amber-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-neutral-900">Notificacoes Antes de Expirar</p>
                          <p className="text-xs text-neutral-500">Envie lembretes antes da assinatura expirar</p>
                        </div>
                      </div>
                      <Switch checked={notifyBeforeExpireEnabled} onCheckedChange={(c) => { setNotifyBeforeExpireEnabled(c); markChange() }} />
                    </div>

                  {notifyBeforeExpireEnabled && (
                    <>
                      {/* Dias antes de expirar */}
                      <div className="space-y-2">
                        <Label className="text-neutral-500">Dias antes de expirar</Label>
                        <div className="flex flex-wrap gap-2">
                          {["14 dias", "7 dias", "5 dias", "3 dias", "2 dias", "1 dia", "No dia"].map((day) => (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                if (daysBeforeExpire.includes(day)) {
                                  setDaysBeforeExpire(daysBeforeExpire.filter(d => d !== day))
                                } else {
                                  setDaysBeforeExpire([...daysBeforeExpire, day])
                                }
                                markChange()
                              }}
                              className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                                daysBeforeExpire.includes(day)
                                  ? "bg-amber-500/20 border-amber-500 text-amber-500"
                                  : "bg-secondary/50 border-neutral-200 text-neutral-500 hover:border-amber-500/50"
                              }`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Midia */}
                      <div className="space-y-2">
                        <Label className="text-neutral-500">Midia (opcional)</Label>
                        <div className="flex gap-2">
                          {[
                            { id: "none", label: "Nenhuma", icon: null },
                            { id: "image", label: "Imagem", icon: ImageIcon },
                            { id: "video", label: "Video", icon: Video },
                            { id: "audio", label: "Audio", icon: Music },
                          ].map((type) => (
                            <button
                              key={type.id}
                              type="button"
                              onClick={() => { 
                                setRenewalMediaType(type.id)
                                if (type.id === "none") setRenewalMediaUrl("")
                                markChange() 
                              }}
                              className={`px-4 py-2 rounded-lg border text-sm flex items-center gap-2 transition-colors ${
                                renewalMediaType === type.id
                                  ? "bg-amber-500/20 border-amber-500 text-amber-500"
                                  : "bg-secondary/50 border-neutral-200 text-neutral-500 hover:border-amber-500/50"
                              }`}
                            >
                              {type.icon && <type.icon className="h-4 w-4" />}
                              {type.label}
                            </button>
                          ))}
                        </div>
                        
                        {/* Upload de midia */}
                        {renewalMediaType !== "none" && (
                          <div className="mt-3">
                            {renewalMediaUrl ? (
                              <div className="relative w-32 h-32 rounded-lg border border-neutral-200 overflow-hidden group">
                                {renewalMediaType === "video" ? (
                                  <video src={renewalMediaUrl} className="w-full h-full object-cover" />
                                ) : renewalMediaType === "audio" ? (
                                  <div className="w-full h-full flex items-center justify-center bg-secondary/50">
                                    <Music className="h-8 w-8 text-neutral-500" />
                                  </div>
                                ) : (
                                  <img src={renewalMediaUrl} alt="Renewal media" className="w-full h-full object-cover" />
                                )}
                                <button
                                  onClick={() => {
                                    setRenewalMediaUrl("")
                                    markChange()
                                  }}
                                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                >
                                  <Trash2 className="h-5 w-5 text-white" />
                                </button>
                              </div>
                            ) : (
                              <label className="w-32 h-32 rounded-lg border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center cursor-pointer hover:border-amber-500/50 hover:bg-amber-500/5 transition-colors">
                                {uploadingRenewalMedia ? (
                                  <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
                                ) : (
                                  <>
                                    <Plus className="h-6 w-6 text-neutral-500 mb-1" />
                                    <span className="text-xs text-neutral-500">Upload</span>
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept={renewalMediaType === "image" ? "image/*" : renewalMediaType === "video" ? "video/*" : "audio/*"}
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0]
                                    if (!file || !flow) return
                                    
                                    setUploadingRenewalMedia(true)
                                    
                                    try {
                                      const fileExt = file.name.split('.').pop()
                                      const fileName = `${flow.id}/renewal_${Date.now()}.${fileExt}`
                                      
                                      const { error } = await supabase.storage
                                        .from('flow-medias')
                                        .upload(fileName, file, {
                                          cacheControl: '3600',
                                          upsert: false
                                        })
                                      
                                      if (error) {
                                        toast({
                                          title: "Erro",
                                          description: "Falha no upload: " + error.message,
                                          variant: "destructive",
                                        })
                                        return
                                      }
                                      
                                      const { data: urlData } = supabase.storage
                                        .from('flow-medias')
                                        .getPublicUrl(fileName)
                                      
                                      setRenewalMediaUrl(urlData.publicUrl)
                                      markChange()
                                    } catch (err) {
                                      console.error('Upload failed:', err)
                                      toast({
                                        title: "Erro",
                                        description: "Erro ao fazer upload",
                                        variant: "destructive",
                                      })
                                    } finally {
                                      setUploadingRenewalMedia(false)
                                    }
                                    
                                    e.target.value = ""
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Mensagem */}
                      <div className="space-y-2 mt-4">
                        <Label className="text-neutral-500">Mensagem de Renovacao</Label>
                        <RichTextEditor
                          value={renewalMessage}
                          onChange={(value) => { setRenewalMessage(value); markChange() }}
                          rows={5}
                          maxLength={4000}
                          className="bg-secondary/50 border-neutral-200 font-mono text-sm"
                          variables={[
                            { label: "{nome}", value: "{nome}" },
                            { label: "{plano}", value: "{plano}" },
                            { label: "{dias}", value: "{dias}" },
                            { label: "{data_expiracao}", value: "{data_expiracao}" },
                            { label: "{saudacao}", value: "{saudacao}" },
                            { label: "{uf}", value: "{uf}" }
                          ]}
                        />
                      </div>
                    </>
                  )}
                  </div>

                  {/* Notificacoes no Dia da Expiracao */}
                  <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <Clock className="h-4 w-4 text-amber-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-neutral-900">Notificacoes no Dia da Expiracao</p>
                          <p className="text-xs text-neutral-500">Envie notificacoes no dia que a assinatura expirar</p>
                        </div>
                      </div>
                      <Switch checked={notifyOnDayEnabled} onCheckedChange={(c) => { setNotifyOnDayEnabled(c); markChange() }} />
                    </div>

                  {notifyOnDayEnabled && (
                    <>
                      <p className="text-sm text-neutral-500">
                        Envie multiplas notificacoes em horarios especificos no dia que a assinatura expirar (dia 0)
                      </p>

                      {/* Quantidade */}
                      <div className="space-y-2">
                        <Label className="text-neutral-500">Quantas notificacoes enviar</Label>
                        <Select value={notificationCount} onValueChange={(v) => { setNotificationCount(v); markChange() }}>
                          <SelectTrigger className="bg-white border-neutral-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 vez</SelectItem>
                            <SelectItem value="2">2 vezes</SelectItem>
                            <SelectItem value="3">3 vezes</SelectItem>
                            <SelectItem value="4">4 vezes</SelectItem>
                            <SelectItem value="5">5 vezes</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-neutral-500">Numero de notificacoes que serao enviadas durante o dia da expiracao</p>
                      </div>

                      {/* Horarios Grid */}
                      <div className="space-y-2">
                        <Label className="text-neutral-500">Horarios (selecione {notificationCount})</Label>
                        <div className="grid grid-cols-6 gap-2">
                          {Array.from({ length: 24 }, (_, i) => {
                            const hour = `${i.toString().padStart(2, "0")}:00`
                            const isSelected = selectedHours.includes(hour)
                            const maxReached = selectedHours.length >= parseInt(notificationCount)
                            const isDisabled = !isSelected && maxReached
                            return (
                              <button
                                key={hour}
                                type="button"
                                disabled={isDisabled}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedHours(selectedHours.filter(h => h !== hour))
                                  } else {
                                    setSelectedHours([...selectedHours, hour])
                                  }
                                  markChange()
                                }}
                                className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                                  isSelected
                                    ? "bg-amber-500/20 border-amber-500 text-amber-500"
                                    : isDisabled
                                    ? "bg-secondary/30 border-neutral-200/30 text-neutral-500/50 cursor-not-allowed"
                                    : "bg-secondary/50 border-neutral-200 text-neutral-500 hover:border-amber-500/50"
                                }`}
                              >
                                {hour}
                              </button>
                            )
                          })}
                        </div>
                        <p className="text-xs text-neutral-500">
                          {selectedHours.length}/{notificationCount} horario(s) selecionado(s)
                        </p>
                      </div>

                      {/* Atencao */}
                      <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4 mt-4">
                        <p className="text-sm">
                          <span className="font-semibold text-amber-500">Atencao:</span>{" "}
                          <span className="text-neutral-500">Estas notificacoes usam a mesma mensagem e midia configuradas em "Notificacoes Antes de Expirar" acima, mas sao enviadas nos horarios especificos do dia da expiracao.</span>
                        </p>
                      </div>
                    </>
                  )}
                  </div>

                  {/* Mensagem Quando Expirar */}
                  <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-neutral-900">Mensagem Quando Expirar</p>
                          <p className="text-xs text-neutral-500">Mensagem enviada quando a assinatura expira</p>
                        </div>
                      </div>
                      <Switch checked={expireMessageEnabled} onCheckedChange={(c) => { setExpireMessageEnabled(c); markChange() }} />
                    </div>

                  {expireMessageEnabled && (
                    <>
                      {/* Midia */}
                      <div className="space-y-2">
                        <Label className="text-neutral-500">Midia (opcional)</Label>
                        <div className="flex gap-2">
                          {[
                            { id: "none", label: "Nenhuma", icon: null },
                            { id: "image", label: "Imagem", icon: ImageIcon },
                            { id: "video", label: "Video", icon: Video },
                            { id: "audio", label: "Audio", icon: Music },
                          ].map((type) => (
                            <button
                              key={type.id}
                              type="button"
                              onClick={() => { 
                                setExpireMediaType(type.id)
                                if (type.id === "none") setExpireMediaUrl("")
                                markChange() 
                              }}
                              className={`px-4 py-2 rounded-lg border text-sm flex items-center gap-2 transition-colors ${
                                expireMediaType === type.id
                                  ? "bg-amber-500/20 border-amber-500 text-amber-500"
                                  : "bg-secondary/50 border-neutral-200 text-neutral-500 hover:border-amber-500/50"
                              }`}
                            >
                              {type.icon && <type.icon className="h-4 w-4" />}
                              {type.label}
                            </button>
                          ))}
                        </div>
                        
                        {/* Upload de midia */}
                        {expireMediaType !== "none" && (
                          <div className="mt-3">
                            {expireMediaUrl ? (
                              <div className="relative w-32 h-32 rounded-lg border border-neutral-200 overflow-hidden group">
                                {expireMediaType === "video" ? (
                                  <video src={expireMediaUrl} className="w-full h-full object-cover" />
                                ) : expireMediaType === "audio" ? (
                                  <div className="w-full h-full flex items-center justify-center bg-secondary/50">
                                    <Music className="h-8 w-8 text-neutral-500" />
                                  </div>
                                ) : (
                                  <img src={expireMediaUrl} alt="Expire media" className="w-full h-full object-cover" />
                                )}
                                <button
                                  onClick={() => {
                                    setExpireMediaUrl("")
                                    markChange()
                                  }}
                                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                >
                                  <Trash2 className="h-5 w-5 text-white" />
                                </button>
                              </div>
                            ) : (
                              <label className="w-32 h-32 rounded-lg border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center cursor-pointer hover:border-destructive/50 hover:bg-destructive/5 transition-colors">
                                {uploadingExpireMedia ? (
                                  <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
                                ) : (
                                  <>
                                    <Plus className="h-6 w-6 text-neutral-500 mb-1" />
                                    <span className="text-xs text-neutral-500">Upload</span>
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept={expireMediaType === "image" ? "image/*" : expireMediaType === "video" ? "video/*" : "audio/*"}
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0]
                                    if (!file || !flow) return
                                    
                                    setUploadingExpireMedia(true)
                                    
                                    try {
                                      const fileExt = file.name.split('.').pop()
                                      const fileName = `${flow.id}/expire_${Date.now()}.${fileExt}`
                                      
                                      const { error } = await supabase.storage
                                        .from('flow-medias')
                                        .upload(fileName, file, {
                                          cacheControl: '3600',
                                          upsert: false
                                        })
                                      
                                      if (error) {
                                        toast({
                                          title: "Erro",
                                          description: "Falha no upload: " + error.message,
                                          variant: "destructive",
                                        })
                                        return
                                      }
                                      
                                      const { data: urlData } = supabase.storage
                                        .from('flow-medias')
                                        .getPublicUrl(fileName)
                                      
                                      setExpireMediaUrl(urlData.publicUrl)
                                      markChange()
                                    } catch (err) {
                                      console.error('Upload failed:', err)
                                      toast({
                                        title: "Erro",
                                        description: "Erro ao fazer upload",
                                        variant: "destructive",
                                      })
                                    } finally {
                                      setUploadingExpireMedia(false)
                                    }
                                    
                                    e.target.value = ""
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Mensagem de Expiracao */}
                      <div className="space-y-2 mt-4">
                        <Label className="text-neutral-500">Mensagem de Expiracao</Label>
                        <RichTextEditor
                          value={expireMessage}
                          onChange={(value) => { setExpireMessage(value); markChange() }}
                          rows={5}
                          maxLength={4000}
                          className="bg-secondary/50 border-neutral-200 font-mono text-sm"
                          variables={[
                            { label: "{nome}", value: "{nome}" },
                            { label: "{plano}", value: "{plano}" },
                            { label: "{saudacao}", value: "{saudacao}" },
                            { label: "{uf}", value: "{uf}" }
                          ]}
                        />
                      </div>
                    </>
                  )}
                  </div>

                  {/* Planos de Renovacao */}
                  <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-100">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-9 w-9 rounded-lg bg-[#bfff00]/20 flex items-center justify-center">
                        <DollarSign className="h-4 w-4 text-[#8fb300]" />
                      </div>
                      <p className="font-semibold text-neutral-900">Planos de Renovacao</p>
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-neutral-500">Usar planos do fluxo</span>
                      <Switch checked={useFlowPlans} onCheckedChange={(c) => { setUseFlowPlans(c); markChange() }} />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-neutral-500 text-sm">Desconto na renovacao</Label>
                      <Select value={renewalDiscount} onValueChange={(v) => { setRenewalDiscount(v); markChange() }}>
                        <SelectTrigger className="bg-white border-neutral-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0%">Sem desconto</SelectItem>
                          <SelectItem value="10%">10%</SelectItem>
                          <SelectItem value="15%">15%</SelectItem>
                          <SelectItem value="20%">20%</SelectItem>
                          <SelectItem value="25%">25%</SelectItem>
                          <SelectItem value="30%">30%</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-neutral-500">Desconto aplicado aos planos na oferta de renovacao</p>
                    </div>
                  </div>

                  {/* Acoes ao Expirar */}
                  <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-100">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-9 w-9 rounded-lg bg-neutral-200 flex items-center justify-center">
                        <Users className="h-4 w-4 text-neutral-600" />
                      </div>
                      <p className="font-semibold text-neutral-900">Acoes ao Expirar</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-neutral-100">
                        <div>
                          <p className="font-medium text-sm text-neutral-900">Expulsar do grupo</p>
                          <p className="text-xs text-neutral-500">Remove o usuario do grupo VIP quando expirar</p>
                        </div>
                        <Switch checked={kickFromGroup} onCheckedChange={(c) => { setKickFromGroup(c); markChange() }} />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-neutral-100">
                        <div>
                          <p className="font-medium text-sm text-neutral-900">Remover status VIP</p>
                          <p className="text-xs text-neutral-500">Marca o lead como nao-VIP no sistema</p>
                        </div>
                        <Switch checked={removeVipStatus} onCheckedChange={(c) => { setRemoveVipStatus(c); markChange() }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Deliverables Tab */}
          {activeTab === "deliverables" && (
            <div className="space-y-6">
              {/* Header Card - White */}
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#bfff00] to-[#8fb300] flex items-center justify-center shadow-lg shadow-[#bfff00]/30">
                      <Gift className="h-5 w-5 text-neutral-900" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-neutral-900">Entregaveis</h2>
                      <p className="text-sm text-neutral-500">Configure o que sera entregue apos o pagamento</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-neutral-900 bg-[#bfff00] px-3 py-1 rounded-full">
                    {deliverables.length}/10
                  </span>
                </div>

                {/* Botao Adicionar */}
                <button
                  type="button"
                  onClick={() => {
                    setEditingDeliverable(null)
                    setDeliverableModalStep("select")
                    setTempDeliverable({
                      id: `del-${Date.now()}`,
                      name: `Entregavel ${deliverables.length + 1}`,
                      type: "media",
                      medias: [],
                      link: "",
                      linkText: "",
                      vipGroupChatId: "",
                      vipGroupName: "",
                      vipAutoAdd: true,
                      vipAutoRemove: true,
                    })
                    setDeliverableModalOpen(true)
                  }}
                  disabled={deliverables.length >= 10}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-neutral-200 hover:border-[#bfff00]/50 hover:bg-[#bfff00]/5 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="h-12 w-12 rounded-full bg-[#bfff00]/20 flex items-center justify-center group-hover:bg-[#bfff00]/30 transition-colors">
                    <Plus className="h-5 w-5 text-[#8fb300]" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-neutral-900">Adicionar</p>
                    <p className="text-sm text-neutral-500">Midia, Grupo VIP ou Link</p>
                  </div>
                </button>

                {deliverables.length === 0 && (
                  <p className="text-center text-xs text-neutral-500 mt-4">
                    Configure o que sera entregue apos o pagamento
                  </p>
                )}
              </div>

              {/* Entregavel Principal - White */}
              {deliverables.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border-2 border-[#bfff00]/30 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-[#bfff00]/20 flex items-center justify-center">
                        <Crown className="h-5 w-5 text-[#8fb300]" />
                      </div>
                      <div>
                        <p className="font-bold text-neutral-900 text-sm">Entregavel Principal</p>
                        <p className="text-xs text-neutral-500">Sera enviado apos a compra inicial</p>
                      </div>
                    </div>
                    <Select
                      value={mainDeliverableId || "none"}
                      onValueChange={(v) => {
                        setMainDeliverableId(v === "none" ? "" : v)
                        markChange()
                      }}
                    >
                      <SelectTrigger className="w-52 bg-neutral-50 border-neutral-200">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {deliverables.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name} ({d.type === "media" ? "Midia" : d.type === "link" ? "Link" : "Grupo VIP"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Lista de Entregaveis - White */}
              {deliverables.length > 0 && (
                <div className="space-y-3">
                  {deliverables.map((del) => (
                    <div 
                      key={del.id} 
                      className="bg-white rounded-2xl p-4 border border-neutral-100 hover:border-[#bfff00]/40 hover:shadow-sm transition-all cursor-pointer"
                      onClick={() => {
                        setEditingDeliverable(del)
                        setDeliverableModalStep("form")
                        setTempDeliverable({ ...del })
                        setDeliverableModalOpen(true)
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`h-11 w-11 rounded-xl flex items-center justify-center shadow-lg ${
                            del.type === "media" ? "bg-gradient-to-br from-purple-500 to-purple-600 shadow-purple-500/25" : 
                            del.type === "link" ? "bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/25" : "bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-500/25"
                          }`}>
                            {del.type === "media" ? (
                              <ImageIcon className="h-5 w-5 text-white" />
                            ) : del.type === "link" ? (
                              <Link2 className="h-5 w-5 text-white" />
                            ) : (
                              <Users className="h-5 w-5 text-white" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-neutral-900">{del.name}</p>
                            <p className="text-xs text-neutral-500">
                              {del.type === "media" 
                                ? `${(del.medias || []).length} midia(s)` 
                                : del.type === "link" 
                                  ? del.link || "Sem link configurado"
                                  : del.vipGroupName || "Grupo VIP"
                              }
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {mainDeliverableId === del.id && (
                            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#bfff00]/20 text-[#8fb300] text-xs font-bold">
                              <Crown className="h-3 w-3" />
                              Principal
                            </span>
                          )}
                          <button
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (mainDeliverableId === del.id) setMainDeliverableId("")
                              setDeliverables(deliverables.filter((d) => d.id !== del.id))
                              markChange()
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

          
        </div>
        )}
      </div>

      {/* Delete Flow Dialog - Design escuro */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[400px] bg-[#1c1c1e] border-[#2a2a2e] p-0 gap-0 overflow-hidden rounded-[20px] [&>button]:text-gray-400 [&>button]:hover:text-white">
          <div className="p-5">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Excluir Fluxo</h2>
                <p className="text-xs text-gray-400">Esta acao e irreversivel</p>
              </div>
            </div>

            {/* Content */}
            <div className="bg-[#2a2a2e] rounded-xl p-4 mb-4">
              <p className="text-sm text-gray-300 mb-3">
                Tem certeza que deseja excluir <span className="text-white font-semibold">{flow.name}</span>?
              </p>
              <ul className="text-xs text-gray-400 space-y-1.5">
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-gray-500" />
                  Remover todos os bots vinculados
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-gray-500" />
                  Desvincular o grupo VIP
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-gray-500" />
                  Excluir todas as configuracoes
                </li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 bg-[#18181a] border-t border-[#2a2a2e] flex items-center justify-end gap-2">
            <button
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-[#2a2a2e] transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleDeleteFlow}
              disabled={isDeleting}
              className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Bot Dialog - Design escuro */}
      <Dialog open={showAddBotDialog} onOpenChange={setShowAddBotDialog}>
        <DialogContent className="sm:max-w-[400px] bg-[#1c1c1e] border-[#2a2a2e] p-0 gap-0 overflow-hidden rounded-[20px] [&>button]:text-gray-400 [&>button]:hover:text-white">
          <div className="p-5">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-[#bfff00]/10 flex items-center justify-center border border-[#bfff00]/20">
                <Bot className="h-5 w-5 text-[#bfff00]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Selecionar Bot</h2>
                <p className="text-xs text-gray-400">Vincule um bot a este fluxo</p>
              </div>
            </div>

            {/* Content */}
            {isLoadingBots ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[#bfff00]" />
              </div>
            ) : availableBots.length === 0 ? (
              <div className="text-center py-6 bg-[#2a2a2e] rounded-xl">
                <Bot className="h-10 w-10 text-gray-500 mx-auto mb-3" />
                <p className="font-medium text-white mb-1">Nenhum bot disponivel</p>
                <p className="text-sm text-gray-400 mb-4">
                  {userBots.length === 0
                    ? "Voce ainda nao tem bots cadastrados"
                    : "Todos os seus bots ja estao vinculados a outros fluxos. Cada bot so pode estar em um fluxo por vez."}
                </p>
                <button
                  onClick={() => {
                    setShowAddBotDialog(false)
                    setShowCreateBotForm(true)
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#bfff00] text-[#1c1c1e] font-semibold text-sm hover:bg-[#d4ff4d] transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Criar Novo Bot
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">
                  Selecione um bot para vincular a este fluxo.
                </p>
                <Select value={selectedBotToAdd} onValueChange={setSelectedBotToAdd}>
                  <SelectTrigger className="h-11 bg-[#2a2a2e] border-[#3a3a3e] text-white rounded-lg">
                    <SelectValue placeholder="Selecione um bot..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2a2a2e] border-[#3a3a3e]">
                    {availableBots.map((bot) => (
                      <SelectItem key={bot.id} value={bot.id} className="text-white hover:bg-[#3a3a3e] focus:bg-[#3a3a3e]">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-[#bfff00]" />
                          <span>{bot.first_name || bot.username}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Footer */}
          {availableBots.length > 0 && (
            <div className="px-5 py-3 bg-[#18181a] border-t border-[#2a2a2e] flex items-center justify-end gap-2">
              <button
                onClick={() => setShowAddBotDialog(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-[#2a2a2e] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddBot}
                disabled={!selectedBotToAdd}
                className="flex items-center gap-2 bg-[#bfff00] text-[#1c1c1e] px-4 py-2 rounded-lg font-semibold text-sm hover:bg-[#d4ff4d] disabled:opacity-50 transition-colors"
              >
                Vincular Bot
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Novo/Editar Entregavel - Global */}
      <Dialog open={deliverableModalOpen} onOpenChange={setDeliverableModalOpen}>
        <DialogContent className="sm:max-w-[380px] p-0 gap-0">
          {/* Etapa 1: Selecao de Tipo */}
          {deliverableModalStep === "select" && (
            <div className="p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="h-8 w-8 rounded-lg bg-[#BEFF00]/10 flex items-center justify-center">
                  <Gift className="h-4 w-4 text-[#8fb300]" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Novo Entregavel</h3>
                  <p className="text-xs text-neutral-500">Selecione o tipo</p>
                </div>
              </div>
              
              <div className="space-y-2">
                {[
                  { type: "media" as const, label: "Midia", desc: "Fotos, videos ou arquivos", icon: ImageIcon, color: "purple" },
                  { type: "vip_group" as const, label: "Grupo VIP", desc: "Adicao automatica ao grupo", icon: Users, color: "amber" },
                  { type: "link" as const, label: "Link", desc: "Link de acesso externo", icon: Link2, color: "blue" },
                ].map((opt) => (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => {
                      setTempDeliverable({ ...tempDeliverable, type: opt.type })
                      setDeliverableModalStep("form")
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-neutral-200 bg-white hover:border-[#BEFF00]/50 hover:bg-[#BEFF00]/5 transition-all text-left group"
                  >
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                      opt.color === "purple" ? "bg-purple-500/10" :
                      opt.color === "amber" ? "bg-amber-500/10" : "bg-blue-500/10"
                    }`}>
                      <opt.icon className={`h-4 w-4 ${
                        opt.color === "purple" ? "text-purple-500" :
                        opt.color === "amber" ? "text-amber-500" : "text-blue-500"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{opt.label}</p>
                      <p className="text-xs text-neutral-500">{opt.desc}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Etapa 2: Formulario */}
          {deliverableModalStep === "form" && (
            <>
              {/* Header */}
              <div className="p-5 pb-0">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                    tempDeliverable.type === "media" ? "bg-purple-500/10" :
                    tempDeliverable.type === "vip_group" ? "bg-amber-500/10" : "bg-blue-500/10"
                  }`}>
                    {tempDeliverable.type === "media" ? (
                      <ImageIcon className="h-4 w-4 text-purple-500" />
                    ) : tempDeliverable.type === "vip_group" ? (
                      <Users className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Link2 className="h-4 w-4 text-blue-500" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{editingDeliverable ? "Editar" : "Novo"} Entregavel</h3>
                    <p className="text-xs text-neutral-500">
                      {tempDeliverable.type === "media" ? "Midia" : 
                       tempDeliverable.type === "vip_group" ? "Grupo VIP" : "Link"}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Content */}
              <div className="px-5 pb-5 space-y-3">
                {/* Nome */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Nome do Entregavel</Label>
                  <Input
                    value={tempDeliverable.name}
                    onChange={(e) => setTempDeliverable({ ...tempDeliverable, name: e.target.value })}
                    placeholder="Ex: Curso Completo"
                    className="h-9"
                  />
                </div>

                {/* Tipo selector compacto */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Tipo</Label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { type: "media" as const, label: "Midia", icon: ImageIcon, color: "purple" },
                      { type: "vip_group" as const, label: "Grupo VIP", icon: Users, color: "amber" },
                      { type: "link" as const, label: "Link", icon: Link2, color: "blue" },
                    ].map((opt) => (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => setTempDeliverable({ ...tempDeliverable, type: opt.type })}
                        className={`flex flex-col items-center gap-1 py-2 px-1.5 rounded-lg border-2 transition-all ${
                          tempDeliverable.type === opt.type
                            ? "border-[#BEFF00] bg-[#BEFF00]/5"
                            : "border-neutral-200 hover:border-[#BEFF00]/30"
                        }`}
                      >
                        <opt.icon className={`h-4 w-4 ${
                          tempDeliverable.type === opt.type ? "text-[#8fb300]" :
                          opt.color === "purple" ? "text-purple-500" :
                          opt.color === "amber" ? "text-amber-500" : "text-blue-500"
                        }`} />
                        <span className={`text-[10px] font-medium ${tempDeliverable.type === opt.type ? "text-[#8fb300]" : "text-neutral-500"}`}>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Campos especificos por tipo */}
                {tempDeliverable.type === "media" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Midias</Label>
                      <span className="text-[10px] text-neutral-500">{(tempDeliverable.medias || []).length}/20</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(tempDeliverable.medias || []).map((media, mediaIndex) => {
                        const isBlob = media.startsWith("blob:")
                        const isVideo = media.includes("/videos/") || media.match(/\.(mp4|webm|mov)($|\?)/i)
                        return (
                          <div key={mediaIndex} className="relative group">
                            {isBlob ? (
                              <div className="h-12 w-12 rounded-lg border border-neutral-200 flex items-center justify-center bg-neutral-100">
                                <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                              </div>
                            ) : isVideo ? (
                              <video
                                src={media}
                                className="h-12 w-12 rounded-lg object-cover border border-neutral-200"
                                muted
                              />
                            ) : (
                              <img
                                src={media}
                                alt={`Media ${mediaIndex + 1}`}
                                className="h-12 w-12 rounded-lg object-cover border border-neutral-200"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.style.display = "none"
                                }}
                              />
                            )}
                            {!isBlob && (
                              <button
                                type="button"
                                onClick={() => {
                                  setTempDeliverable({
                                    ...tempDeliverable,
                                    medias: (tempDeliverable.medias || []).filter((_, i) => i !== mediaIndex)
                                  })
                                }}
                                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            )}
                          </div>
                        )
                      })}
                      {(tempDeliverable.medias || []).length < 20 && (
                        <label className="h-12 w-12 rounded-lg border-2 border-dashed border-neutral-200 flex items-center justify-center cursor-pointer hover:border-[#BEFF00]/50 hover:bg-[#BEFF00]/5 transition-colors relative">
                          <Plus className="h-4 w-4 text-neutral-500" />
                          <input
                            type="file"
                            accept="image/*,video/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              
                              // Mostrar loading temporario
                              const tempUrl = URL.createObjectURL(file)
                              setTempDeliverable({
                                ...tempDeliverable,
                                medias: [...(tempDeliverable.medias || []), tempUrl]
                              })
                              
                              try {
                                // Upload real para API
                                const formData = new FormData()
                                formData.append("file", file)
                                
                                const res = await fetch("/api/upload", {
                                  method: "POST",
                                  body: formData,
                                })
                                
                                const data = await res.json()
                                
                                if (!res.ok) {
                                  throw new Error(data.error || "Erro no upload")
                                }
                                
                                // Substituir blob URL pela URL real
                                setTempDeliverable(prev => ({
                                  ...prev,
                                  medias: (prev.medias || []).map(m => m === tempUrl ? data.url : m)
                                }))
                              } catch (err) {
                                console.error("Erro no upload:", err)
                                // Remover a URL temporaria em caso de erro
                                setTempDeliverable(prev => ({
                                  ...prev,
                                  medias: (prev.medias || []).filter(m => m !== tempUrl)
                                }))
                                alert("Erro ao fazer upload da midia. Tente novamente.")
                              } finally {
                                URL.revokeObjectURL(tempUrl)
                              }
                              
                              // Limpar input
                              e.target.value = ""
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {tempDeliverable.type === "link" && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Link de Acesso</Label>
                      <Input
                        value={tempDeliverable.link || ""}
                        onChange={(e) => setTempDeliverable({ ...tempDeliverable, link: e.target.value })}
                        placeholder="https://exemplo.com/acesso"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Texto do Botao</Label>
                      <Input
                        value={tempDeliverable.linkText || ""}
                        onChange={(e) => setTempDeliverable({ ...tempDeliverable, linkText: e.target.value })}
                        placeholder="Acessar Conteudo"
                        className="h-9"
                      />
                    </div>
                  </div>
                )}

                {tempDeliverable.type === "vip_group" && (
                  <div className="space-y-2">
                    {/* Inputs em grid */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-medium">Chat ID</Label>
                        <Input
                          value={tempDeliverable.vipGroupChatId || ""}
                          onChange={(e) => setTempDeliverable({ ...tempDeliverable, vipGroupChatId: e.target.value })}
                          placeholder="-100123..."
                          className="h-8 font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-medium">Nome (opcional)</Label>
                        <Input
                          value={tempDeliverable.vipGroupName || ""}
                          onChange={(e) => setTempDeliverable({ ...tempDeliverable, vipGroupName: e.target.value })}
                          placeholder="Grupo VIP"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                    
                    {/* Toggles inline */}
                    <div className="flex items-center gap-4 py-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Switch
                          checked={tempDeliverable.vipAutoAdd !== false}
                          onCheckedChange={(checked) => setTempDeliverable({ ...tempDeliverable, vipAutoAdd: checked })}
                          className="scale-75"
                        />
                        <span className="text-[10px]">Add auto</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Switch
                          checked={tempDeliverable.vipAutoRemove !== false}
                          onCheckedChange={(checked) => setTempDeliverable({ ...tempDeliverable, vipAutoRemove: checked })}
                          className="scale-75"
                        />
                        <span className="text-[10px]">Remover expirado</span>
                      </label>
                    </div>
                    
                    {/* Aviso + Testar inline */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded bg-amber-500/10 text-amber-600">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <p className="text-[9px]">Bot precisa ser ADMIN</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-[10px] px-2" 
                        type="button"
                        onClick={handleTestVipGroup}
                        disabled={isTestingVipGroup || !tempDeliverable.vipGroupChatId}
                      >
                        {isTestingVipGroup ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Zap className="h-3 w-3 mr-1" />
                        )}
                        {isTestingVipGroup ? "Testando..." : "Testar"}
                      </Button>
                    </div>
                    
                    {/* Resultado do teste */}
                    {vipTestResult && (
                      <div className={`flex items-start gap-1.5 px-2 py-1.5 rounded text-[9px] ${
                        vipTestResult.success 
                          ? "bg-green-500/10 text-green-600" 
                          : "bg-red-500/10 text-red-600"
                      }`}>
                        {vipTestResult.success ? (
                          <Check className="h-3 w-3 shrink-0 mt-0.5" />
                        ) : (
                          <X className="h-3 w-3 shrink-0 mt-0.5" />
                        )}
                        <p>{vipTestResult.message}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-secondary/30">
                <Button 
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => {
                    if (editingDeliverable) {
                      setDeliverableModalOpen(false)
                    } else {
                      setDeliverableModalStep("select")
                    }
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  size="sm"
                  className="h-8 bg-accent hover:bg-accent/90 text-[#8fb300]-foreground"
                  onClick={() => {
                    if (editingDeliverable) {
                      setDeliverables(deliverables.map(d => d.id === tempDeliverable.id ? tempDeliverable : d))
                    } else {
                      setDeliverables([...deliverables, tempDeliverable])
                    }
                    setDeliverableModalOpen(false)
                    markChange()
                  }}
                >
                  Salvar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

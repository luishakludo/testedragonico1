"use client"

import { useState, useEffect, useCallback, useRef } from "react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { NoBotSelected } from "@/components/no-bot-selected"
import { useBots } from "@/lib/bot-context"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"
import {
  Plus, GitBranch, MessageSquare, Timer, Split,
  ArrowRight, GripVertical, ChevronRight, Users, CreditCard,
  Pencil, Trash2, Loader2, Image, Video, Link, X, Upload, FileCheck,
  Star, Zap, RotateCcw, ShoppingBag, UserPlus, Mail, Target, Sparkles, Crown,
  Search, Settings2, Clock, Bell, Tag, Percent, Globe, FileText, Heart,
  Send, CalendarDays, Repeat, Filter, MessageCircle, AlertCircle,
  ExternalLink, Workflow, CheckCircle2, Hash, Unlink, UsersRound, Webhook,
  CircleStop, RefreshCw, MousePointerClick,
  ArrowDown, TrendingUp, TrendingDown, Package,
} from "lucide-react"
import NextImage from "next/image"
import { Switch } from "@/components/ui/switch"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

// ---- Types ----

type FlowCategory = "inicial" | "remarketing" | "followup" | "pos-venda" | "captacao" | "notificacao" | "personalizado"

interface Flow {
  id: string
  bot_id: string
  user_id: string
  name: string
  status: "ativo" | "pausado"
  category: FlowCategory
  is_primary: boolean
  flow_type: "basic" | "complete"
  created_at: string
  updated_at: string
}

type NodeType = "trigger" | "message" | "delay" | "condition" | "payment" | "action"

interface InlineButton {
  text: string
  url: string
}

interface PaymentButton {
  id: string
  text: string
  amount: string
}

interface UpsellOffer {
  id: string
  enabled: boolean
  media_url: string
  media_type: "photo" | "video" | "none"
  description: string
  delay_seconds: string
  buttons: PaymentButton[]
}

interface DownsellOffer {
  id: string
  enabled: boolean
  media_url: string
  media_type: "photo" | "video" | "none"
  description: string
  delay_seconds: string
  buttons: PaymentButton[]
}

interface FlowNode {
  id: string
  flow_id: string
  type: NodeType
  label: string
  config: Record<string, unknown>
  position: number
  created_at: string
  updated_at: string
}

// ---- Dragon Icon ----
function DragonTriggerIcon({ className }: { className?: string }) {
  return (
    <NextImage
      src="/images/dragon-icon.png"
      alt=""
      width={20}
      height={20}
      className={className}
    />
  )
}

// ---- Flow Category Config ----

const flowCategories: { value: FlowCategory; label: string; description: string; icon: React.ElementType; color: string; iconColor: string }[] = [
  { value: "inicial", label: "Fluxo Inicial", description: "Primeiro contato do usuario com o bot", icon: Crown, color: "border-accent bg-accent/10", iconColor: "text-accent" },
  { value: "remarketing", label: "Remarketing", description: "Reengajar usuarios que nao converteram", icon: Target, color: "border-orange-500/30 bg-orange-500/10", iconColor: "text-orange-400" },
  { value: "followup", label: "Follow-up", description: "Acompanhamento apos interacao", icon: RotateCcw, color: "border-blue-500/30 bg-blue-500/10", iconColor: "text-blue-400" },
  { value: "pos-venda", label: "Pos-venda", description: "Fluxo para quem ja comprou", icon: ShoppingBag, color: "border-purple-500/30 bg-purple-500/10", iconColor: "text-purple-400" },
  { value: "captacao", label: "Captacao", description: "Captar novos leads e contatos", icon: UserPlus, color: "border-cyan-500/30 bg-cyan-500/10", iconColor: "text-cyan-400" },
  { value: "notificacao", label: "Notificacao", description: "Enviar avisos e alertas", icon: Mail, color: "border-yellow-500/30 bg-yellow-500/10", iconColor: "text-yellow-400" },
  { value: "personalizado", label: "Personalizado", description: "Crie seu proprio tipo de fluxo", icon: Sparkles, color: "border-pink-500/30 bg-pink-500/10", iconColor: "text-pink-400" },
]

const getCategoryConfig = (cat: FlowCategory) => flowCategories.find((c) => c.value === cat) || flowCategories[flowCategories.length - 1]

// ---- Category-specific configuration fields ----

interface CategoryField {
  key: string
  label: string
  type: "text" | "number" | "select" | "toggle" | "textarea"
  placeholder?: string
  options?: { value: string; label: string }[]
  description?: string
  icon: React.ElementType
}

interface CategoryConfigDef {
  category: FlowCategory
  title: string
  description: string
  fields: CategoryField[]
}

const categoryConfigs: CategoryConfigDef[] = [
  {
    category: "inicial",
    title: "Configuracoes do Fluxo Inicial",
    description: "O primeiro contato do usuario com o bot. Configure o comportamento padrao do fluxo.",
    fields: [
      { key: "default_delay_sec", label: "Delay padrao entre mensagens (seg)", type: "number", placeholder: "2", icon: Clock, description: "Tempo de espera padrao entre cada mensagem enviada" },
      { key: "fallback_message", label: "Mensagem de fallback", type: "textarea", placeholder: "Desculpe, nao entendi. Tente novamente.", icon: AlertCircle, description: "Quando o bot nao entende o usuario" },
    ],
  },
  {
    category: "remarketing",
    title: "Configuracoes de Remarketing",
    description: "Reengaje usuarios inativos ou que nao converteram.",
    fields: [
      { key: "trigger_after_days", label: "Disparar apos (dias)", type: "number", placeholder: "3", icon: Clock, description: "Dias sem interacao para disparar" },
      { key: "target_audience", label: "Publico-alvo", type: "select", icon: Users, options: [
        { value: "inativos", label: "Usuarios inativos" },
        { value: "carrinho", label: "Abandonaram carrinho" },
        { value: "visitantes", label: "Visitaram mas nao compraram" },
        { value: "todos", label: "Todos os contatos" },
      ], description: "Quem vai receber" },
      { key: "offer_type", label: "Tipo de oferta", type: "select", icon: Tag, options: [
        { value: "desconto", label: "Desconto %" },
        { value: "cupom", label: "Cupom fixo" },
        { value: "frete", label: "Frete gratis" },
        { value: "nenhum", label: "Sem oferta" },
      ], description: "Incentivo para reengajar" },
      { key: "discount_value", label: "Valor do desconto", type: "text", placeholder: "10% ou R$20", icon: Percent, description: "Valor do incentivo" },
      { key: "max_sends", label: "Maximo de envios", type: "number", placeholder: "3", icon: Repeat, description: "Limite de mensagens por usuario" },
      { key: "urgency_enabled", label: "Urgencia (tempo limitado)", type: "toggle", icon: AlertCircle, description: "Adicionar countdown na oferta" },
    ],
  },
  {
    category: "followup",
    title: "Configuracoes de Follow-up",
    description: "Acompanhe usuarios apos uma interacao.",
    fields: [
      { key: "followup_delay_hours", label: "Delay apos interacao (horas)", type: "number", placeholder: "24", icon: Clock, description: "Tempo para enviar follow-up" },
      { key: "trigger_event", label: "Evento gatilho", type: "select", icon: Zap, options: [
        { value: "mensagem", label: "Enviou mensagem" },
        { value: "visualizou", label: "Visualizou conteudo" },
        { value: "clicou", label: "Clicou em link" },
        { value: "respondeu", label: "Respondeu pesquisa" },
      ], description: "O que ativa este follow-up" },
      { key: "max_followups", label: "Maximo de follow-ups", type: "number", placeholder: "3", icon: Repeat, description: "Quantas vezes insistir" },
      { key: "stop_on_reply", label: "Parar se responder", type: "toggle", icon: MessageCircle, description: "Cancela sequencia se usuario responder" },
      { key: "personalize", label: "Personalizar com nome", type: "toggle", icon: Heart, description: "Usar nome do usuario na mensagem" },
    ],
  },
  {
    category: "pos-venda",
    title: "Configuracoes de Pos-venda",
    description: "Fluxo para quem ja comprou. Fidelizacao e upsell.",
    fields: [
      { key: "trigger_after_purchase_hours", label: "Enviar apos compra (horas)", type: "number", placeholder: "2", icon: Clock, description: "Delay apos confirmacao de compra" },
      { key: "satisfaction_survey", label: "Pesquisa de satisfacao", type: "toggle", icon: Star, description: "Enviar pesquisa NPS/CSAT" },
      { key: "review_request", label: "Pedir avaliacao", type: "toggle", icon: Heart, description: "Solicitar review do produto" },
      { key: "upsell_enabled", label: "Oferecer upsell", type: "toggle", icon: ShoppingBag, description: "Sugerir produtos complementares" },
      { key: "upsell_discount", label: "Desconto no upsell (%)", type: "number", placeholder: "15", icon: Percent, description: "Desconto para produtos sugeridos" },
      { key: "support_shortcut", label: "Atalho para suporte", type: "toggle", icon: MessageCircle, description: "Botao rapido para falar com suporte" },
    ],
  },
  {
    category: "captacao",
    title: "Configuracoes de Captacao",
    description: "Capture leads e novos contatos para sua base.",
    fields: [
      { key: "collect_email", label: "Coletar e-mail", type: "toggle", icon: Mail, description: "Pedir e-mail do lead" },
      { key: "collect_phone", label: "Coletar telefone", type: "toggle", icon: Send, description: "Pedir telefone do lead" },
      { key: "lead_magnet", label: "Isca digital", type: "select", icon: Tag, options: [
        { value: "ebook", label: "E-book" },
        { value: "desconto", label: "Cupom de desconto" },
        { value: "webinar", label: "Webinar/Aula" },
        { value: "checklist", label: "Checklist" },
        { value: "nenhum", label: "Nenhuma" },
      ], description: "O que oferecer em troca dos dados" },
      { key: "qualification_question", label: "Pergunta de qualificacao", type: "textarea", placeholder: "Qual seu maior desafio hoje?", icon: Filter, description: "Segmentar o lead com perguntas" },
      { key: "redirect_after", label: "Redirecionar apos captura", type: "text", placeholder: "https://seusite.com/obrigado", icon: Globe, description: "URL de destino pos-captura" },
      { key: "tag_lead", label: "Tag do lead", type: "text", placeholder: "lead-quente", icon: Tag, description: "Tag para identificar esses leads" },
    ],
  },
  {
    category: "notificacao",
    title: "Configuracoes de Notificacao",
    description: "Envie avisos, alertas e comunicados.",
    fields: [
      { key: "notification_type", label: "Tipo de notificacao", type: "select", icon: Bell, options: [
        { value: "aviso", label: "Aviso geral" },
        { value: "promocao", label: "Promocao" },
        { value: "lembrete", label: "Lembrete" },
        { value: "atualizacao", label: "Atualizacao" },
      ], description: "Categoria da notificacao" },
      { key: "schedule_enabled", label: "Agendar envio", type: "toggle", icon: CalendarDays, description: "Programar data/hora de envio" },
      { key: "schedule_datetime", label: "Data e hora", type: "text", placeholder: "2025-12-25 09:00", icon: Clock, description: "Quando enviar (se agendado)" },
      { key: "frequency_limit", label: "Limite de frequencia (horas)", type: "number", placeholder: "24", icon: Repeat, description: "Intervalo minimo entre envios" },
      { key: "priority", label: "Prioridade", type: "select", icon: AlertCircle, options: [
        { value: "alta", label: "Alta" },
        { value: "media", label: "Media" },
        { value: "baixa", label: "Baixa" },
      ], description: "Nivel de urgencia" },
    ],
  },
  {
    category: "personalizado",
    title: "Configuracoes Personalizadas",
    description: "Defina suas proprias configuracoes para este fluxo.",
    fields: [
      { key: "custom_label", label: "Label personalizado", type: "text", placeholder: "Ex: Fluxo VIP", icon: Tag, description: "Nome interno para organizacao" },
      { key: "custom_description", label: "Descricao", type: "textarea", placeholder: "Descreva o objetivo deste fluxo...", icon: FileText, description: "Anotacao sobre o fluxo" },
      { key: "custom_trigger", label: "Gatilho personalizado", type: "text", placeholder: "Ex: Quando usuario digita /vip", icon: Zap, description: "Condicao para ativar este fluxo" },
      { key: "custom_tag", label: "Tag", type: "text", placeholder: "Ex: vip, especial", icon: Tag, description: "Tags para segmentacao" },
    ],
  },
]

const getCategoryConfigDef = (cat: FlowCategory) => categoryConfigs.find((c) => c.category === cat) || categoryConfigs[categoryConfigs.length - 1]

// ---- Constants ----

const nodeIcons: Record<NodeType, React.ElementType> = {
  trigger: DragonTriggerIcon, message: MessageSquare, delay: Timer,
  condition: Split, payment: CreditCard, action: Users,
  redirect: ExternalLink,
}

const nodeColors: Record<NodeType, string> = {
  trigger: "border-accent bg-accent/5",
  message: "border-blue-500/30 bg-blue-500/5",
  delay: "border-warning/30 bg-warning/5",
  condition: "border-purple-500/30 bg-purple-500/5",
  payment: "border-success/30 bg-success/5",
  action: "border-cyan-500/30 bg-cyan-500/5",
  redirect: "border-orange-500/30 bg-orange-500/5",
}

const nodeIconColors: Record<NodeType, string> = {
  trigger: "text-accent", message: "text-blue-400", delay: "text-warning",
  condition: "text-purple-400", payment: "text-success", action: "text-cyan-400",
  redirect: "text-orange-400",
}

const statusStyles: Record<string, string> = {
  ativo: "bg-success/10 text-success border-success/20",
  pausado: "bg-warning/10 text-warning border-warning/20",
}

// Available action templates
const actionTemplates: { type: NodeType; label: string; description: string; configFields: { key: string; label: string; placeholder: string; inputType: "text" | "textarea" | "number" }[]; subVariant?: string }[] = [
  {
    type: "trigger",
    label: "Usuario inicia bot",
    description: "Gatilho inicial quando o usuario inicia o bot",
    configFields: [],
  },
  {
    type: "message",
    label: "Mensagem de Texto",
    description: "Enviar mensagem com texto, midia e botoes",
    configFields: [],
    subVariant: "text",
  },
  {
    type: "delay",
    label: "Aguardar Tempo",
    description: "Esperar antes da proxima etapa",
    configFields: [
      { key: "seconds", label: "Tempo em segundos", placeholder: "300", inputType: "number" },
    ],
    subVariant: "wait_time",
  },
  {
  type: "condition",
  label: "Condição",
  description: "Ramificar fluxo com base na resposta do usuario",
  configFields: [],
  subVariant: "response_condition",
  },
  {
    type: "payment",
    label: "Gerar Cobranca",
    description: "Criar cobranca PIX ou link de pagamento",
    configFields: [
      { key: "amount", label: "Valor (R$)", placeholder: "49.90", inputType: "text" },
      { key: "description", label: "Descricao", placeholder: "Pagamento do produto X", inputType: "text" },
    ],
    subVariant: "charge",
  },

  {
    type: "action",
    label: "Adicionar ao Grupo",
    description: "Enviar usuario para um grupo ou canal",
    configFields: [
      { key: "action_name", label: "Link do grupo", placeholder: "https://t.me/grupo", inputType: "text" },
    ],
    subVariant: "add_group",
  },
  {
    type: "action",
    label: "Ir para Outro Fluxo",
    description: "Redirecionar para fluxo secundario",
    configFields: [
      { key: "target_flow_id", label: "Fluxo de destino", placeholder: "Selecione o fluxo...", inputType: "text" },
    ],
    subVariant: "goto_flow",
  },
  {
    type: "action",
    label: "Encerrar Conversa",
    description: "Finalizar interacao com o usuario",
    configFields: [],
    subVariant: "end",
  },
]

// Business function groups for the "Add Step" dialog
interface ActionGroup {
  id: string
  label: string
  description: string
  icon: React.ElementType
  iconColor: string
  bgColor: string
  borderAccent: string
  types: NodeType[]
  subVariants?: string[]
}

const actionGroups: ActionGroup[] = [
  {
    id: "comunicacao",
    label: "Comunicacao",
    description: "Enviar mensagens de texto",
    icon: MessageSquare,
    iconColor: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderAccent: "border-blue-500/30",
    types: ["message"],
    subVariants: ["text"],
  },
  {
    id: "logica",
    label: "Logica",
    description: "Condicoes, delays e verificacoes",
    icon: Split,
    iconColor: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderAccent: "border-purple-500/30",
    types: ["delay", "condition"],
    subVariants: ["wait_time", "response_condition"],
  },
  {
    id: "monetizacao",
    label: "Monetizacao",
    description: "Cobrancas, pagamentos e PIX",
    icon: CreditCard,
    iconColor: "text-success",
    bgColor: "bg-success/10",
    borderAccent: "border-success/30",
    types: ["payment"],
    subVariants: ["charge"],
  },
  {
    id: "navegacao",
    label: "Navegacao",
    description: "Redirecionar, recomecar ou encerrar",
    icon: ExternalLink,
    iconColor: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderAccent: "border-orange-500/30",
    types: ["action"],
    subVariants: ["goto_flow", "end"],
  },
  {
    id: "automacao",
    label: "Automacao",
    description: "Adicionar usuarios a grupos",
    icon: Zap,
    iconColor: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderAccent: "border-cyan-500/30",
    types: ["action"],
    subVariants: ["add_group"],
  },
]

// SubVariant-specific icons for the dialog
const subVariantIcons: Record<string, React.ElementType> = {
  text: MessageSquare,
  media: Image,
  buttons: MousePointerClick,

  wait_time: Timer,
  response_condition: Split,

  charge: CreditCard,

  add_group: UsersRound,
  goto_flow: ExternalLink,
  restart: RefreshCw,
  end: CircleStop,
}

// ---- Sortable Payment Button ----

function SortablePaymentButton({
  button,
  index,
  onUpdate,
  onDelete,
  canDelete,
}: {
  button: PaymentButton
  index: number
  onUpdate: (field: "text" | "amount", value: string) => void
  onDelete: () => void
  canDelete: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: button.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col gap-2 rounded-xl border border-border/60 bg-secondary/20 p-3"
    >
      <div className="flex items-center gap-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-secondary/50"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground/50" />
        </div>
        <span className="text-[10px] font-medium text-muted-foreground/60 uppercase">Botao {index + 1}</span>
        <div className="flex-1" />
        {canDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground/50 hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <Input
        type="text"
        value={button.text}
        onChange={(e) => onUpdate("text", e.target.value)}
        placeholder="Texto do botao (ex: Plano Mensal)"
        className="bg-secondary/50 border-border/50 rounded-lg text-sm h-9"
      />
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">R$</span>
        <Input
          type="text"
          value={button.amount}
          onChange={(e) => onUpdate("amount", e.target.value)}
          placeholder="29,90"
          className="bg-secondary/50 border-border/50 rounded-lg text-sm h-9 w-[100px]"
        />
      </div>
    </div>
  )
}

// ---- Offer Form Component (for Upsell/Downsell) ----

function OfferForm({
  offer,
  index,
  type,
  onUpdate,
  onRemove,
  onMediaUpload,
  isUploading,
  canRemove,
  linkedDownsellEnabled,
  sensors,
  activeButtonId,
  setActiveButtonId,
}: {
  offer: UpsellOffer | DownsellOffer
  index: number
  type: "upsell" | "downsell"
  onUpdate: (updated: UpsellOffer | DownsellOffer) => void
  onRemove: () => void
  onMediaUpload: (file: File) => void
  isUploading: boolean
  canRemove: boolean
  linkedDownsellEnabled?: boolean
  sensors: ReturnType<typeof useSensors>
  activeButtonId: string | null
  setActiveButtonId: (id: string | null) => void
}) {
  const isUpsell = type === "upsell"
  const colorClass = isUpsell ? "blue" : "rose"
  const Icon = isUpsell ? TrendingUp : TrendingDown
  const label = isUpsell ? `Upsell ${index + 1}` : `Downsell ${index + 1}`
  const description = isUpsell ? "Oferta de upgrade apos pagamento" : "Oferta menor se recusar upsell"

  // For downsell, check if linked upsell is enabled
  const isDisabled = type === "downsell" && !linkedDownsellEnabled

  return (
    <div className={`flex flex-col rounded-xl border ${offer.enabled ? `border-${colorClass}-500/30` : "border-border/60"} overflow-hidden`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-3.5 py-2.5 ${offer.enabled ? `bg-${colorClass}-500/5` : "bg-secondary/20"}`}>
        <div className="flex items-center gap-2.5">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${isUpsell ? "bg-blue-500/10" : "bg-rose-500/10"}`}>
            <Icon className={`h-3.5 w-3.5 ${isUpsell ? "text-blue-400" : "text-rose-400"}`} />
          </div>
          <div>
            <span className="text-sm font-medium text-foreground">{label}</span>
            <p className="text-[10px] text-muted-foreground/70 leading-tight">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground/50 hover:text-destructive"
              onClick={onRemove}
              disabled={isDisabled}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Switch
            checked={offer.enabled}
            onCheckedChange={(checked) => onUpdate({ ...offer, enabled: checked })}
            disabled={isDisabled}
          />
        </div>
      </div>

      {isDisabled && (
        <div className="px-3.5 py-2 bg-muted/30">
          <p className="text-[10px] text-muted-foreground">Ative o Upsell {index + 1} para configurar este Downsell</p>
        </div>
      )}

      {/* Content */}
      {offer.enabled && !isDisabled && (
        <div className="flex flex-col gap-3 px-3.5 py-3">
          {/* Delay */}
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Enviar apos</span>
            <Input
              type="number"
              value={offer.delay_seconds}
              onChange={(e) => onUpdate({ ...offer, delay_seconds: e.target.value })}
              className="bg-secondary/50 border-border/50 rounded-lg text-xs h-7 w-[70px] text-center"
              min="1"
            />
            <span className="text-xs text-muted-foreground">segundos</span>
          </div>

          {/* Media Upload */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-medium tracking-wide uppercase text-muted-foreground/70">Midia</Label>
            <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-secondary/20 p-3 cursor-pointer hover:border-border transition-colors">
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) onMediaUpload(file)
                }}
              />
              {isUploading ? (
                <div className="flex flex-col items-center gap-1.5">
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  <span className="text-[10px] text-muted-foreground">Enviando...</span>
                </div>
              ) : offer.media_url ? (
                <div className="relative w-full">
                  {offer.media_type === "video" ? (
                    <video src={offer.media_url} className="w-full h-20 object-cover rounded-lg" />
                  ) : (
                    <img src={offer.media_url} alt="Preview" className="w-full h-20 object-cover rounded-lg" />
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-5 w-5"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onUpdate({ ...offer, media_url: "", media_type: "none" })
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5">
                  <Upload className="h-5 w-5 text-muted-foreground/50" />
                  <span className="text-[10px] text-muted-foreground">Clique para enviar foto ou video</span>
                </div>
              )}
            </label>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-medium tracking-wide uppercase text-muted-foreground/70">Descricao</Label>
            <Textarea
              value={offer.description}
              onChange={(e) => onUpdate({ ...offer, description: e.target.value })}
              placeholder="Descricao da oferta que aparecera no Telegram"
              className="bg-secondary/50 border-border/50 rounded-lg text-xs min-h-[60px]"
            />
          </div>

          {/* Payment Buttons with Drag and Drop */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-medium tracking-wide uppercase text-muted-foreground/70">Botoes de Pagamento</Label>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={(event) => setActiveButtonId(event.active.id as string)}
              onDragEnd={(event) => {
                setActiveButtonId(null)
                const { active, over } = event
                if (!over || active.id === over.id) return
                const oldIndex = offer.buttons.findIndex((b) => b.id === active.id)
                const newIndex = offer.buttons.findIndex((b) => b.id === over.id)
                if (oldIndex !== -1 && newIndex !== -1) {
                  onUpdate({ ...offer, buttons: arrayMove(offer.buttons, oldIndex, newIndex) })
                }
              }}
            >
              <SortableContext items={offer.buttons.map(b => b.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-1.5">
                  {offer.buttons.map((btn, btnIndex) => (
                    <SortableOfferButton
                      key={btn.id}
                      button={btn}
                      index={btnIndex}
                      onUpdate={(field, value) => {
                        const updated = offer.buttons.map(b => b.id === btn.id ? { ...b, [field]: value } : b)
                        onUpdate({ ...offer, buttons: updated })
                      }}
                      onDelete={() => {
                        if (offer.buttons.length > 1) {
                          onUpdate({ ...offer, buttons: offer.buttons.filter(b => b.id !== btn.id) })
                        }
                      }}
                      canDelete={offer.buttons.length > 1}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeButtonId && offer.buttons.find(b => b.id === activeButtonId) ? (
                  <div className="rounded-lg border border-primary/50 bg-card p-2 shadow-lg">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-foreground">
                        {offer.buttons.find(b => b.id === activeButtonId)?.text || "Botao"}
                      </span>
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
            
            {offer.buttons.length < 5 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-[10px] h-7 rounded-lg border-dashed border border-border/50"
                onClick={() => onUpdate({ ...offer, buttons: [...offer.buttons, { id: crypto.randomUUID(), text: "", amount: "" }] })}
              >
                <Plus className="h-3 w-3 mr-1" />
                Adicionar botao
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Sortable Offer Button (compact version for offers) ----

function SortableOfferButton({
  button,
  index,
  onUpdate,
  onDelete,
  canDelete,
}: {
  button: PaymentButton
  index: number
  onUpdate: (field: "text" | "amount", value: string) => void
  onDelete: () => void
  canDelete: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: button.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg border border-border/50 bg-secondary/30 p-2"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-secondary/50"
      >
        <GripVertical className="h-3 w-3 text-muted-foreground/50" />
      </div>
      <Input
        type="text"
        value={button.text}
        onChange={(e) => onUpdate("text", e.target.value)}
        placeholder="Texto do botao"
        className="bg-transparent border-0 p-0 h-6 text-xs focus-visible:ring-0 flex-1"
      />
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[10px] text-muted-foreground">R$</span>
        <Input
          type="text"
          value={button.amount}
          onChange={(e) => onUpdate("amount", e.target.value)}
          placeholder="0,00"
          className="bg-transparent border-0 p-0 h-6 w-[50px] text-xs text-right focus-visible:ring-0"
        />
      </div>
      {canDelete && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-muted-foreground/50 hover:text-destructive shrink-0"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}

// ---- Sortable Node Card ----

function SortableNodeCard({
  node,
  isLast,
  flows: flowsList,
  onEdit,
  onDelete,
}: {
  node: FlowNode
  isLast: boolean
  flows: Flow[]
  onEdit: (node: FlowNode) => void
  onDelete: (node: FlowNode) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: "relative" as const,
  }

  const Icon = nodeIcons[node.type]
  const group = actionGroups.find((g) => g.types.includes(node.type))

  // Helper para verificar ofertas ativas no no de pagamento
  const getPaymentOffers = () => {
    if (node.type !== "payment") return { hasOrderBump: false, hasUpsell: false, hasDownsell: false }
    
    const hasOrderBump = node.config?.has_order_bump === "true"
    let hasUpsell = false
    let hasDownsell = false
    
    try {
      const upsellsStr = node.config?.upsells as string
      if (upsellsStr) {
        const upsells = JSON.parse(upsellsStr)
        hasUpsell = upsells.some((u: { enabled: boolean }) => u.enabled)
      }
    } catch { /* ignore */ }
    
    try {
      const downsellsStr = node.config?.downsells as string
      if (downsellsStr) {
        const downsells = JSON.parse(downsellsStr)
        hasDownsell = downsells.some((d: { enabled: boolean }) => d.enabled)
      }
    } catch { /* ignore */ }
    
    return { hasOrderBump, hasUpsell, hasDownsell }
  }

  const paymentOffers = getPaymentOffers()

  // Helper to get subtitle
  const getSubtitle = () => {
    if (node.type === "message") {
      const parts: string[] = []
      if (node.config?.media_type && node.config.media_type !== "") parts.push(node.config.media_type === "photo" ? "Foto" : "Video")
      if (node.config?.buttons && node.config.buttons !== "") {
        try { parts.push(`${JSON.parse(node.config.buttons as string).length} botao(es)`) } catch { /* noop */ }
      }
      return parts.length > 0 ? parts.join(" · ") : "Mensagem"
    }
    if (node.type === "delay" && node.config?.seconds) {
      const s = parseInt(node.config.seconds as string)
      if (s >= 3600) return `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60) > 0 ? ` ${Math.floor((s % 3600) / 60)}min` : ""}`
      if (s >= 60) return `${Math.floor(s / 60)} min`
      return `${s}s`
    }
    if (node.type === "condition") {
      return "Condicao de resposta"
    }
    if (node.type === "payment") {
      return "Cobranca"
    }
    if (node.type === "action") {
      const sv = node.config?.subVariant as string
      if (sv === "goto_flow") {
        if (node.config?.target_flow_name) return node.config.target_flow_name as string
        return "Ir para outro fluxo"
      }
if (sv === "end") return "Encerrar"
      return sv === "add_group" ? "Adicionar ao grupo" : "Automacao"
    }
    return ""
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`group flex items-center gap-4 rounded-2xl border px-4 py-4 transition-all ${
          isDragging 
            ? "opacity-50 ring-2 ring-accent/30 bg-secondary/40 border-border" 
            : "border-border/60 bg-card hover:bg-secondary/30 hover:border-border"
        }`}
      >
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          group ? `${group.bgColor} border ${group.borderAccent}` : "bg-secondary/50 border border-border/40"
        }`}>
          <Icon className={`h-5 w-5 ${nodeIconColors[node.type]}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate leading-tight">{node.label}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="text-xs text-muted-foreground/60 truncate">{getSubtitle()}</p>
            {/* Indicadores de ofertas ativas */}
            {node.type === "payment" && (paymentOffers.hasOrderBump || paymentOffers.hasUpsell || paymentOffers.hasDownsell) && (
              <div className="flex items-center gap-1 shrink-0">
                {paymentOffers.hasOrderBump && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/15 text-amber-500 border border-amber-500/20">
                    Bump
                  </span>
                )}
                {paymentOffers.hasUpsell && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-500/15 text-blue-500 border border-blue-500/20">
                    Upsell
                  </span>
                )}
                {paymentOffers.hasDownsell && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-rose-500/15 text-rose-500 border border-rose-500/20">
                    Downsell
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-secondary/60 transition-colors"
              onClick={() => onEdit(node)}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
              onClick={() => onDelete(node)}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <button
            className="flex items-center justify-center w-8 h-8 rounded-lg cursor-grab active:cursor-grabbing touch-none opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Arrastar para reordenar"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground/30" />
          </button>
        </div>
      </div>
      {!isLast && (
        <div className="flex justify-center py-1">
          <div className="w-px h-5 bg-border/40" />
        </div>
      )}
    </div>
  )
}

// ---- Component ----

export default function FlowsPage() {
  const { selectedBot } = useBots()
  const { session } = useAuth()

  // Bot plans (from bot config)
  interface BotPlan {
    id: string
    bot_id: string
    name: string
    price: number
    duration_days: number
    description: string | null
    active: boolean
  }
  const [botPlans, setBotPlans] = useState<BotPlan[]>([])

  // Fetch bot plans when selectedBot changes
  useEffect(() => {
    if (!selectedBot) { setBotPlans([]); return }
    supabase
      .from("bot_plans")
      .select("*")
      .eq("bot_id", selectedBot.id)
      .eq("active", true)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setBotPlans((data as BotPlan[]) || [])
      })
  }, [selectedBot])

  // Flows state
  const [flows, setFlows] = useState<Flow[]>([])
  const [activeFlow, setActiveFlow] = useState<Flow | null>(null)
  const [nodes, setNodes] = useState<FlowNode[]>([])
  const [isLoadingFlows, setIsLoadingFlows] = useState(true)
  const [isLoadingNodes, setIsLoadingNodes] = useState(false)

  // New flow dialog
  const [showNewFlowDialog, setShowNewFlowDialog] = useState(false)
  const [newFlowName, setNewFlowName] = useState("")
  const [newFlowCategory, setNewFlowCategory] = useState<FlowCategory>("personalizado")
  const [isCreatingFlow, setIsCreatingFlow] = useState(false)

  // Flow creation mode: null = choosing, "basico" | "completo"
  const [newFlowMode, setNewFlowMode] = useState<"basico" | "completo" | null>(null)

  // Basic flow wizard fields (simplified: media -> text -> buttons)
  const [basicWizardStep, setBasicWizardStep] = useState(1)
  const [basicHasMedia, setBasicHasMedia] = useState(false)
  const [basicMediaFile, setBasicMediaFile] = useState<File | null>(null)
  const [basicMediaUrl, setBasicMediaUrl] = useState("")
  const [basicMediaType, setBasicMediaType] = useState<"photo" | "video">("photo")
  const [basicIsUploading, setBasicIsUploading] = useState(false)
  const [basicWelcomeMsg, setBasicWelcomeMsg] = useState("")
  const [basicHasButtons, setBasicHasButtons] = useState(false)
  const [basicButtons, setBasicButtons] = useState<{ id: string; text: string; amount: string; hasOrderBump?: boolean; orderBumpName?: string; orderBumpAmount?: string }[]>([])

  const resetBasicFlow = () => {
    setBasicWizardStep(1)
    setBasicHasMedia(false)
    setBasicMediaFile(null)
    setBasicMediaUrl("")
    setBasicMediaType("photo")
    setBasicIsUploading(false)
    setBasicUploadError(null)
    setBasicWelcomeMsg("")
    setBasicHasButtons(false)
    setBasicButtons([])
  }

  // Upload media file
  const [basicUploadError, setBasicUploadError] = useState<string | null>(null)
  const handleBasicMediaUpload = async (file: File) => {
    setBasicIsUploading(true)
    setBasicUploadError(null)
    
    // Validate file size client-side (max 10MB for images, 50MB for videos)
    const isVideo = file.type.startsWith("video")
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024
    if (file.size > maxSize) {
      setBasicUploadError(isVideo ? "Video muito grande (max 50MB)" : "Imagem muito grande (max 10MB)")
      setBasicIsUploading(false)
      return
    }
    
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("mediaType", file.type.startsWith("video") ? "video" : "photo")
      const res = await fetch("/api/upload-media", { method: "POST", body: formData })
      
      // Check if response is OK before parsing
      if (!res.ok) {
        const text = await res.text()
        console.error("Upload failed:", res.status, text)
        setBasicUploadError("Falha no upload. Tente um arquivo menor.")
        return
      }
      
      const data = await res.json()
      if (data.error) {
        setBasicUploadError(data.error)
        return
      }
      if (data.url) {
        setBasicMediaUrl(data.url)
        setBasicMediaType(file.type.startsWith("video") ? "video" : "photo")
        setBasicMediaFile(file)
      }
    } catch (err) {
      console.error("Upload error:", err)
      setBasicUploadError("Erro ao enviar arquivo")
    } finally {
      setBasicIsUploading(false)
    }
  }

  // Basic wizard has 3 steps
  const BASIC_WIZARD_TOTAL_STEPS = 3
  const canGoNextBasicStep = () => {
    switch (basicWizardStep) {
      case 1: return true // Media is optional
      case 2: return basicWelcomeMsg.trim().length > 0 // Text is required
      case 3: return true // Buttons are optional (final step)
      default: return false
    }
  }

  // Add node dialog
  const [showAddNodeDialog, setShowAddNodeDialog] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<typeof actionTemplates[0] | null>(null)
  const [nodeConfigValues, setNodeConfigValues] = useState<Record<string, string>>({})
  const [isAddingNode, setIsAddingNode] = useState(false)

  // Message node config
  const [msgText, setMsgText] = useState("")
  const [msgMediaUrl, setMsgMediaUrl] = useState("")
  const [msgMediaType, setMsgMediaType] = useState<"photo" | "video" | "none">("none")
  const [msgHasButtons, setMsgHasButtons] = useState(false)
  const [msgButtons, setMsgButtons] = useState<InlineButton[]>([])

  // Payment buttons for custom payment
  const [paymentButtons, setPaymentButtons] = useState<PaymentButton[]>([{ id: crypto.randomUUID(), text: "", amount: "" }])
  const [editPaymentButtons, setEditPaymentButtons] = useState<PaymentButton[]>([])
  const [activePaymentButtonId, setActivePaymentButtonId] = useState<string | null>(null)

  // Upsells and Downsells (max 3 each)
  const createEmptyUpsell = (): UpsellOffer => ({
    id: crypto.randomUUID(),
    enabled: false,
    media_url: "",
    media_type: "none",
    description: "",
    delay_seconds: "20",
    buttons: [{ id: crypto.randomUUID(), text: "", amount: "" }]
  })
  const createEmptyDownsell = (): DownsellOffer => ({
    id: crypto.randomUUID(),
    enabled: false,
    media_url: "",
    media_type: "none",
    description: "",
    delay_seconds: "40",
    buttons: [{ id: crypto.randomUUID(), text: "", amount: "" }]
  })
  const [upsells, setUpsells] = useState<UpsellOffer[]>([createEmptyUpsell()])
  const [downsells, setDownsells] = useState<DownsellOffer[]>([createEmptyDownsell()])
  const [editUpsells, setEditUpsells] = useState<UpsellOffer[]>([])
  const [editDownsells, setEditDownsells] = useState<DownsellOffer[]>([])
  const [upsellUploadingIndex, setUpsellUploadingIndex] = useState<number | null>(null)
  const [downsellUploadingIndex, setDownsellUploadingIndex] = useState<number | null>(null)

  // Upload function for upsell/downsell media
  const handleOfferMediaUpload = async (
    file: File,
    type: "upsell" | "downsell",
    index: number,
    isEdit: boolean = false
  ) => {
    const setLoading = type === "upsell" ? setUpsellUploadingIndex : setDownsellUploadingIndex
    setLoading(index)
    
    const isVideo = file.type.startsWith("video")
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024
    if (file.size > maxSize) {
      setLoading(null)
      return
    }
    
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("mediaType", isVideo ? "video" : "photo")
      const res = await fetch("/api/upload-media", { method: "POST", body: formData })
      
      if (!res.ok) {
        setLoading(null)
        return
      }
      
      const data = await res.json()
      if (data.url) {
        const mediaType = isVideo ? "video" : "photo"
        if (type === "upsell") {
          if (isEdit) {
            setEditUpsells(prev => prev.map((u, i) => i === index ? { ...u, media_url: data.url, media_type: mediaType } : u))
          } else {
            setUpsells(prev => prev.map((u, i) => i === index ? { ...u, media_url: data.url, media_type: mediaType } : u))
          }
        } else {
          if (isEdit) {
            setEditDownsells(prev => prev.map((d, i) => i === index ? { ...d, media_url: data.url, media_type: mediaType } : d))
          } else {
            setDownsells(prev => prev.map((d, i) => i === index ? { ...d, media_url: data.url, media_type: mediaType } : d))
          }
        }
      }
    } catch (err) {
      console.error("Upload error:", err)
    } finally {
      setLoading(null)
    }
  }

  const resetMessageConfig = () => {
    setMsgText("")
    setMsgMediaUrl("")
    setMsgMediaType("none")
    setMsgHasButtons(false)
    setMsgButtons([])
    setPaymentButtons([{ id: crypto.randomUUID(), text: "", amount: "" }])
    setEditPaymentButtons([])
    setUpsells([createEmptyUpsell()])
    setDownsells([createEmptyDownsell()])
    setEditUpsells([])
    setEditDownsells([])
  }

  const addMsgButton = () => {
    setMsgButtons((prev) => [...prev, { text: "", url: "" }])
  }

  const updateMsgButton = (index: number, field: "text" | "url", value: string) => {
    setMsgButtons((prev) => prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)))
  }

  const removeMsgButton = (index: number) => {
    setMsgButtons((prev) => prev.filter((_, i) => i !== index))
  }

  // Edit node dialog
  const [showEditNodeDialog, setShowEditNodeDialog] = useState(false)
  const [editingNode, setEditingNode] = useState<FlowNode | null>(null)
  const [editNodeLabel, setEditNodeLabel] = useState("")
  const [editNodeConfig, setEditNodeConfig] = useState<Record<string, string>>({})
  const [isSavingNode, setIsSavingNode] = useState(false)

  // Delete confirmation
  const [showDeleteNodeDialog, setShowDeleteNodeDialog] = useState(false)
  const [deletingNode, setDeletingNode] = useState<FlowNode | null>(null)
  const [isDeletingNode, setIsDeletingNode] = useState(false)

  // Delete flow
  const [showDeleteFlowDialog, setShowDeleteFlowDialog] = useState(false)
  const [isDeletingFlow, setIsDeletingFlow] = useState(false)

  // Edit flow category
  const [showEditFlowDialog, setShowEditFlowDialog] = useState(false)
  const [editFlowCategory, setEditFlowCategory] = useState<FlowCategory>("personalizado")
  const [editFlowName, setEditFlowName] = useState("")
  const [isSavingFlow, setIsSavingFlow] = useState(false)

  // Category-specific config
  const [flowCategoryConfig, setFlowCategoryConfig] = useState<Record<string, string | boolean>>({})
  const [isSavingCategoryConfig, setIsSavingCategoryConfig] = useState(false)
  const [showCategoryConfig, setShowCategoryConfig] = useState(false)

  // Drag and drop
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveNodeId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveNodeId(null)

    if (!over || active.id === over.id) return

    const nonTriggerNodes = nodes.filter((n) => n.type !== "trigger")
    const triggerNodes = nodes.filter((n) => n.type === "trigger")

    const oldIndex = nonTriggerNodes.findIndex((n) => n.id === active.id)
    const newIndex = nonTriggerNodes.findIndex((n) => n.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    const reorderedNonTrigger = arrayMove(nonTriggerNodes, oldIndex, newIndex)
    const allReordered = [...triggerNodes, ...reorderedNonTrigger].map((n, i) => ({
      ...n,
      position: i,
    }))

    // Optimistic update
    setNodes(allReordered)

    // Persist to DB
    for (const node of allReordered) {
      await supabase
        .from("flow_nodes")
        .update({ position: node.position })
        .eq("id", node.id)
    }
  }

  // Derived: primary flow and secondary flows
  const primaryFlow = flows.find((f) => f.is_primary)
  const secondaryFlows = flows.filter((f) => !f.is_primary)

  // ---- Fetch flows for selected bot ----
  const fetchFlows = useCallback(async () => {
    console.log("[v0] ========== fetchFlows INICIADO ==========")
    console.log("[v0] selectedBot:", selectedBot?.id, selectedBot?.name)
    console.log("[v0] session userId:", session?.userId)
    
    if (!selectedBot || !session) {
      console.log("[v0] fetchFlows ABORTADO - bot ou session nao definidos")
      setFlows([])
      setActiveFlow(null)
      setNodes([])
      setIsLoadingFlows(false)
      return
    }

    setIsLoadingFlows(true)
    console.log("[v0] Buscando flows para bot_id:", selectedBot.id, "user_id:", session.userId)
    
    const { data, error } = await supabase
      .from("flows")
      .select("*")
      .eq("bot_id", selectedBot.id)
      .eq("user_id", session.userId)
      .order("created_at", { ascending: true })

    console.log("[v0] Resultado da busca de flows:")
    console.log("[v0]   - data count:", data?.length || 0)
    console.log("[v0]   - data:", JSON.stringify(data, null, 2))
    console.log("[v0]   - error:", error ? JSON.stringify({ message: error.message, code: error.code }, null, 2) : null)

    if (error) {
      console.error("[v0] ERRO ao buscar flows:", error.message, error.code)
      setIsLoadingFlows(false)
      return
    }

    const fetched = (data || []) as Flow[]
    console.log("[v0] Flows encontrados:", fetched.length)
    
    // Backwards compat: if no flow has is_primary, mark the first one
    const hasPrimary = fetched.some((f) => f.is_primary)
    const normalized = fetched.map((f, i) => ({
      ...f,
      is_primary: hasPrimary ? !!f.is_primary : i === 0 && fetched.length > 0,
      category: (f.category || (i === 0 && !hasPrimary ? "inicial" : "personalizado")) as FlowCategory,
      flow_type: (f.flow_type || "complete") as "basic" | "complete",
    }))

    console.log("[v0] Flows normalizados:", normalized.length)
    setFlows(normalized)

    if (normalized.length > 0) {
      const primary = normalized.find((f) => f.is_primary) || normalized[0]
      console.log("[v0] Definindo activeFlow:", primary.id, primary.name)
      setActiveFlow(primary)
    } else {
      console.log("[v0] Nenhum flow encontrado, limpando activeFlow")
      setActiveFlow(null)
      setNodes([])
    }
    setIsLoadingFlows(false)
    console.log("[v0] ========== fetchFlows FINALIZADO ==========")
  }, [selectedBot, session])

  useEffect(() => {
    fetchFlows()
  }, [fetchFlows])

  // ---- Fetch nodes for active flow ----
  const fetchNodes = useCallback(async () => {
    console.log("[v0] ========== fetchNodes INICIADO ==========")
    console.log("[v0] activeFlow:", activeFlow?.id, activeFlow?.name)
    
    if (!activeFlow) {
      console.log("[v0] fetchNodes ABORTADO - activeFlow nao definido")
      setNodes([])
      return
    }

    setIsLoadingNodes(true)
    console.log("[v0] Buscando nodes para flow_id:", activeFlow.id)
    
    const { data, error } = await supabase
      .from("flow_nodes")
      .select("*")
      .eq("flow_id", activeFlow.id)
      .order("position", { ascending: true })

    console.log("[v0] Resultado da busca de nodes:")
    console.log("[v0]   - data count:", data?.length || 0)
    console.log("[v0]   - data:", JSON.stringify(data, null, 2))
    console.log("[v0]   - error:", error ? JSON.stringify({ message: error.message, code: error.code }, null, 2) : null)

    if (error) {
      console.error("[v0] ERRO ao buscar nodes:", error.message, error.code)
      setIsLoadingNodes(false)
      return
    }

    console.log("[v0] Nodes encontrados:", data?.length || 0)
    setNodes((data || []) as FlowNode[])
    setIsLoadingNodes(false)
    console.log("[v0] ========== fetchNodes FINALIZADO ==========")
  }, [activeFlow])

  useEffect(() => {
    fetchNodes()
  }, [fetchNodes])

  // ---- Create new flow ----
  const handleCreateFlow = async () => {
    if (!selectedBot || !session || !newFlowName.trim()) return

    setIsCreatingFlow(true)

    // If this is the first flow, it becomes the primary
    const isFirst = flows.length === 0
    const category = isFirst ? "inicial" : newFlowCategory

    // Try with category/is_primary columns first, fallback without them
    let insertPayload: Record<string, unknown> = {
      bot_id: selectedBot.id,
      user_id: session.userId,
      name: newFlowName.trim(),
      status: "ativo",
      category,
      is_primary: isFirst,
      flow_type: "complete",
    }

    let { data, error } = await supabase
      .from("flows")
      .insert(insertPayload)
      .select()
      .single()

    // If columns don't exist yet, retry without them
    if (error && (error.message?.includes("category") || error.message?.includes("is_primary") || error.message?.includes("flow_type") || error.code === "42703")) {
      insertPayload = {
        bot_id: selectedBot.id,
        user_id: session.userId,
        name: newFlowName.trim(),
        status: "ativo",
      }
      const retry = await supabase
        .from("flows")
        .insert(insertPayload)
        .select()
        .single()
      data = retry.data
      error = retry.error
    }

    if (error) {
      console.error("Error creating flow:", error)
      setIsCreatingFlow(false)
      return
    }

    const newFlow = { ...data, category, is_primary: isFirst, flow_type: "complete" } as Flow
    setFlows((prev) => [...prev, newFlow])
    setActiveFlow(newFlow)
    setNewFlowName("")
    setNewFlowCategory("personalizado")
    setShowNewFlowDialog(false)
    setIsCreatingFlow(false)
  }

  // ---- Create BASIC flow (auto-generates nodes) ----
  const handleCreateBasicFlow = async () => {
    console.log("[v0] ========== INICIANDO handleCreateBasicFlow ==========")
    console.log("[v0] selectedBot:", selectedBot?.id, selectedBot?.name)
    console.log("[v0] session userId:", session?.userId)
    console.log("[v0] basicWelcomeMsg:", basicWelcomeMsg)
    console.log("[v0] basicWelcomeMsg.trim():", basicWelcomeMsg.trim())
    console.log("[v0] basicWelcomeMsg.trim().length:", basicWelcomeMsg.trim().length)
    
    if (!selectedBot || !session || !basicWelcomeMsg.trim()) {
      console.log("[v0] ABORTANDO - Validacao falhou:")
      console.log("[v0]   - selectedBot existe?", !!selectedBot)
      console.log("[v0]   - session existe?", !!session)
      console.log("[v0]   - basicWelcomeMsg tem conteudo?", !!basicWelcomeMsg.trim())
      alert("Erro: Bot, sessao ou mensagem de boas-vindas nao definidos")
      return
    }

    setIsCreatingFlow(true)
    console.log("[v0] Validacao OK, iniciando criacao do fluxo...")

    const isFirst = flows.length === 0
    const flowName = basicWelcomeMsg.trim().split(" ").slice(0, 3).join(" ") || "Boas-vindas"
    console.log("[v0] isFirst (primeiro fluxo)?:", isFirst)
    console.log("[v0] flowName gerado:", flowName)

    let insertPayload: Record<string, unknown> = {
      bot_id: selectedBot.id,
      user_id: session.userId,
      name: flowName,
      status: "ativo",
      category: isFirst ? "inicial" : "personalizado",
      is_primary: isFirst,
      flow_type: "basic",
    }
    console.log("[v0] insertPayload para flows:", JSON.stringify(insertPayload, null, 2))

    console.log("[v0] Executando INSERT na tabela flows...")
    let { data, error } = await supabase
      .from("flows")
      .insert(insertPayload)
      .select()
      .single()

    console.log("[v0] Resultado do INSERT flows:")
    console.log("[v0]   - data:", JSON.stringify(data, null, 2))
    console.log("[v0]   - error:", error ? JSON.stringify({ message: error.message, code: error.code, details: error.details }, null, 2) : null)

    if (error && (error.message?.includes("category") || error.message?.includes("is_primary") || error.message?.includes("flow_type") || error.code === "42703")) {
      console.log("[v0] Erro de coluna, tentando INSERT simplificado...")
      insertPayload = {
        bot_id: selectedBot.id,
        user_id: session.userId,
        name: flowName,
        status: "ativo",
      }
      console.log("[v0] insertPayload simplificado:", JSON.stringify(insertPayload, null, 2))
      
      const retry = await supabase
        .from("flows")
        .insert(insertPayload)
        .select()
        .single()
      data = retry.data
      error = retry.error
      
      console.log("[v0] Resultado do INSERT simplificado:")
      console.log("[v0]   - data:", JSON.stringify(data, null, 2))
      console.log("[v0]   - error:", error ? JSON.stringify({ message: error.message, code: error.code, details: error.details }, null, 2) : null)
    }

    if (error || !data) {
      console.error("[v0] ERRO FATAL ao criar fluxo:", error?.message, error?.code)
      alert(`Erro ao criar fluxo: ${error?.message || "Dados nao retornados"}`)
      setIsCreatingFlow(false)
      return
    }

    console.log("[v0] Fluxo criado com sucesso! ID:", data.id)
    const newFlow = { ...data, category: (isFirst ? "inicial" : "personalizado") as FlowCategory, is_primary: isFirst, flow_type: "basic" } as Flow

    // Auto-generate nodes for basic flow
    const autoNodes: { type: NodeType; label: string; config: Record<string, unknown>; position: number }[] = []

    // 1) Trigger
    autoNodes.push({
      type: "trigger",
      label: "Usuario inicia bot",
      config: {},
      position: 0,
    })

    // 2) Welcome message with media
    const msgText = basicWelcomeMsg.trim()
    
    autoNodes.push({
      type: "message",
      label: msgText.length > 40 ? msgText.slice(0, 40) + "..." : msgText,
      config: {
        text: msgText,
        media_url: basicHasMedia ? basicMediaUrl : "",
        media_type: basicHasMedia ? basicMediaType : "",
        buttons: "",
        subVariant: basicHasMedia ? "media" : "text",
      },
      position: 1,
    })

    // 3) Payment node if user added payment buttons
    const validPaymentButtons = basicButtons.filter(b => b.text.trim() && b.amount.trim())
    if (validPaymentButtons.length > 0) {
      // Build payment_buttons in the same format as the complete flow
      const paymentButtonsFormatted = validPaymentButtons.map(b => ({
        id: b.id,
        text: b.text.trim(),
        amount: b.amount.replace(",", "."),
      }))
      
      // Build upsells from order bumps (same format as complete flow)
      const upsells = validPaymentButtons
        .filter(b => b.hasOrderBump && b.orderBumpName?.trim() && b.orderBumpAmount?.trim())
        .map(b => ({
          id: crypto.randomUUID(),
          media_url: "",
          media_type: "none" as const,
          description: "",
          delay_seconds: "0",
          buttons: [{
            id: crypto.randomUUID(),
            text: b.orderBumpName!.trim(),
            amount: b.orderBumpAmount!.replace(",", "."),
          }],
        }))

      const firstBtn = paymentButtonsFormatted[0]
      autoNodes.push({
        type: "payment",
        label: `${firstBtn.text} - R$${firstBtn.amount}`,
        config: {
          subVariant: "charge",
          amount: firstBtn.amount,
          description: firstBtn.text,
          gateway: "gate_uy",
          payment_buttons: JSON.stringify(paymentButtonsFormatted),
          upsells: JSON.stringify(upsells),
          downsells: JSON.stringify([]),
        },
        position: 2,
      })
    }

    // Insert all nodes
    console.log("[v0] Iniciando insercao de", autoNodes.length, "nodes...")
    console.log("[v0] autoNodes:", JSON.stringify(autoNodes, null, 2))
    
    let nodesCreated = 0
    let nodesFailed = 0
    
    for (const node of autoNodes) {
      console.log("[v0] Inserindo node:", node.type, "- label:", node.label)
      const nodePayload = { flow_id: newFlow.id, ...node }
      console.log("[v0] nodePayload:", JSON.stringify(nodePayload, null, 2))
      
      const { data: nodeData, error: nodeError } = await supabase
        .from("flow_nodes")
        .insert(nodePayload)
        .select()
        .single()
      
      if (nodeError) {
        console.error("[v0] ERRO ao inserir flow_node:", nodeError.message, nodeError.code, nodeError.details)
        alert(`Erro ao salvar node ${node.type}: ${nodeError.message}`)
        nodesFailed++
      } else {
        console.log("[v0] Node inserido com sucesso! ID:", nodeData?.id)
        nodesCreated++
      }
    }
    
    console.log("[v0] ========== RESUMO ==========")
    console.log("[v0] Nodes criados:", nodesCreated)
    console.log("[v0] Nodes com erro:", nodesFailed)
    console.log("[v0] Flow ID:", newFlow.id)

    setFlows((prev) => [...prev, newFlow])
    setActiveFlow(newFlow)
    resetBasicFlow()
    setNewFlowName("")
    setNewFlowMode(null)
    setShowNewFlowDialog(false)
    setIsCreatingFlow(false)
    
    console.log("[v0] ========== FIM handleCreateBasicFlow ==========")
  }

  // ---- Delete flow ----
  const handleDeleteFlow = async () => {
    if (!activeFlow) return

    setIsDeletingFlow(true)
    
    // First delete all nodes of this flow
    const { error: nodesError } = await supabase
      .from("flow_nodes")
      .delete()
      .eq("flow_id", activeFlow.id)
    
    if (nodesError) {
      console.error("[v0] Erro ao deletar flow_nodes:", nodesError.message)
    }
    
    // Then delete the flow itself
    const { error } = await supabase
      .from("flows")
      .delete()
      .eq("id", activeFlow.id)

    if (error) {
      console.error("Error deleting flow:", error)
      setIsDeletingFlow(false)
      return
    }

    setFlows((prev) => {
      const updated = prev.filter((f) => f.id !== activeFlow.id)
      // If we deleted the primary, promote the first remaining
      if (activeFlow.is_primary && updated.length > 0) {
        updated[0] = { ...updated[0], is_primary: true, category: "inicial" }
        // Update in DB (try with new cols, ignore if they don't exist)
        supabase
          .from("flows")
          .update({ is_primary: true, category: "inicial" })
          .eq("id", updated[0].id)
          .then(() => {})
          .catch(() => {})
      }
      if (updated.length > 0) {
        setActiveFlow(updated[0])
      } else {
        setActiveFlow(null)
        setNodes([])
      }
      return updated
    })
    setShowDeleteFlowDialog(false)
    setIsDeletingFlow(false)
  }

  // ---- Set as primary flow ----
  const handleSetPrimary = async (flow: Flow) => {
    // Remove primary from current
    const oldPrimary = flows.find((f) => f.is_primary)
    if (oldPrimary) {
      // Try updating new columns, ignore errors if they don't exist
      await supabase
        .from("flows")
        .update({ is_primary: false })
        .eq("id", oldPrimary.id)
        .then(() => {})
        .catch(() => {})
    }
    // Set new primary (try with new columns)
    await supabase
      .from("flows")
      .update({ is_primary: true, category: "inicial" })
      .eq("id", flow.id)
      .then(() => {})
      .catch(() => {})

    setFlows((prev) =>
      prev.map((f) => ({
        ...f,
        is_primary: f.id === flow.id,
        category: f.id === flow.id ? "inicial" : (f.id === oldPrimary?.id ? "personalizado" : f.category),
      }))
    )
    setActiveFlow({ ...flow, is_primary: true, category: "inicial" })
  }

  // ---- Edit flow (name + category) ----
  const openEditFlow = (flow: Flow) => {
    setEditFlowName(flow.name)
    setEditFlowCategory(flow.category)
    setShowEditFlowDialog(true)
  }

  const handleSaveFlow = async () => {
    if (!activeFlow) return
    setIsSavingFlow(true)

    let { error } = await supabase
      .from("flows")
      .update({
        name: editFlowName.trim(),
        category: activeFlow.is_primary ? "inicial" : editFlowCategory,
        updated_at: new Date().toISOString(),
      })
      .eq("id", activeFlow.id)

    // Fallback without category column
    if (error && (error.message?.includes("category") || error.code === "42703")) {
      const retry = await supabase
        .from("flows")
        .update({
          name: editFlowName.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", activeFlow.id)
      error = retry.error
    }

    if (error) {
      console.error("Error updating flow:", error)
      setIsSavingFlow(false)
      return
    }

    const updatedCategory = activeFlow.is_primary ? "inicial" : editFlowCategory
    setFlows((prev) =>
      prev.map((f) =>
        f.id === activeFlow.id ? { ...f, name: editFlowName.trim(), category: updatedCategory } : f
      )
    )
    setActiveFlow((prev) => prev ? { ...prev, name: editFlowName.trim(), category: updatedCategory } : prev)
    setShowEditFlowDialog(false)
    setIsSavingFlow(false)
  }

  // ---- Add node ----
  const handleAddNode = async () => {
    if (!activeFlow || !selectedTemplate) return

    setIsAddingNode(true)

    let label = selectedTemplate.label
    let config: Record<string, unknown> = { ...nodeConfigValues, subVariant: selectedTemplate.subVariant || "" }

    if (selectedTemplate.type === "message") {
      label = msgText ? (msgText.length > 40 ? msgText.slice(0, 40) + "..." : msgText) : "Mensagem"
      const validButtons = msgButtons.filter((b) => b.text.trim() && b.url.trim())
      config = {
        text: msgText,
        media_url: msgMediaType !== "none" ? msgMediaUrl : "",
        media_type: msgMediaType !== "none" ? msgMediaType : "",
        buttons: validButtons.length > 0 ? JSON.stringify(validButtons) : "",
        subVariant: selectedTemplate.subVariant || "",
      }
    } else if (selectedTemplate.type === "delay" && nodeConfigValues.seconds) {
      const secs = parseInt(nodeConfigValues.seconds)
      if (secs >= 3600) {
        const hours = Math.floor(secs / 3600)
        label = `Esperar ${hours} hora${hours > 1 ? "s" : ""}`
      } else if (secs >= 60) {
        label = `Esperar ${Math.floor(secs / 60)} minuto${Math.floor(secs / 60) > 1 ? "s" : ""}`
      } else {
        label = `Esperar ${secs} segundo${secs > 1 ? "s" : ""}`
      }
    } else if (selectedTemplate.type === "condition") {
      const msg = nodeConfigValues.condition_message || "Condicao"
      label = msg.length > 35 ? msg.slice(0, 35) + "..." : msg
      config = {
        condition_message: nodeConfigValues.condition_message || "",
        condition_branches: nodeConfigValues.condition_branches || "[]",
        subVariant: "response_condition",
      }
  } else if (selectedTemplate.type === "payment") {
    if (selectedTemplate.subVariant === "charge") {
      // Filter valid payment buttons
      const validButtons = paymentButtons.filter(b => b.text.trim() && b.amount.trim())
      const firstBtn = validButtons[0]
      
      if (firstBtn) {
        label = `${firstBtn.text} - R$${firstBtn.amount}`
      } else {
        label = "Cobranca"
      }
      
      config = {
        ...nodeConfigValues,
        subVariant: "charge",
        payment_buttons: JSON.stringify(validButtons.length > 0 ? validButtons : paymentButtons),
        upsells: JSON.stringify(upsells),
        downsells: JSON.stringify(downsells),
      }
    }
  } else if (selectedTemplate.type === "action" && nodeConfigValues.action_name) {
      const actionVal = nodeConfigValues.action_name
      if (selectedTemplate.subVariant === "add_group") {
        label = `Grupo: ${actionVal.replace(/https?:\/\//, "").slice(0, 30)}`
      } else {
        label = actionVal
      }
    } else if (selectedTemplate.subVariant === "goto_flow" && nodeConfigValues.target_flow_name) {
      label = `Ir para: ${nodeConfigValues.target_flow_name}`
      config = {
        target_flow_id: nodeConfigValues.target_flow_id,
        target_flow_name: nodeConfigValues.target_flow_name,
        subVariant: "goto_flow",
      }
} else if (selectedTemplate.subVariant === "end") {
      label = "Encerrar Conversa"
      config = { subVariant: "end" }
    }

    const newPosition = nodes.length

    const { data, error } = await supabase
      .from("flow_nodes")
      .insert({
        flow_id: activeFlow.id,
        type: selectedTemplate.type,
        label,
        config,
        position: newPosition,
      })
      .select()
      .single()

    if (error) {
      console.error("Error adding node:", error)
      setIsAddingNode(false)
      return
    }

    setNodes((prev) => [...prev, data as FlowNode])
    setSelectedTemplate(null)
    setNodeConfigValues({})
    resetMessageConfig()
    setShowAddNodeDialog(false)
    setIsAddingNode(false)
  }

  // ---- Edit node ----
  const openEditNode = (node: FlowNode) => {
    setEditingNode(node)
    setEditNodeLabel(node.label)
    const cfg = node.config || {}
    setEditNodeConfig(cfg as Record<string, string>)

    if (node.type === "message") {
      setMsgText((cfg.text as string) || "")
      setMsgMediaUrl((cfg.media_url as string) || "")
      const mType = (cfg.media_type as string) || ""
      setMsgMediaType(mType === "photo" || mType === "video" ? mType : "none")
      const btnStr = (cfg.buttons as string) || ""
      if (btnStr) {
        try {
          const parsed = JSON.parse(btnStr) as InlineButton[]
          setMsgButtons(parsed)
          setMsgHasButtons(parsed.length > 0)
        } catch {
          setMsgButtons([])
          setMsgHasButtons(false)
        }
      } else {
        setMsgButtons([])
        setMsgHasButtons(false)
      }
    } else if (node.type === "payment") {
      // Load payment buttons
      const paymentBtnStr = (cfg.payment_buttons as string) || ""
      if (paymentBtnStr) {
        try {
          const parsed = JSON.parse(paymentBtnStr) as PaymentButton[]
          setEditPaymentButtons(parsed.length > 0 ? parsed : [{ id: crypto.randomUUID(), text: "", amount: "" }])
        } catch {
          setEditPaymentButtons([{ id: crypto.randomUUID(), text: "", amount: "" }])
        }
      } else {
        setEditPaymentButtons([{ id: crypto.randomUUID(), text: "", amount: "" }])
      }
      
      // Load upsells
      const upsellsStr = (cfg.upsells as string) || ""
      if (upsellsStr) {
        try {
          const parsed = JSON.parse(upsellsStr) as UpsellOffer[]
          setEditUpsells(parsed.length > 0 ? parsed : [createEmptyUpsell()])
        } catch {
          setEditUpsells([createEmptyUpsell()])
        }
      } else {
        setEditUpsells([createEmptyUpsell()])
      }
      
      // Load downsells
      const downsellsStr = (cfg.downsells as string) || ""
      if (downsellsStr) {
        try {
          const parsed = JSON.parse(downsellsStr) as DownsellOffer[]
          setEditDownsells(parsed.length > 0 ? parsed : [createEmptyDownsell()])
        } catch {
          setEditDownsells([createEmptyDownsell()])
        }
      } else {
        setEditDownsells([createEmptyDownsell()])
      }
    } else {
      resetMessageConfig()
    }

    setShowEditNodeDialog(true)
  }

  const handleSaveNode = async () => {
    if (!editingNode) return
    
    console.log("[v0] handleSaveNode - Starting save for node:", editingNode.id)

    setIsSavingNode(true)

    let finalConfig: Record<string, unknown> = { ...editNodeConfig }
    let finalLabel = editNodeLabel

    if (editingNode.type === "message") {
      // Only include buttons if the switch is ON and there are valid buttons
      const validButtons = msgHasButtons ? msgButtons.filter((b) => b.text.trim() && b.url.trim()) : []
      finalConfig = {
        text: msgText,
        media_url: msgMediaType !== "none" ? msgMediaUrl : "",
        media_type: msgMediaType !== "none" ? msgMediaType : "",
        buttons: validButtons.length > 0 ? JSON.stringify(validButtons) : "",
        subVariant: editingNode.config?.subVariant || "",
      }
      finalLabel = msgText ? (msgText.length > 40 ? msgText.slice(0, 40) + "..." : msgText) : "Mensagem"
    } else if (editingNode.type === "delay") {
      const secs = parseInt(editNodeConfig.seconds || "0")
      finalConfig = { seconds: editNodeConfig.seconds || "0", subVariant: editingNode.config?.subVariant || "" }
      if (secs >= 3600) {
        const hours = Math.floor(secs / 3600)
        finalLabel = `Esperar ${hours} hora${hours > 1 ? "s" : ""}`
      } else if (secs >= 60) {
        const mins = Math.floor(secs / 60)
        finalLabel = `Esperar ${mins} minuto${mins > 1 ? "s" : ""}`
      } else {
        finalLabel = `Esperar ${secs} segundo${secs > 1 ? "s" : ""}`
      }
    } else if (editingNode.type === "condition") {
      const msg = editNodeConfig.condition_message || "Condicao"
      finalLabel = msg.length > 35 ? msg.slice(0, 35) + "..." : msg
      finalConfig = {
        condition_message: editNodeConfig.condition_message || "",
        condition_branches: editNodeConfig.condition_branches || "[]",
        subVariant: "response_condition",
      }
    } else if (editingNode.type === "payment") {
      const sv = editingNode.config?.subVariant || ""
      finalConfig = { 
        ...editNodeConfig, 
        subVariant: sv,
        payment_buttons: JSON.stringify(editPaymentButtons),
        upsells: JSON.stringify(editUpsells),
        downsells: JSON.stringify(editDownsells),
      }
      // Usar o nome personalizado se definido, senao gerar automaticamente
      if (editNodeLabel && editNodeLabel.trim()) {
        finalLabel = editNodeLabel.trim()
      } else {
        // Fallback: gerar label baseado no primeiro botao
        const firstBtn = editPaymentButtons.find(b => b.text && b.amount)
        if (firstBtn) {
          finalLabel = `${firstBtn.text} - R$${firstBtn.amount}`
        } else if (sv === "charge" && editNodeConfig.amount) {
          finalLabel = editNodeConfig.description ? `R$${editNodeConfig.amount} - ${editNodeConfig.description}` : `Cobrar R$${editNodeConfig.amount}`
        }
      }
    } else if (editingNode.type === "action") {
      const sv = editingNode.config?.subVariant || ""
if (sv === "end") {
        finalConfig = { subVariant: "end" }
        finalLabel = "Encerrar Conversa"
      } else if (sv === "goto_flow") {
        finalConfig = {
          target_flow_id: editNodeConfig.target_flow_id,
          target_flow_name: editNodeConfig.target_flow_name,
          subVariant: "goto_flow",
        }
        finalLabel = editNodeConfig.target_flow_name ? `Ir para: ${editNodeConfig.target_flow_name}` : "Redirecionar"
      } else {
        // add_group ou outros
        finalConfig = { ...editNodeConfig, subVariant: sv }
        const actionVal = editNodeConfig.action_name || ""
        if (sv === "add_group" && actionVal) {
          finalLabel = `Grupo: ${actionVal.replace(/https?:\/\//, "").slice(0, 30)}`
        } else {
          finalLabel = actionVal || editNodeLabel
        }
      }
    }

    console.log("[v0] handleSaveNode - Saving to database:", { id: editingNode.id, label: finalLabel, config: finalConfig })
    
    const { error, data } = await supabase
      .from("flow_nodes")
      .update({
        label: finalLabel,
        config: finalConfig,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingNode.id)
      .select()
    
    console.log("[v0] handleSaveNode - Result:", { error, data })

    if (error) {
      console.error("Error updating node:", error)
      setIsSavingNode(false)
      return
    }

    // Check if the update actually affected a row
    if (!data || data.length === 0) {
      
      const { error: deleteError } = await supabase
        .from("flow_nodes")
        .delete()
        .eq("id", editingNode.id)
      
      if (deleteError) {
        console.error("Delete also failed:", deleteError)
        setIsSavingNode(false)
        return
      }

      const { data: insertData, error: insertError } = await supabase
        .from("flow_nodes")
        .insert({
          id: editingNode.id,
          flow_id: editingNode.flow_id,
          type: editingNode.type,
          label: finalLabel,
          config: finalConfig,
          position: editingNode.position,
        })
        .select()
        .single()
      
      if (insertError) {
        console.error("Re-insert also failed:", insertError)
        setIsSavingNode(false)
        return
      }
      
      // Delete + insert fallback succeeded
    }

    setNodes((prev) =>
      prev.map((n) =>
        n.id === editingNode.id
          ? { ...n, label: finalLabel, config: finalConfig }
          : n
      )
    )
    resetMessageConfig()
    setShowEditNodeDialog(false)
    setEditingNode(null)
    setIsSavingNode(false)
  }

  // ---- Delete node ----
  const handleDeleteNode = async () => {
    if (!deletingNode) return

    setIsDeletingNode(true)
    const { error } = await supabase
      .from("flow_nodes")
      .delete()
      .eq("id", deletingNode.id)

    if (error) {
      console.error("Error deleting node:", error)
      setIsDeletingNode(false)
      return
    }

    const remaining = nodes.filter((n) => n.id !== deletingNode.id)
    const reordered = remaining.map((n, i) => ({ ...n, position: i }))

    for (const node of reordered) {
      await supabase
        .from("flow_nodes")
        .update({ position: node.position })
        .eq("id", node.id)
    }

    setNodes(reordered)
    setShowDeleteNodeDialog(false)
    setDeletingNode(null)
    setIsDeletingNode(false)
  }

  // ---- Load category config when active flow changes ----
  useEffect(() => {
    if (!activeFlow) {
      setFlowCategoryConfig({})
      setShowCategoryConfig(false)
      return
    }
    // Load from local state per flow (in real app, this would come from DB)
    const stored = localStorage.getItem(`flow_config_${activeFlow.id}`)
    if (stored) {
      try {
        setFlowCategoryConfig(JSON.parse(stored))
      } catch {
        setFlowCategoryConfig({})
      }
    } else {
      setFlowCategoryConfig({})
    }
  }, [activeFlow?.id])

  const handleSaveCategoryConfig = async () => {
    if (!activeFlow) return
    setIsSavingCategoryConfig(true)
    // Save to localStorage as fallback (would be DB in production)
    localStorage.setItem(`flow_config_${activeFlow.id}`, JSON.stringify(flowCategoryConfig))
    // Attempt to save to supabase (if config column exists)
    await supabase
      .from("flows")
      .update({ config: flowCategoryConfig, updated_at: new Date().toISOString() })
      .eq("id", activeFlow.id)
      .then(() => {})
      .catch(() => {})
    setIsSavingCategoryConfig(false)
  }

  // ---- Toggle flow status ----
  const toggleFlowStatus = async (flow: Flow) => {
    const newStatus = flow.status === "ativo" ? "pausado" : "ativo"
    const { error } = await supabase
      .from("flows")
      .update({ status: newStatus })
      .eq("id", flow.id)

    if (error) {
      console.error("Error updating flow status:", error)
      return
    }

    setFlows((prev) =>
      prev.map((f) => (f.id === flow.id ? { ...f, status: newStatus } : f))
    )
    if (activeFlow?.id === flow.id) {
      setActiveFlow((prev) => (prev ? { ...prev, status: newStatus } : prev))
    }
  }

  // ---- Render ----

  if (!selectedBot) {
    return (
      <>
        
        <NoBotSelected />
      </>
    )
  }

  return (
    <>
      
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 md:gap-6 p-4 md:p-6">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground/50">Monte jornadas de conversao</p>
            <Button
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg text-xs h-8"
              onClick={() => {
                setNewFlowCategory(flows.length === 0 ? "inicial" : "personalizado")
                setNewFlowMode(null)
                resetBasicFlow()
                setShowNewFlowDialog(true)
              }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Novo fluxo
            </Button>
          </div>

          {isLoadingFlows ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
            </div>
          ) : flows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 gap-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 border border-accent/20">
                <Zap className="h-7 w-7 text-accent" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold text-foreground">Comece aqui</h3>
                <p className="text-sm text-muted-foreground max-w-[320px] leading-relaxed">
                  Crie seu primeiro fluxo. Ele sera o ponto de entrada do seu bot.
                </p>
              </div>
              <Button
                size="lg"
                className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl text-sm font-medium h-11 px-6 shadow-lg shadow-accent/20"
                onClick={() => {
                  setNewFlowCategory("inicial")
                  setNewFlowMode(null)
                  resetBasicFlow()
                  setShowNewFlowDialog(true)
                }}
              >
                Criar fluxo inicial
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* ====== FLUXO PRINCIPAL ====== */}
              {primaryFlow && (
                <button
                  className={`group relative w-full text-left rounded-2xl border transition-all ${
                    activeFlow?.id === primaryFlow.id
                      ? "border-accent/40 bg-accent/[0.04]"
                      : "border-border bg-card hover:border-border/80 hover:bg-card/80"
                  }`}
                  onClick={() => setActiveFlow(primaryFlow)}
                >
                  <div className="flex items-center gap-4 p-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      activeFlow?.id === primaryFlow.id ? "bg-accent/10" : "bg-secondary/60"
                    }`}>
                      <Crown className={`h-4.5 w-4.5 ${activeFlow?.id === primaryFlow.id ? "text-accent" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground truncate">{primaryFlow.name}</h3>
                        <span className="text-[10px] font-medium text-accent/70 bg-accent/[0.08] rounded px-1.5 py-px">
                          Principal
                        </span>
                        {primaryFlow.flow_type === "basic" && (
                          <span className="text-[10px] font-medium text-blue-400/70 bg-blue-500/10 rounded px-1.5 py-px">
                            Basico
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {primaryFlow.flow_type === "basic" ? "Mensagem de boas-vindas" : "Jornada inicial do usuario"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div
                        className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium cursor-pointer transition-colors ${
                          primaryFlow.status === "ativo" 
                            ? "text-success/80 hover:text-success" 
                            : "text-warning/80 hover:text-warning"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleFlowStatus(primaryFlow)
                        }}
                      >
                        <div className={`h-1.5 w-1.5 rounded-full ${primaryFlow.status === "ativo" ? "bg-success" : "bg-warning"}`} />
                        {primaryFlow.status === "ativo" ? "Ativo" : "Pausado"}
                      </div>
                      <div
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-secondary/60 transition-colors opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveFlow(primaryFlow)
                          openEditFlow(primaryFlow)
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                </button>
              )}

              {/* ====== FLUXOS SECUNDARIOS (esconder para fluxo basico) ====== */}
              {(secondaryFlows.length > 0 || primaryFlow) && activeFlow?.flow_type !== "basic" && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Sub Fluxos
                    </p>
                    {secondaryFlows.length > 0 && (
                      <span className="text-[11px] text-muted-foreground/60">
                        {secondaryFlows.length} fluxo{secondaryFlows.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {secondaryFlows.length === 0 ? (
                    <button
                      className="flex items-center gap-3 rounded-2xl border border-dashed border-border/60 hover:border-border bg-transparent hover:bg-secondary/20 p-4 transition-all text-left"
                      onClick={() => {
                        setNewFlowCategory("personalizado")
                        setNewFlowMode(null)
                        resetBasicFlow()
                        setShowNewFlowDialog(true)
                      }}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/40">
                        <Plus className="h-4 w-4 text-muted-foreground/60" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Criar sub fluxo</p>
                        <p className="text-xs text-muted-foreground/60">Remarketing, follow-up, pos-venda</p>
                      </div>
                    </button>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {secondaryFlows.map((fluxo) => {
                        const catConfig = getCategoryConfig(fluxo.category)
                        const CatIcon = catConfig.icon
                        const isActive = activeFlow?.id === fluxo.id

                        return (
                          <button
                            key={fluxo.id}
                            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all text-left w-full ${
                              isActive
                                ? "bg-secondary/60 border border-border/80"
                                : "bg-transparent border border-transparent hover:bg-secondary/30"
                            }`}
                            onClick={() => setActiveFlow(fluxo)}
                          >
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                              isActive ? "bg-accent/10" : "bg-secondary/50"
                            }`}>
                              <CatIcon className={`h-3.5 w-3.5 ${isActive ? catConfig.iconColor : "text-muted-foreground"}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate ${isActive ? "text-foreground" : "text-foreground/80"}`}>{fluxo.name}</p>
                              <p className="text-[11px] text-muted-foreground/60">{catConfig.label}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div
                                className={`flex items-center gap-1 text-[10px] font-medium cursor-pointer ${
                                  fluxo.status === "ativo" ? "text-success/60" : "text-warning/60"
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleFlowStatus(fluxo)
                                }}
                              >
                                <div className={`h-1.5 w-1.5 rounded-full ${fluxo.status === "ativo" ? "bg-success/60" : "bg-warning/60"}`} />
                                {fluxo.status}
                              </div>
                              <ChevronRight className={`h-3.5 w-3.5 transition-colors ${isActive ? "text-muted-foreground/40" : "text-muted-foreground/20 group-hover:text-muted-foreground/40"}`} />
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ====== VISUAL BUILDER DO FLUXO ATIVO ====== */}
              {activeFlow && activeFlow.flow_type === "basic" ? (
                /* ====== PAINEL SIMPLIFICADO PARA FLUXO BASICO ====== */
                <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6">
                  {/* Header basico */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-base font-bold text-foreground">{activeFlow.name}</h2>
                        <span className="text-[10px] font-semibold text-accent/70 bg-accent/[0.08] rounded-lg px-2 py-0.5">
                          Fluxo Basico
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Mensagem enviada quando o usuario inicia o bot
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground/50 hover:text-foreground"
                        onClick={() => openEditFlow(activeFlow)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground/50 hover:text-destructive"
                        onClick={() => setShowDeleteFlowDialog(true)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="h-px bg-border/60" />

                  {/* Conteudo do Fluxo Basico: Editor + Preview lado a lado */}
                  <div className="flex gap-6">
                    {/* Editor simplificado */}
                    <div className="flex-1 flex flex-col gap-4">
                      {isLoadingNodes ? (
                        <div className="flex items-center justify-center py-10">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
                        </div>
                      ) : (
                        <>
                          {/* Mensagem principal */}
                          {nodes.filter(n => n.type === "message").map((msgNode) => (
                            <div key={msgNode.id} className="flex flex-col gap-3 p-4 rounded-xl border border-border/50 bg-secondary/10">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-blue-400" />
                                <span className="text-sm font-medium text-foreground">Mensagem de boas-vindas</span>
                              </div>
                              <div className="text-xs text-muted-foreground/80 bg-background/50 rounded-lg p-3 whitespace-pre-wrap">
                                {(msgNode.config?.text as string) || "Sem mensagem definida"}
                              </div>
                              {(msgNode.config?.media_url as string) && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                                  {(msgNode.config?.media_type as string) === "photo" ? (
                                    <Image className="h-3.5 w-3.5" />
                                  ) : (
                                    <Video className="h-3.5 w-3.5" />
                                  )}
                                  <span>Midia anexada</span>
                                </div>
                              )}
                              {(msgNode.config?.buttons as string) && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                                  <Link className="h-3.5 w-3.5" />
                                  <span>Botao de link</span>
                                </div>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-fit text-xs"
                                onClick={() => openEditNode(msgNode)}
                              >
                                <Pencil className="h-3 w-3 mr-1.5" />
                                Editar mensagem
                              </Button>
                            </div>
                          ))}

                          {/* Pagamento */}
                          {nodes.filter(n => n.type === "payment").map((payNode) => (
                            <div key={payNode.id} className="flex flex-col gap-3 p-4 rounded-xl border border-success/20 bg-success/5">
                              <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-success" />
                                <span className="text-sm font-medium text-foreground">Cobranca PIX</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground/80">{payNode.config?.description as string || "Produto"}</span>
                                <span className="text-sm font-bold text-success">R$ {payNode.config?.amount as string || "0"}</span>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-fit text-xs"
                                onClick={() => openEditNode(payNode)}
                              >
                                <Pencil className="h-3 w-3 mr-1.5" />
                                Editar valor
                              </Button>
                            </div>
                          ))}

                          {nodes.filter(n => n.type !== "trigger").length === 0 && (
                            <div className="text-center py-6 text-muted-foreground/50 text-sm">
                              Nenhuma mensagem configurada
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Preview do Telegram */}
                    <div className="w-[240px] shrink-0 flex flex-col">
                      <div className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider mb-2 text-center">
                        Preview no Telegram
                      </div>
                      <div className="flex-1 bg-[#0e1621] rounded-xl p-3 flex flex-col min-h-[300px]">
                        {/* Telegram header */}
                        <div className="flex items-center gap-2 pb-2 border-b border-white/5 mb-3">
                          <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center">
                            <Zap className="h-4 w-4 text-accent" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-background dark:text-foreground truncate">{selectedBot?.name || "Seu Bot"}</p>
                            <p className="text-[10px] text-background dark:text-foreground/40">online</p>
                          </div>
                        </div>

                        {/* Chat messages */}
                        <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
                          {nodes.filter(n => n.type === "message").map((msgNode) => {
                            const mediaUrl = msgNode.config?.media_url as string
                            const mediaType = msgNode.config?.media_type as string
                            const buttonsStr = msgNode.config?.buttons as string
                            let buttons: InlineButton[] = []
                            try {
                              if (buttonsStr) buttons = JSON.parse(buttonsStr)
                            } catch { /* ignore */ }
                            
                            return (
                              <div key={msgNode.id} className="flex flex-col gap-1.5">
                                {mediaUrl && (
                                  <div className="bg-[#182533] rounded-lg p-1.5">
                                    <div className="bg-[#0d1318] rounded h-24 flex items-center justify-center">
                                      {mediaType === "photo" ? (
                                        <Image className="h-8 w-8 text-background dark:text-foreground/20" />
                                      ) : (
                                        <Video className="h-8 w-8 text-background dark:text-foreground/20" />
                                      )}
                                    </div>
                                  </div>
                                )}
                                <div className="bg-[#182533] rounded-lg p-2.5">
                                  <p className="text-[11px] text-background dark:text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
                                    {(msgNode.config?.text as string) || "Mensagem..."}
                                  </p>
                                </div>
                                {buttons.map((btn, i) => (
                                  <div key={i} className="bg-[#2b5278] rounded-lg py-1.5 px-2 text-center">
                                    <span className="text-[10px] text-background dark:text-foreground font-medium">{btn.text}</span>
                                  </div>
                                ))}
                              </div>
                            )
                          })}

                          {nodes.filter(n => n.type === "payment").map((payNode) => (
                            <div key={payNode.id} className="bg-[#182533] rounded-lg p-2.5 border border-green-500/20">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <CreditCard className="h-3 w-3 text-green-400" />
                                <span className="text-[10px] text-green-400 font-medium">Pagamento PIX</span>
                              </div>
                              <p className="text-[10px] text-background dark:text-foreground/70">{payNode.config?.description as string || "Produto"}</p>
                              <p className="text-xs text-background dark:text-foreground font-bold mt-0.5">R$ {payNode.config?.amount as string || "0"}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeFlow && (
                <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6">
                  {/* Builder Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h2 className="text-base font-bold text-foreground">{activeFlow.name}</h2>
                          {activeFlow.is_primary && (
                            <span className="text-xs font-semibold text-accent/70 bg-accent/[0.08] rounded-lg px-2 py-0.5">
                              Principal
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-muted-foreground/60">
                            {getCategoryConfig(activeFlow.category).label}
                          </span>
                          <span className="text-xs text-muted-foreground/40">
                            {nodes.filter((n) => n.type !== "trigger").length} etapa{nodes.filter((n) => n.type !== "trigger").length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!activeFlow.is_primary && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-muted-foreground/60 hover:text-accent"
                          onClick={() => handleSetPrimary(activeFlow)}
                        >
                          <Star className="h-3.5 w-3.5 mr-1.5" />
                          Tornar principal
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 ${showCategoryConfig ? "text-accent bg-accent/10" : "text-muted-foreground/50 hover:text-foreground"}`}
                        onClick={() => setShowCategoryConfig(!showCategoryConfig)}
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground/50 hover:text-foreground"
                        onClick={() => openEditFlow(activeFlow)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground/50 hover:text-destructive"
                        onClick={() => setShowDeleteFlowDialog(true)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="h-px bg-border/60" />

                  {/* ====== PAINEL DE CONFIGURACOES DO TIPO ====== */}
                  {showCategoryConfig && (
                    <div className="mx-6 mb-4">
                      {(() => {
                        const configDef = getCategoryConfigDef(activeFlow.category)
                        const catStyle = getCategoryConfig(activeFlow.category)
                        return (
                          <div className={`rounded-xl border p-4 ${catStyle.color}`}>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Settings2 className={`h-4 w-4 ${catStyle.iconColor}`} />
                                <h3 className="text-sm font-semibold text-foreground">{configDef.title}</h3>
                              </div>
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg"
                                disabled={isSavingCategoryConfig}
                                onClick={handleSaveCategoryConfig}
                              >
                                {isSavingCategoryConfig && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                                Salvar
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mb-4">{configDef.description}</p>

                            {/* ---- FLUXOS VINCULADOS (only for primary flow) ---- */}
                            {activeFlow.is_primary && secondaryFlows.length > 0 && (
                              <div className="mb-4 rounded-xl border border-border/50 bg-background/30 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <Workflow className="h-4 w-4 text-orange-400" />
                                  <h4 className="text-xs font-semibold text-foreground">Fluxos Vinculados</h4>
                                  <span className="text-[10px] text-muted-foreground">
                                    ({nodes.filter((n) => n.type === "action" && n.config?.subVariant === "goto_flow").length} conectados)
                                  </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground mb-2.5">
                                  Fluxos secundarios que o usuario pode ser redirecionado a partir deste fluxo. Adicione um bloco "Ir para Outro Fluxo" no builder abaixo.
                                </p>
                                <div className="flex flex-col gap-1.5">
                                  {secondaryFlows.map((sf) => {
                                    const sfCat = getCategoryConfig(sf.category)
                                    const SFIcon = sfCat.icon
                                    const isLinked = nodes.some((n) => n.type === "action" && n.config?.subVariant === "goto_flow" && n.config?.target_flow_id === sf.id)
                                    return (
                                      <div
                                        key={sf.id}
                                        className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors ${
                                          isLinked ? "bg-orange-500/5 border border-orange-500/20" : "bg-secondary/30 border border-transparent"
                                        }`}
                                      >
                                        <div className={`flex h-7 w-7 items-center justify-center rounded-md border shrink-0 ${sfCat.color}`}>
                                          <SFIcon className={`h-3.5 w-3.5 ${sfCat.iconColor}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-medium text-foreground truncate">{sf.name}</p>
                                          <p className="text-[10px] text-muted-foreground">{sfCat.label}</p>
                                        </div>
                                        {isLinked ? (
                                          <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/30 rounded-md text-[9px] px-1.5 py-0 shrink-0">
                                            Conectado
                                          </Badge>
                                        ) : (
                                          <span className="text-[10px] text-muted-foreground shrink-0">Nao vinculado</span>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}

                            {activeFlow.is_primary && secondaryFlows.length === 0 && (
                              <div className="mb-4 rounded-xl border border-dashed border-border p-4 flex flex-col items-center gap-2">
                                <Workflow className="h-5 w-5 text-muted-foreground" />
                                <p className="text-xs text-muted-foreground text-center">
                                  Crie fluxos secundarios (remarketing, follow-up, etc.) para poder vincular ao fluxo principal.
                                </p>
                              </div>
                            )}

                            <div className="flex flex-col gap-3">
                              {configDef.fields.map((field) => {
                                const FieldIcon = field.icon
                                return (
                                  <div key={field.key} className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2">
                                      <FieldIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                      <Label className="text-xs font-medium text-foreground">{field.label}</Label>
                                    </div>
                                    {field.description && (
                                      <p className="text-[10px] text-muted-foreground ml-5">{field.description}</p>
                                    )}
                                    {field.type === "toggle" ? (
                                      <div className="ml-5">
                                        <Switch
                                          checked={!!flowCategoryConfig[field.key]}
                                          onCheckedChange={(checked) =>
                                            setFlowCategoryConfig((prev) => ({ ...prev, [field.key]: checked }))
                                          }
                                        />
                                      </div>
                                    ) : field.type === "select" ? (
                                      <div className="ml-5">
                                        <Select
                                          value={(flowCategoryConfig[field.key] as string) || ""}
                                          onValueChange={(v) =>
                                            setFlowCategoryConfig((prev) => ({ ...prev, [field.key]: v }))
                                          }
                                        >
                                          <SelectTrigger className="h-8 bg-background/60 border-border/50 rounded-lg text-foreground text-xs">
                                            <SelectValue placeholder="Selecione..." />
                                          </SelectTrigger>
                                          <SelectContent className="bg-card border-border">
                                            {field.options?.map((opt) => (
                                              <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    ) : field.type === "textarea" ? (
                                      <div className="ml-5">
                                        <Textarea
                                          value={(flowCategoryConfig[field.key] as string) || ""}
                                          onChange={(e) =>
                                            setFlowCategoryConfig((prev) => ({ ...prev, [field.key]: e.target.value }))
                                          }
                                          placeholder={field.placeholder}
                                          className="bg-background/60 border-border/50 rounded-lg text-foreground text-xs min-h-[60px]"
                                        />
                                      </div>
                                    ) : (
                                      <div className="ml-5">
                                        <Input
                                          type={field.type === "number" ? "number" : "text"}
                                          value={(flowCategoryConfig[field.key] as string) || ""}
                                          onChange={(e) =>
                                            setFlowCategoryConfig((prev) => ({ ...prev, [field.key]: e.target.value }))
                                          }
                                          placeholder={field.placeholder}
                                          className="h-8 bg-background/60 border-border/50 rounded-lg text-foreground text-xs"
                                        />
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  <div>
                    {/* Mini-mapa */}
                    {!isLoadingNodes && nodes.filter((n) => n.type !== "trigger").length > 2 && (
                      <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1 px-1">
                        <div className="h-7 w-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0" title="Gatilho">
                          <Zap className="h-3.5 w-3.5 text-accent/60" />
                        </div>
                        {nodes.filter((n) => n.type !== "trigger").map((node) => {
                          const MiniIcon = nodeIcons[node.type]
                          return (
                            <div key={node.id} className="flex items-center gap-2 shrink-0">
                              <div className="w-4 h-px bg-border/40" />
                              <div
                                className="h-7 w-7 rounded-lg bg-secondary/40 flex items-center justify-center"
                                title={node.label}
                              >
                                <MiniIcon className="h-3.5 w-3.5 text-muted-foreground/60" />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {isLoadingNodes ? (
                      <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        {nodes.filter((n) => n.type !== "trigger").length === 0 && (
                          <div className="text-center py-8 mb-2">
                            <p className="text-sm text-muted-foreground/60">
                              Adicione etapas ao fluxo
                            </p>
                          </div>
                        )}

                        {/* Trigger block */}
                        <div className="flex flex-col">
                          <div className="flex items-center gap-4 rounded-2xl border border-accent/30 bg-accent/[0.04] px-5 py-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
                              <DragonTriggerIcon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-foreground">Inicio do Fluxo</p>
                              <p className="text-xs text-muted-foreground/50 mt-0.5">Quando o usuario inicia a conversa</p>
                            </div>
                            <span className="text-[10px] font-semibold text-accent/60 uppercase tracking-wider bg-accent/[0.08] px-2.5 py-1 rounded-lg">Gatilho</span>
                          </div>
                          {nodes.filter((n) => n.type !== "trigger").length > 0 && (
                            <div className="flex justify-center py-1.5">
                              <div className="w-px h-6 bg-border/40" />
                            </div>
                          )}
                        </div>

                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                        >
                          <SortableContext
                            items={nodes.filter((n) => n.type !== "trigger").map((n) => n.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {nodes.filter((n) => n.type !== "trigger").map((node, i, arr) => (
                              <SortableNodeCard
                                key={node.id}
                                node={node}
                                isLast={i === arr.length - 1}
                                flows={flows}
                                onEdit={openEditNode}
                                onDelete={(n) => {
                                  setDeletingNode(n)
                                  setShowDeleteNodeDialog(true)
                                }}
                              />
                            ))}
                          </SortableContext>
                        </DndContext>

                        {nodes.filter((n) => n.type !== "trigger").length > 0 && (
                          <div className="flex justify-center py-1.5">
                            <div className="w-px h-5 bg-border/30" />
                          </div>
                        )}
                        <button
                          className="group w-full flex items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-border/40 hover:border-accent/40 bg-transparent hover:bg-accent/[0.04] py-5 transition-all"
                          onClick={() => {
                            setSelectedTemplate(null)
                            setNodeConfigValues({})
                            setShowAddNodeDialog(true)
                          }}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary/40 group-hover:bg-accent/10 transition-colors">
                            <Plus className="h-4 w-4 text-muted-foreground/40 group-hover:text-accent/70 transition-colors" />
                          </div>
                          <span className="text-sm font-medium text-muted-foreground/40 group-hover:text-accent/70 transition-colors">
                            Adicionar etapa
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ---- New Flow Dialog ---- */}
      <Dialog open={showNewFlowDialog} onOpenChange={(open) => {
        setShowNewFlowDialog(open)
        if (!open) {
          setNewFlowMode(null)
          resetBasicFlow()
          setNewFlowName("")
        }
      }}>
        <DialogContent className={`bg-card border-border rounded-2xl max-h-[90vh] overflow-y-auto p-0 transition-all ${
          newFlowMode === "basico" ? "max-w-[720px]" : newFlowMode === null ? "max-w-[620px]" : "max-w-[580px]"
        }`}>

          {/* ===== STEP 1: Choose mode ===== */}
          {newFlowMode === null && (
            <div className="flex flex-col p-5 sm:p-8 gap-5 sm:gap-8">
              <div className="space-y-1.5 sm:space-y-2">
                <DialogHeader>
                  <DialogTitle className="text-foreground text-xl font-semibold">
                    {flows.length === 0 ? "Criar fluxo inicial" : "Novo fluxo"}
                  </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">Escolha como montar seu fluxo.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Basic Flow Option */}
                <button
                  className="group flex flex-row sm:flex-col items-start rounded-2xl border border-border bg-card p-4 sm:p-6 text-left transition-all hover:bg-secondary/30 hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5"
                  onClick={() => setNewFlowMode("basico")}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 border border-accent/20 mr-4 sm:mr-0 sm:mb-5">
                    <Zap className="h-6 w-6 text-accent" />
                  </div>
                  <div className="flex-1 sm:flex-none">
                    <p className="text-base font-semibold text-foreground">Basico</p>
                    <p className="text-sm text-muted-foreground mt-0.5 sm:mt-1 sm:mb-5">Pronto em segundos</p>
                    <div className="hidden sm:flex flex-col gap-2.5 mt-auto">
                      <p className="text-sm text-muted-foreground/70">Boas-vindas + midia</p>
                      <p className="text-sm text-muted-foreground/70">Cobranca automatica</p>
                      <p className="text-sm text-muted-foreground/70">Preencha e pronto</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 mt-5 pt-5 border-t border-border/50">
                      <div className="h-2.5 w-2.5 rounded-full bg-accent/60" />
                      <div className="w-5 h-px bg-border/60" />
                      <div className="h-2.5 w-2.5 rounded-full bg-blue-400/60" />
                      <div className="w-5 h-px bg-border/60" />
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
                    </div>
                  </div>
                </button>

                {/* Complete Flow Option */}
                <button
                  className="group flex flex-row sm:flex-col items-start rounded-2xl border border-border bg-card p-4 sm:p-6 text-left transition-all hover:bg-secondary/30 hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5"
                  onClick={() => setNewFlowMode("completo")}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 mr-4 sm:mr-0 sm:mb-5">
                    <Workflow className="h-6 w-6 text-purple-400" />
                  </div>
                  <div className="flex-1 sm:flex-none">
                    <p className="text-base font-semibold text-foreground">Completo</p>
                    <p className="text-sm text-muted-foreground mt-0.5 sm:mt-1 sm:mb-5">Controle total</p>
                    <div className="hidden sm:flex flex-col gap-2.5 mt-auto">
                      <p className="text-sm text-muted-foreground/70">Etapa por etapa</p>
                      <p className="text-sm text-muted-foreground/70">Logica e automacoes</p>
                      <p className="text-sm text-muted-foreground/70">Jornadas elaboradas</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 mt-5 pt-5 border-t border-border/50">
                      <div className="h-2.5 w-2.5 rounded-full bg-accent/60" />
                      <div className="w-5 h-px bg-border/60" />
                      <div className="h-2.5 w-2.5 rounded-full bg-purple-400/60" />
                      <div className="w-5 h-px bg-border/60" />
                      <div className="h-2.5 w-2.5 rounded-full bg-orange-400/60" />
                      <div className="w-5 h-px bg-border/60" />
                      <div className="h-2.5 w-2.5 rounded-full bg-cyan-400/60" />
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ===== STEP 2A: Basic Flow Wizard (Step by Step) ===== */}
          {newFlowMode === "basico" && (
            <div className="flex flex-col h-full">
              {/* Progress indicator */}
              <div className="px-6 pt-5 pb-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-accent font-bold text-sm">{basicWizardStep}</span>
                  <span className="text-muted-foreground/50 text-sm">/ {BASIC_WIZARD_TOTAL_STEPS}</span>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: BASIC_WIZARD_TOTAL_STEPS }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all ${
                        i < basicWizardStep ? "bg-accent" : "bg-border/50"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Two column layout: Question + Preview */}
              <div className="flex flex-1 gap-4 px-6 pb-4 min-h-0">
                {/* Left: Question */}
                <div className="flex-1 flex flex-col">
                  {/* Step 1: Media (optional) */}
                  {basicWizardStep === 1 && (
                    <div className="flex flex-col gap-4 py-4">
                      <div>
                        <h3 className="text-lg font-bold text-foreground mb-1">Midia</h3>
                        <p className="text-sm text-muted-foreground">Quer enviar uma foto ou video antes da mensagem?</p>
                      </div>
                      
                      {/* Toggle midia */}
                      <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-secondary/20">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <Image className="h-5 w-5 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">Anexar foto ou video</p>
                            <p className="text-xs text-muted-foreground/60">Opcional</p>
                          </div>
                        </div>
                        <Switch
                          checked={basicHasMedia}
                          onCheckedChange={(checked) => {
                            setBasicHasMedia(checked)
                            if (!checked) {
                              setBasicMediaFile(null)
                              setBasicMediaUrl("")
                            }
                          }}
                        />
                      </div>

                      {/* Upload area */}
                      {basicHasMedia && (
                        <div className="flex flex-col gap-3">
                          {!basicMediaUrl ? (
                            <>
                              <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-border/60 bg-secondary/10 cursor-pointer hover:bg-secondary/20 hover:border-accent/30 transition-all">
                                <input
                                  type="file"
                                  accept="image/*,video/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) handleBasicMediaUpload(file)
                                  }}
                                />
                                {basicIsUploading ? (
                                  <>
                                    <Loader2 className="h-8 w-8 text-accent animate-spin" />
                                    <p className="text-sm text-muted-foreground">Enviando...</p>
                                  </>
                                ) : (
                                  <>
                                    <Upload className="h-8 w-8 text-muted-foreground/50" />
                                    <p className="text-sm text-muted-foreground">Clique para enviar foto ou video</p>
                                    <p className="text-xs text-muted-foreground/50">JPG, PNG, GIF, MP4 (max 10MB)</p>
                                  </>
                                )}
                              </label>
                              {basicUploadError && (
                                <p className="text-xs text-destructive">{basicUploadError}</p>
                              )}
                            </>
                          ) : (
                            <div className="flex items-center gap-3 p-3 rounded-xl border border-accent/30 bg-accent/5">
                              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                                {basicMediaType === "photo" ? (
                                  <Image className="h-6 w-6 text-accent" />
                                ) : (
                                  <Video className="h-6 w-6 text-accent" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {basicMediaFile?.name || "Arquivo enviado"}
                                </p>
                                <p className="text-xs text-muted-foreground/60">
                                  {basicMediaType === "photo" ? "Foto" : "Video"}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  setBasicMediaFile(null)
                                  setBasicMediaUrl("")
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 2: Message Text */}
                  {basicWizardStep === 2 && (
                    <div className="flex flex-col gap-4 py-4">
                      <div>
                        <h3 className="text-lg font-bold text-foreground mb-1">Mensagem</h3>
                        <p className="text-sm text-muted-foreground">O que o bot vai enviar quando alguem iniciar?</p>
                      </div>
                      <Textarea
                        autoFocus
                        value={basicWelcomeMsg}
                        onChange={(e) => setBasicWelcomeMsg(e.target.value)}
                        placeholder="Ex: Opa! Que bom ter voce aqui. Olha so essa oportunidade..."
                        className="bg-secondary/50 border-border rounded-xl text-foreground min-h-[140px] resize-none text-base"
                        rows={5}
                      />
                    </div>
                  )}

                  {/* Step 3: Cobranca (optional) */}
                  {basicWizardStep === 3 && (
                    <div className="flex flex-col gap-4 py-4">
                      <div>
                        <h3 className="text-lg font-bold text-foreground mb-1">Cobranca</h3>
                        <p className="text-sm text-muted-foreground">Quer adicionar botoes de pagamento na mensagem?</p>
                      </div>

                      {/* Toggle buttons */}
                      <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-secondary/20">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 border border-accent/20">
                            <CreditCard className="h-5 w-5 text-accent" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">Gerar cobranca</p>
                            <p className="text-xs text-muted-foreground/60">Cobranca automatica via PIX</p>
                          </div>
                        </div>
                        <Switch
                          checked={basicHasButtons}
                          onCheckedChange={(checked) => {
                            setBasicHasButtons(checked)
                            if (checked && basicButtons.length === 0) {
                              setBasicButtons([{ id: crypto.randomUUID(), text: "", amount: "" }])
                            } else if (!checked) {
                              setBasicButtons([])
                            }
                          }}
                        />
                      </div>

                      {/* Payment buttons list */}
                      {basicHasButtons && (
                        <div className="flex flex-col gap-4">
                          {basicButtons.map((btn, i) => (
                            <div key={btn.id} className="flex flex-col gap-3 p-4 rounded-xl border border-border/60 bg-secondary/10">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground">Produto {i + 1}</span>
                                {basicButtons.length > 1 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    onClick={() => setBasicButtons(basicButtons.filter((_, j) => j !== i))}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                              <div className="flex gap-3">
                                <div className="flex-1">
                                  <Input
                                    value={btn.text}
                                    onChange={(e) => {
                                      const updated = [...basicButtons]
                                      updated[i].text = e.target.value
                                      setBasicButtons(updated)
                                    }}
                                    placeholder="Nome do produto"
                                    className="bg-secondary/50 border-border rounded-xl text-foreground h-10"
                                  />
                                </div>
                                <div className="w-32">
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                                    <Input
                                      value={btn.amount}
                                      onChange={(e) => {
                                        const updated = [...basicButtons]
                                        updated[i].amount = e.target.value.replace(/[^0-9.,]/g, "")
                                        setBasicButtons(updated)
                                      }}
                                      placeholder="0,00"
                                      className="bg-secondary/50 border-border rounded-xl text-foreground h-10 pl-9"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Order Bump toggle */}
                              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                                <div className="flex items-center gap-2">
                                  <Package className="h-4 w-4 text-purple-400" />
                                  <span className="text-xs text-muted-foreground">Order Bump</span>
                                </div>
                                <Switch
                                  checked={btn.hasOrderBump || false}
                                  onCheckedChange={(checked) => {
                                    const updated = [...basicButtons]
                                    updated[i].hasOrderBump = checked
                                    if (!checked) {
                                      updated[i].orderBumpName = ""
                                      updated[i].orderBumpAmount = ""
                                    }
                                    setBasicButtons(updated)
                                  }}
                                />
                              </div>

                              {/* Order Bump fields */}
                              {btn.hasOrderBump && (
                                <div className="flex gap-3 pl-6 border-l-2 border-purple-400/30">
                                  <div className="flex-1">
                                    <Input
                                      value={btn.orderBumpName || ""}
                                      onChange={(e) => {
                                        const updated = [...basicButtons]
                                        updated[i].orderBumpName = e.target.value
                                        setBasicButtons(updated)
                                      }}
                                      placeholder="Nome do bump"
                                      className="bg-secondary/50 border-border rounded-xl text-foreground h-9 text-sm"
                                    />
                                  </div>
                                  <div className="w-28">
                                    <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                                      <Input
                                        value={btn.orderBumpAmount || ""}
                                        onChange={(e) => {
                                          const updated = [...basicButtons]
                                          updated[i].orderBumpAmount = e.target.value.replace(/[^0-9.,]/g, "")
                                          setBasicButtons(updated)
                                        }}
                                        placeholder="0,00"
                                        className="bg-secondary/50 border-border rounded-xl text-foreground h-9 text-sm pl-9"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          {basicButtons.length < 3 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-fit text-xs"
                              onClick={() => setBasicButtons([...basicButtons, { id: crypto.randomUUID(), text: "", amount: "" }])}
                            >
                              <Plus className="h-3 w-3 mr-1.5" />
                              Adicionar produto
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Telegram Preview */}
                <div className="w-[220px] shrink-0 flex flex-col">
                  <div className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2 text-center">
                    Preview no Telegram
                  </div>
                  <div className="flex-1 bg-[#0e1621] rounded-xl p-3 flex flex-col">
                    {/* Telegram header */}
                    <div className="flex items-center gap-2 pb-2 border-b border-white/5 mb-3">
                      <div className="h-7 w-7 rounded-full bg-accent/20 flex items-center justify-center">
                        <Zap className="h-3.5 w-3.5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-background dark:text-foreground truncate">{selectedBot?.name || "Seu Bot"}</p>
                        <p className="text-[9px] text-background dark:text-foreground/40">online</p>
                      </div>
                    </div>

                    {/* Chat messages */}
                    <div className="flex-1 flex flex-col gap-2 overflow-hidden">
                      {/* Media preview if exists */}
                      {basicHasMedia && basicMediaUrl && (
                        <div className="bg-[#182533] rounded-lg p-1.5 max-w-full">
                          <div className="bg-[#0d1318] rounded h-20 flex items-center justify-center overflow-hidden">
                            {basicMediaType === "photo" ? (
                              basicMediaUrl.startsWith("http") ? (
                                <img src={basicMediaUrl} alt="Preview" className="w-full h-full object-cover" />
                              ) : (
                                <Image className="h-6 w-6 text-background dark:text-foreground/20" />
                              )
                            ) : (
                              <Video className="h-6 w-6 text-background dark:text-foreground/20" />
                            )}
                          </div>
                        </div>
                      )}

                      {/* Message bubble */}
                      <div className="bg-[#182533] rounded-lg p-2 max-w-full">
                        <p className="text-[10px] text-background dark:text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
                          {basicWelcomeMsg.trim() || "Sua mensagem aqui..."}
                        </p>
                      </div>

                    {/* Payment button previews */}
                    {basicHasButtons && basicButtons.filter(b => b.text || b.amount).map((btn, i) => (
                      <div key={i} className="bg-[#2b5278] rounded-lg py-1.5 px-2 text-center">
                        <span className="text-[10px] text-background dark:text-foreground font-medium">
                          {btn.text || "Produto"} {btn.amount ? `- R$${btn.amount}` : ""}
                        </span>
                      </div>
                    ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer navigation */}
              <div className="border-t border-border px-6 py-4 flex justify-between items-center">
                <Button
                  variant="ghost"
                  className="rounded-xl text-muted-foreground"
                  onClick={() => {
                    if (basicWizardStep === 1) {
                      setNewFlowMode(null)
                    } else {
                      setBasicWizardStep((s) => s - 1)
                    }
                  }}
                >
                  Voltar
                </Button>

                {basicWizardStep < BASIC_WIZARD_TOTAL_STEPS ? (
                  <Button
                    className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl min-w-[120px]"
                    disabled={!canGoNextBasicStep()}
                    onClick={() => setBasicWizardStep((s) => s + 1)}
                  >
                    Proximo
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    className="bg-success text-success-foreground hover:bg-success/90 rounded-xl min-w-[120px]"
                    disabled={!basicWelcomeMsg.trim() || isCreatingFlow}
                    onClick={handleCreateBasicFlow}
                  >
                    {isCreatingFlow ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                    Criar Fluxo
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ===== STEP 2B: Complete Flow (existing form) ===== */}
          {newFlowMode === "completo" && (
            <div className="flex flex-col">
              <div className="sticky top-0 z-10 bg-card border-b border-border px-6 pt-6 pb-4 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <button
                    className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-secondary/60 transition-colors"
                    onClick={() => setNewFlowMode(null)}
                  >
                    <ArrowRight className="h-4 w-4 text-muted-foreground rotate-180" />
                  </button>
                  <div>
                    <DialogHeader>
                      <DialogTitle className="text-foreground text-base">Fluxo Completo</DialogTitle>
                    </DialogHeader>
                    <p className="text-xs text-muted-foreground mt-0.5">Monte etapa por etapa com controle total</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 p-5">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="flow-name" className="text-foreground text-xs">Nome do fluxo</Label>
                  <Input
                    id="flow-name"
                    value={newFlowName}
                    onChange={(e) => setNewFlowName(e.target.value)}
                    placeholder={flows.length === 0 ? "Ex: Boas-vindas" : "Ex: Remarketing VIP"}
                    className="bg-secondary border-border rounded-xl text-foreground"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateFlow()
                    }}
                  />
                </div>

                {/* Category selection - only for secondary flows */}
                {flows.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <Label className="text-foreground text-xs">Tipo de fluxo</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {flowCategories.filter((c) => c.value !== "inicial").map((cat) => {
                        const CatIcon = cat.icon
                        const isSelected = newFlowCategory === cat.value
                        return (
                          <button
                            key={cat.value}
                            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all ${
                              isSelected
                                ? `${cat.color} ring-1 ring-accent`
                                : "border-border bg-secondary/30 hover:bg-secondary/60"
                            }`}
                            onClick={() => setNewFlowCategory(cat.value)}
                          >
                            <CatIcon className={`h-4 w-4 shrink-0 ${isSelected ? cat.iconColor : "text-muted-foreground"}`} />
                            <div className="min-w-0">
                              <p className={`text-xs font-medium truncate ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                                {cat.label}
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {getCategoryConfig(newFlowCategory).description}
                    </p>
                  </div>
                )}

                {flows.length === 0 && (
                  <div className="flex items-start gap-3 rounded-xl bg-accent/5 border border-accent/20 p-3">
                    <Zap className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      Este sera o fluxo principal do seu bot. E o primeiro que seus usuarios vao ver ao interagir.
                    </p>
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 bg-card border-t border-border px-5 py-4 flex justify-between items-center rounded-b-2xl">
                <Button
                  variant="ghost"
                  className="rounded-xl text-muted-foreground"
                  onClick={() => setNewFlowMode(null)}
                >
                  Voltar
                </Button>
                <Button
                  className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl"
                  disabled={!newFlowName.trim() || isCreatingFlow}
                  onClick={handleCreateFlow}
                >
                  {isCreatingFlow && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar
                </Button>
              </div>
            </div>
          )}

        </DialogContent>
      </Dialog>

      {/* ---- Edit Flow Dialog ---- */}
      <Dialog open={showEditFlowDialog} onOpenChange={setShowEditFlowDialog}>
        <DialogContent className="bg-card border-border rounded-2xl max-w-sm p-5">
          <DialogHeader>
            <DialogTitle className="text-foreground text-sm font-semibold">Editar fluxo</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Nome</Label>
              <Input
                value={editFlowName}
                onChange={(e) => setEditFlowName(e.target.value)}
                className="bg-secondary/40 border-border/60 rounded-lg text-foreground text-sm h-9"
              />
            </div>
            {!activeFlow?.is_primary && (
              <div className="flex flex-col gap-2">
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {flowCategories.filter((c) => c.value !== "inicial").map((cat) => {
                    const CatIcon = cat.icon
                    const isSelected = editFlowCategory === cat.value
                    return (
                      <button
                        key={cat.value}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all ${
                          isSelected
                            ? "bg-secondary/60 border border-border"
                            : "bg-transparent border border-transparent hover:bg-secondary/30"
                        }`}
                        onClick={() => setEditFlowCategory(cat.value)}
                      >
                        <CatIcon className={`h-3.5 w-3.5 shrink-0 ${isSelected ? cat.iconColor : "text-muted-foreground/50"}`} />
                        <p className={`text-xs truncate ${isSelected ? "text-foreground font-medium" : "text-muted-foreground/70"}`}>
                          {cat.label}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {activeFlow?.is_primary && (
              <p className="text-[11px] text-muted-foreground/50">
                Fluxo principal. Use {"'Tornar principal'"} em outro fluxo para trocar.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-lg text-xs text-muted-foreground"
              onClick={() => setShowEditFlowDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg text-xs"
              disabled={!editFlowName.trim() || isSavingFlow}
              onClick={handleSaveFlow}
            >
              {isSavingFlow && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---- Add Node Dialog ---- */}
      <Dialog open={showAddNodeDialog} onOpenChange={setShowAddNodeDialog}>
        <DialogContent className="bg-card border-border rounded-2xl max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          {!selectedTemplate ? (
            <>
              {/* Header */}
              <div className="shrink-0 px-6 pt-6 pb-4">
                <DialogHeader>
                  <DialogTitle className="text-foreground text-base font-bold">Adicionar etapa</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground/60 mt-1">Escolha o tipo de acao para esta etapa.</p>
              </div>

              <div className="h-px bg-border/40 mx-6" />

              {/* Groups */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="flex flex-col gap-5 px-6 py-5">
                  {actionGroups.map((group) => {
                    const GroupIcon = group.icon
                    const groupTemplates = actionTemplates.filter((tpl) => {
                      if (!group.types.includes(tpl.type)) return false
                      if (group.subVariants && tpl.subVariant) return group.subVariants.includes(tpl.subVariant)
                      if (group.subVariants && !tpl.subVariant) return false
                      return tpl.type !== "trigger"
                    })
                    console.log("[v0] Group filter:", group.id, "templates:", groupTemplates.map(t => t.label))
                    if (groupTemplates.length === 0) return null

                    return (
                      <div key={group.id} className="flex flex-col gap-2">
                        {/* Group label */}
                        <div className="flex items-center gap-2.5 px-1">
                          <div className={`flex h-6 w-6 items-center justify-center rounded-md ${group.bgColor}`}>
                            <GroupIcon className={`h-3.5 w-3.5 ${group.iconColor}`} />
                          </div>
                          <p className="text-xs font-bold text-foreground/80 uppercase tracking-wider">{group.label}</p>
                        </div>

                        {/* Group Items */}
                        <div className="flex flex-col gap-1">
                          {groupTemplates.map((tpl, tplIdx) => {
                            const SubIcon = tpl.subVariant ? (subVariantIcons[tpl.subVariant] || nodeIcons[tpl.type]) : nodeIcons[tpl.type]
                            return (
                              <button
                                key={`${tpl.type}-${tpl.subVariant || tplIdx}`}
                                className="flex items-center gap-4 rounded-xl px-4 py-3.5 text-left transition-all hover:bg-secondary/40 group"
                                onClick={async () => {
                                  // Para "end" adiciona direto sem configuracao
                                  if (tpl.subVariant === "end") {
                                    if (!activeFlow) return
                                    setIsAddingNode(true)
                                    const label = "Encerrar Conversa"
                                    const config = { subVariant: tpl.subVariant }
                                    const newPosition = nodes.length
                                    const { data, error } = await supabase
                                      .from("flow_nodes")
                                      .insert({
                                        flow_id: activeFlow.id,
                                        type: tpl.type,
                                        label,
                                        config,
                                        position: newPosition,
                                      })
                                      .select()
                                      .single()
                                    if (!error && data) {
                                      setNodes((prev) => [...prev, data as FlowNode])
                                    }
                                    setShowAddNodeDialog(false)
                                    setIsAddingNode(false)
                                    return
                                  }
                                  // Para restart e outros, abre modal de configuracao
                                  setSelectedTemplate(tpl)
                                  setNodeConfigValues({})
                                  resetMessageConfig()
                                }}
                              >
                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${group.bgColor} border ${group.borderAccent}`}>
                                  <SubIcon className={`h-5 w-5 ${group.iconColor}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-foreground">{tpl.label}</p>
                                  <p className="text-xs text-muted-foreground/50 mt-0.5 leading-snug">{tpl.description}</p>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors shrink-0" />
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-5 px-6 py-5 overflow-y-auto min-h-0">
              <div className="flex items-center gap-4">
                {(() => {
                  const group = actionGroups.find((g) => g.types.includes(selectedTemplate.type))
                  const SubIcon = selectedTemplate.subVariant ? (subVariantIcons[selectedTemplate.subVariant] || nodeIcons[selectedTemplate.type]) : nodeIcons[selectedTemplate.type]
                  return (
                    <>
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${group?.bgColor || "bg-secondary/50"} border ${group?.borderAccent || "border-border/40"}`}>
                        <SubIcon className={`h-5 w-5 ${group?.iconColor || nodeIconColors[selectedTemplate.type]}`} />
                      </div>
                      <div>
                        <p className="text-base font-bold text-foreground">{selectedTemplate.label}</p>
                        <p className="text-sm text-muted-foreground/50">{selectedTemplate.description}</p>
                      </div>
                    </>
                  )
                })()}
              </div>

              {selectedTemplate.type === "message" ? (
                <MessageConfigForm
                  msgText={msgText}
                  setMsgText={setMsgText}
                  msgMediaType={msgMediaType}
                  setMsgMediaType={setMsgMediaType}
                  msgMediaUrl={msgMediaUrl}
                  setMsgMediaUrl={setMsgMediaUrl}
                  msgHasButtons={msgHasButtons}
                  setMsgHasButtons={setMsgHasButtons}
                  msgButtons={msgButtons}
                  addMsgButton={addMsgButton}
                  updateMsgButton={updateMsgButton}
                  removeMsgButton={removeMsgButton}
                />
              ) : selectedTemplate.type === "action" && selectedTemplate.subVariant === "goto_flow" ? (
                <div className="flex flex-col gap-3">
                  <Label className="text-foreground text-sm font-semibold">Selecione o fluxo de destino</Label>
                  <p className="text-sm text-muted-foreground -mt-1">
                    O usuario sera redirecionado para este fluxo ao chegar nesta etapa.
                  </p>
                  {flows.filter((f) => f.id !== activeFlow?.id).length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-6">
                      <Workflow className="h-6 w-6 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground text-center">
                        Nenhum outro fluxo disponivel. Crie fluxos secundarios primeiro.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto pr-1">
                      {flows.filter((f) => f.id !== activeFlow?.id).map((f) => {
                        const fCat = getCategoryConfig(f.category)
                        const FCatIcon = fCat.icon
                        const isSelected = nodeConfigValues.target_flow_id === f.id
                        return (
                          <button
                            key={f.id}
                            className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all ${
                              isSelected
                                ? `${fCat.color} ring-1 ring-accent`
                                : "border-border bg-secondary/30 hover:bg-secondary/60"
                            }`}
                            onClick={() => setNodeConfigValues((prev) => ({ ...prev, target_flow_id: f.id, target_flow_name: f.name }))}
                          >
                            <div className={`flex h-9 w-9 items-center justify-center rounded-lg border shrink-0 ${fCat.color}`}>
                              <FCatIcon className={`h-4 w-4 ${fCat.iconColor}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
                              <p className="text-[11px] text-muted-foreground">{fCat.label}{f.is_primary ? " — Principal" : ""}</p>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : selectedTemplate.type === "delay" ? (
                <div className="flex flex-col gap-3">
                  <Label className="text-foreground text-sm font-semibold">Tempo em segundos</Label>
                  <p className="text-sm text-muted-foreground -mt-1">
                    Defina quanto tempo o fluxo deve aguardar antes de continuar.
                  </p>
                  <Input
                    type="number"
                    value={nodeConfigValues.seconds || ""}
                    onChange={(e) =>
                      setNodeConfigValues((prev) => ({ ...prev, seconds: e.target.value }))
                    }
                    placeholder="300"
                    className="bg-secondary border-border rounded-xl text-foreground h-11 text-sm"
                  />
                  {nodeConfigValues.seconds && parseInt(nodeConfigValues.seconds) > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {(() => {
                        const s = parseInt(nodeConfigValues.seconds)
                        if (s >= 3600) return `= ${Math.floor(s / 3600)} hora${Math.floor(s / 3600) > 1 ? "s" : ""} e ${Math.floor((s % 3600) / 60)} min`
                        if (s >= 60) return `= ${Math.floor(s / 60)} minuto${Math.floor(s / 60) > 1 ? "s" : ""}`
                        return `= ${s} segundo${s > 1 ? "s" : ""}`
                      })()}
                    </p>
                  )}
                </div>
              ) : selectedTemplate.type === "condition" ? (
                <div className="flex flex-col gap-4">
                      {/* 1. Mensagem/Pergunta */}
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Mensagem / Pergunta</Label>
                        <Textarea
                          value={nodeConfigValues.condition_message || ""}
                          onChange={(e) =>
                            setNodeConfigValues((prev) => ({ ...prev, condition_message: e.target.value }))
                          }
                          placeholder="Ex: Voce gostaria de continuar?"
                          className="bg-secondary/50 border-border/60 rounded-xl text-foreground min-h-[70px] text-sm focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all resize-none"
                        />
                      </div>

                      {/* 2. Botoes - simples: texto + sub-fluxo */}
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Botoes (ate 3)</Label>
                        <div className="flex flex-col gap-2">
                          {(() => {
                            const branchesRaw = nodeConfigValues.condition_branches
                            let branches: { label: string; target_flow_id: string }[] = []
                            try { branches = branchesRaw ? JSON.parse(branchesRaw) : [] } catch { branches = [] }
                            if (branches.length === 0) {
                              branches = [{ label: "", target_flow_id: "" }]
                              setTimeout(() => {
                                setNodeConfigValues((prev) => ({ ...prev, condition_branches: JSON.stringify(branches) }))
                              }, 0)
                            }

                            const updateBranch = (idx: number, field: string, value: string) => {
                              const updated = [...branches]
                              ;(updated[idx] as Record<string, unknown>)[field] = value
                              setNodeConfigValues((prev) => ({ ...prev, condition_branches: JSON.stringify(updated) }))
                            }
                            const removeBranch = (idx: number) => {
                              const updated = branches.filter((_, i) => i !== idx)
                              setNodeConfigValues((prev) => ({ ...prev, condition_branches: JSON.stringify(updated) }))
                            }
                            const addBranch = () => {
                              if (branches.length >= 3) return
                              const updated = [...branches, { label: "", target_flow_id: "" }]
                              setNodeConfigValues((prev) => ({ ...prev, condition_branches: JSON.stringify(updated) }))
                            }

                            const colors = [
                              { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", dot: "bg-emerald-400" },
                              { bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-400", dot: "bg-rose-400" },
                              { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", dot: "bg-amber-400" },
                            ]

                            // Fluxos disponiveis (exceto o atual)
                            const availableFlows = flows.filter((f) => f.id !== activeFlow?.id)

                            return (
                              <>
                                {branches.map((branch, idx) => {
                                  const color = colors[idx % colors.length]
                                  return (
                                    <div key={idx} className={`flex flex-col gap-3 rounded-xl border ${color.border} ${color.bg} p-3`}>
                                      {/* Texto do botao */}
                                      <div className="flex items-center gap-2">
                                        <div className={`h-2.5 w-2.5 rounded-full ${color.dot} shrink-0`} />
                                        <Input
                                          value={branch.label}
                                          onChange={(e) => updateBranch(idx, "label", e.target.value)}
                                          placeholder={`Texto do botao ${idx + 1}`}
                                          className="bg-transparent border-0 p-0 h-auto text-sm font-medium text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
                                        />
                                        {branches.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => removeBranch(idx)}
                                            className="text-muted-foreground/50 hover:text-destructive transition-colors"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        )}
                                      </div>

                                      {/* Sub-fluxo (select dos fluxos ja criados) */}
                                      <div className="flex flex-col gap-1.5">
                                        <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wide">Sub-fluxo</span>
                                        <Select
                                          value={branch.target_flow_id || ""}
                                          onValueChange={(val) => updateBranch(idx, "target_flow_id", val)}
                                        >
                                          <SelectTrigger className="bg-background/50 border-border/40 rounded-lg h-9 text-sm">
                                            <SelectValue placeholder="Selecione um fluxo..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {availableFlows.length === 0 ? (
                                              <div className="px-3 py-2 text-xs text-muted-foreground">
                                                Nenhum outro fluxo disponivel
                                              </div>
                                            ) : (
                                              availableFlows.map((f) => {
                                                const catCfg = getCategoryConfig(f.category)
                                                return (
                                                  <SelectItem key={f.id} value={f.id}>
                                                    <div className="flex items-center gap-2">
                                                      <catCfg.icon className={`h-3 w-3 ${catCfg.iconColor}`} />
                                                      <span>{f.name}</span>
                                                    </div>
                                                  </SelectItem>
                                                )
                                              })
                                            )}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                  )
                                })}

                                {branches.length < 3 && (
                                  <button
                                    type="button"
                                    onClick={addBranch}
                                    className="flex items-center justify-center gap-1.5 w-full rounded-xl border border-dashed border-border/50 text-muted-foreground text-xs py-2.5 hover:bg-secondary/30 transition-colors"
                                  >
                                    <Plus className="h-3 w-3" />
                                    Adicionar botao
                                  </button>
                                )}

                                <p className="text-[10px] text-muted-foreground/60">
                                  Maximo de 3 botoes por condicao
                                </p>
                              </>
                            )
                          })()}
                        </div>
                      </div>
                </div>
              ) : selectedTemplate.type === "action" ? (
                <div className="flex flex-col gap-3">
                  <Label className="text-foreground text-sm font-semibold">
                    {selectedTemplate.subVariant === "add_group" ? "Link do grupo" : "Valor"}
                  </Label>
                  <p className="text-sm text-muted-foreground -mt-1">
              {selectedTemplate.subVariant === "add_group"
                          ? "Envie o usuario para um grupo ou canal do Telegram."
                          : "Configure a acao automatica."}
                  </p>
                  <Input
                    type="text"
                    value={nodeConfigValues.action_name || ""}
                    onChange={(e) =>
                      setNodeConfigValues((prev) => ({ ...prev, action_name: e.target.value }))
                    }
                    placeholder={
                      selectedTemplate.subVariant === "add_group" ? "https://t.me/meugrupo" : "Valor"
                    }
                    className="bg-secondary border-border rounded-xl text-foreground h-11 text-sm"
                  />
                </div>
              ) : selectedTemplate.type === "payment" ? (
                <div className="flex flex-col gap-4">
                      {/* Mensagem acima dos botoes */}
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Mensagem</Label>
                        <Textarea
                          value={nodeConfigValues.payment_message || ""}
                          onChange={(e) => setNodeConfigValues((prev) => ({ ...prev, payment_message: e.target.value }))}
                          placeholder="Escolha seu plano para liberar o acesso:"
                          className="bg-secondary/50 border-border/60 rounded-xl text-foreground min-h-[70px] text-sm"
                        />
                        <p className="text-[10px] text-muted-foreground/60">Texto que aparece acima dos botoes de plano</p>
                      </div>

                      {/* Botoes de pagamento com drag and drop */}
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Botoes de Pagamento</Label>
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragStart={(event) => setActivePaymentButtonId(event.active.id as string)}
                          onDragEnd={(event) => {
                            setActivePaymentButtonId(null)
                            const { active, over } = event
                            if (!over || active.id === over.id) return
                            const oldIndex = paymentButtons.findIndex((b) => b.id === active.id)
                            const newIndex = paymentButtons.findIndex((b) => b.id === over.id)
                            if (oldIndex !== -1 && newIndex !== -1) {
                              setPaymentButtons(arrayMove(paymentButtons, oldIndex, newIndex))
                            }
                          }}
                        >
                          <SortableContext items={paymentButtons.map(b => b.id)} strategy={verticalListSortingStrategy}>
                            <div className="flex flex-col gap-2">
                              {paymentButtons.map((btn, index) => (
                                <SortablePaymentButton
                                  key={btn.id}
                                  button={btn}
                                  index={index}
                                  onUpdate={(field, value) => {
                                    setPaymentButtons(prev => prev.map(b => b.id === btn.id ? { ...b, [field]: value } : b))
                                  }}
                                  onDelete={() => {
                                    if (paymentButtons.length > 1) {
                                      setPaymentButtons(prev => prev.filter(b => b.id !== btn.id))
                                    }
                                  }}
                                  canDelete={paymentButtons.length > 1}
                                />
                              ))}
                            </div>
                          </SortableContext>
                          <DragOverlay>
                            {activePaymentButtonId ? (
                              <div className="rounded-xl border border-primary/50 bg-card p-3 shadow-lg">
                                <div className="flex items-center gap-2">
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm text-foreground">
                                    {paymentButtons.find(b => b.id === activePaymentButtonId)?.text || "Botao"}
                                  </span>
                                </div>
                              </div>
                            ) : null}
                          </DragOverlay>
                        </DndContext>
                        
                        {/* Adicionar novo botao */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-1 text-xs rounded-lg border-dashed"
                          onClick={() => setPaymentButtons(prev => [...prev, { id: crypto.randomUUID(), text: "", amount: "" }])}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1.5" />
                          Adicionar novo botao
                        </Button>
                        <p className="text-[10px] text-muted-foreground/60">Arraste para reorganizar a ordem dos botoes. Cada botao sera exibido no Telegram.</p>
                      </div>

                      {/* Order Bump */}
                      <div className="flex flex-col rounded-xl border border-border/60 overflow-hidden">
                        <div className={`flex items-center justify-between px-3.5 py-2.5 ${nodeConfigValues.has_order_bump === "true" ? "bg-amber-500/5" : "bg-secondary/20"}`}>
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
                              <Plus className="h-3.5 w-3.5 text-amber-400" />
                            </div>
                            <div>
                              <span className="text-sm font-medium text-foreground">Order Bump</span>
                              <p className="text-[10px] text-muted-foreground/70 leading-tight">Oferta adicional antes do pagamento</p>
                            </div>
                          </div>
                          <Switch
                            checked={nodeConfigValues.has_order_bump === "true"}
                            onCheckedChange={(checked) =>
                              setNodeConfigValues((prev) => ({ ...prev, has_order_bump: checked ? "true" : "false" }))
                            }
                          />
                        </div>
                        {nodeConfigValues.has_order_bump === "true" && (
                          <div className="flex flex-col gap-3 px-3.5 py-3">
                            {/* Midia opcional */}
                            <div className="flex flex-col gap-1.5">
                              <Label className="text-[10px] font-medium tracking-wide uppercase text-muted-foreground/70">Midia (opcional)</Label>
                              <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-secondary/20 p-3 cursor-pointer hover:border-border transition-colors">
                                <input
                                  type="file"
                                  accept="image/*,video/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0]
                                    if (!file) return
                                    const isVideo = file.type.startsWith("video")
                                    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024
                                    if (file.size > maxSize) return
                                    try {
                                      const formData = new FormData()
                                      formData.append("file", file)
                                      formData.append("mediaType", isVideo ? "video" : "photo")
                                      const res = await fetch("/api/upload-media", { method: "POST", body: formData })
                                      if (res.ok) {
                                        const data = await res.json()
                                        if (data.url) {
                                          setNodeConfigValues((prev) => ({ 
                                            ...prev, 
                                            order_bump_media_url: data.url,
                                            order_bump_media_type: isVideo ? "video" : "photo"
                                          }))
                                        }
                                      }
                                    } catch (err) {
                                      console.error("Upload error:", err)
                                    }
                                  }}
                                />
                                {nodeConfigValues.order_bump_media_url ? (
                                  <div className="relative w-full">
                                    {nodeConfigValues.order_bump_media_type === "video" ? (
                                      <video src={nodeConfigValues.order_bump_media_url} className="w-full h-20 object-cover rounded-lg" />
                                    ) : (
                                      <img src={nodeConfigValues.order_bump_media_url} alt="Preview" className="w-full h-20 object-cover rounded-lg" />
                                    )}
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="icon"
                                      className="absolute top-1 right-1 h-5 w-5"
                                      onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        setNodeConfigValues((prev) => ({ ...prev, order_bump_media_url: "", order_bump_media_type: "" }))
                                      }}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center gap-1.5">
                                    <Upload className="h-5 w-5 text-muted-foreground/50" />
                                    <span className="text-[10px] text-muted-foreground">Clique para enviar foto ou video</span>
                                  </div>
                                )}
                              </label>
                            </div>
                            
                            {/* Descricao da oferta */}
                            <div className="flex flex-col gap-1.5">
                              <Label className="text-[10px] font-medium tracking-wide uppercase text-muted-foreground/70">Descricao da oferta</Label>
                              <Textarea
                                value={nodeConfigValues.order_bump_desc || ""}
                                onChange={(e) =>
                                  setNodeConfigValues((prev) => ({ ...prev, order_bump_desc: e.target.value }))
                                }
                                placeholder="Descreva a oferta adicional que sera apresentada ao usuario"
                                className="bg-secondary/50 border-border/50 rounded-lg text-xs min-h-[60px]"
                              />
                            </div>
                            
                            {/* Valor do Order Bump */}
                            <div className="flex flex-col gap-1.5">
                              <Label className="text-[10px] font-medium tracking-wide uppercase text-muted-foreground/70">Valor do Order Bump</Label>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">R$</span>
                                <Input
                                  type="text"
                                  value={nodeConfigValues.order_bump_amount || ""}
                                  onChange={(e) =>
                                    setNodeConfigValues((prev) => ({ ...prev, order_bump_amount: e.target.value }))
                                  }
                                  placeholder="0,00"
                                  className="bg-secondary/50 border-border/50 rounded-lg text-xs h-8 w-[100px]"
                                />
                              </div>
                            </div>
                            
                            {/* Botoes de aceitar/recusar */}
                            <div className="flex flex-col gap-2">
                              <Label className="text-[10px] font-medium tracking-wide uppercase text-muted-foreground/70">Botoes de decisao</Label>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <div className="h-2 w-2 rounded-full bg-green-500" />
                                    <span className="text-[10px] text-muted-foreground">Aceitar</span>
                                  </div>
                                  <Input
                                    type="text"
                                    value={nodeConfigValues.order_bump_accept_text || ""}
                                    onChange={(e) =>
                                      setNodeConfigValues((prev) => ({ ...prev, order_bump_accept_text: e.target.value }))
                                    }
                                    placeholder="Sim, quero!"
                                    className="bg-secondary/50 border-border/50 rounded-lg text-xs h-8"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <div className="h-2 w-2 rounded-full bg-red-500" />
                                    <span className="text-[10px] text-muted-foreground">Recusar</span>
                                  </div>
                                  <Input
                                    type="text"
                                    value={nodeConfigValues.order_bump_decline_text || ""}
                                    onChange={(e) =>
                                      setNodeConfigValues((prev) => ({ ...prev, order_bump_decline_text: e.target.value }))
                                    }
                                    placeholder="Nao, obrigado"
                                    className="bg-secondary/50 border-border/50 rounded-lg text-xs h-8"
                                  />
                                </div>
                              </div>
                            </div>
                            
                            {/* Informacao sobre comportamento */}
                            <div className="rounded-lg bg-muted/30 border border-border/30 p-2.5">
                              <p className="text-[10px] text-muted-foreground leading-relaxed">
                                <strong>Importante:</strong> Se o usuario recusar, o pagamento sera gerado apenas com o valor do produto original, sem o Order Bump. 
                                O fluxo de Upsells e Downsells continuara normalmente independentemente da decisao.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Upsells e Downsells */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Funil de Ofertas</Label>
                          <span className="text-[10px] text-muted-foreground/60">{upsells.length}/3 upsells</span>
                        </div>
                        
                        {upsells.map((upsell, index) => (
                          <div key={upsell.id} className="flex flex-col gap-2">
                            <OfferForm
                              offer={upsell}
                              index={index}
                              type="upsell"
                              onUpdate={(updated) => {
                                setUpsells(prev => prev.map((u, i) => i === index ? updated as UpsellOffer : u))
                                // If upsell is disabled, also disable corresponding downsell
                                if (!(updated as UpsellOffer).enabled && downsells[index]) {
                                  setDownsells(prev => prev.map((d, i) => i === index ? { ...d, enabled: false } : d))
                                }
                              }}
                              onRemove={() => {
                                if (upsells.length > 1) {
                                  setUpsells(prev => prev.filter((_, i) => i !== index))
                                  setDownsells(prev => prev.filter((_, i) => i !== index))
                                }
                              }}
                              onMediaUpload={(file) => handleOfferMediaUpload(file, "upsell", index)}
                              isUploading={upsellUploadingIndex === index}
                              canRemove={upsells.length > 1}
                              sensors={sensors}
                              activeButtonId={activePaymentButtonId}
                              setActiveButtonId={setActivePaymentButtonId}
                            />
                            
                            {/* Corresponding Downsell */}
                            <OfferForm
                              offer={downsells[index] || createEmptyDownsell()}
                              index={index}
                              type="downsell"
                              onUpdate={(updated) => {
                                setDownsells(prev => {
                                  const newDownsells = [...prev]
                                  newDownsells[index] = updated as DownsellOffer
                                  return newDownsells
                                })
                              }}
                              onRemove={() => {}}
                              onMediaUpload={(file) => handleOfferMediaUpload(file, "downsell", index)}
                              isUploading={downsellUploadingIndex === index}
                              canRemove={false}
                              linkedDownsellEnabled={upsell.enabled}
                              sensors={sensors}
                              activeButtonId={activePaymentButtonId}
                              setActiveButtonId={setActivePaymentButtonId}
                            />
                          </div>
                        ))}
                        
                        {upsells.length < 3 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-xs rounded-lg border-dashed"
                            onClick={() => {
                              setUpsells(prev => [...prev, createEmptyUpsell()])
                              setDownsells(prev => [...prev, createEmptyDownsell()])
                            }}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                            Adicionar Upsell {upsells.length + 1}
                          </Button>
                        )}
                        
                        <p className="text-[10px] text-muted-foreground/60">
                          Configure ate 3 upsells. Cada upsell tem um downsell correspondente que sera enviado se o cliente recusar.
                        </p>
                      </div>
                </div>
              ) : selectedTemplate.configFields.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/40">
                    <CheckCircle2 className="h-6 w-6 text-success/60" />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Este bloco nao precisa de configuracao.
                  </p>
                </div>
              ) : (
                selectedTemplate.configFields.map((field) => (
                  <div key={field.key} className="flex flex-col gap-2.5">
                    <Label className="text-foreground text-sm font-semibold">{field.label}</Label>
                    {field.inputType === "textarea" ? (
                      <Textarea
                        value={nodeConfigValues[field.key] || ""}
                        onChange={(e) =>
                          setNodeConfigValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        placeholder={field.placeholder}
                        className="bg-secondary border-border rounded-xl text-foreground min-h-[100px] text-sm"
                      />
                    ) : (
                      <Input
                        type={field.inputType}
                        value={nodeConfigValues[field.key] || ""}
                        onChange={(e) =>
                          setNodeConfigValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        placeholder={field.placeholder}
                        className="bg-secondary border-border rounded-xl text-foreground h-11 text-sm"
                      />
                    )}
                  </div>
                ))
              )}

              <div className="h-px bg-border/40 mt-2" />
              <div className="flex justify-between gap-3 pt-4">
                <Button
                  variant="ghost"
                  className="rounded-xl text-sm text-muted-foreground h-10 px-4"
                  onClick={() => {
                    setSelectedTemplate(null)
                    resetMessageConfig()
                  }}
                >
                  <ChevronRight className="h-4 w-4 mr-1.5 rotate-180" />
                  Voltar
                </Button>
                <Button
                  className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl text-sm h-10 px-6 font-semibold"
                  disabled={isAddingNode ||
                    (selectedTemplate.type === "message" && !msgText.trim()) ||
                    (selectedTemplate.subVariant === "goto_flow" && !nodeConfigValues.target_flow_id) ||
                    (selectedTemplate.type === "delay" && (!nodeConfigValues.seconds || parseInt(nodeConfigValues.seconds) <= 0)) ||
                    (selectedTemplate.type === "condition" && !nodeConfigValues.condition_message?.trim()) ||
                    (selectedTemplate.type === "action" && selectedTemplate.subVariant === "add_group" && !nodeConfigValues.action_name?.trim()) ||
                    (selectedTemplate.type === "payment" && selectedTemplate.subVariant === "charge" && !paymentButtons.some(b => b.text.trim() && b.amount.trim()))
                  }
                  onClick={handleAddNode}
                >
                  {isAddingNode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Adicionar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---- Edit Node Dialog ---- */}
      <Dialog open={showEditNodeDialog} onOpenChange={setShowEditNodeDialog}>
        <DialogContent className="bg-card border-border rounded-2xl max-w-md max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <DialogHeader>
              <DialogTitle className="text-foreground text-sm font-semibold">Editar etapa</DialogTitle>
            </DialogHeader>
            {editingNode && (
              <p className="text-[11px] text-muted-foreground/50 mt-1">{editingNode.label}</p>
            )}
          </div>
          <div className="h-px bg-border/40 mx-5" />
          {editingNode && (
            <div className="flex flex-col gap-4 px-5 py-4 overflow-y-auto min-h-0">
              {editingNode.type === "message" ? (
                <MessageConfigForm
                  msgText={msgText}
                  setMsgText={setMsgText}
                  msgMediaType={msgMediaType}
                  setMsgMediaType={setMsgMediaType}
                  msgMediaUrl={msgMediaUrl}
                  setMsgMediaUrl={setMsgMediaUrl}
                  msgHasButtons={msgHasButtons}
                  setMsgHasButtons={setMsgHasButtons}
                  msgButtons={msgButtons}
                  addMsgButton={addMsgButton}
                  updateMsgButton={updateMsgButton}
                  removeMsgButton={removeMsgButton}
                />
              ) : editingNode.type === "action" && editingNode.config?.subVariant === "goto_flow" ? (
                <div className="flex flex-col gap-3">
                  <Label className="text-foreground">Selecione o fluxo de destino</Label>
                  {flows.filter((f) => f.id !== activeFlow?.id).length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-6">
                      <Workflow className="h-6 w-6 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground text-center">
                        Nenhum outro fluxo disponivel.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto pr-1">
                      {flows.filter((f) => f.id !== activeFlow?.id).map((f) => {
                        const fCat = getCategoryConfig(f.category)
                        const FCatIcon = fCat.icon
                        const isSelected = editNodeConfig.target_flow_id === f.id
                        return (
                          <button
                            key={f.id}
                            className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all ${
                              isSelected
                                ? `${fCat.color} ring-1 ring-accent`
                                : "border-border bg-secondary/30 hover:bg-secondary/60"
                            }`}
                            onClick={() => {
                              setEditNodeConfig((prev) => ({ ...prev, target_flow_id: f.id, target_flow_name: f.name }))
                              setEditNodeLabel(`Ir para: ${f.name}`)
                            }}
                          >
                            <div className={`flex h-9 w-9 items-center justify-center rounded-lg border shrink-0 ${fCat.color}`}>
                              <FCatIcon className={`h-4 w-4 ${fCat.iconColor}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
                              <p className="text-[11px] text-muted-foreground">{fCat.label}{f.is_primary ? " — Principal" : ""}</p>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : editingNode.type === "delay" ? (
                <div className="flex flex-col gap-3">
                  <Label className="text-foreground">Tempo em segundos</Label>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Defina quanto tempo o fluxo deve aguardar antes de continuar.
                  </p>
                  <Input
                    type="number"
                    value={editNodeConfig.seconds || ""}
                    onChange={(e) =>
                      setEditNodeConfig((prev) => ({ ...prev, seconds: e.target.value }))
                    }
                    placeholder="300"
                    className="bg-secondary border-border rounded-xl text-foreground"
                  />
                  {editNodeConfig.seconds && parseInt(editNodeConfig.seconds) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {(() => {
                        const s = parseInt(editNodeConfig.seconds)
                        if (s >= 3600) return `= ${Math.floor(s / 3600)} hora${Math.floor(s / 3600) > 1 ? "s" : ""} e ${Math.floor((s % 3600) / 60)} min`
                        if (s >= 60) return `= ${Math.floor(s / 60)} minuto${Math.floor(s / 60) > 1 ? "s" : ""}`
                        return `= ${s} segundo${s > 1 ? "s" : ""}`
                      })()}
                    </p>
                  )}
                </div>
              ) : editingNode.type === "condition" ? (
                <div className="flex flex-col gap-4">
                      {/* 1. Mensagem */}
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Mensagem / Pergunta</Label>
                        <Textarea
                          value={editNodeConfig.condition_message || ""}
                          onChange={(e) =>
                            setEditNodeConfig((prev) => ({ ...prev, condition_message: e.target.value }))
                          }
                          placeholder="Ex: Voce gostaria de continuar?"
                          className="bg-secondary/50 border-border/60 rounded-xl text-foreground min-h-[70px] text-sm focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all resize-none"
                        />
                      </div>

                      {/* 2. Botoes - simples: texto + sub-fluxo */}
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Botoes (ate 3)</Label>
                        <div className="flex flex-col gap-2">
                          {(() => {
                            const branchesRaw = editNodeConfig.condition_branches
                            let branches: { label: string; target_flow_id: string }[] = []
                            try { branches = branchesRaw ? JSON.parse(branchesRaw) : [] } catch { branches = [] }
                            if (branches.length === 0) {
                              branches = [{ label: "", target_flow_id: "" }]
                              setTimeout(() => {
                                setEditNodeConfig((prev) => ({ ...prev, condition_branches: JSON.stringify(branches) }))
                              }, 0)
                            }

                            const updateBranch = (idx: number, field: string, value: string) => {
                              const updated = [...branches]
                              ;(updated[idx] as Record<string, unknown>)[field] = value
                              setEditNodeConfig((prev) => ({ ...prev, condition_branches: JSON.stringify(updated) }))
                            }
                            const removeBranch = (idx: number) => {
                              const updated = branches.filter((_, i) => i !== idx)
                              setEditNodeConfig((prev) => ({ ...prev, condition_branches: JSON.stringify(updated) }))
                            }
                            const addBranch = () => {
                              if (branches.length >= 3) return
                              const updated = [...branches, { label: "", target_flow_id: "" }]
                              setEditNodeConfig((prev) => ({ ...prev, condition_branches: JSON.stringify(updated) }))
                            }

                            const colors = [
                              { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", dot: "bg-emerald-400" },
                              { bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-400", dot: "bg-rose-400" },
                              { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", dot: "bg-amber-400" },
                            ]

                            // Fluxos disponiveis (exceto o atual)
                            const availableFlows = flows.filter((f) => f.id !== activeFlow?.id)

                            return (
                              <>
                                {branches.map((branch, idx) => {
                                  const color = colors[idx % colors.length]
                                  return (
                                    <div key={idx} className={`flex flex-col gap-3 rounded-xl border ${color.border} ${color.bg} p-3`}>
                                      {/* Texto do botao */}
                                      <div className="flex items-center gap-2">
                                        <div className={`h-2.5 w-2.5 rounded-full ${color.dot} shrink-0`} />
                                        <Input
                                          value={branch.label}
                                          onChange={(e) => updateBranch(idx, "label", e.target.value)}
                                          placeholder={`Texto do botao ${idx + 1}`}
                                          className="bg-transparent border-0 p-0 h-auto text-sm font-medium text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
                                        />
                                        {branches.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => removeBranch(idx)}
                                            className="text-muted-foreground/50 hover:text-destructive transition-colors"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        )}
                                      </div>

                                      {/* Sub-fluxo (select dos fluxos ja criados) */}
                                      <div className="flex flex-col gap-1.5">
                                        <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wide">Sub-fluxo</span>
                                        <Select
                                          value={branch.target_flow_id || ""}
                                          onValueChange={(val) => updateBranch(idx, "target_flow_id", val)}
                                        >
                                          <SelectTrigger className="bg-background/50 border-border/40 rounded-lg h-9 text-sm">
                                            <SelectValue placeholder="Selecione um fluxo..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {availableFlows.length === 0 ? (
                                              <div className="px-3 py-2 text-xs text-muted-foreground">
                                                Nenhum outro fluxo disponivel
                                              </div>
                                            ) : (
                                              availableFlows.map((f) => {
                                                const catCfg = getCategoryConfig(f.category)
                                                return (
                                                  <SelectItem key={f.id} value={f.id}>
                                                    <div className="flex items-center gap-2">
                                                      <catCfg.icon className={`h-3 w-3 ${catCfg.iconColor}`} />
                                                      <span>{f.name}</span>
                                                    </div>
                                                  </SelectItem>
                                                )
                                              })
                                            )}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                  )
                                })}

                                {branches.length < 3 && (
                                  <button
                                    type="button"
                                    onClick={addBranch}
                                    className="flex items-center justify-center gap-1.5 w-full rounded-xl border border-dashed border-border/50 text-muted-foreground text-xs py-2.5 hover:bg-secondary/30 transition-colors"
                                  >
                                    <Plus className="h-3 w-3" />
                                    Adicionar botao
                                  </button>
                                )}

                                <p className="text-[10px] text-muted-foreground/60">
                                  Maximo de 3 botoes por condicao
                                </p>
                              </>
                            )
                          })()}
                        </div>
                      </div>
                </div>
              ) : editingNode.type === "payment" ? (
                <div className="flex flex-col gap-4">
                      {/* Nome da etapa */}
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Nome da Etapa</Label>
                        <Input
                          type="text"
                          value={editNodeLabel}
                          onChange={(e) => setEditNodeLabel(e.target.value)}
                          placeholder="Ex: Pagamento Premium"
                          className="bg-secondary/50 border-border/60 rounded-xl text-foreground h-10 text-sm"
                        />
                        <p className="text-[10px] text-muted-foreground/60">Nome que aparece no card da etapa no fluxo</p>
                      </div>

                      {/* Mensagem acima dos botoes */}
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Mensagem</Label>
                        <Textarea
                          value={editNodeConfig.payment_message || ""}
                          onChange={(e) => setEditNodeConfig((prev) => ({ ...prev, payment_message: e.target.value }))}
                          placeholder="Escolha seu plano para liberar o acesso:"
                          className="bg-secondary/50 border-border/60 rounded-xl text-foreground min-h-[70px] text-sm"
                        />
                        <p className="text-[10px] text-muted-foreground/60">Texto que aparece acima dos botoes de plano</p>
                      </div>

                      {/* Botoes de pagamento com drag and drop */}
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Botoes de Pagamento</Label>
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragStart={(event) => setActivePaymentButtonId(event.active.id as string)}
                          onDragEnd={(event) => {
                            setActivePaymentButtonId(null)
                            const { active, over } = event
                            if (!over || active.id === over.id) return
                            const oldIndex = editPaymentButtons.findIndex((b) => b.id === active.id)
                            const newIndex = editPaymentButtons.findIndex((b) => b.id === over.id)
                            if (oldIndex !== -1 && newIndex !== -1) {
                              const reordered = arrayMove(editPaymentButtons, oldIndex, newIndex)
                              setEditPaymentButtons(reordered)
                              setEditNodeConfig((prev) => ({ ...prev, payment_buttons: JSON.stringify(reordered) }))
                            }
                          }}
                        >
                          <SortableContext items={editPaymentButtons.map(b => b.id)} strategy={verticalListSortingStrategy}>
                            <div className="flex flex-col gap-2">
                              {editPaymentButtons.map((btn, index) => (
                                <SortablePaymentButton
                                  key={btn.id}
                                  button={btn}
                                  index={index}
                                  onUpdate={(field, value) => {
                                    const updated = editPaymentButtons.map(b => b.id === btn.id ? { ...b, [field]: value } : b)
                                    setEditPaymentButtons(updated)
                                    setEditNodeConfig((prev) => ({ ...prev, payment_buttons: JSON.stringify(updated) }))
                                  }}
                                  onDelete={() => {
                                    if (editPaymentButtons.length > 1) {
                                      const updated = editPaymentButtons.filter(b => b.id !== btn.id)
                                      setEditPaymentButtons(updated)
                                      setEditNodeConfig((prev) => ({ ...prev, payment_buttons: JSON.stringify(updated) }))
                                    }
                                  }}
                                  canDelete={editPaymentButtons.length > 1}
                                />
                              ))}
                            </div>
                          </SortableContext>
                          <DragOverlay>
                            {activePaymentButtonId ? (
                              <div className="rounded-xl border border-primary/50 bg-card p-3 shadow-lg">
                                <div className="flex items-center gap-2">
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm text-foreground">
                                    {editPaymentButtons.find(b => b.id === activePaymentButtonId)?.text || "Botao"}
                                  </span>
                                </div>
                              </div>
                            ) : null}
                          </DragOverlay>
                        </DndContext>
                        
                        {/* Adicionar novo botao */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-1 text-xs rounded-lg border-dashed"
                          onClick={() => {
                            const newBtn = { id: crypto.randomUUID(), text: "", amount: "" }
                            const updated = [...editPaymentButtons, newBtn]
                            setEditPaymentButtons(updated)
                            setEditNodeConfig((prev) => ({ ...prev, payment_buttons: JSON.stringify(updated) }))
                          }}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1.5" />
                          Adicionar novo botao
                        </Button>
                        <p className="text-[10px] text-muted-foreground/60">Arraste para reorganizar a ordem dos botoes.</p>
                      </div>

                      {/* Order Bump */}
                      <div className="flex flex-col rounded-xl border border-border/60 overflow-hidden">
                        <div className={`flex items-center justify-between px-3.5 py-2.5 ${editNodeConfig.has_order_bump === "true" ? "bg-amber-500/5" : "bg-secondary/20"}`}>
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
                              <Plus className="h-3.5 w-3.5 text-amber-400" />
                            </div>
                            <div>
                              <span className="text-sm font-medium text-foreground">Order Bump</span>
                              <p className="text-[10px] text-muted-foreground/70 leading-tight">Oferta adicional antes do pagamento</p>
                            </div>
                          </div>
                          <Switch
                            checked={editNodeConfig.has_order_bump === "true"}
                            onCheckedChange={(checked) =>
                              setEditNodeConfig((prev) => ({ ...prev, has_order_bump: checked ? "true" : "false" }))
                            }
                          />
                        </div>
                        {editNodeConfig.has_order_bump === "true" && (
                          <div className="flex flex-col gap-3 px-3.5 py-3">
                            {/* Midia opcional */}
                            <div className="flex flex-col gap-1.5">
                              <Label className="text-[10px] font-medium tracking-wide uppercase text-muted-foreground/70">Midia (opcional)</Label>
                              <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-secondary/20 p-3 cursor-pointer hover:border-border transition-colors">
                                <input
                                  type="file"
                                  accept="image/*,video/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0]
                                    if (!file) return
                                    const isVideo = file.type.startsWith("video")
                                    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024
                                    if (file.size > maxSize) return
                                    try {
                                      const formData = new FormData()
                                      formData.append("file", file)
                                      formData.append("mediaType", isVideo ? "video" : "photo")
                                      const res = await fetch("/api/upload-media", { method: "POST", body: formData })
                                      if (res.ok) {
                                        const data = await res.json()
                                        if (data.url) {
                                          setEditNodeConfig((prev) => ({ 
                                            ...prev, 
                                            order_bump_media_url: data.url,
                                            order_bump_media_type: isVideo ? "video" : "photo"
                                          }))
                                        }
                                      }
                                    } catch (err) {
                                      console.error("Upload error:", err)
                                    }
                                  }}
                                />
                                {editNodeConfig.order_bump_media_url ? (
                                  <div className="relative w-full">
                                    {editNodeConfig.order_bump_media_type === "video" ? (
                                      <video src={editNodeConfig.order_bump_media_url} className="w-full h-20 object-cover rounded-lg" />
                                    ) : (
                                      <img src={editNodeConfig.order_bump_media_url} alt="Preview" className="w-full h-20 object-cover rounded-lg" />
                                    )}
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="icon"
                                      className="absolute top-1 right-1 h-5 w-5"
                                      onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        setEditNodeConfig((prev) => ({ ...prev, order_bump_media_url: "", order_bump_media_type: "" }))
                                      }}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center gap-1.5">
                                    <Upload className="h-5 w-5 text-muted-foreground/50" />
                                    <span className="text-[10px] text-muted-foreground">Clique para enviar foto ou video</span>
                                  </div>
                                )}
                              </label>
                            </div>
                            
                            {/* Descricao da oferta */}
                            <div className="flex flex-col gap-1.5">
                              <Label className="text-[10px] font-medium tracking-wide uppercase text-muted-foreground/70">Descricao da oferta</Label>
                              <Textarea
                                value={editNodeConfig.order_bump_desc || ""}
                                onChange={(e) =>
                                  setEditNodeConfig((prev) => ({ ...prev, order_bump_desc: e.target.value }))
                                }
                                placeholder="Descreva a oferta adicional que sera apresentada ao usuario"
                                className="bg-secondary/50 border-border/50 rounded-lg text-xs min-h-[60px]"
                              />
                            </div>
                            
                            {/* Valor do Order Bump */}
                            <div className="flex flex-col gap-1.5">
                              <Label className="text-[10px] font-medium tracking-wide uppercase text-muted-foreground/70">Valor do Order Bump</Label>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">R$</span>
                                <Input
                                  type="text"
                                  value={editNodeConfig.order_bump_amount || ""}
                                  onChange={(e) =>
                                    setEditNodeConfig((prev) => ({ ...prev, order_bump_amount: e.target.value }))
                                  }
                                  placeholder="0,00"
                                  className="bg-secondary/50 border-border/50 rounded-lg text-xs h-8 w-[100px]"
                                />
                              </div>
                            </div>
                            
                            {/* Botoes de aceitar/recusar */}
                            <div className="flex flex-col gap-2">
                              <Label className="text-[10px] font-medium tracking-wide uppercase text-muted-foreground/70">Botoes de decisao</Label>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <div className="h-2 w-2 rounded-full bg-green-500" />
                                    <span className="text-[10px] text-muted-foreground">Aceitar</span>
                                  </div>
                                  <Input
                                    type="text"
                                    value={editNodeConfig.order_bump_accept_text || ""}
                                    onChange={(e) =>
                                      setEditNodeConfig((prev) => ({ ...prev, order_bump_accept_text: e.target.value }))
                                    }
                                    placeholder="Sim, quero!"
                                    className="bg-secondary/50 border-border/50 rounded-lg text-xs h-8"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <div className="h-2 w-2 rounded-full bg-red-500" />
                                    <span className="text-[10px] text-muted-foreground">Recusar</span>
                                  </div>
                                  <Input
                                    type="text"
                                    value={editNodeConfig.order_bump_decline_text || ""}
                                    onChange={(e) =>
                                      setEditNodeConfig((prev) => ({ ...prev, order_bump_decline_text: e.target.value }))
                                    }
                                    placeholder="Nao, obrigado"
                                    className="bg-secondary/50 border-border/50 rounded-lg text-xs h-8"
                                  />
                                </div>
                              </div>
                            </div>
                            
                            {/* Informacao sobre comportamento */}
                            <div className="rounded-lg bg-muted/30 border border-border/30 p-2.5">
                              <p className="text-[10px] text-muted-foreground leading-relaxed">
                                <strong>Importante:</strong> Se o usuario recusar, o pagamento sera gerado apenas com o valor do produto original, sem o Order Bump. 
                                O fluxo de Upsells e Downsells continuara normalmente independentemente da decisao.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Upsells e Downsells */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Funil de Ofertas</Label>
                          <span className="text-[10px] text-muted-foreground/60">{editUpsells.length}/3 upsells</span>
                        </div>
                        
                        {editUpsells.map((upsell, index) => (
                          <div key={upsell.id} className="flex flex-col gap-2">
                            <OfferForm
                              offer={upsell}
                              index={index}
                              type="upsell"
                              onUpdate={(updated) => {
                                const newUpsells = editUpsells.map((u, i) => i === index ? updated as UpsellOffer : u)
                                setEditUpsells(newUpsells)
                                setEditNodeConfig((prev) => ({ ...prev, upsells: JSON.stringify(newUpsells) }))
                                // If upsell is disabled, also disable corresponding downsell
                                if (!(updated as UpsellOffer).enabled && editDownsells[index]) {
                                  const newDownsells = editDownsells.map((d, i) => i === index ? { ...d, enabled: false } : d)
                                  setEditDownsells(newDownsells)
                                  setEditNodeConfig((prev) => ({ ...prev, downsells: JSON.stringify(newDownsells) }))
                                }
                              }}
                              onRemove={() => {
                                if (editUpsells.length > 1) {
                                  const newUpsells = editUpsells.filter((_, i) => i !== index)
                                  const newDownsells = editDownsells.filter((_, i) => i !== index)
                                  setEditUpsells(newUpsells)
                                  setEditDownsells(newDownsells)
                                  setEditNodeConfig((prev) => ({ 
                                    ...prev, 
                                    upsells: JSON.stringify(newUpsells),
                                    downsells: JSON.stringify(newDownsells)
                                  }))
                                }
                              }}
                              onMediaUpload={(file) => handleOfferMediaUpload(file, "upsell", index, true)}
                              isUploading={upsellUploadingIndex === index}
                              canRemove={editUpsells.length > 1}
                              sensors={sensors}
                              activeButtonId={activePaymentButtonId}
                              setActiveButtonId={setActivePaymentButtonId}
                            />
                            
                            {/* Corresponding Downsell */}
                            <OfferForm
                              offer={editDownsells[index] || createEmptyDownsell()}
                              index={index}
                              type="downsell"
                              onUpdate={(updated) => {
                                const newDownsells = [...editDownsells]
                                newDownsells[index] = updated as DownsellOffer
                                setEditDownsells(newDownsells)
                                setEditNodeConfig((prev) => ({ ...prev, downsells: JSON.stringify(newDownsells) }))
                              }}
                              onRemove={() => {}}
                              onMediaUpload={(file) => handleOfferMediaUpload(file, "downsell", index, true)}
                              isUploading={downsellUploadingIndex === index}
                              canRemove={false}
                              linkedDownsellEnabled={upsell.enabled}
                              sensors={sensors}
                              activeButtonId={activePaymentButtonId}
                              setActiveButtonId={setActivePaymentButtonId}
                            />
                          </div>
                        ))}
                        
                        {editUpsells.length < 3 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-xs rounded-lg border-dashed"
                            onClick={() => {
                              const newUpsell = createEmptyUpsell()
                              const newDownsell = createEmptyDownsell()
                              const newUpsells = [...editUpsells, newUpsell]
                              const newDownsells = [...editDownsells, newDownsell]
                              setEditUpsells(newUpsells)
                              setEditDownsells(newDownsells)
                              setEditNodeConfig((prev) => ({ 
                                ...prev, 
                                upsells: JSON.stringify(newUpsells),
                                downsells: JSON.stringify(newDownsells)
                              }))
                            }}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                            Adicionar Upsell {editUpsells.length + 1}
                          </Button>
                        )}
                        
                        <p className="text-[10px] text-muted-foreground/60">
                          Configure ate 3 upsells. Cada upsell tem um downsell correspondente.
                        </p>
                      </div>
                </div>
              ) : editingNode.type === "action" ? (
                <div className="flex flex-col gap-3">
                  <Label className="text-foreground">
                    {(editingNode.config?.subVariant as string) === "add_group" ? "Link do grupo" : "Valor"}
                  </Label>
                  <Input
                    type="text"
                    value={editNodeConfig.action_name || ""}
                    onChange={(e) =>
                      setEditNodeConfig((prev) => ({ ...prev, action_name: e.target.value }))
                    }
                    placeholder={
                      (editingNode.config?.subVariant as string) === "add_group" ? "https://t.me/grupo" : "Valor"
                    }
                    className="bg-secondary border-border rounded-xl text-foreground"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Label className="text-foreground">Label</Label>
                  <Input
                    value={editNodeLabel}
                    onChange={(e) => setEditNodeLabel(e.target.value)}
                    className="bg-secondary border-border rounded-xl text-foreground"
                  />
                </div>
              )}

              <div className="h-px bg-border/40" />
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-lg text-xs text-muted-foreground"
                  onClick={() => {
                    resetMessageConfig()
                    setShowEditNodeDialog(false)
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg text-xs"
                  disabled={isSavingNode || (
                    editingNode.type === "message" ? !msgText.trim() :
                    editingNode.type === "delay" ? !editNodeConfig.seconds || parseInt(editNodeConfig.seconds) <= 0 :
                    editingNode.type === "condition" ? !editNodeConfig.condition_message?.trim() :
                    editingNode.type === "action" && editingNode.config?.subVariant === "end" ? false :
                    editingNode.type === "action" && editingNode.config?.subVariant === "goto_flow" ? !editNodeConfig.target_flow_id :
                    editingNode.type === "action" && editingNode.config?.subVariant === "add_group" ? !editNodeConfig.action_name?.trim() :
                    editingNode.type === "payment" && (editingNode.config?.subVariant as string) === "charge" ? !editPaymentButtons.some(b => b.text.trim() && b.amount.trim()) :
                    false
                  )}
                  onClick={handleSaveNode}
                >
                  {isSavingNode && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---- Delete Node Dialog ---- */}
      <Dialog open={showDeleteNodeDialog} onOpenChange={setShowDeleteNodeDialog}>
        <DialogContent className="bg-card border-border rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground text-sm font-semibold">Apagar etapa</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Apagar <span className="font-medium text-foreground">{deletingNode?.label}</span>? Essa acao nao pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-lg text-xs text-muted-foreground"
              onClick={() => setShowDeleteNodeDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="rounded-lg text-xs"
              disabled={isDeletingNode}
              onClick={handleDeleteNode}
            >
              {isDeletingNode && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Apagar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---- Delete Flow Dialog ---- */}
      <Dialog open={showDeleteFlowDialog} onOpenChange={setShowDeleteFlowDialog}>
        <DialogContent className="bg-card border-border rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground text-sm font-semibold">Apagar fluxo</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Apagar <span className="font-medium text-foreground">{activeFlow?.name}</span> e todas as suas etapas? Essa acao nao pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-lg text-xs text-muted-foreground"
              onClick={() => setShowDeleteFlowDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="rounded-lg text-xs"
              disabled={isDeletingFlow}
              onClick={handleDeleteFlow}
            >
              {isDeletingFlow && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Apagar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---- Message Config Form ----

function MessageConfigForm({
  msgText,
  setMsgText,
  msgMediaType,
  setMsgMediaType,
  msgMediaUrl,
  setMsgMediaUrl,
  msgHasButtons,
  setMsgHasButtons,
  msgButtons,
  addMsgButton,
  updateMsgButton,
  removeMsgButton,
}: {
  msgText: string
  setMsgText: (v: string) => void
  msgMediaType: "photo" | "video" | "none"
  setMsgMediaType: (v: "photo" | "video" | "none") => void
  msgMediaUrl: string
  setMsgMediaUrl: (v: string) => void
  msgHasButtons: boolean
  setMsgHasButtons: (v: boolean) => void
  msgButtons: InlineButton[]
  addMsgButton: () => void
  updateMsgButton: (index: number, field: "text" | "url", value: string) => void
  removeMsgButton: (index: number) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const [fileName, setFileName] = useState("")

  async function handleFileUpload(file: File) {
    setUploading(true)
    setUploadError("")
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("mediaType", msgMediaType)

      const res = await fetch("/api/upload-media", { method: "POST", body: formData })
      const data = await res.json()

      if (!res.ok) {
        setUploadError(data.error || "Erro ao fazer upload")
        return
      }

      setMsgMediaUrl(data.url)
      setFileName(file.name)
    } catch {
      setUploadError("Erro de conexao ao fazer upload")
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }

  const mediaEnabled = msgMediaType !== "none"

  return (
    <div className="flex flex-col gap-4">
      {/* Texto da mensagem */}
      <div className="flex flex-col gap-2">
        <Label className="text-foreground text-xs font-medium tracking-wide uppercase text-muted-foreground">Mensagem</Label>
        <Textarea
          value={msgText}
          onChange={(e) => setMsgText(e.target.value)}
          placeholder="Digite a mensagem que o bot vai enviar..."
          className="bg-secondary/50 border-border/60 rounded-xl text-foreground min-h-[90px] text-sm focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all resize-none"
        />
      </div>

      {/* Switches compactos */}
      <div className="flex flex-col gap-0 rounded-xl border border-border/60 overflow-hidden">
        {/* Switch Midia */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-secondary/20">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10">
                <Image className="h-3.5 w-3.5 text-blue-400" />
              </div>
              <div>
                <span className="text-sm font-medium text-foreground">Midia</span>
                <p className="text-[10px] text-muted-foreground/70 leading-tight">Anexar foto ou video</p>
              </div>
            </div>
            <Switch
              checked={mediaEnabled}
              onCheckedChange={(checked) => {
                if (checked) {
                  setMsgMediaType("photo")
                } else {
                  setMsgMediaType("none")
                  setMsgMediaUrl("")
                  setFileName("")
                  setUploadError("")
                }
              }}
            />
          </div>

          {mediaEnabled && (
            <div className="flex flex-col gap-2.5 px-3.5 pb-3 pt-1">
              <div className="flex gap-1.5">
                <button
                  onClick={() => setMsgMediaType("photo")}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    msgMediaType === "photo"
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "bg-secondary/50 text-muted-foreground border border-border/40 hover:bg-secondary"
                  }`}
                >
                  <Image className="h-3 w-3" /> Foto
                </button>
                <button
                  onClick={() => setMsgMediaType("video")}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    msgMediaType === "video"
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "bg-secondary/50 text-muted-foreground border border-border/40 hover:bg-secondary"
                  }`}
                >
                  <Video className="h-3 w-3" /> Video
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept={msgMediaType === "photo" ? "image/jpeg,image/png,image/gif,image/webp" : "video/mp4,video/webm,video/quicktime"}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileUpload(file)
                  e.target.value = ""
                }}
              />

              {msgMediaUrl ? (
                <div className="flex flex-col gap-1.5">
                  {msgMediaType === "photo" ? (
                    <div className="relative rounded-lg overflow-hidden border border-border/50 bg-secondary/30">
                      <img src={msgMediaUrl} alt="Preview" className="w-full max-h-[120px] object-cover" />
                    </div>
                  ) : (
                    <div className="relative rounded-lg overflow-hidden border border-border/50 bg-secondary/30">
                      <video src={msgMediaUrl} className="w-full max-h-[120px] object-cover" controls />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <FileCheck className="h-3 w-3 text-green-500 shrink-0" />
                      <span className="text-[11px] text-muted-foreground truncate">{fileName || "Arquivo enviado"}</span>
                    </div>
                    <button
                      className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => {
                        setMsgMediaUrl("")
                        setFileName("")
                      }}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-5 cursor-pointer transition-all ${
                    uploading
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/50 hover:border-primary/30 hover:bg-secondary/30"
                  }`}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                      <span className="text-xs text-muted-foreground">Enviando...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5 text-muted-foreground/60" />
                      <span className="text-xs text-muted-foreground text-center">
                        Clique ou arraste {msgMediaType === "photo" ? "uma foto" : "um video"}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50">
                        {msgMediaType === "photo" ? "JPG, PNG, GIF, WEBP" : "MP4, WEBM, MOV"} - Max 50MB
                      </span>
                    </>
                  )}
                </div>
              )}

              {uploadError && (
                <p className="text-[11px] text-destructive">{uploadError}</p>
              )}
            </div>
          )}
        </div>

        {/* Divisor */}
        <div className="h-px bg-border/40" />

        {/* Switch Botoes */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-secondary/20">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10">
                <Link className="h-3.5 w-3.5 text-purple-400" />
              </div>
              <div>
                <span className="text-sm font-medium text-foreground">Botoes</span>
                <p className="text-[10px] text-muted-foreground/70 leading-tight">Adicionar botoes com link</p>
              </div>
            </div>
            <Switch
              checked={msgHasButtons}
              onCheckedChange={(checked) => {
                setMsgHasButtons(checked)
                if (checked && msgButtons.length === 0) {
                  addMsgButton()
                }
              }}
            />
          </div>

          {msgHasButtons && (
            <div className="flex flex-col gap-2.5 px-3.5 pb-3 pt-1">
              {msgButtons.map((btn, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-border/40 bg-secondary/20 p-2.5">
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Input
                      value={btn.text}
                      onChange={(e) => updateMsgButton(i, "text", e.target.value)}
                      placeholder="Titulo do botao"
                      className="bg-secondary/50 border-border/50 rounded-lg text-foreground text-xs h-8"
                    />
                    <Input
                      value={btn.url}
                      onChange={(e) => updateMsgButton(i, "url", e.target.value)}
                      placeholder="https://link-do-botao.com"
                      className="bg-secondary/50 border-border/50 rounded-lg text-foreground text-xs h-8"
                    />
                  </div>
                  <button
                    className="mt-1 text-muted-foreground/60 hover:text-destructive transition-colors"
                    onClick={() => removeMsgButton(i)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {msgButtons.length < 6 && (
                <button
                  className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-dashed border-border/40 text-muted-foreground text-xs py-2 hover:bg-secondary/30 transition-colors"
                  onClick={addMsgButton}
                >
                  <Plus className="h-3 w-3" />
                  Adicionar botao
                </button>
              )}
              <p className="text-[10px] text-muted-foreground/60">
                Max. 6 botoes por mensagem
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

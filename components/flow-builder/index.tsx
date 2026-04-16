"use client"

import { useState, useCallback, useRef, useMemo, DragEvent } from "react"
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
  useReactFlow,
  Panel,
  BackgroundVariant,
  Handle,
  Position,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

// Custom styles for handles
const handleStyles = `
  .react-flow__handle {
    width: 12px !important;
    height: 12px !important;
    border-radius: 50% !important;
    background-color: #10b981 !important;
    border: 2px solid hsl(var(--background)) !important;
  }
  .react-flow__handle:hover {
    transform: scale(1.3);
    background-color: #34d399 !important;
  }
  .react-flow__handle-top {
    top: -6px !important;
  }
  .react-flow__handle-bottom {
    bottom: -6px !important;
  }
  .react-flow__connection-line {
    stroke: #10b981 !important;
    stroke-width: 2px !important;
  }
  .react-flow__edge-path {
    stroke: #10b981 !important;
    stroke-width: 2px !important;
  }
`
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  MessageCircle, Type, Image as ImageIcon, Video, Mic, FileText, Circle,
  Keyboard, MessageSquare, MapPin, Clock, Zap, Shuffle, CornerDownRight,
  CreditCard, ShoppingBag, TrendingUp, TrendingDown, Users, Play,
  GripVertical, ChevronLeft, ChevronRight, Send, Plus, Trash2, Copy,
  Undo, Redo, Search, BarChart3, Settings, Save, Maximize2, HelpCircle,
  Upload, X
} from "lucide-react"

// Block Types Definition
const BLOCK_CATEGORIES = [
  {
    id: "communication",
    label: "COMUNICACAO",
    blocks: [
      { type: "message", label: "Mensagem...", icon: MessageCircle, color: "emerald", isNew: true },
      { type: "text", label: "Texto", icon: Type, color: "emerald" },
      { type: "image", label: "Imagem", icon: ImageIcon, color: "emerald" },
      { type: "video", label: "Video", icon: Video, color: "red" },
      { type: "audio", label: "Audio", icon: Mic, color: "purple" },
      { type: "file", label: "Arquivo", icon: FileText, color: "blue" },
      { type: "buttons", label: "Botoes", icon: MessageSquare, color: "pink" },
      { type: "input", label: "Input do Usuario", icon: MessageSquare, color: "blue" },
    ],
  },
  {
    id: "timing",
    label: "TEMPO",
    blocks: [
      { type: "delay", label: "Atraso", icon: Clock, color: "amber" },
      { type: "randomizer", label: "Randomizer", icon: Shuffle, color: "purple" },
    ],
  },
  {
    id: "payment",
    label: "PAGAMENTO",
    blocks: [
      { type: "pix", label: "Gerar PIX", icon: CreditCard, color: "emerald" },
      { type: "order_bump", label: "Order Bump", icon: ShoppingBag, color: "amber" },
    ],
  },
  {
    id: "sequences",
    label: "SEQUENCIAS",
    blocks: [
      { type: "upsell", label: "Upsell", icon: TrendingUp, color: "emerald" },
      { type: "downsell", label: "Downsell", icon: TrendingDown, color: "red" },
    ],
  },
  {
    id: "delivery",
    label: "ENTREGA",
    blocks: [
      { type: "temp_group", label: "Grupo Temporario", icon: Users, color: "blue" },
    ],
  },
]

// Get block config by type
const getBlockConfig = (type: string) => {
  for (const category of BLOCK_CATEGORIES) {
    const block = category.blocks.find((b) => b.type === type)
    if (block) return block
  }
  return null
}

// Custom Node Component
function CustomNode({ id, data, selected }: { id: string; data: any; selected: boolean }) {
  const config = getBlockConfig(data.type)
  if (!config) return null

  const Icon = config.icon
  const colorMap: Record<string, string> = {
    emerald: "border-emerald-500 bg-emerald-500/10",
    red: "border-red-500 bg-red-500/10",
    amber: "border-amber-500 bg-amber-500/10",
    blue: "border-blue-500 bg-blue-500/10",
    purple: "border-purple-500 bg-purple-500/10",
    pink: "border-pink-500 bg-pink-500/10",
  }
  const iconColorMap: Record<string, string> = {
    emerald: "text-emerald-500",
    red: "text-red-500",
    amber: "text-amber-500",
    blue: "text-blue-500",
    purple: "text-purple-500",
    pink: "text-pink-500",
  }

  const isStart = data.type === "start"

  if (isStart) {
    return (
      <div
        className={`rounded-lg border-2 border-emerald-500 bg-emerald-500/10 px-4 py-3 min-w-[140px] relative ${
          selected ? "ring-2 ring-accent ring-offset-2 ring-offset-background" : ""
        }`}
      >
        <div className="flex items-center gap-2">
          <Play className="h-4 w-4 text-emerald-500" />
          <div>
            <p className="font-medium text-sm">Inicio</p>
            <p className="text-[10px] text-muted-foreground">Quando o usuario inicia</p>
          </div>
        </div>
        <Handle
          type="source"
          position={Position.Bottom}
          id="source"
          className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background"
        />
      </div>
    )
  }

  // Image node
  if (data.type === "image") {
    return (
      <div
        className={`rounded-lg border-2 ${colorMap[config.color]} min-w-[180px] relative ${
          selected ? "ring-2 ring-accent ring-offset-2 ring-offset-background" : ""
        }`}
      >
        <Handle
          type="target"
          position={Position.Top}
          id="target"
          className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background"
        />
        
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${iconColorMap[config.color]}`} />
            <span className="font-medium text-sm">{data.label || config.label} {data.index || ""}</span>
          </div>
          <button type="button" className="p-1 hover:bg-destructive/20 rounded">
            <Trash2 className="h-3 w-3 text-destructive" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 space-y-2">
          <div className="border-2 border-dashed border-border/50 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500/50 transition-colors">
            <Upload className="h-5 w-5 text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Arraste ou clique</p>
            <p className="text-[10px] text-muted-foreground">para fazer upload</p>
          </div>
          <Input placeholder="Legenda (opcional)" className="bg-secondary/30 text-xs h-8" />
        </div>

        <Handle
          type="source"
          position={Position.Bottom}
          id="source"
          className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background"
        />
      </div>
    )
  }

  // PIX node
  if (data.type === "pix") {
    return (
      <div
        className={`rounded-lg border-2 ${colorMap[config.color]} min-w-[280px] max-w-[320px] relative ${
          selected ? "ring-2 ring-accent ring-offset-2 ring-offset-background" : ""
        }`}
      >
        <Handle
          type="target"
          position={Position.Top}
          id="target"
          className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background"
        />
        
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
          <div>
            <div className="flex items-center gap-2">
              <Icon className={`h-4 w-4 ${iconColorMap[config.color]}`} />
              <span className="font-medium text-sm">PIX {data.index || 1}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">QR Code + Copia e Cola</p>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-1 hover:bg-secondary/50 rounded">
              <Copy className="h-3 w-3 text-muted-foreground" />
            </button>
            <button className="p-1 hover:bg-destructive/20 rounded">
              <Trash2 className="h-3 w-3 text-destructive" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 space-y-3 max-h-[400px] overflow-y-auto">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nome do Plano</Label>
            <Input placeholder="Ex: Acesso Premium" className="bg-secondary/30 text-xs h-8" />
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
            <Input type="number" placeholder="0" className="bg-secondary/30 text-xs h-8" defaultValue="0" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Duracao do Acesso</Label>
            <Select defaultValue="monthly">
              <SelectTrigger className="bg-secondary/30 text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Diario (1 dia)</SelectItem>
                <SelectItem value="weekly">Semanal (7 dias)</SelectItem>
                <SelectItem value="monthly">Mensal (30 dias)</SelectItem>
                <SelectItem value="yearly">Anual (365 dias)</SelectItem>
                <SelectItem value="lifetime">Vitalicio</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Formato do Codigo PIX</Label>
            <Select defaultValue="code">
              <SelectTrigger className="bg-secondary/30 text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="code">{'<>'} Bloco de codigo</SelectItem>
                <SelectItem value="text">Texto normal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="p-2 bg-secondary/20 rounded text-xs font-mono text-muted-foreground">
            ...<br />
            00020126...
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs">Mostrar Botao QR Code</span>
              <Switch defaultChecked className="scale-75" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs">Mostrar Botao Copia e Cola</span>
              <Switch defaultChecked className="scale-75" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs">Mostrar Plano Antes do PIX</span>
                <p className="text-[10px] text-muted-foreground">Exibe detalhes do plano antes de gerar o codigo PIX</p>
              </div>
              <Switch className="scale-75" />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-border/50">
            <p className="text-xs text-emerald-500 font-medium">Mensagens Personalizadas</p>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Mensagem antes do codigo</Label>
              <Input placeholder="Ex: Copie o codigo abaixo:" className="bg-secondary/30 text-xs h-8" />
              <p className="text-[10px] text-muted-foreground">Padrao: "Copie o codigo abaixo:"</p>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Mensagem apos o codigo</Label>
              <Textarea placeholder="Ex: Apos efetuar o pagamento, clique no botao abaixo" className="bg-secondary/30 text-xs min-h-[60px]" />
              <p className="text-[10px] text-muted-foreground">Padrao: "Apos efetuar o pagamento, clique no botao abaixo"</p>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-border/50">
            <p className="text-xs text-emerald-500 font-medium">Botoes Personalizados</p>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Texto do botao "Verificar"</Label>
              <Input placeholder="Ex: CONFIRMAR PAGAMENTO" className="bg-secondary/30 text-xs h-8" />
              <p className="text-[10px] text-muted-foreground">Padrao: "Verificar Pagamento"</p>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Texto do botao "Copiar"</Label>
              <Input placeholder="Ex: COPIAR CODIGO" className="bg-secondary/30 text-xs h-8" />
              <p className="text-[10px] text-muted-foreground">Padrao: "Copiar Codigo"</p>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Texto do botao "Ver QR Code"</Label>
              <Input placeholder="Ex: VER QR CODE" className="bg-secondary/30 text-xs h-8" />
              <p className="text-[10px] text-muted-foreground">Padrao: "Ver QR Code"</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div>
              <span className="text-xs">Instrucoes de Pagamento</span>
              <p className="text-[10px] text-muted-foreground">"Como realizar o pagamento..."</p>
            </div>
            <Switch defaultChecked className="scale-75" />
          </div>
        </div>

        <Handle
          type="source"
          position={Position.Bottom}
          id="source"
          className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background"
        />
      </div>
    )
  }

  // Text node
  if (data.type === "text") {
    return (
      <div
        className={`rounded-lg border-2 ${colorMap[config.color]} min-w-[200px] relative ${
          selected ? "ring-2 ring-accent ring-offset-2 ring-offset-background" : ""
        }`}
      >
        <Handle
          type="target"
          position={Position.Top}
          id="target"
          className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background"
        />
        
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${iconColorMap[config.color]}`} />
            <span className="font-medium text-sm">Texto {data.index || ""}</span>
          </div>
          <button type="button" className="p-1 hover:bg-destructive/20 rounded">
            <Trash2 className="h-3 w-3 text-destructive" />
          </button>
        </div>

        <div className="p-3">
          <Textarea placeholder="Digite sua mensagem..." className="bg-secondary/30 text-xs min-h-[80px]" />
        </div>

        <Handle
          type="source"
          position={Position.Bottom}
          id="source"
          className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background"
        />
      </div>
    )
  }

  // Default node
  return (
    <div
      className={`rounded-lg border-2 ${colorMap[config.color]} px-4 py-3 min-w-[140px] relative ${
        selected ? "ring-2 ring-accent ring-offset-2 ring-offset-background" : ""
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="target"
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background"
      />
      
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconColorMap[config.color]}`} />
        <span className="font-medium text-sm">{data.label || config.label}</span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="source"
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background"
      />
    </div>
  )
}

// Node types for React Flow
const nodeTypes: NodeTypes = {
  custom: CustomNode,
}

// Initial nodes
const initialNodes: Node[] = [
  {
    id: "start",
    type: "custom",
    position: { x: 400, y: 100 },
    data: { type: "start", label: "Inicio" },
  },
]

const initialEdges: Edge[] = []

// Sidebar Block Item
function BlockItem({ block }: { block: typeof BLOCK_CATEGORIES[0]["blocks"][0] }) {
  const Icon = block.icon
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500/20 text-emerald-500",
    red: "bg-red-500/20 text-red-500",
    amber: "bg-amber-500/20 text-amber-500",
    blue: "bg-blue-500/20 text-blue-500",
    purple: "bg-purple-500/20 text-purple-500",
    pink: "bg-pink-500/20 text-pink-500",
  }

  const onDragStart = (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData("application/reactflow", block.type)
    event.dataTransfer.effectAllowed = "move"
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-grab hover:bg-secondary/50 transition-colors active:cursor-grabbing"
    >
      <GripVertical className="h-4 w-4 text-muted-foreground/50" />
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${colorMap[block.color]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-sm">{block.label}</span>
      {block.isNew && (
        <Badge className="bg-emerald-500 text-white text-[10px] px-1.5 py-0">NOVO</Badge>
      )}
    </div>
  )
}

// Main Flow Builder Component
function FlowBuilderInner({ flowName = "Novo Fluxo" }: { flowName?: string }) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const { screenToFlowPosition } = useReactFlow()

  // Counter for node indices
  const nodeCounters = useRef<Record<string, number>>({})

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, type: "smoothstep", animated: true }, eds)),
    [setEdges]
  )

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }, [])

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()

      const type = event.dataTransfer.getData("application/reactflow")
      if (!type) return

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      // Increment counter for this type
      nodeCounters.current[type] = (nodeCounters.current[type] || 0) + 1
      const index = nodeCounters.current[type]

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type: "custom",
        position,
        data: { type, index, label: getBlockConfig(type)?.label },
      }

      setNodes((nds) => nds.concat(newNode))
    },
    [screenToFlowPosition, setNodes]
  )

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  return (
    <div className="flex h-full">
      <style>{handleStyles}</style>
      {/* Sidebar */}
      <div className="w-64 border-r border-border/50 bg-background flex flex-col">
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span className="font-semibold text-sm">Blocos Disponiveis</span>
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-4">
            {BLOCK_CATEGORIES.map((category) => (
              <div key={category.id}>
                <p className="text-[10px] font-medium text-muted-foreground px-3 mb-2">{category.label}</p>
                <div className="space-y-1">
                  {category.blocks.map((block) => (
                    <BlockItem key={block.type} block={block} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          snapToGrid
          snapGrid={[15, 15]}
          defaultEdgeOptions={{
            type: "smoothstep",
            animated: true,
            style: { stroke: "#10b981", strokeWidth: 2 },
          }}
          connectionLineStyle={{ stroke: "#10b981", strokeWidth: 2 }}
          connectionLineType="smoothstep"
          className="bg-background"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#333" />
          
          {/* Controls */}
          <Panel position="bottom-left" className="flex flex-col gap-1 bg-secondary/80 rounded-lg p-1 backdrop-blur">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <span className="text-lg font-bold">-</span>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="5" width="14" height="14" rx="2" />
              </svg>
            </Button>
          </Panel>

          {/* Mini Map */}
          <MiniMap
            nodeColor={(node) => {
              const config = getBlockConfig(node.data.type)
              const colorMap: Record<string, string> = {
                emerald: "#10b981",
                red: "#ef4444",
                amber: "#f59e0b",
                blue: "#3b82f6",
                purple: "#8b5cf6",
                pink: "#ec4899",
              }
              return colorMap[config?.color || "emerald"] || "#10b981"
            }}
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="!bg-secondary/50 !border-border/50 rounded-lg"
            style={{ width: 120, height: 80 }}
          />
        </ReactFlow>

        {/* Bottom Navigation */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-secondary/90 rounded-full px-4 py-2 backdrop-blur">
          <Button variant="ghost" size="sm" className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <Button variant="ghost" size="sm" className="gap-2">
            <Send className="h-4 w-4" />
            Midia
          </Button>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            Proximo
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* React Flow Branding */}
        <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground/50">
          React Flow
        </div>
      </div>
    </div>
  )
}

// Wrapper with Provider
export function FlowBuilder({ flowName }: { flowName?: string }) {
  return (
    <ReactFlowProvider>
      <FlowBuilderInner flowName={flowName} />
    </ReactFlowProvider>
  )
}

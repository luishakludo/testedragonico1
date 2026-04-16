"use client"

import { useState, useRef, useCallback } from "react"
import { Camera, Loader2, X, Check, ZoomIn, ZoomOut, RotateCw } from "lucide-react"
import { cn } from "@/lib/utils"

interface AvatarUploadProps {
  currentPhoto?: string | null
  onPhotoSelect: (file: File) => void
  onPhotoRemove?: () => void
  size?: "sm" | "md" | "lg"
  className?: string
  disabled?: boolean
  showStatus?: boolean
  statusActive?: boolean
  placeholder?: React.ReactNode
}

export function AvatarUpload({
  currentPhoto,
  onPhotoSelect,
  onPhotoRemove,
  size = "md",
  className,
  disabled = false,
  showStatus = false,
  statusActive = false,
  placeholder
}: AvatarUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showCrop, setShowCrop] = useState(false)
  const [cropImage, setCropImage] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDraggingCrop, setIsDraggingCrop] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  
  const inputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cropAreaRef = useRef<HTMLDivElement>(null)

  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-16 h-16",
    lg: "w-24 h-24"
  }

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-8 w-8"
  }

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setIsDragging(true)
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const validateAndProcessFile = useCallback((file: File) => {
    // Validar tipo
    if (!file.type.startsWith("image/")) {
      return
    }

    // Validar tamanho (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return
    }

    setIsProcessing(true)
    
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      setCropImage(result)
      setShowCrop(true)
      setZoom(1)
      setRotation(0)
      setPosition({ x: 0, y: 0 })
      setIsProcessing(false)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    
    if (disabled) return

    const file = e.dataTransfer.files?.[0]
    if (file) {
      validateAndProcessFile(file)
    }
  }, [disabled, validateAndProcessFile])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      validateAndProcessFile(file)
    }
    // Reset input
    if (inputRef.current) inputRef.current.value = ""
  }, [validateAndProcessFile])

  // Crop drag handlers
  const handleCropMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingCrop(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }, [position])

  const handleCropMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingCrop) return
    const newX = e.clientX - dragStart.x
    const newY = e.clientY - dragStart.y
    // Limitar movimento baseado no zoom
    const maxMove = 100 * (zoom - 1)
    setPosition({
      x: Math.max(-maxMove, Math.min(maxMove, newX)),
      y: Math.max(-maxMove, Math.min(maxMove, newY))
    })
  }, [isDraggingCrop, dragStart, zoom])

  const handleCropMouseUp = useCallback(() => {
    setIsDraggingCrop(false)
  }, [])

  // Processar e aplicar crop
  const applyCrop = useCallback(async () => {
    if (!cropImage || !canvasRef.current) return
    
    setIsProcessing(true)
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      // Tamanho final do avatar (512x512 para Telegram)
      const outputSize = 512
      canvas.width = outputSize
      canvas.height = outputSize

      // Limpar canvas
      ctx.clearRect(0, 0, outputSize, outputSize)

      // Desenhar circulo de clip (para visualizacao, mas o Telegram aceita quadrado)
      ctx.save()
      
      // Calcular dimensoes
      const scale = zoom
      const centerX = outputSize / 2
      const centerY = outputSize / 2
      
      // Aplicar transformacoes
      ctx.translate(centerX, centerY)
      ctx.rotate((rotation * Math.PI) / 180)
      ctx.scale(scale, scale)
      ctx.translate(-centerX, -centerY)
      
      // Calcular posicao da imagem para centralizar
      const imgRatio = img.width / img.height
      let drawWidth, drawHeight, drawX, drawY
      
      if (imgRatio > 1) {
        // Imagem mais larga que alta
        drawHeight = outputSize
        drawWidth = outputSize * imgRatio
        drawX = (outputSize - drawWidth) / 2 + position.x
        drawY = position.y
      } else {
        // Imagem mais alta que larga
        drawWidth = outputSize
        drawHeight = outputSize / imgRatio
        drawX = position.x
        drawY = (outputSize - drawHeight) / 2 + position.y
      }

      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)
      ctx.restore()

      // Converter para blob
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], "avatar.jpg", { type: "image/jpeg" })
          setPreview(canvas.toDataURL("image/jpeg", 0.95))
          onPhotoSelect(file)
          setShowCrop(false)
          setCropImage(null)
        }
        setIsProcessing(false)
      }, "image/jpeg", 0.95)
    }
    img.src = cropImage
  }, [cropImage, zoom, rotation, position, onPhotoSelect])

  const cancelCrop = useCallback(() => {
    setShowCrop(false)
    setCropImage(null)
    setZoom(1)
    setRotation(0)
    setPosition({ x: 0, y: 0 })
  }, [])

  const displayPhoto = preview || currentPhoto

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />
      
      {/* Avatar principal */}
      <div
        className={cn(
          "relative inline-block group cursor-pointer",
          disabled && "cursor-not-allowed opacity-60",
          className
        )}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div
          className={cn(
            sizeClasses[size],
            "rounded-xl overflow-hidden transition-all duration-200",
            isDragging && "ring-2 ring-[#bfff00] ring-offset-2 ring-offset-[#1c1c1e] scale-105",
            !displayPhoto && "bg-[#bfff00]/10 border-2 border-dashed border-[#3a3a3e]",
            displayPhoto && "border-2 border-[#3a3a3e]"
          )}
        >
          {isProcessing ? (
            <div className="w-full h-full flex items-center justify-center bg-[#2a2a2e]">
              <Loader2 className={cn(iconSizes[size], "text-[#bfff00] animate-spin")} />
            </div>
          ) : displayPhoto ? (
            <img
              src={displayPhoto}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {placeholder || <Camera className={cn(iconSizes[size], "text-[#bfff00]/50")} />}
            </div>
          )}
        </div>

        {/* Hover overlay */}
        {!disabled && !isProcessing && (
          <div className="absolute inset-0 bg-black/60 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className={cn(iconSizes[size], "text-white")} />
          </div>
        )}

        {/* Indicador de drag */}
        {isDragging && (
          <div className="absolute inset-0 bg-[#bfff00]/20 rounded-xl flex items-center justify-center border-2 border-[#bfff00]">
            <span className="text-[10px] font-semibold text-[#bfff00]">Soltar</span>
          </div>
        )}

        {/* Status indicator */}
        {showStatus && (
          <div className={cn(
            "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#1c1c1e]",
            statusActive ? "bg-[#bfff00]" : "bg-gray-500"
          )} />
        )}
      </div>

      {/* Modal de Crop */}
      {showCrop && cropImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1c1c1e] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-[#2a2a2e]">
            <div className="text-center mb-4">
              <h3 className="text-lg font-bold text-white">Ajustar Foto</h3>
              <p className="text-xs text-gray-400 mt-1">Arraste para posicionar</p>
            </div>

            {/* Area de crop circular */}
            <div 
              ref={cropAreaRef}
              className="relative w-64 h-64 mx-auto mb-4 rounded-full overflow-hidden bg-[#2a2a2e] cursor-move"
              onMouseDown={handleCropMouseDown}
              onMouseMove={handleCropMouseMove}
              onMouseUp={handleCropMouseUp}
              onMouseLeave={handleCropMouseUp}
            >
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                  transition: isDraggingCrop ? "none" : "transform 0.1s ease-out"
                }}
              >
                <img
                  src={cropImage}
                  alt="Crop preview"
                  className="max-w-none"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover"
                  }}
                  draggable={false}
                />
              </div>
              
              {/* Overlay com borda circular */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 border-4 border-[#bfff00]/30 rounded-full" />
              </div>
            </div>

            {/* Controles */}
            <div className="flex items-center justify-center gap-4 mb-4">
              {/* Zoom */}
              <div className="flex items-center gap-2 bg-[#2a2a2e] rounded-lg px-3 py-2">
                <button
                  onClick={() => setZoom(z => Math.max(1, z - 0.1))}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.1"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-20 accent-[#bfff00]"
                />
                <button
                  onClick={() => setZoom(z => Math.min(3, z + 0.1))}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
              </div>

              {/* Rotacao */}
              <button
                onClick={() => setRotation(r => (r + 90) % 360)}
                className="p-2 bg-[#2a2a2e] rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <RotateCw className="h-4 w-4" />
              </button>
            </div>

            {/* Botoes */}
            <div className="flex gap-3">
              <button
                onClick={cancelCrop}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#2a2a2e] text-gray-300 hover:bg-[#3a3a3e] transition-colors text-sm font-medium"
              >
                <X className="h-4 w-4" />
                Cancelar
              </button>
              <button
                onClick={applyCrop}
                disabled={isProcessing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#bfff00] text-[#1c1c1e] hover:bg-[#d4ff4d] transition-colors text-sm font-semibold disabled:opacity-50"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Aplicar
              </button>
            </div>
          </div>

          {/* Canvas oculto para processamento */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}
    </>
  )
}

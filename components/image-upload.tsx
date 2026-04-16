"use client"

import { useState, useRef } from "react"
import { Upload, X, Loader2, Image as ImageIcon, Video } from "lucide-react"

type ImageUploadProps = {
  value: string
  onChange: (url: string) => void
  accept?: string
  placeholder?: string
  className?: string
  previewClassName?: string
  showPreview?: boolean
}

export function ImageUpload({ 
  value, 
  onChange, 
  accept = "image/*",
  placeholder = "Clique para fazer upload",
  className = "",
  previewClassName = "",
  showPreview = true
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const isVideo = value?.startsWith("data:video") || value?.includes("video")

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError("")

    try {
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

      onChange(data.url)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const handleRemove = () => {
    onChange("")
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleUpload}
        className="hidden"
        disabled={uploading}
      />

      {value && showPreview ? (
        <div className={`relative group ${previewClassName}`}>
          {isVideo ? (
            <video 
              src={value} 
              className="w-full h-full object-cover rounded-lg"
              muted
            />
          ) : (
            <img 
              src={value} 
              alt="Preview" 
              className="w-full h-full object-cover rounded-lg"
            />
          )}
          <button
            onClick={handleRemove}
            className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm font-medium rounded-lg"
          >
            Trocar
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`w-full border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center gap-2 hover:border-gray-400 hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${previewClassName}`}
        >
          {uploading ? (
            <>
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
              <span className="text-xs text-gray-500">Enviando...</span>
            </>
          ) : (
            <>
              {accept?.includes("video") ? (
                <Video className="w-6 h-6 text-gray-400" />
              ) : (
                <ImageIcon className="w-6 h-6 text-gray-400" />
              )}
              <span className="text-xs text-gray-500">{placeholder}</span>
            </>
          )}
        </button>
      )}

      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  )
}

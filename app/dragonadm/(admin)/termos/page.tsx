"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import {
  FileText,
  Plus,
  Trash2,
  Save,
  Loader2,
  GripVertical,
  Shield,
  Eye,
} from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"

interface TermSection {
  title: string
  content: string
}

interface TermsData {
  sections: TermSection[]
}

export default function TermosPage() {
  const [activeTab, setActiveTab] = useState<"terms" | "privacy">("terms")
  const [terms, setTerms] = useState<TermsData>({ sections: [] })
  const [privacy, setPrivacy] = useState<TermsData>({ sections: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadTerms()
  }, [])

  const loadTerms = async () => {
    setLoading(true)
    try {
      // Load terms of use
      const termsRes = await fetch("/api/terms?type=terms_of_use")
      const termsData = await termsRes.json()
      setTerms(termsData)

      // Load privacy policy
      const privacyRes = await fetch("/api/terms?type=privacy_policy")
      const privacyData = await privacyRes.json()
      setPrivacy(privacyData)
    } catch (error) {
      console.error("Error loading terms:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Save terms
      await fetch("/api/dragonadm/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "terms_of_use", value: terms }),
      })

      // Save privacy
      await fetch("/api/dragonadm/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "privacy_policy", value: privacy }),
      })

      toast({ title: "Salvo!", description: "Termos atualizados com sucesso" })
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao salvar", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const currentData = activeTab === "terms" ? terms : privacy
  const setCurrentData = activeTab === "terms" ? setTerms : setPrivacy

  const addSection = () => {
    setCurrentData({
      sections: [...currentData.sections, { title: "", content: "" }]
    })
  }

  const updateSection = (index: number, field: "title" | "content", value: string) => {
    const newSections = [...currentData.sections]
    newSections[index] = { ...newSections[index], [field]: value }
    setCurrentData({ sections: newSections })
  }

  const removeSection = (index: number) => {
    setCurrentData({
      sections: currentData.sections.filter((_, i) => i !== index)
    })
  }

  const moveSection = (from: number, to: number) => {
    if (to < 0 || to >= currentData.sections.length) return
    const newSections = [...currentData.sections]
    const [removed] = newSections.splice(from, 1)
    newSections.splice(to, 0, removed)
    setCurrentData({ sections: newSections })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Termos e Politicas</h1>
            <p className="text-sm text-zinc-400">
              Edite os termos de uso e politica de privacidade
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(true)} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#BFFF00] hover:bg-[#a8e600] text-black">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Alteracoes
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("terms")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "terms"
                ? "bg-[#BFFF00] text-black"
                : "bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            <FileText className="h-4 w-4" />
            Termos de Uso
          </button>
          <button
            onClick={() => setActiveTab("privacy")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "privacy"
                ? "bg-[#BFFF00] text-black"
                : "bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            <Shield className="h-4 w-4" />
            Politica de Privacidade
          </button>
        </div>

        {/* Sections Editor */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg text-white">
              {activeTab === "terms" ? "Secoes dos Termos de Uso" : "Secoes da Politica de Privacidade"}
            </CardTitle>
            <Button size="sm" onClick={addSection} className="bg-[#BFFF00] hover:bg-[#a8e600] text-black border-0">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Secao
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentData.sections.length === 0 ? (
              <div className="text-center py-12 text-zinc-400">
                <FileText className="h-12 w-12 mx-auto mb-4 text-zinc-700" />
                <p>Nenhuma secao criada</p>
                <Button size="sm" className="mt-4 bg-[#BFFF00] hover:bg-[#a8e600] text-black border-0" onClick={addSection}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar primeira secao
                </Button>
              </div>
            ) : (
              currentData.sections.map((section, index) => (
                <div
                  key={index}
                  className="p-4 rounded-xl border border-zinc-800 bg-zinc-800/30 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => moveSection(index, index - 1)}
                        disabled={index === 0}
                        className="p-1 rounded hover:bg-zinc-700 disabled:opacity-30 text-zinc-400"
                      >
                        <GripVertical className="h-3 w-3 rotate-90" />
                      </button>
                      <button
                        onClick={() => moveSection(index, index + 1)}
                        disabled={index === currentData.sections.length - 1}
                        className="p-1 rounded hover:bg-zinc-700 disabled:opacity-30 text-zinc-400"
                      >
                        <GripVertical className="h-3 w-3 rotate-90" />
                      </button>
                    </div>
                    <div className="flex-1">
                      <Input
                        value={section.title}
                        onChange={(e) => updateSection(index, "title", e.target.value)}
                        placeholder="Titulo da secao (ex: 1. Aceitacao dos Termos)"
                        className="font-medium bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSection(index)}
                      className="text-red-400 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    value={section.content}
                    onChange={(e) => updateSection(index, "content", e.target.value)}
                    placeholder="Conteudo da secao..."
                    rows={3}
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] p-0 gap-0 overflow-hidden bg-zinc-900 border-zinc-800">
          <div className="flex items-center justify-between p-5 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Preview</h3>
                <p className="text-xs text-zinc-400">
                  {activeTab === "terms" ? "Termos de Uso" : "Politica de Privacidade"}
                </p>
              </div>
            </div>
          </div>
          <ScrollArea className="max-h-[60vh] p-5">
            <div className="space-y-4">
              {currentData.sections.map((section, index) => (
                <div key={index}>
                  <h4 className="font-semibold text-white mb-2">{section.title}</h4>
                  <p className="text-sm text-zinc-400">{section.content}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="p-5 border-t border-zinc-800">
            <Button onClick={() => setPreviewOpen(false)} className="w-full bg-[#BFFF00] text-black hover:bg-[#a8e600]">
              Fechar Preview
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  )
}

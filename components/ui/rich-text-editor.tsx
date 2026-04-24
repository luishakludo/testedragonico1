"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Bold, Italic, Underline, Strikethrough, Code, Link as LinkIcon, Quote, Smile } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  maxLength?: number
  className?: string
  variables?: { label: string; value: string }[]
  onVariableInsert?: (variable: string) => void
  showCharCount?: boolean
  disabled?: boolean
}

const EMOJI_LIST = [
  "😀", "😁", "😂", "🤣", "😃", "😄", "😅", "😆", "😉", "😊",
  "😋", "😎", "😍", "😘", "🥰", "😗", "😙", "🥲", "😚", "🙂",
  "🤗", "🤩", "🤔", "🤨", "😐", "😑", "😶", "🙄", "😏", "😣",
  "😥", "😮", "🤐", "😯", "😪", "😫", "🥱", "😴", "😌", "😛",
  "😜", "😝", "🤤", "😒", "😓", "😔", "😕", "🙃", "🤑", "😲",
  "🙁", "😖", "😞", "😟", "😤", "😢", "😭", "😦", "😧", "😨",
  "😩", "🤯", "😬", "😰", "😱", "🥵", "🥶", "😳", "🤪", "😵",
  "🥴", "😠", "😡", "🤬", "😷", "🤒", "🤕", "🤢", "🤮", "🤧",
  "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "🤙", "👋", "🖐️",
  "✋", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "💪", "🦾", "🦿",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
  "💯", "💢", "💥", "💫", "💦", "💨", "🔥", "✨", "⭐", "🌟",
  "🎉", "🎊", "🎁", "🎈", "🏆", "🥇", "🥈", "🥉", "🏅", "🎯",
  "✅", "❌", "⚠️", "🚀", "💰", "💵", "💸", "📈", "📉", "📊"
]

const RichTextEditor = React.forwardRef<HTMLTextAreaElement, RichTextEditorProps>(
  ({ 
    value, 
    onChange, 
    placeholder, 
    rows = 4, 
    maxLength = 4000, 
    className, 
    variables = [],
    showCharCount = true,
    disabled = false
  }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null)
    const [linkUrl, setLinkUrl] = React.useState("")
    const [linkText, setLinkText] = React.useState("")
    const [linkPopoverOpen, setLinkPopoverOpen] = React.useState(false)
    const [emojiPopoverOpen, setEmojiPopoverOpen] = React.useState(false)
    const [savedSelection, setSavedSelection] = React.useState<{ start: number; end: number } | null>(null)

    // Converte HTML para formato amigavel para exibicao
    const htmlToDisplay = (html: string): string => {
      return html.replace(/<a href="([^"]+)">([^<]+)<\/a>/g, '[LINK: $2 | $1]')
    }

    // Converte formato amigavel de volta para HTML
    const displayToHtml = (display: string): string => {
      return display.replace(/\[LINK: ([^|]+) \| ([^\]]+)\]/g, '<a href="$2">$1</a>')
    }

    // Valor exibido no textarea (formato amigavel)
    const displayValue = htmlToDisplay(value)

    // Combine refs
    React.useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement)

    const applyTag = (tagOpen: string, tagClose: string) => {
      const textarea = textareaRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selectedText = displayValue.substring(start, end)

      const before = displayValue.substring(0, start)
      const after = displayValue.substring(end)

      const newDisplayValue = before + tagOpen + selectedText + tagClose + after
      onChange(displayToHtml(newDisplayValue))

      // Reposition cursor
      setTimeout(() => {
        textarea.focus()
        if (selectedText) {
          // If text was selected, place cursor after the closing tag
          textarea.setSelectionRange(
            start + tagOpen.length + selectedText.length + tagClose.length,
            start + tagOpen.length + selectedText.length + tagClose.length
          )
        } else {
          // If no selection, place cursor between tags
          textarea.setSelectionRange(start + tagOpen.length, start + tagOpen.length)
        }
      }, 0)
    }

    const handleBold = () => applyTag("<b>", "</b>")
    const handleItalic = () => applyTag("<i>", "</i>")
    const handleUnderline = () => applyTag("<u>", "</u>")
    const handleStrikethrough = () => applyTag("<s>", "</s>")
    const handleCode = () => applyTag("<code>", "</code>")
    const handleQuote = () => applyTag("<blockquote>", "</blockquote>")

    const handleLinkClick = () => {
      const textarea = textareaRef.current
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selectedText = value.substring(start, end)
      setSavedSelection({ start, end })
      setLinkUrl("")
      setLinkText(selectedText) // Pre-fill with selected text if any
      setLinkPopoverOpen(true)
    }

    const handleLinkInsert = () => {
      if (!linkUrl || !savedSelection) return
      
      const textarea = textareaRef.current
      if (!textarea) return

      const { start, end } = savedSelection
      const displayText = linkText.trim() || linkUrl

      const before = value.substring(0, start)
      const after = value.substring(end)

      const newValue = before + `<a href="${linkUrl}">${displayText}</a>` + after
      onChange(newValue)

      setLinkPopoverOpen(false)
      setLinkUrl("")
      setLinkText("")
      setSavedSelection(null)

      setTimeout(() => {
        textarea.focus()
      }, 0)
    }

    const handleEmojiInsert = (emoji: string) => {
      const textarea = textareaRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd

      const before = value.substring(0, start)
      const after = value.substring(end)

      const newValue = before + emoji + after
      onChange(newValue)

      setEmojiPopoverOpen(false)

      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + emoji.length, start + emoji.length)
      }, 0)
    }

    const handleVariableInsert = (variable: string) => {
      const textarea = textareaRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd

      const before = value.substring(0, start)
      const after = value.substring(end)

      const newValue = before + variable + after
      onChange(newValue)

      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + variable.length, start + variable.length)
      }, 0)
    }

    // Keyboard shortcuts
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "b":
            e.preventDefault()
            handleBold()
            break
          case "i":
            e.preventDefault()
            handleItalic()
            break
          case "u":
            e.preventDefault()
            handleUnderline()
            break
        }
      }
    }

    return (
      <div className="space-y-2">
        {/* Toolbar */}
        <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1 w-fit">
          <button
            type="button"
            onClick={handleBold}
            disabled={disabled}
            className="h-7 w-7 rounded flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Negrito (Ctrl+B)"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleItalic}
            disabled={disabled}
            className="h-7 w-7 rounded flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Italico (Ctrl+I)"
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleUnderline}
            disabled={disabled}
            className="h-7 w-7 rounded flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Sublinhado (Ctrl+U)"
          >
            <Underline className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleStrikethrough}
            disabled={disabled}
            className="h-7 w-7 rounded flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Riscado"
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleCode}
            disabled={disabled}
            className="h-7 w-7 rounded flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Codigo"
          >
            <Code className="h-3.5 w-3.5" />
          </button>
          
          <Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={handleLinkClick}
                disabled={disabled}
                className="h-7 w-7 rounded flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Link"
              >
                <LinkIcon className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4" align="start">
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-900">Inserir Link</h4>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="link-text" className="text-xs font-medium text-gray-600">Texto do link</Label>
                    <Input
                      id="link-text"
                      value={linkText}
                      onChange={(e) => setLinkText(e.target.value)}
                      placeholder="Clique aqui"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="link-url" className="text-xs font-medium text-gray-600">URL</Label>
                    <Input
                      id="link-url"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://exemplo.com"
                      className="h-9"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleLinkInsert()
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setLinkPopoverOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleLinkInsert}
                    disabled={!linkUrl}
                  >
                    Inserir
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <button
            type="button"
            onClick={handleQuote}
            disabled={disabled}
            className="h-7 w-7 rounded flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Citacao"
          >
            <Quote className="h-3.5 w-3.5" />
          </button>

          <div className="w-px h-5 bg-neutral-300 mx-1" />

          <Popover open={emojiPopoverOpen} onOpenChange={setEmojiPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                className="h-7 w-7 rounded flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Emoji"
              >
                <Smile className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="start">
              <div className="grid grid-cols-10 gap-1 max-h-48 overflow-y-auto">
                {EMOJI_LIST.map((emoji, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleEmojiInsert(emoji)}
                    className="h-8 w-8 rounded flex items-center justify-center hover:bg-neutral-100 transition-colors text-lg"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={displayValue}
          onChange={(e) => onChange(displayToHtml(e.target.value))}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          disabled={disabled}
          className={cn(
            "flex w-full rounded-lg border border-input bg-secondary/50 px-3 py-2 text-base text-foreground ring-offset-background placeholder:text-muted-foreground transition-all duration-200 focus-visible:outline-none focus-visible:bg-secondary focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:border-accent/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-none",
            className
          )}
        />

        {/* Footer with char count and variables */}
        <div className="flex items-center justify-between">
          {showCharCount && (
            <p className="text-xs text-neutral-400">
              {value.length}/{maxLength} caracteres
            </p>
          )}
          {variables.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400">Variaveis:</span>
              {variables.map((v, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleVariableInsert(v.value)}
                  disabled={disabled}
                  className="px-2 py-1 rounded bg-neutral-100 text-xs font-mono text-neutral-600 hover:bg-[#bfff00]/20 hover:text-[#8fb300] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }
)
RichTextEditor.displayName = "RichTextEditor"

export { RichTextEditor }

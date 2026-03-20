'use client'

import { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react'
import type { FileNode } from '@axy/shared'
import { SlashCommandMenu, type SlashCommandDef } from '@/components/chat/slash-command-menu'
import { useVoiceInput } from '@/hooks/use-voice-input'

interface AttachedImage {
  file: File
  preview: string
  data: string // base64
  mimeType: string
}

export interface ChatInputSendPayload {
  content: string
  images?: { data: string; mimeType: string; name: string }[]
}

interface ChatInputProps {
  sessionId: string
  isStreaming: boolean
  isListening?: boolean
  skillCommands: SlashCommandDef[]
  projectFiles: FileNode[]
  onSend: (payload: ChatInputSendPayload) => void
  onSlashCommand: (name: string, args: string) => void
  onStop?: () => void
}

const TEXT_FILE_EXTENSIONS = ['.txt', '.md', '.json', '.csv']

function isTextFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return TEXT_FILE_EXTENSIONS.some((ext) => name.endsWith(ext))
}

function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

function flattenFiles(nodes: FileNode[]): { name: string; path: string }[] {
  const result: { name: string; path: string }[] = []
  function walk(items: FileNode[]) {
    for (const item of items) {
      if (item.type === 'file') {
        result.push({ name: item.name, path: item.path })
      }
      if (item.children) walk(item.children)
    }
  }
  walk(nodes)
  return result
}

export const ChatInput = memo(function ChatInput({
  sessionId,
  isStreaming,
  skillCommands,
  projectFiles,
  onSend,
  onSlashCommand,
}: ChatInputProps) {
  const [input, setInput] = useState('')
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([])
  const [messageHistory, setMessageHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [savedInput, setSavedInput] = useState('')
  const [voiceInterim, setVoiceInterim] = useState('')
  // @ mention state
  const [showAtMenu, setShowAtMenu] = useState(false)
  const [atQuery, setAtQuery] = useState('')
  const [atMenuIndex, setAtMenuIndex] = useState(0)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Voice input
  const { isListening, isSupported: voiceSupported, toggleListening } = useVoiceInput({
    onResult: (transcript) => {
      setInput((prev) => prev + (prev ? ' ' : '') + transcript)
    },
    onInterimResult: (transcript) => {
      setVoiceInterim(transcript)
    },
  })

  // Restore draft on mount
  useEffect(() => {
    const draft = localStorage.getItem(`chat-draft-${sessionId}`)
    if (draft) setInput(draft)
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    }
  }, [sessionId])

  // Debounced draft save
  useEffect(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(() => {
      if (input) {
        localStorage.setItem(`chat-draft-${sessionId}`, input)
      } else {
        localStorage.removeItem(`chat-draft-${sessionId}`)
      }
    }, 500)
  }, [input, sessionId])

  // Flat file list for @ mentions
  const flatFiles = useMemo(() => flattenFiles(projectFiles), [projectFiles])
  const filteredAtFiles = useMemo(() => {
    if (!atQuery) return flatFiles.slice(0, 20)
    const q = atQuery.toLowerCase()
    return flatFiles.filter((f) => f.path.toLowerCase().includes(q) || f.name.toLowerCase().includes(q)).slice(0, 20)
  }, [flatFiles, atQuery])

  // File to base64
  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        const base64 = result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }, [])

  const addImage = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return
    const data = await fileToBase64(file)
    const preview = URL.createObjectURL(file)
    setAttachedImages((prev) => [...prev, { file, preview, data, mimeType: file.type }])
  }, [fileToBase64])

  const removeImage = useCallback((index: number) => {
    setAttachedImages((prev) => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) addImage(file)
      }
    }
  }, [addImage])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        addImage(file)
      } else if (isTextFile(file)) {
        try {
          const text = await readTextFile(file)
          const ext = file.name.split('.').pop() || 'txt'
          const codeBlock = `\`\`\`${ext} (${file.name})\n${text}\n\`\`\``
          setInput((prev) => (prev ? prev + '\n\n' : '') + codeBlock)
        } catch { /* ignore */ }
      }
    }
    e.target.value = ''
  }, [addImage])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const noteData = e.dataTransfer.getData('application/x-axy-note')
    if (noteData) {
      try {
        const note = JSON.parse(noteData) as { title: string; content: string }
        setInput((prev) => prev + (prev ? '\n\n' : '') + (note.content || note.title))
      } catch { /* ignore */ }
      return
    }
    if (e.dataTransfer.files?.length) {
      for (const file of e.dataTransfer.files) {
        if (file.type.startsWith('image/')) {
          addImage(file)
        } else if (isTextFile(file)) {
          readTextFile(file).then((text) => {
            const ext = file.name.split('.').pop() || 'txt'
            const codeBlock = `\`\`\`${ext} (${file.name})\n${text}\n\`\`\``
            setInput((prev) => (prev ? prev + '\n\n' : '') + codeBlock)
          }).catch(() => {})
        }
      }
      return
    }
    const text = e.dataTransfer.getData('text/plain')
    if (text) setInput((prev) => prev + (prev ? ' ' : '') + text)
  }, [addImage])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  // @ mention selection
  const handleAtSelect = useCallback((file: { name: string; path: string }) => {
    const cursorPos = inputRef.current?.selectionStart || input.length
    const textBeforeCursor = input.slice(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    if (lastAtIndex >= 0) {
      const before = input.slice(0, lastAtIndex)
      const after = input.slice(cursorPos)
      setInput(`${before}@${file.path} ${after}`)
    }
    setShowAtMenu(false)
    setAtQuery('')
    inputRef.current?.focus()
  }, [input])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInput(val)

    // Detect slash command
    if (val.startsWith('/') && !val.includes(' ')) {
      setShowSlashMenu(true)
      setSlashQuery(val.slice(1))
    } else {
      setShowSlashMenu(false)
      setSlashQuery('')
    }

    // Detect @ mention
    const cursorPos = e.target.selectionStart || val.length
    const textBeforeCursor = val.slice(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    if (lastAtIndex >= 0) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setShowAtMenu(true)
        setAtQuery(textAfterAt)
        setAtMenuIndex(0)
      } else {
        setShowAtMenu(false)
        setAtQuery('')
      }
    } else {
      setShowAtMenu(false)
      setAtQuery('')
    }

    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [])

  const handleSend = useCallback(() => {
    const content = input.trim()
    if (!content && attachedImages.length === 0) return

    if (showSlashMenu) setShowSlashMenu(false)

    // Check if it's a slash command
    if (content.startsWith('/')) {
      const spaceIdx = content.indexOf(' ')
      const name = spaceIdx > 0 ? content.slice(1, spaceIdx) : content.slice(1)
      const args = spaceIdx > 0 ? content.slice(spaceIdx + 1).trim() : ''
      setInput('')
      localStorage.removeItem(`chat-draft-${sessionId}`)
      onSlashCommand(name, args)
      inputRef.current?.focus()
      return
    }

    // Save to history
    if (content) {
      setMessageHistory((prev) => {
        const filtered = prev.filter((m) => m !== content)
        return [content, ...filtered].slice(0, 50)
      })
    }
    setHistoryIndex(-1)
    setSavedInput('')
    setInput('')
    localStorage.removeItem(`chat-draft-${sessionId}`)

    const imagesToSend = attachedImages.length > 0
      ? attachedImages.map((img) => ({ data: img.data, mimeType: img.mimeType, name: img.file.name }))
      : undefined

    if (attachedImages.length > 0) {
      for (const img of attachedImages) URL.revokeObjectURL(img.preview)
      setAttachedImages([])
    }

    onSend({ content, images: imagesToSend })
    inputRef.current?.focus()
  }, [input, attachedImages, showSlashMenu, sessionId, onSend, onSlashCommand])

  const handleSlashCommand = useCallback((cmd: SlashCommandDef) => {
    setShowSlashMenu(false)
    setInput('')
    onSlashCommand(cmd.name, '')
    inputRef.current?.focus()
  }, [onSlashCommand])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // @ menu keys
      if (showAtMenu && ['ArrowUp', 'ArrowDown', 'Tab', 'Enter', 'Escape'].includes(e.key)) {
        if (e.key === 'Escape') { e.preventDefault(); setShowAtMenu(false); return }
        if (e.key === 'ArrowUp') { e.preventDefault(); setAtMenuIndex((i) => (i > 0 ? i - 1 : filteredAtFiles.length - 1)); return }
        if (e.key === 'ArrowDown') { e.preventDefault(); setAtMenuIndex((i) => (i < filteredAtFiles.length - 1 ? i + 1 : 0)); return }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (filteredAtFiles[atMenuIndex]) handleAtSelect(filteredAtFiles[atMenuIndex]); return }
      }

      // Slash menu keys
      if (showSlashMenu && ['ArrowUp', 'ArrowDown', 'Tab', 'Escape'].includes(e.key)) return

      // Ctrl/Cmd+Enter to send
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        if (showSlashMenu) return
        e.preventDefault()
        handleSend()
        return
      }

      // History navigation
      if (e.key === 'ArrowUp' && !showSlashMenu) {
        const textarea = e.target as HTMLTextAreaElement
        if (textarea.selectionStart === 0 || !input) {
          if (messageHistory.length > 0 && historyIndex < messageHistory.length - 1) {
            e.preventDefault()
            const newIndex = historyIndex + 1
            if (historyIndex === -1) setSavedInput(input)
            setHistoryIndex(newIndex)
            setInput(messageHistory[newIndex])
          }
        }
        return
      }

      if (e.key === 'ArrowDown' && !showSlashMenu) {
        const textarea = e.target as HTMLTextAreaElement
        if (historyIndex >= 0 && (textarea.selectionStart === textarea.value.length || !input)) {
          e.preventDefault()
          const newIndex = historyIndex - 1
          setHistoryIndex(newIndex)
          if (newIndex < 0) setInput(savedInput)
          else setInput(messageHistory[newIndex])
        }
        return
      }
    },
    [showAtMenu, showSlashMenu, filteredAtFiles, atMenuIndex, handleAtSelect, handleSend, messageHistory, historyIndex, input, savedInput]
  )

  // Public method to set input from parent (for prefill, note drops, etc.)
  // We use a ref callback pattern
  const setInputExternal = useCallback((val: string | ((prev: string) => string)) => {
    setInput(val)
  }, [])

  // Expose setInput and focus via ref on the component
  // Use a stable ref that parent can access
  useEffect(() => {
    // @ts-expect-error - attaching to window for parent access
    window.__chatInput = {
      setInput: setInputExternal,
      focus: () => inputRef.current?.focus(),
      getInput: () => input,
    }
    return () => {
      // @ts-expect-error - cleanup
      delete window.__chatInput
    }
  }, [setInputExternal, input])

  return (
    <div className="rounded-[0.75rem] px-4 py-3 md:px-6 md:py-4" style={{ background: 'rgba(26,26,26,0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(72,72,71,0.15)' }}>
      {/* Image previews */}
      {attachedImages.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachedImages.map((img, i) => (
            <div key={i} className="group relative">
              <img src={img.preview} alt={img.file.name} className="h-16 w-16 rounded-lg border border-[var(--border)] object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--destructive)] text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100"
              >x</button>
              <span className="absolute bottom-0 left-0 right-0 truncate rounded-b-lg bg-black/60 px-1 text-[8px] text-white">{img.file.name}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <span className="hidden shrink-0 font-mono text-lg font-bold text-[#bd9dff] md:inline">&#10095;</span>
        <div className="relative min-w-0 flex-1">
          {/* Slash command autocomplete */}
          <SlashCommandMenu
            query={slashQuery}
            visible={showSlashMenu}
            onSelect={handleSlashCommand}
            onClose={() => setShowSlashMenu(false)}
            customCommands={skillCommands}
          />
          {/* @ mention file picker */}
          {showAtMenu && filteredAtFiles.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 max-h-60 w-full overflow-auto rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-xl">
              <div className="sticky top-0 bg-[var(--card)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Files {atQuery && <span className="normal-case font-normal">matching &quot;{atQuery}&quot;</span>}
              </div>
              {filteredAtFiles.map((file, idx) => (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => handleAtSelect(file)}
                  onMouseEnter={() => setAtMenuIndex(idx)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                    idx === atMenuIndex
                      ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                      : 'text-[var(--foreground)] hover:bg-[var(--accent)]'
                  }`}
                >
                  <svg className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">{file.name}</span>
                  <span className="shrink-0 truncate text-[10px] text-[var(--muted-foreground)] max-w-[40%]">{file.path}</span>
                </button>
              ))}
            </div>
          )}
          {/* Voice interim preview */}
          {voiceInterim && (
            <div className="mb-1 rounded bg-[var(--primary)]/10 px-3 py-1 text-xs text-[var(--primary)] italic">
              {voiceInterim}...
            </div>
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            placeholder={isListening ? 'Listening...' : 'Type a command or message...'}
            rows={1}
            className={`w-full resize-none rounded-[0.375rem] px-4 py-3 pr-20 text-[15px] text-white outline-none transition-colors placeholder:text-[#adaaaa]/50 focus:ring-1 focus:ring-[#bd9dff]/50 md:text-sm ${isListening ? 'ring-1 ring-red-500/50 bg-red-500/5' : ''}`}
            style={{ background: '#000000', border: '1px solid rgba(72,72,71,0.2)', maxHeight: '120px' }}
          />
          {/* Input action buttons */}
          <div className="absolute bottom-2.5 right-2 flex items-center gap-1">
            {voiceSupported && (
              <button
                type="button"
                onClick={toggleListening}
                className={`rounded p-0.5 transition-colors ${isListening ? 'text-red-400 animate-pulse' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
                title={isListening ? 'Stop listening' : 'Voice input'}
              >
                <svg className="h-4 w-4" fill={isListening ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              title="Attach files (images, .txt, .md, .json, .csv)"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.txt,.md,.json,.csv"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!input.trim() && attachedImages.length === 0}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-30"
          style={{ background: 'linear-gradient(135deg, #bd9dff, #8a4cfc)' }}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      </div>
      <div className="mt-1 hidden items-center gap-3 text-[10px] text-[var(--muted-foreground)] sm:flex">
        <span>@ to mention files</span>
        <span>Paste/attach images or text files</span>
        {voiceSupported && <span>Mic for voice input</span>}
        <span>Arrow Up/Down for history</span>
      </div>
    </div>
  )
})

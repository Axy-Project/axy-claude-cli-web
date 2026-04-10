'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

// ────────────────────────────────────────────────────────────
// Saved prompts from localStorage
// ────────────────────────────────────────────────────────────
interface SavedPrompt {
  id: string
  name: string
  content: string
  createdAt: string
}

function getSavedPrompts(): SavedPrompt[] {
  try {
    const raw = localStorage.getItem('axy-system-prompts')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveSavedPrompts(prompts: SavedPrompt[]) {
  try { localStorage.setItem('axy-system-prompts', JSON.stringify(prompts)) } catch {}
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────
export interface SystemPromptPanelProps {
  sessionId: string
  value: string
  onChange: (prompt: string) => void
  onCollapse: () => void
}

export function SystemPromptPanel({ sessionId, value, onChange, onCollapse }: SystemPromptPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showSaved, setShowSaved] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>(() => getSavedPrompts())
  const savedRef = useRef<HTMLDivElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [value])

  // Close dropdown on outside click
  useEffect(() => {
    if (!showSaved) return
    const handler = (e: MouseEvent) => {
      if (savedRef.current && !savedRef.current.contains(e.target as Node)) setShowSaved(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSaved])

  // Load from file
  const handleFileLoad = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      onChange(text)
    } catch (err) {
      console.error('Failed to read file:', err)
    }
    // Reset input so same file can be loaded again
    e.target.value = ''
  }, [onChange])

  // Save prompt
  const handleSave = useCallback(() => {
    if (!saveName.trim() || !value.trim()) return
    const newPrompt: SavedPrompt = {
      id: crypto.randomUUID(),
      name: saveName.trim(),
      content: value,
      createdAt: new Date().toISOString(),
    }
    const updated = [newPrompt, ...savedPrompts]
    setSavedPrompts(updated)
    saveSavedPrompts(updated)
    setShowSaveDialog(false)
    setSaveName('')
  }, [saveName, value, savedPrompts])

  // Load saved prompt
  const handleLoadSaved = useCallback((prompt: SavedPrompt) => {
    onChange(prompt.content)
    setShowSaved(false)
  }, [onChange])

  // Delete saved prompt
  const handleDeleteSaved = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = savedPrompts.filter((p) => p.id !== id)
    setSavedPrompts(updated)
    saveSavedPrompts(updated)
  }, [savedPrompts])

  const charCount = value.length
  const lineCount = value ? value.split('\n').length : 0

  return (
    <div className="rounded-lg border" style={{ background: '#111', borderColor: 'rgba(189,157,255,0.15)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid rgba(72,72,71,0.12)' }}>
        <div className="flex items-center gap-2">
          <svg className="h-3.5 w-3.5 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
          <span className="text-[11px] font-semibold text-[var(--primary)]">System Prompt</span>
          {value && (
            <span className="text-[9px] text-[#555]">{lineCount}L / {charCount}ch</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Load from file */}
          <button
            onClick={handleFileLoad}
            className="rounded p-1 text-[#767575] transition-colors hover:bg-[rgba(189,157,255,0.08)] hover:text-[#adaaaa]"
            title="Load from .md / .txt file"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </button>

          {/* Saved prompts */}
          <div className="relative" ref={savedRef}>
            <button
              onClick={() => setShowSaved(!showSaved)}
              className="rounded p-1 text-[#767575] transition-colors hover:bg-[rgba(189,157,255,0.08)] hover:text-[#adaaaa]"
              title="Saved prompts"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
              </svg>
            </button>
            {showSaved && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSaved(false)} />
                <div className="absolute right-0 bottom-full z-50 mb-1 w-64 rounded-lg border shadow-xl" style={{ background: '#1a1a1a', borderColor: 'rgba(72,72,71,0.2)' }}>
                  <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid rgba(72,72,71,0.12)' }}>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#adaaaa]">Saved Prompts</span>
                    {value.trim() && (
                      <button
                        onClick={() => { setShowSaved(false); setShowSaveDialog(true) }}
                        className="text-[10px] font-medium text-[var(--primary)] hover:brightness-125"
                      >
                        + Save current
                      </button>
                    )}
                  </div>
                  <div className="custom-scrollbar max-h-48 overflow-y-auto">
                    {savedPrompts.length === 0 ? (
                      <p className="px-3 py-4 text-center text-[10px] text-[#555]">No saved prompts yet</p>
                    ) : (
                      savedPrompts.map((sp) => (
                        <button
                          key={sp.id}
                          onClick={() => handleLoadSaved(sp)}
                          className="group flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[rgba(189,157,255,0.06)]"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-medium text-white">{sp.name}</p>
                            <p className="truncate text-[9px] text-[#555]">{sp.content.slice(0, 60)}...</p>
                          </div>
                          <button
                            onClick={(e) => handleDeleteSaved(sp.id, e)}
                            className="shrink-0 rounded p-0.5 text-[#555] opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Save current */}
          {value.trim() && (
            <button
              onClick={() => setShowSaveDialog(true)}
              className="rounded p-1 text-[#767575] transition-colors hover:bg-[rgba(189,157,255,0.08)] hover:text-[#adaaaa]"
              title="Save this prompt"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75H6.912a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859" />
              </svg>
            </button>
          )}

          {/* Clear */}
          {value && (
            <button
              onClick={() => onChange('')}
              className="rounded p-1 text-[#767575] transition-colors hover:bg-[rgba(248,113,113,0.08)] hover:text-red-400"
              title="Clear system prompt"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          )}

          {/* Collapse */}
          <button
            onClick={onCollapse}
            className="rounded p-1 text-[#767575] transition-colors hover:bg-[rgba(72,72,71,0.15)] hover:text-white"
            title="Collapse"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Save dialog */}
      {showSaveDialog && (
        <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid rgba(72,72,71,0.12)' }}>
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setShowSaveDialog(false) }}
            placeholder="Prompt name..."
            autoFocus
            className="flex-1 rounded bg-[#1a1a1a] px-2 py-1 text-[11px] text-white placeholder:text-[#555] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/40"
          />
          <button onClick={handleSave} className="rounded bg-[var(--primary)]/20 px-2 py-1 text-[10px] font-medium text-[var(--primary)] hover:bg-[var(--primary)]/30">Save</button>
          <button onClick={() => setShowSaveDialog(false)} className="rounded px-2 py-1 text-[10px] text-[#767575] hover:text-white">Cancel</button>
        </div>
      )}

      {/* Textarea */}
      <div className="px-3 py-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={'Escribe tu system prompt aquí o carga un archivo .md...\n\nEjemplo: "Eres un experto en desarrollo de mods para Minecraft con Cobblemon..."'}
          className="custom-scrollbar w-full resize-none bg-transparent font-mono text-[11px] leading-relaxed text-[#e0e0e0] placeholder:text-[#444] focus:outline-none"
          style={{ minHeight: '3rem', maxHeight: '200px' }}
          rows={3}
        />
      </div>

      {/* Footer hint */}
      <div className="flex items-center gap-2 px-3 py-1.5" style={{ borderTop: '1px solid rgba(72,72,71,0.08)' }}>
        <svg className="h-3 w-3 text-[#444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <span className="text-[9px] text-[#444]">Se envía como --system-prompt con cada mensaje. Carga archivos .md o guarda presets.</span>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.txt,.prompt"
        onChange={handleFileSelected}
        className="hidden"
      />
    </div>
  )
}

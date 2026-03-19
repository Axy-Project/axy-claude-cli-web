'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { usePermissionStore } from '@/stores/permission.store'

export function PermissionDialog() {
  const { currentRequest, respond } = usePermissionStore()
  const dialogRef = useRef<HTMLDivElement>(null)
  const allowBtnRef = useRef<HTMLButtonElement>(null)
  const [showInput, setShowInput] = useState(false)

  // Auto-focus the dialog when a request appears
  useEffect(() => {
    if (currentRequest) {
      setShowInput(false)
      // Small delay to let the DOM render, then focus the Allow button
      requestAnimationFrame(() => {
        allowBtnRef.current?.focus()
      })
    }
  }, [currentRequest])

  // Close on Escape key
  useEffect(() => {
    if (!currentRequest) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        respond(currentRequest.requestId, false)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [currentRequest, respond])

  const handleAllow = useCallback(() => {
    if (!currentRequest) return
    respond(currentRequest.requestId, true)
  }, [currentRequest, respond])

  const handleAllowRemember = useCallback(() => {
    if (!currentRequest) return
    respond(currentRequest.requestId, true, true)
  }, [currentRequest, respond])

  const handleDeny = useCallback(() => {
    if (!currentRequest) return
    respond(currentRequest.requestId, false)
  }, [currentRequest, respond])

  if (!currentRequest) return null

  const inputKeys = currentRequest.input ? Object.keys(currentRequest.input) : []
  const hasInput = inputKeys.length > 0

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={handleDeny}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Permission request"
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15">
            <svg
              className="h-5 w-5 text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              Permission Required
            </h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Claude wants to use a tool
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-3 px-5 py-4">
          {/* Tool name */}
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-500/15 text-blue-400">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.42 15.17l-5.384-3.19A.75.75 0 005 12.638v-1.276a.75.75 0 011.036-.658l5.384 3.19a.75.75 0 010 1.276zM15.953 4.39l-5.384 3.19a.75.75 0 000 1.276l5.384 3.19A.75.75 0 0017 11.362V5.048a.75.75 0 00-1.047-.658z"
                />
              </svg>
            </span>
            <span className="rounded bg-blue-500/15 px-2.5 py-1 font-mono text-xs font-semibold text-blue-400">
              {currentRequest.tool}
            </span>
          </div>

          {/* Description */}
          {currentRequest.description && (
            <p className="text-sm leading-relaxed text-[var(--foreground)]">
              {currentRequest.description}
            </p>
          )}

          {/* Collapsible input details */}
          {hasInput && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/50 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowInput(!showInput)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--secondary)]"
              >
                <svg
                  className={`h-3 w-3 shrink-0 text-[var(--muted-foreground)] transition-transform ${showInput ? 'rotate-90' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  Input Details
                </span>
                <span className="ml-auto rounded bg-[var(--muted)]/50 px-1.5 py-0.5 text-[10px] text-[var(--muted-foreground)]">
                  {inputKeys.length} {inputKeys.length === 1 ? 'field' : 'fields'}
                </span>
              </button>
              {showInput && (
                <div className="border-t border-[var(--border)] px-3 py-2">
                  <pre className="max-h-48 overflow-auto font-mono text-[11px] leading-relaxed text-[var(--muted-foreground)]">
                    {JSON.stringify(currentRequest.input, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 border-t border-[var(--border)] px-5 py-4">
          <button
            onClick={handleDeny}
            className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-4 py-2 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
          >
            Deny
          </button>
          <div className="flex-1" />
          <button
            onClick={handleAllowRemember}
            className="rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-4 py-2 text-xs font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/20"
          >
            Allow &amp; Remember
          </button>
          <button
            ref={allowBtnRef}
            onClick={handleAllow}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-medium text-white transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:ring-offset-1 focus:ring-offset-[var(--card)]"
          >
            Allow
          </button>
        </div>
      </div>
    </>
  )
}

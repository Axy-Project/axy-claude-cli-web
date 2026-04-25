'use client'

import { useState } from 'react'
import type { Message, ContentBlock } from '@axy/shared'

export function MessageActions({
  message,
  onRetry,
  onCopy,
  onFork,
}: {
  message: Message
  onRetry?: () => void
  onCopy?: () => void
  onFork?: () => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    const text = message.contentJson
      ?.filter((b: ContentBlock) => b.type === 'text')
      .map((b: ContentBlock) => b.text)
      .join('\n') || ''

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      onCopy?.()
    })
  }

  return (
    <div className="flex items-center gap-0.5 rounded-md border border-[var(--border)] bg-[var(--card)] px-1 py-0.5 shadow-sm">
      {/* Copy */}
      <button
        onClick={handleCopy}
        className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
        title="Copy message"
      >
        {copied ? (
          <svg className="h-3.5 w-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>

      {/* Retry (only for assistant messages) */}
      {message.role === 'assistant' && onRetry && (
        <button
          onClick={onRetry}
          className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
          title="Retry this response"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      )}

      {/* Fork conversation from this point */}
      {onFork && (
        <button
          onClick={onFork}
          className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
          title="Fork conversation from here"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l-6 6m0-6l6 6m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      )}
    </div>
  )
}

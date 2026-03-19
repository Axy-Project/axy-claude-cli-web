'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
interface ArtifactPreviewProps {
  content: string
  language?: string
  filename?: string
}

type ArtifactKind = 'html' | 'markdown' | 'mermaid' | 'svg' | 'code'

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
function detectKind(content: string, language?: string): ArtifactKind {
  const lang = language?.toLowerCase()
  if (lang === 'markdown' || lang === 'md') return 'markdown'
  if (lang === 'mermaid') return 'mermaid'

  const trimmed = content.trimStart()
  if (lang === 'html' || lang === 'svg') {
    if (trimmed.startsWith('<svg')) return 'svg'
    return 'html'
  }
  if (
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    trimmed.includes('<body')
  ) {
    return 'html'
  }
  if (trimmed.startsWith('<svg')) return 'svg'

  return 'code'
}

// ────────────────────────────────────────────────────────────
// Sub-renderers
// ────────────────────────────────────────────────────────────
function HtmlPreview({ content }: { content: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const openInNewTab = useCallback(() => {
    const w = window.open()
    if (w) {
      w.document.open()
      w.document.write(content)
      w.document.close()
    }
  }, [content])

  return (
    <div className="relative">
      <iframe
        ref={iframeRef}
        srcDoc={content}
        sandbox="allow-scripts"
        title="HTML preview"
        className="w-full rounded border border-[var(--border)] bg-white"
        style={{ minHeight: 200, maxHeight: 500 }}
      />
      <button
        type="button"
        onClick={openInNewTab}
        className="absolute right-2 top-2 rounded bg-[var(--card)] px-2 py-1 text-xs text-[var(--muted-foreground)] border border-[var(--border)] hover:text-[var(--foreground)] transition-colors"
      >
        Open in new tab
      </button>
    </div>
  )
}

function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none p-4 prose-headings:text-[var(--foreground)] prose-p:text-[var(--foreground)] prose-strong:text-[var(--foreground)] prose-a:text-[var(--primary)] prose-li:text-[var(--foreground)]">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}

function MermaidPreview({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [rendered, setRendered] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'loose',
        })
        const id = `mermaid-${Date.now()}`
        const { svg } = await mermaid.render(id, content)
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg
          setRendered(true)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [content])

  if (error) {
    return (
      <div className="p-4">
        <p className="mb-2 text-xs text-[var(--muted-foreground)]">
          Mermaid rendering failed: {error}
        </p>
        <pre className="overflow-x-auto rounded bg-[#282c34] p-3 text-xs text-[var(--foreground)]">
          {content}
        </pre>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div
        ref={containerRef}
        className="flex items-center justify-center overflow-x-auto [&_svg]:max-w-full"
      />
      {!rendered && (
        <p className="text-xs text-[var(--muted-foreground)] animate-pulse">
          Rendering diagram...
        </p>
      )}
    </div>
  )
}

function SvgPreview({ content }: { content: string }) {
  return (
    <div
      className="flex items-center justify-center overflow-auto p-4 [&_svg]:max-h-[400px] [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}

function SourceView({ content, language }: { content: string; language?: string }) {
  return (
    <SyntaxHighlighter
      style={oneDark}
      language={language || 'text'}
      PreTag="div"
      customStyle={{
        margin: 0,
        borderRadius: 0,
        fontSize: '0.8rem',
        lineHeight: '1.5',
        background: 'transparent',
      }}
    >
      {content}
    </SyntaxHighlighter>
  )
}

// ────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────
export function ArtifactPreview({ content, language, filename }: ArtifactPreviewProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'source'>('preview')
  const [copied, setCopied] = useState(false)
  const kind = detectKind(content, language)

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = content
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [content])

  const renderPreview = () => {
    switch (kind) {
      case 'html':
        return <HtmlPreview content={content} />
      case 'markdown':
        return <MarkdownPreview content={content} />
      case 'mermaid':
        return <MermaidPreview content={content} />
      case 'svg':
        return <SvgPreview content={content} />
      default:
        return <SourceView content={content} language={language} />
    }
  }

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-[var(--border)] bg-[#282c34]">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-3 py-1.5">
        <div className="flex items-center gap-1">
          {/* Tabs */}
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              activeTab === 'preview'
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('source')}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              activeTab === 'source'
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            Source
          </button>

          {/* Kind badge */}
          <span className="ml-2 rounded bg-[var(--secondary)] px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wider text-[var(--muted-foreground)]">
            {kind}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {filename && (
            <span className="text-xs text-[var(--muted-foreground)]">{filename}</span>
          )}
          <button
            type="button"
            onClick={copyToClipboard}
            className="rounded px-2 py-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="max-h-[500px] overflow-auto">
        {activeTab === 'preview' ? renderPreview() : <SourceView content={content} language={language} />}
      </div>
    </div>
  )
}

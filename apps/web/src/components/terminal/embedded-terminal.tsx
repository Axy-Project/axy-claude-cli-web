'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { wsClient } from '@/lib/ws-client'
import { useTerminalStore } from '@/stores/terminal.store'

interface EmbeddedTerminalProps {
  projectId: string
}

export function EmbeddedTerminal({ projectId }: EmbeddedTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<any>(null)
  const fitAddonRef = useRef<any>(null)
  const terminalIdRef = useRef<string | null>(null)
  const unsubsRef = useRef<(() => void)[]>([])

  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  const { setSession, sessions } = useTerminalStore()
  const existingSession = sessions[projectId]

  const createTerminal = useCallback(async () => {
    if (!containerRef.current) return
    setIsConnecting(true)
    setError(null)

    try {
      // Clean up old instance if any
      if (xtermRef.current) {
        unsubsRef.current.forEach((u) => u())
        unsubsRef.current = []
        xtermRef.current.dispose()
        xtermRef.current = null
      }

      const { Terminal } = await import('@xterm/xterm')
      const { FitAddon } = await import('@xterm/addon-fit')
      const { WebLinksAddon } = await import('@xterm/addon-web-links')

      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        fontSize: 12,
        fontFamily: '"JetBrains Mono", "Fira Code", Menlo, Monaco, monospace',
        lineHeight: 1.2,
        theme: {
          background: '#0d1117',
          foreground: '#c9d1d9',
          cursor: '#58a6ff',
          selectionBackground: '#264f78',
          black: '#484f58',
          red: '#ff7b72',
          green: '#3fb950',
          yellow: '#d29922',
          blue: '#58a6ff',
          magenta: '#bc8cff',
          cyan: '#39c5cf',
          white: '#b1bac4',
          brightBlack: '#6e7681',
          brightRed: '#ffa198',
          brightGreen: '#56d364',
          brightYellow: '#e3b341',
          brightBlue: '#79c0ff',
          brightMagenta: '#d2a8ff',
          brightCyan: '#56d4dd',
          brightWhite: '#f0f6fc',
        },
        allowProposedApi: true,
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.loadAddon(new WebLinksAddon())

      term.open(containerRef.current)
      fitAddon.fit()

      xtermRef.current = term
      fitAddonRef.current = fitAddon

      const unsubs: (() => void)[] = []

      unsubs.push(
        wsClient.on('terminal:created', (data) => {
          const tid = data.terminalId
          terminalIdRef.current = tid
          setConnected(true)
          setIsConnecting(false)
          setSession(projectId, { id: tid, projectId, createdAt: Date.now() })

          wsClient.send('terminal:resize', {
            terminalId: tid,
            cols: term.cols,
            rows: term.rows,
          })
        })
      )

      unsubs.push(
        wsClient.on('terminal:data', (data) => {
          if (data.terminalId === terminalIdRef.current) {
            term.write(data.data)
          }
        })
      )

      unsubs.push(
        wsClient.on('terminal:exit', (data) => {
          if (data.terminalId === terminalIdRef.current) {
            term.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n')
            setConnected(false)
            terminalIdRef.current = null
            setSession(projectId, null)
          }
        })
      )

      unsubs.push(
        wsClient.on('terminal:error' as any, (data: any) => {
          setError(data?.error || 'Terminal failed to start')
          setIsConnecting(false)
        })
      )

      term.onData((data: string) => {
        if (terminalIdRef.current) {
          wsClient.send('terminal:write', { terminalId: terminalIdRef.current, data })
        }
      })

      term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        if (terminalIdRef.current) {
          wsClient.send('terminal:resize', { terminalId: terminalIdRef.current, cols, rows })
        }
      })

      unsubsRef.current = unsubs

      const sent = await wsClient.sendWhenReady('terminal:create', { projectId })
      if (!sent) {
        setError('WebSocket not connected')
        setIsConnecting(false)
      }
    } catch (err) {
      setError('Failed to initialize terminal')
      setIsConnecting(false)
      console.error('[EmbeddedTerminal]', err)
    }
  }, [projectId, setSession])

  // Init on mount
  useEffect(() => {
    createTerminal()

    return () => {
      unsubsRef.current.forEach((u) => u())
      unsubsRef.current = []
      if (xtermRef.current) {
        xtermRef.current.dispose()
        xtermRef.current = null
      }
      // Do NOT destroy server-side terminal — keep it alive for persistence
    }
  }, [createTerminal])

  // Re-fit on resize
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      fitAddonRef.current?.fit()
    })
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }
    return () => observer.disconnect()
  }, [])

  return (
    <div className="flex h-full flex-col bg-[#0d1117]">
      {/* Title bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#30363d] bg-[#161b22] px-3 py-1.5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </div>
          <span className="ml-1 font-mono text-[10px] text-[#8b949e]">
            {terminalIdRef.current ? `terminal:${terminalIdRef.current.slice(0, 8)}` : 'terminal'}
          </span>
          {isConnecting && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400" />
          )}
          {connected && (
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
          )}
        </div>
        <div className="flex items-center gap-1">
          {!connected && !isConnecting && (
            <button
              onClick={createTerminal}
              className="rounded px-2 py-0.5 text-[10px] font-medium text-[#8b949e] transition-colors hover:bg-[#30363d] hover:text-[#c9d1d9]"
            >
              Reconnect
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="shrink-0 border-b border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Terminal */}
      <div
        ref={containerRef}
        className="min-h-0 flex-1"
        style={{ padding: '4px 8px' }}
      />
    </div>
  )
}

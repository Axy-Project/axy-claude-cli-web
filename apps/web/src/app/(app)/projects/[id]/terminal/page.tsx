'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { wsClient } from '@/lib/ws-client'

export default function ProjectTerminalPage() {
  const params = useParams()
  const projectId = params.id as string
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<any>(null)
  const fitAddonRef = useRef<any>(null)
  const [terminalId, setTerminalId] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const terminalIdRef = useRef<string | null>(null)

  const createTerminal = useCallback(async () => {
    if (!terminalRef.current || xtermRef.current) return
    setIsConnecting(true)
    setError(null)

    try {
      // Dynamic imports to avoid SSR issues
      const { Terminal } = await import('@xterm/xterm')
      const { FitAddon } = await import('@xterm/addon-fit')
      const { WebLinksAddon } = await import('@xterm/addon-web-links')

      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        fontSize: 13,
        fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, Monaco, "Courier New", monospace',
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
      const webLinksAddon = new WebLinksAddon()

      term.loadAddon(fitAddon)
      term.loadAddon(webLinksAddon)

      term.open(terminalRef.current!)
      fitAddon.fit()

      xtermRef.current = term
      fitAddonRef.current = fitAddon

      // Listen for terminal created event (register BEFORE sending to avoid race)
      const unsubCreated = wsClient.on('terminal:created', (data) => {
        const tid = data.terminalId
        setTerminalId(tid)
        terminalIdRef.current = tid
        setIsConnecting(false)

        // Send initial size
        wsClient.send('terminal:resize', {
          terminalId: tid,
          cols: term.cols,
          rows: term.rows,
        })
      })

      // Listen for terminal data
      const unsubData = wsClient.on('terminal:data', (data) => {
        if (data.terminalId === terminalIdRef.current) {
          term.write(data.data)
        }
      })

      // Listen for terminal exit
      const unsubExit = wsClient.on('terminal:exit', (data) => {
        if (data.terminalId === terminalIdRef.current) {
          term.write('\r\n\x1b[90m[Process exited with code ' + data.code + ']\x1b[0m\r\n')
          setTerminalId(null)
          terminalIdRef.current = null
        }
      })

      // Listen for terminal errors (e.g. spawn failure)
      const unsubError = wsClient.on('terminal:error' as any, (data: any) => {
        setError(data?.error || 'Terminal failed to start')
        setIsConnecting(false)
      })

      // Send user input to server
      term.onData((data: string) => {
        if (terminalIdRef.current) {
          wsClient.send('terminal:write', {
            terminalId: terminalIdRef.current,
            data,
          })
        }
      })

      // Handle resize
      term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        if (terminalIdRef.current) {
          wsClient.send('terminal:resize', {
            terminalId: terminalIdRef.current,
            cols,
            rows,
          })
        }
      })

      // Store cleanup functions
      ;(term as any)._unsubs = [unsubCreated, unsubData, unsubExit, unsubError]

      // Request terminal creation from server (after listeners are ready)
      const sent = await wsClient.sendWhenReady('terminal:create', { projectId })
      if (!sent) {
        setError('WebSocket not connected. Try refreshing the page.')
        setIsConnecting(false)
      }
    } catch (err) {
      setError('Failed to initialize terminal')
      setIsConnecting(false)
      console.error('[Terminal]', err)
    }
  }, [projectId])

  useEffect(() => {
    createTerminal()

    const handleResize = () => {
      fitAddonRef.current?.fit()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)

      // Clean up terminal
      if (xtermRef.current) {
        const unsubs = (xtermRef.current as any)._unsubs || []
        unsubs.forEach((unsub: () => void) => unsub())
        xtermRef.current.dispose()
        xtermRef.current = null
      }

      // Destroy server-side terminal
      if (terminalIdRef.current) {
        wsClient.send('terminal:destroy', { terminalId: terminalIdRef.current })
      }
    }
  }, [createTerminal])

  // Re-fit when container might have changed
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      fitAddonRef.current?.fit()
    })
    if (terminalRef.current) {
      observer.observe(terminalRef.current)
    }
    return () => observer.disconnect()
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Terminal</h2>
        <div className="flex items-center gap-2">
          {isConnecting && (
            <span className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400" />
              Connecting...
            </span>
          )}
          {terminalId && (
            <span className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              Connected
            </span>
          )}
          {!isConnecting && !terminalId && !error && (
            <button
              onClick={() => {
                if (xtermRef.current) {
                  xtermRef.current.dispose()
                  xtermRef.current = null
                }
                createTerminal()
              }}
              className="rounded border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            >
              New Terminal
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-[var(--border)]">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[#161b22] px-4 py-2">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          </div>
          <span className="ml-2 font-mono text-xs text-[#8b949e]">
            {terminalId ? `terminal:${terminalId.slice(0, 8)}` : 'terminal'}
          </span>
        </div>

        {/* Terminal container */}
        <div
          ref={terminalRef}
          className="h-[calc(100vh-280px)] min-h-[400px] bg-[#0d1117]"
          style={{ padding: '8px' }}
        />
      </div>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { wsClient } from '@/lib/ws-client'

interface ClaudeLoginTerminalProps {
  onSuccess?: (email: string) => void
}

export function ClaudeLoginTerminal({ onSuccess }: ClaudeLoginTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<any>(null)
  const fitAddonRef = useRef<any>(null)
  const terminalIdRef = useRef<string | null>(null)
  const unsubsRef = useRef<(() => void)[]>([])
  const createdRef = useRef(false)

  const [connected, setConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createTerminal = useCallback(async () => {
    if (!containerRef.current || createdRef.current) return
    createdRef.current = true
    setIsConnecting(true)
    setError(null)

    try {
      const { Terminal } = await import('@xterm/xterm')
      const { FitAddon } = await import('@xterm/addon-fit')
      const { WebLinksAddon } = await import('@xterm/addon-web-links')

      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        fontSize: 13,
        fontFamily: '"JetBrains Mono", "Fira Code", Menlo, Monaco, monospace',
        lineHeight: 1.3,
        theme: {
          background: '#0d1117',
          foreground: '#c9d1d9',
          cursor: '#bd9dff',
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
      term.focus()

      xtermRef.current = term
      fitAddonRef.current = fitAddon

      const unsubs: (() => void)[] = []

      unsubs.push(
        wsClient.on('terminal:created', (data) => {
          terminalIdRef.current = data.terminalId
          setConnected(true)
          setIsConnecting(false)
          wsClient.send('terminal:resize', {
            terminalId: data.terminalId,
            cols: term.cols,
            rows: term.rows,
          })
        })
      )

      unsubs.push(
        wsClient.on('terminal:data', (data) => {
          if (data.terminalId === terminalIdRef.current) {
            term.write(data.data)

            // Detect login success
            if (data.data.includes('Login successful') || data.data.includes('Already logged in')) {
              onSuccess?.('')
            }
          }
        })
      )

      unsubs.push(
        wsClient.on('terminal:exit', (data) => {
          if (data.terminalId === terminalIdRef.current) {
            term.write('\r\n\x1b[90m[Terminal closed]\x1b[0m\r\n')
            setConnected(false)
            terminalIdRef.current = null
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

      // Ensure WS is connected
      const token = localStorage.getItem('axy_token')
      if (token && !wsClient.isConnected) {
        wsClient.setToken(token)
        wsClient.connect()
      }

      const sent = await wsClient.sendWhenReady('terminal:create-login', {}, 10000)
      if (!sent) {
        setError('WebSocket not connected')
        setIsConnecting(false)
      }
    } catch (err) {
      setError('Failed to initialize terminal')
      setIsConnecting(false)
      console.error('[ClaudeLoginTerminal]', err)
    }
  }, [onSuccess])

  useEffect(() => {
    createTerminal()
    return () => {
      unsubsRef.current.forEach((u) => u())
      unsubsRef.current = []
      if (xtermRef.current) {
        xtermRef.current.dispose()
        xtermRef.current = null
      }
      if (terminalIdRef.current) {
        wsClient.send('terminal:destroy', { terminalId: terminalIdRef.current })
        terminalIdRef.current = null
      }
      createdRef.current = false
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
    <div className="space-y-3">
      <div className="overflow-hidden rounded-[0.5rem]" style={{ border: '1px solid rgba(72,72,71,0.3)' }}>
        {/* Title bar */}
        <div className="flex items-center justify-between px-3 py-1.5" style={{ background: '#161b22', borderBottom: '1px solid rgba(72,72,71,0.2)' }}>
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            </div>
            <span className="font-mono text-[10px] text-[#8b949e]">terminal</span>
            {isConnecting && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400" />}
            {connected && <span className="h-1.5 w-1.5 rounded-full bg-green-400" />}
          </div>
        </div>

        {error && (
          <div className="border-b border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Terminal */}
        <div
          ref={containerRef}
          className="cursor-text"
          style={{ background: '#0d1117', padding: '4px 8px', height: '300px' }}
          onClick={() => xtermRef.current?.focus()}
        />
      </div>

      <p className="text-[11px] text-[#767575]">
        Type <code className="rounded bg-[#0e0e0e] px-1.5 py-0.5 text-[#bd9dff]">claude</code> and follow the login prompts. You can click links directly in the terminal.
      </p>
    </div>
  )
}

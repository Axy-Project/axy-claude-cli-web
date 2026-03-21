'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { wsClient } from '@/lib/ws-client'

interface ClaudeLoginTerminalProps {
  onSuccess?: (email: string) => void
}

export function ClaudeLoginTerminal({ onSuccess }: ClaudeLoginTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<any>(null)
  const terminalIdRef = useRef<string | null>(null)
  const createdRef = useRef(false)
  const [connected, setConnected] = useState(false)

  const createTerminal = useCallback(async () => {
    if (!containerRef.current || createdRef.current) return
    createdRef.current = true

    try {
      const { Terminal } = await import('@xterm/xterm')
      const { FitAddon } = await import('@xterm/addon-fit')

      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        fontSize: 13,
        fontFamily: '"JetBrains Mono", "Fira Code", Menlo, Monaco, monospace',
        lineHeight: 1.3,
        theme: {
          background: '#0a0a0a',
          foreground: '#c9d1d9',
          cursor: '#bd9dff',
          selectionBackground: '#264f78',
        },
        allowProposedApi: true,
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(containerRef.current)
      setTimeout(() => { fitAddon.fit(); term.focus() }, 100)

      xtermRef.current = term

      const unsubs: (() => void)[] = []

      unsubs.push(
        wsClient.on('terminal:created', (data) => {
          terminalIdRef.current = data.terminalId
          setConnected(true)
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
          }
        })
      )

      unsubs.push(
        wsClient.on('terminal:exit', (data) => {
          if (data.terminalId === terminalIdRef.current) {
            term.write('\r\n\x1b[90m[Terminal closed]\x1b[0m\r\n')
            setConnected(false)
          }
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

      ;(term as any)._unsubs = unsubs

      // Ensure WS connected
      const token = localStorage.getItem('axy_token')
      if (token && !wsClient.isConnected) {
        wsClient.setToken(token)
        wsClient.connect()
      }

      await wsClient.sendWhenReady('terminal:create-login', {}, 10000)
    } catch (err) {
      console.error('[ClaudeLoginTerminal]', err)
    }
  }, [])

  useEffect(() => {
    createTerminal()
    return () => {
      if (xtermRef.current) {
        const unsubs = (xtermRef.current as any)._unsubs || []
        unsubs.forEach((u: () => void) => u())
        xtermRef.current.dispose()
        xtermRef.current = null
      }
      if (terminalIdRef.current) {
        wsClient.send('terminal:destroy', { terminalId: terminalIdRef.current })
      }
    }
  }, [createTerminal])

  return (
    <div className="space-y-3">
      {/* Instructions */}
      <div className="rounded-[0.375rem] px-4 py-3 text-xs" style={{ background: 'rgba(189,157,255,0.06)', border: '1px solid rgba(189,157,255,0.15)' }}>
        <p className="font-medium text-white">Steps:</p>
        <ol className="mt-2 space-y-1 text-[#adaaaa]">
          <li>1. Type <code className="rounded bg-[#0e0e0e] px-1.5 py-0.5 text-[#bd9dff]">claude auth login</code> in the terminal below and press Enter</li>
          <li>2. A URL will appear — open it in your browser and authorize</li>
          <li>3. Copy the code from Claude and paste it back in the terminal</li>
          <li>4. Click <strong className="text-white">Check Connection</strong> below to verify</li>
        </ol>
      </div>

      {/* Real terminal */}
      <div className="overflow-hidden rounded-[0.5rem]" style={{ border: '1px solid rgba(72,72,71,0.2)' }}>
        <div className="flex items-center justify-between px-3 py-1.5" style={{ background: '#131313', borderBottom: '1px solid rgba(72,72,71,0.15)' }}>
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
              <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
              <span className="h-2 w-2 rounded-full bg-[#28c840]" />
            </div>
            <span className="font-mono text-[10px] text-[#767575]">terminal</span>
          </div>
          {connected && <span className="h-1.5 w-1.5 rounded-full bg-green-400" />}
        </div>
        <div
          ref={containerRef}
          className="cursor-text"
          style={{ background: '#0a0a0a', padding: '4px 8px', height: '220px' }}
          onClick={() => xtermRef.current?.focus()}
        />
      </div>
    </div>
  )
}

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
  const [isConnecting, setIsConnecting] = useState(false)
  const [connected, setConnected] = useState(false)

  const createTerminal = useCallback(async () => {
    if (!containerRef.current || xtermRef.current) return
    setIsConnecting(true)

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
      fitAddon.fit()

      xtermRef.current = term

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

            // Check if login was successful
            const text = data.data.toString()
            if (text.includes('Login successful') || text.includes('Already logged in')) {
              onSuccess?.('')
            }
          }
        })
      )

      unsubs.push(
        wsClient.on('terminal:exit', (data) => {
          if (data.terminalId === terminalIdRef.current) {
            term.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n')
            setConnected(false)
          }
        })
      )

      // Send user input to server
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

      // Request login terminal creation
      const sent = await wsClient.sendWhenReady('terminal:create-login', {})
      if (!sent) {
        setIsConnecting(false)
      }
    } catch (err) {
      console.error('[ClaudeLoginTerminal]', err)
      setIsConnecting(false)
    }
  }, [onSuccess])

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

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      // Fit handled by FitAddon
    })
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="overflow-hidden rounded-[0.5rem]" style={{ border: '1px solid rgba(72,72,71,0.2)' }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ background: '#131313', borderBottom: '1px solid rgba(72,72,71,0.15)' }}>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </div>
          <span className="font-mono text-[10px] text-[#767575]">claude auth login</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isConnecting && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400" />}
          {connected && <span className="h-1.5 w-1.5 rounded-full bg-green-400" />}
          {!connected && !isConnecting && (
            <button onClick={() => { if (xtermRef.current) { xtermRef.current.dispose(); xtermRef.current = null }; createTerminal() }}
              className="rounded px-2 py-0.5 text-[10px] text-[#bd9dff] hover:bg-[#bd9dff]/10">
              Retry
            </button>
          )}
        </div>
      </div>
      <div ref={containerRef} className="h-52" style={{ background: '#0a0a0a', padding: '4px 8px' }} />
      <div className="px-3 py-1.5 text-[10px] text-[#767575]" style={{ background: '#131313', borderTop: '1px solid rgba(72,72,71,0.1)' }}>
        Paste the code from Claude directly into the terminal above (Ctrl+V / Cmd+V)
      </div>
    </div>
  )
}

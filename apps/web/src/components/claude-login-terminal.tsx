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
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const outputRef = useRef('')

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
            outputRef.current += data.data

            // Extract auth URL from output
            const clean = outputRef.current.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\r?\n/g, '')
            const urlMatch = clean.match(/(https:\/\/claude\.ai\/oauth\/authorize[^\s"'<>]+)/)
            if (urlMatch && !authUrl) {
              let url = urlMatch[1]
              if (!url.includes('code_challenge_method')) url += '&code_challenge_method=S256'
              setAuthUrl(url)
            }

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

      // Ensure WS has the token (setup wizard may have just set it)
      const token = localStorage.getItem('axy_token')
      if (token && !wsClient.isConnected) {
        wsClient.setToken(token)
        wsClient.connect()
      }

      // Request login terminal creation (wait up to 10s for WS)
      const sent = await wsClient.sendWhenReady('terminal:create-login', {}, 10000)
      if (!sent) {
        term.write('\x1b[31mFailed to connect WebSocket. Try refreshing the page.\x1b[0m\r\n')
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

  const handleSubmitCode = useCallback(async () => {
    if (!codeInput.trim() || !terminalIdRef.current) return
    setSubmitting(true)
    // Send the code to the real terminal PTY
    wsClient.send('terminal:write', { terminalId: terminalIdRef.current, data: codeInput.trim() + '\r' })
    setCodeInput('')
    // Poll for success
    let attempts = 0
    const poll = setInterval(async () => {
      attempts++
      if (outputRef.current.includes('Login successful') || outputRef.current.includes('Already logged in')) {
        clearInterval(poll)
        setSubmitting(false)
        onSuccess?.('')
      } else if (attempts >= 15) {
        clearInterval(poll)
        setSubmitting(false)
      }
    }, 2000)
  }, [codeInput, onSuccess])

  return (<>
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
      <div ref={containerRef} className="h-40" style={{ background: '#0a0a0a', padding: '4px 8px' }} />
    </div>

    {/* Step 1: Open auth URL */}
    {authUrl && (
      <a href={authUrl} target="_blank" rel="noopener noreferrer"
        className="mt-3 block w-full rounded-[0.375rem] px-4 py-2.5 text-center text-sm font-medium text-white transition-all hover:brightness-110"
        style={{ background: 'linear-gradient(135deg, #bd9dff, #8a4cfc)' }}>
        1. Open Authorization Page
      </a>
    )}

    {/* Step 2: Paste code */}
    {authUrl && (
      <div className="mt-3">
        <p className="mb-2 text-xs text-[#adaaaa]">2. Paste the authentication code:</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && codeInput.trim()) handleSubmitCode() }}
            placeholder="Paste code from Claude..."
            className="flex-1 rounded-[0.375rem] px-3 py-2 font-mono text-sm text-white outline-none placeholder:text-[#767575]/50 focus:ring-1 focus:ring-[#bd9dff]"
            style={{ background: '#000', border: '1px solid rgba(72,72,71,0.2)' }}
          />
          <button
            onClick={handleSubmitCode}
            disabled={!codeInput.trim() || submitting}
            className="shrink-0 rounded-[0.375rem] px-4 py-2 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #bd9dff, #8a4cfc)' }}>
            {submitting ? 'Verifying...' : 'Submit Code'}
          </button>
        </div>
      </div>
    )}
    </>
  )
}

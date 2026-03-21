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
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const outputRef = useRef('')

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
        rightClickSelectsWord: true,
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(containerRef.current)
      setTimeout(() => { fitAddon.fit(); term.focus() }, 200)

      xtermRef.current = term
      const unsubs: (() => void)[] = []

      unsubs.push(wsClient.on('terminal:created', (data) => {
        terminalIdRef.current = data.terminalId
        setConnected(true)
        wsClient.send('terminal:resize', { terminalId: data.terminalId, cols: term.cols, rows: term.rows })
      }))

      unsubs.push(wsClient.on('terminal:data', (data) => {
        if (data.terminalId === terminalIdRef.current) {
          term.write(data.data)
          outputRef.current += data.data

          // Extract auth URL
          const clean = outputRef.current.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\r?\n/g, '')
          const match = clean.match(/(https:\/\/claude\.ai\/oauth\/authorize\S+)/)
            || clean.match(/(https:\/\/platform\.claude\.com\/oauth\S+)/)
          if (match && !authUrl) {
            let url = match[1]
            if (!url.includes('code_challenge_method')) url += '&code_challenge_method=S256'
            setAuthUrl(url)
          }

          // Detect success
          if (data.data.includes('Login successful') || data.data.includes('Already logged in')) {
            onSuccess?.('')
          }
        }
      }))

      unsubs.push(wsClient.on('terminal:exit', (data) => {
        if (data.terminalId === terminalIdRef.current) {
          term.write('\r\n\x1b[90m[Terminal closed]\x1b[0m\r\n')
          setConnected(false)
        }
      }))

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

      const token = localStorage.getItem('axy_token')
      if (token && !wsClient.isConnected) {
        wsClient.setToken(token)
        wsClient.connect()
      }

      await wsClient.sendWhenReady('terminal:create-login', {}, 10000)
    } catch (err) {
      console.error('[ClaudeLoginTerminal]', err)
    }
  }, [onSuccess, authUrl])

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
        <ol className="mt-2 space-y-1.5 text-[#adaaaa]">
          <li className="flex items-start gap-2">
            <span className="shrink-0 text-[#bd9dff]">1.</span>
            <span>Type <code className="rounded bg-[#0e0e0e] px-1.5 py-0.5 text-[#bd9dff]">claude</code> in the terminal below and press Enter</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="shrink-0 text-[#bd9dff]">2.</span>
            <span>Follow the login prompts — a URL will appear, open it in your browser</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="shrink-0 text-[#bd9dff]">3.</span>
            <span>Paste the code back into the terminal (<strong className="text-white">right-click → paste</strong> or <strong className="text-white">Ctrl+Shift+V</strong>)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="shrink-0 text-[#bd9dff]">4.</span>
            <span>Click <strong className="text-white">Check Connection</strong> below when done</span>
          </li>
        </ol>
        <p className="mt-2 text-[10px] text-[#767575]">Tip: To copy text from the terminal, select it and use <strong>right-click → copy</strong> or <strong>Ctrl+Shift+C</strong></p>
      </div>

      {/* Terminal */}
      <div className="overflow-hidden rounded-[0.5rem]" style={{ border: '1px solid rgba(72,72,71,0.2)' }}>
        <div className="flex items-center justify-between px-3 py-1.5" style={{ background: '#131313', borderBottom: '1px solid rgba(72,72,71,0.15)' }}>
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
              <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
              <span className="h-2 w-2 rounded-full bg-[#28c840]" />
            </div>
            <span className="font-mono text-[10px] text-[#767575]">bash</span>
          </div>
          {connected && <span className="h-1.5 w-1.5 rounded-full bg-green-400" />}
        </div>
        <div
          ref={containerRef}
          className="cursor-text"
          style={{ background: '#0a0a0a', padding: '4px 8px', height: '250px' }}
          onClick={() => xtermRef.current?.focus()}
        />
      </div>

      {/* Auth URL helper — extracted from terminal output */}
      {authUrl && (
        <div className="flex gap-2">
          <button
            onClick={() => { window.open(authUrl, '_blank') }}
            className="flex-1 rounded-[0.375rem] px-4 py-2 text-center text-sm font-medium text-white transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #bd9dff, #8a4cfc)' }}
          >
            Open Auth URL in Browser
          </button>
          <button
            onClick={() => { navigator.clipboard.writeText(authUrl); }}
            className="shrink-0 rounded-[0.375rem] px-3 py-2 text-xs text-[#adaaaa] transition-colors hover:text-white"
            style={{ border: '1px solid rgba(72,72,71,0.2)' }}
          >
            Copy URL
          </button>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api-client'

interface PortInfo {
  port: number
  pid: number
  process: string
  protocol: string
  state: string
  isWeb: boolean
}

interface ConsoleEntry {
  level: 'log' | 'warn' | 'error'
  args: string[]
  time: string
}

interface ScriptInfo {
  name: string
  command: string
}

interface DevServerStatus {
  running: boolean
  port?: number
  log: string[]
}

export default function PortsPage() {
  const params = useParams()
  const projectId = params.id as string

  const [ports, setPorts] = useState<PortInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [previewPort, setPreviewPort] = useState<number | null>(null)

  // Dev server state
  const [scripts, setScripts] = useState<ScriptInfo[]>([])
  const [packageManager, setPackageManager] = useState('npm')
  const [selectedScript, setSelectedScript] = useState('')
  const [devStatus, setDevStatus] = useState<DevServerStatus>({ running: false, log: [] })
  const [starting, setStarting] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  // Console capture from proxied iframe
  const [consoleLogs, setConsoleLogs] = useState<ConsoleEntry[]>([])
  const [showConsole, setShowConsole] = useState(false)
  const consoleRef = useRef<HTMLDivElement>(null)

  const fetchPorts = useCallback(async () => {
    try {
      const data = await api.get<PortInfo[]>('/api/ports')
      setPorts(data)
    } catch (err) {
      console.error('Failed to fetch ports:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchScripts = useCallback(async () => {
    try {
      const data = await api.get<{ scripts: ScriptInfo[]; packageManager: string }>(
        `/api/ports/project/${projectId}/scripts`
      )
      setScripts(data.scripts)
      setPackageManager(data.packageManager)
      if (data.scripts.length > 0 && !selectedScript) {
        setSelectedScript(data.scripts[0].name)
      }
    } catch (err) {
      console.error('Failed to fetch scripts:', err)
    }
  }, [projectId, selectedScript])

  const fetchDevStatus = useCallback(async () => {
    try {
      const data = await api.get<DevServerStatus>(`/api/ports/project/${projectId}/status`)
      setDevStatus(data)
      // Auto-preview when port is detected
      if (data.running && data.port && !previewPort) {
        setPreviewPort(data.port)
      }
    } catch (err) {
      console.error('Failed to fetch dev status:', err)
    }
  }, [projectId, previewPort])

  useEffect(() => {
    fetchPorts()
    fetchScripts()
    fetchDevStatus()
    const interval = setInterval(() => {
      fetchPorts()
      fetchDevStatus()
    }, 3000)
    return () => clearInterval(interval)
  }, [fetchPorts, fetchScripts, fetchDevStatus])

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [devStatus.log])

  // Auto-scroll console
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight
    }
  }, [consoleLogs])

  // Listen for console messages from proxied iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'axy:console') {
        const entry: ConsoleEntry = {
          level: e.data.level || 'log',
          args: e.data.args || [],
          time: new Date().toLocaleTimeString(),
        }
        setConsoleLogs((prev) => [...prev.slice(-500), entry])
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // Clear console when preview port changes
  useEffect(() => {
    setConsoleLogs([])
  }, [previewPort])

  const startDevServer = async () => {
    if (!selectedScript) return
    setStarting(true)
    try {
      await api.post(`/api/ports/project/${projectId}/start`, { script: selectedScript })
      // Poll status quickly to catch the port
      setTimeout(fetchDevStatus, 1000)
      setTimeout(fetchDevStatus, 3000)
      setTimeout(fetchDevStatus, 5000)
    } catch (err) {
      console.error('Failed to start dev server:', err)
    } finally {
      setStarting(false)
    }
  }

  const stopDevServer = async () => {
    try {
      await api.post(`/api/ports/project/${projectId}/stop`, {})
      setDevStatus({ running: false, log: [] })
      setPreviewPort(null)
    } catch (err) {
      console.error('Failed to stop dev server:', err)
    }
  }

  const apiBase = typeof window !== 'undefined' ? `http://${window.location.hostname}:3456` : ''
  const proxyUrl = (port: number, path = '/') => `${apiBase}/api/ports/${port}/proxy${path}`

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Preview</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Start dev servers and preview your web app live.
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchPorts() }}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
        >
          <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Dev Server Controls */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Dev Server</h3>
          {devStatus.running && (
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
              </span>
              <span className="text-xs text-green-400">
                Running{devStatus.port ? ` on :${devStatus.port}` : ''}
              </span>
            </div>
          )}
        </div>

        {scripts.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            No dev scripts found in package.json
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <select
              value={selectedScript}
              onChange={(e) => setSelectedScript(e.target.value)}
              disabled={devStatus.running}
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--foreground)] disabled:opacity-50"
            >
              {scripts.map((s) => (
                <option key={s.name} value={s.name}>
                  {packageManager} run {s.name} — {s.command}
                </option>
              ))}
            </select>

            {devStatus.running ? (
              <button
                onClick={stopDevServer}
                className="flex items-center gap-1.5 rounded-lg bg-red-500/15 px-4 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/25"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
                Stop
              </button>
            ) : (
              <button
                onClick={startDevServer}
                disabled={starting || !selectedScript}
                className="flex items-center gap-1.5 rounded-lg bg-green-500/15 px-4 py-1.5 text-sm font-medium text-green-400 transition-colors hover:bg-green-500/25 disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                {starting ? 'Starting...' : 'Start'}
              </button>
            )}
          </div>
        )}

        {/* Log output */}
        {devStatus.running && devStatus.log.length > 0 && (
          <div
            ref={logRef}
            className="mt-3 max-h-32 overflow-auto rounded-lg bg-[var(--background)] p-2 font-mono text-[11px] text-[var(--muted-foreground)]"
          >
            {devStatus.log.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap break-all">{line}</div>
            ))}
          </div>
        )}
      </div>

      {/* Port list */}
      <div className="grid gap-2">
        {loading && ports.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">Scanning ports...</div>
        ) : ports.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">No open ports found</div>
        ) : (
          ports.map((p) => (
            <div
              key={p.port}
              className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 transition-colors hover:bg-[var(--secondary)]/50"
            >
              {/* Port number */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/15">
                <span className="font-mono text-sm font-bold text-[var(--primary)]">{p.port}</span>
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--foreground)]">{p.process}</span>
                  <span className="rounded bg-[var(--secondary)] px-1.5 py-0.5 text-[10px] text-[var(--muted-foreground)]">
                    PID {p.pid}
                  </span>
                  {p.isWeb && (
                    <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] text-green-400">
                      web
                    </span>
                  )}
                </div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  {p.protocol.toUpperCase()} · {p.state}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {p.isWeb && (
                  <>
                    <button
                      onClick={() => setPreviewPort(previewPort === p.port ? null : p.port)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        previewPort === p.port
                          ? 'bg-[var(--primary)] text-white'
                          : 'border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      {previewPort === p.port ? 'Close' : 'Preview'}
                    </button>
                    <a
                      href={proxyUrl(p.port)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
                    >
                      Open
                    </a>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Preview iframe */}
      {previewPort && (
        <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-[var(--border)] overflow-hidden" style={{ minHeight: '400px' }}>
          <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--secondary)] px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              <span className="text-xs font-medium text-[var(--foreground)]">
                localhost:{previewPort}
              </span>
              <span className="text-[10px] text-[var(--muted-foreground)]">
                (proxied through Axy server)
              </span>
            </div>
            <div className="flex items-center gap-1">
              {/* Console toggle */}
              <button
                onClick={() => setShowConsole(!showConsole)}
                className={`relative rounded p-1 transition-colors ${
                  showConsole
                    ? 'bg-[var(--accent)] text-[var(--foreground)]'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]'
                }`}
                title="Toggle console"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {consoleLogs.filter((l) => l.level === 'error').length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {consoleLogs.filter((l) => l.level === 'error').length}
                  </span>
                )}
              </button>
              <a
                href={proxyUrl(previewPort)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                title="Open in new tab"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <button
                onClick={() => setPreviewPort(null)}
                className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <iframe
            src={proxyUrl(previewPort)}
            className={showConsole ? 'h-[60%] bg-white' : 'flex-1 bg-white'}
            title={`Preview localhost:${previewPort}`}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />

          {/* Console panel */}
          {showConsole && (
            <div className="flex h-[40%] flex-col border-t border-[var(--border)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--background)] px-3 py-1.5">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-[var(--foreground)]">Console</span>
                  <div className="flex items-center gap-2 text-[10px]">
                    {consoleLogs.filter((l) => l.level === 'error').length > 0 && (
                      <span className="text-red-400">
                        {consoleLogs.filter((l) => l.level === 'error').length} errors
                      </span>
                    )}
                    {consoleLogs.filter((l) => l.level === 'warn').length > 0 && (
                      <span className="text-yellow-400">
                        {consoleLogs.filter((l) => l.level === 'warn').length} warnings
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setConsoleLogs([])}
                  className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  title="Clear console"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </button>
              </div>
              <div
                ref={consoleRef}
                className="flex-1 overflow-auto bg-[#0d1117] p-2 font-mono text-[11px]"
              >
                {consoleLogs.length === 0 ? (
                  <div className="py-4 text-center text-[var(--muted-foreground)]">No console output</div>
                ) : (
                  consoleLogs.map((entry, i) => (
                    <div
                      key={i}
                      className={`flex gap-2 border-b border-white/5 px-1 py-0.5 ${
                        entry.level === 'error'
                          ? 'bg-red-500/5 text-red-400'
                          : entry.level === 'warn'
                            ? 'bg-yellow-500/5 text-yellow-400'
                            : 'text-[#c9d1d9]'
                      }`}
                    >
                      <span className="shrink-0 text-[var(--muted-foreground)]">{entry.time}</span>
                      <span className="shrink-0 w-10 text-right">
                        {entry.level === 'error' ? 'ERR' : entry.level === 'warn' ? 'WARN' : 'LOG'}
                      </span>
                      <span className="whitespace-pre-wrap break-all">{entry.args.join(' ')}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

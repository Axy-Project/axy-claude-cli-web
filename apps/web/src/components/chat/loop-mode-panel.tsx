'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export interface LoopModeConfig {
  enabled: boolean
  prompt: string
  intervalMinutes: number
  maxIterations: number
  currentIteration: number
  isPaused: boolean
}

const DEFAULT_CONFIG: LoopModeConfig = {
  enabled: false,
  prompt: '',
  intervalMinutes: 10,
  maxIterations: 0, // 0 = unlimited
  currentIteration: 0,
  isPaused: false,
}

const INTERVAL_PRESETS = [
  { label: '1m', value: 1 },
  { label: '5m', value: 5 },
  { label: '10m', value: 10 },
  { label: '30m', value: 30 },
  { label: '1h', value: 60 },
]

export function LoopModePanel({
  sessionId,
  isStreaming,
  onSendMessage,
  onCollapse,
}: {
  sessionId: string
  isStreaming: boolean
  onSendMessage: (content: string) => void
  onCollapse: () => void
}) {
  const [config, setConfig] = useState<LoopModeConfig>(() => {
    try {
      const saved = localStorage.getItem(`axy-loop-${sessionId}`)
      return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG
    } catch {
      return DEFAULT_CONFIG
    }
  })

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const nextRunRef = useRef<number>(0)
  const [countdown, setCountdown] = useState<string>('')

  // Persist config
  useEffect(() => {
    try {
      localStorage.setItem(`axy-loop-${sessionId}`, JSON.stringify(config))
    } catch {}
  }, [config, sessionId])

  // Countdown display
  useEffect(() => {
    if (!config.enabled || config.isPaused) {
      setCountdown('')
      return
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, nextRunRef.current - Date.now())
      if (remaining <= 0) {
        setCountdown('Sending...')
        return
      }
      const mins = Math.floor(remaining / 60000)
      const secs = Math.floor((remaining % 60000) / 1000)
      setCountdown(mins > 0 ? `${mins}m ${secs}s` : `${secs}s`)
    }, 1000)

    return () => clearInterval(interval)
  }, [config.enabled, config.isPaused])

  const executeLoop = useCallback(() => {
    if (!config.prompt.trim() || isStreaming) return

    // Check max iterations
    if (config.maxIterations > 0 && config.currentIteration >= config.maxIterations) {
      setConfig((c) => ({ ...c, enabled: false, currentIteration: 0 }))
      return
    }

    onSendMessage(config.prompt)
    setConfig((c) => ({ ...c, currentIteration: c.currentIteration + 1 }))
  }, [config.prompt, config.maxIterations, config.currentIteration, isStreaming, onSendMessage])

  // Main loop timer
  useEffect(() => {
    if (!config.enabled || config.isPaused || !config.prompt.trim()) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    // Schedule next run
    nextRunRef.current = Date.now() + config.intervalMinutes * 60 * 1000

    timerRef.current = setInterval(() => {
      if (!isStreaming) {
        executeLoop()
        nextRunRef.current = Date.now() + config.intervalMinutes * 60 * 1000
      }
    }, config.intervalMinutes * 60 * 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [config.enabled, config.isPaused, config.prompt, config.intervalMinutes, isStreaming, executeLoop])

  const startLoop = () => {
    if (!config.prompt.trim()) return
    setConfig((c) => ({ ...c, enabled: true, isPaused: false, currentIteration: 0 }))
    // Send immediately on first iteration
    onSendMessage(config.prompt)
    setConfig((c) => ({ ...c, currentIteration: 1 }))
  }

  const stopLoop = () => {
    setConfig((c) => ({ ...c, enabled: false, isPaused: false, currentIteration: 0 }))
  }

  const togglePause = () => {
    setConfig((c) => ({ ...c, isPaused: !c.isPaused }))
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]" style={{ borderColor: config.enabled ? 'rgba(168,85,247,0.3)' : undefined }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-xs font-medium text-[var(--foreground)]">Loop Mode</span>
          {config.enabled && (
            <span className="flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-400">
              {config.isPaused ? 'PAUSED' : 'RUNNING'}
              {!config.isPaused && countdown && <span className="text-purple-300">({countdown})</span>}
            </span>
          )}
          {config.enabled && config.maxIterations > 0 && (
            <span className="text-[10px] text-[var(--muted-foreground)]">
              {config.currentIteration}/{config.maxIterations}
            </span>
          )}
          {config.enabled && config.maxIterations === 0 && (
            <span className="text-[10px] text-[var(--muted-foreground)]">
              #{config.currentIteration}
            </span>
          )}
        </div>
        <button
          onClick={onCollapse}
          className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Prompt */}
      <div className="px-3 pb-2">
        <textarea
          value={config.prompt}
          onChange={(e) => setConfig((c) => ({ ...c, prompt: e.target.value }))}
          disabled={config.enabled}
          placeholder="Enter the prompt to run on each loop iteration..."
          className="w-full resize-none rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-2 text-xs text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:border-purple-500/50 focus:outline-none disabled:opacity-50"
          rows={3}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 px-3 pb-3">
        {/* Interval selector */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[var(--muted-foreground)]">Every</span>
          <div className="flex rounded-md border border-[var(--border)] bg-[var(--secondary)]">
            {INTERVAL_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setConfig((c) => ({ ...c, intervalMinutes: preset.value }))}
                disabled={config.enabled}
                className={`px-2 py-0.5 text-[10px] font-medium transition-colors first:rounded-l-md last:rounded-r-md disabled:opacity-50 ${
                  config.intervalMinutes === preset.value
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Max iterations */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[var(--muted-foreground)]">Max</span>
          <input
            type="number"
            min={0}
            value={config.maxIterations}
            onChange={(e) => setConfig((c) => ({ ...c, maxIterations: Math.max(0, parseInt(e.target.value) || 0) }))}
            disabled={config.enabled}
            className="w-12 rounded border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5 text-center text-[10px] text-[var(--foreground)] focus:border-purple-500/50 focus:outline-none disabled:opacity-50"
            title="Max iterations (0 = unlimited)"
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons */}
        {!config.enabled ? (
          <button
            onClick={startLoop}
            disabled={!config.prompt.trim() || isStreaming}
            className="flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1 text-[11px] font-medium text-white transition-colors hover:bg-purple-500 disabled:opacity-40"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            </svg>
            Start Loop
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={togglePause}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                config.isPaused
                  ? 'bg-green-600 text-white hover:bg-green-500'
                  : 'bg-amber-600 text-white hover:bg-amber-500'
              }`}
            >
              {config.isPaused ? (
                <>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  </svg>
                  Resume
                </>
              ) : (
                <>
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                  Pause
                </>
              )}
            </button>
            <button
              onClick={stopLoop}
              className="flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-red-500"
            >
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
              Stop
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

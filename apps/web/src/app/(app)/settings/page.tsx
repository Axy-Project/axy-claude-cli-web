'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { useAccountStore } from '@/stores/account.store'
import { api } from '@/lib/api-client'
import { notifications } from '@/lib/notifications'
import {
  THEME_PRESETS,
  applyTheme,
  getStoredTheme,
  storeTheme,
  getForegroundForColor,
} from '@/lib/theme'
import type { ConnectedAccount, ConnectedAccountType } from '@axy/shared'

export default function UserSettingsPage() {
  const user = useAuthStore((s) => s.user)
  const [isSaved, setIsSaved] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    theme: 'system' as 'light' | 'dark' | 'system',
  })

  // Notification state
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default')

  // Color theme state
  const [colorThemeId, setColorThemeId] = useState('default')
  const [customColor, setCustomColor] = useState('#7c3aed')

  // Connected accounts
  const { accounts, fetchAccounts, createAccount, updateAccount, deleteAccount, testAccount } = useAccountStore()
  const [showAddAccount, setShowAddAccount] = useState<ConnectedAccountType | null>(null)
  const [newAccount, setNewAccount] = useState({ nickname: '', token: '' })
  const [isAddingAccount, setIsAddingAccount] = useState(false)
  const [testingAccountId, setTestingAccountId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ id: string; valid: boolean; username?: string } | null>(null)

  // Claude CLI auth
  const [claudeStatus, setClaudeStatus] = useState<{
    cliLoggedIn: boolean; cliEmail: string | null; cliAuthMethod: string | null; cliSubscription: string | null
  } | null>(null)
  const [claudeLoginUrl, setClaudeLoginUrl] = useState<string | null>(null)
  const [claudeLoggingIn, setClaudeLoggingIn] = useState(false)
  const [claudeLoginPollRef] = useState<{ current: ReturnType<typeof setInterval> | null }>({ current: null })

  useEffect(() => {
    fetchAccounts()
    api.get<any>('/api/claude/status').then(setClaudeStatus).catch(() => {})
  }, [fetchAccounts])

  useEffect(() => {
    if (user) {
      setForm({
        displayName: user.displayName || '',
        email: user.email || '',
        theme: (localStorage.getItem('axy_theme') as 'light' | 'dark' | 'system') || 'system',
      })
    }

    // Load stored color theme
    const stored = getStoredTheme()
    setColorThemeId(stored.id)
    if (stored.customColor) setCustomColor(stored.customColor)

    // Check notification permission
    if (!('Notification' in window)) {
      setNotifPermission('unsupported')
    } else {
      setNotifPermission(Notification.permission)
    }
  }, [user])

  const handleEnableNotifications = useCallback(async () => {
    const granted = await notifications.requestPermission()
    setNotifPermission(granted ? 'granted' : 'denied')
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      // Theme is applied client-side
      localStorage.setItem('axy_theme', form.theme)
      applyLightDarkTheme(form.theme)
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
    } catch (err) {
      console.error('Save settings error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const applyLightDarkTheme = (theme: 'light' | 'dark' | 'system') => {
    const root = document.documentElement
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
    } else {
      root.setAttribute('data-theme', theme)
    }
  }

  const handleSelectColorTheme = (id: string) => {
    setColorThemeId(id)
    if (id === 'custom') {
      applyTheme('custom', customColor)
      storeTheme('custom', customColor)
    } else {
      applyTheme(id)
      storeTheme(id)
    }
  }

  const handleCustomColorChange = (color: string) => {
    setCustomColor(color)
    if (colorThemeId === 'custom') {
      applyTheme('custom', color)
      storeTheme('custom', color)
    }
  }

  if (!user) {
    return <div className="animate-pulse text-[var(--muted-foreground)]">Loading settings...</div>
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Profile section */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="mb-3 font-medium">Profile</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Display Name</label>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input
                type="email"
                value={form.email}
                disabled
                className="w-full rounded-lg border border-[var(--input)] bg-[var(--secondary)] px-3 py-2 text-sm opacity-60"
              />
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Email cannot be changed here.
              </p>
            </div>

            {user.githubUsername && (
              <div>
                <label className="mb-1 block text-sm font-medium">GitHub</label>
                <div className="rounded-lg border border-[var(--input)] bg-[var(--secondary)] px-3 py-2 font-mono text-sm">
                  {user.githubUsername}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Theme section */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="mb-3 font-medium">Appearance</h2>

          <div className="flex gap-3">
            {(['light', 'dark', 'system'] as const).map((theme) => (
              <button
                key={theme}
                type="button"
                onClick={() => setForm({ ...form, theme })}
                className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium capitalize transition-colors ${
                  form.theme === theme
                    ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                    : 'border-[var(--border)] hover:bg-[var(--accent)]'
                }`}
              >
                {theme}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-[var(--primary)] px-6 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : isSaved ? 'Saved!' : 'Save Settings'}
        </button>
      </form>

      {/* Notifications section */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-1 font-medium">Notifications</h2>
        <p className="mb-4 text-sm text-[var(--muted-foreground)]">
          Get notified when Claude finishes a response or a background task completes, even when the tab is in the background.
        </p>

        <div className="flex items-center gap-3">
          {notifPermission === 'granted' ? (
            <span className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm font-medium text-green-600 dark:text-green-400">
              Notifications enabled
            </span>
          ) : notifPermission === 'denied' ? (
            <span className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              Notifications blocked. Please enable them in your browser settings.
            </span>
          ) : notifPermission === 'unsupported' ? (
            <span className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
              Your browser does not support notifications.
            </span>
          ) : (
            <button
              type="button"
              onClick={handleEnableNotifications}
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Enable Notifications
            </button>
          )}
        </div>
      </div>

      {/* Theme Colors section */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-1 font-medium">Theme Colors</h2>
        <p className="mb-4 text-sm text-[var(--muted-foreground)]">
          Choose an accent color for the interface.
        </p>

        <div className="grid grid-cols-4 gap-3">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelectColorTheme(preset.id)}
              className={`group flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors ${
                colorThemeId === preset.id
                  ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                  : 'border-[var(--border)] hover:bg-[var(--accent)]'
              }`}
            >
              <div className="relative">
                <div
                  className="h-8 w-8 rounded-full shadow-sm transition-transform group-hover:scale-110"
                  style={{ backgroundColor: preset.primary }}
                />
                {colorThemeId === preset.id && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke={preset.primaryForeground}
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
              <span className="text-xs font-medium leading-tight text-center">
                {preset.name}
              </span>
            </button>
          ))}

          {/* Custom color option */}
          <button
            type="button"
            onClick={() => handleSelectColorTheme('custom')}
            className={`group flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors ${
              colorThemeId === 'custom'
                ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                : 'border-[var(--border)] hover:bg-[var(--accent)]'
            }`}
          >
            <div className="relative">
              <div
                className="h-8 w-8 rounded-full shadow-sm transition-transform group-hover:scale-110"
                style={{
                  background: colorThemeId === 'custom'
                    ? customColor
                    : 'conic-gradient(from 0deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #a855f7, #ef4444)',
                }}
              />
              {colorThemeId === 'custom' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke={getForegroundForColor(customColor)}
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
            <span className="text-xs font-medium leading-tight text-center">Custom</span>
          </button>
        </div>

        {/* Custom color picker */}
        {colorThemeId === 'custom' && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
            <label htmlFor="custom-color-picker" className="text-sm font-medium">
              Pick a color
            </label>
            <input
              id="custom-color-picker"
              type="color"
              value={customColor}
              onChange={(e) => handleCustomColorChange(e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border border-[var(--border)] bg-transparent p-0.5"
            />
            <span className="font-mono text-sm text-[var(--muted-foreground)]">
              {customColor}
            </span>
          </div>
        )}
      </div>

      {/* Claude CLI Auth */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Claude CLI Account</h3>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
              Sign in with your Claude/Anthropic account. Same as running &quot;claude auth login&quot; in the terminal.
            </p>
          </div>
          {claudeStatus?.cliLoggedIn && (
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              <span className="text-xs text-green-400">Connected</span>
            </div>
          )}
        </div>

        {claudeStatus?.cliLoggedIn ? (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-3 rounded-lg bg-[var(--secondary)] px-4 py-3">
              <div className="flex-1">
                <p className="text-sm font-medium">{claudeStatus.cliEmail}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {claudeStatus.cliAuthMethod === 'claude.ai' ? 'Claude Pro/Max' : 'Anthropic Console'}
                  {claudeStatus.cliSubscription ? ` (${claudeStatus.cliSubscription})` : ''}
                </p>
              </div>
              <button
                onClick={async () => {
                  if (!confirm('Sign out from Claude CLI?')) return
                  try {
                    await api.post('/api/claude/logout', {})
                    setClaudeStatus({ cliLoggedIn: false, cliEmail: null, cliAuthMethod: null, cliSubscription: null })
                  } catch { /* ignore */ }
                }}
                className="rounded-md border border-red-500/30 px-3 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
              >
                Sign Out
              </button>
            </div>
            <button
              onClick={async () => {
                setClaudeLoggingIn(true)
                setClaudeLoginUrl(null)
                try {
                  const result = await api.post<{ url: string | null }>('/api/claude/login', {})
                  if (result.url) {
                    setClaudeLoginUrl(result.url)
                    // Poll for completion
                    claudeLoginPollRef.current = setInterval(async () => {
                      try {
                        const s = await api.get<{ status: string; email?: string }>('/api/claude/login/status')
                        if (s.status === 'success') {
                          if (claudeLoginPollRef.current) clearInterval(claudeLoginPollRef.current)
                          setClaudeLoggingIn(false)
                          setClaudeLoginUrl(null)
                          api.get<any>('/api/claude/status').then(setClaudeStatus).catch(() => {})
                        }
                      } catch { /* ignore */ }
                    }, 2000)
                    setTimeout(() => { if (claudeLoginPollRef.current) clearInterval(claudeLoginPollRef.current); setClaudeLoggingIn(false) }, 300000)
                  }
                } catch { setClaudeLoggingIn(false) }
              }}
              className="text-xs text-[var(--primary)] hover:underline"
            >
              Switch to a different account
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {/* Embedded terminal for claude auth login */}
            <div className="overflow-hidden rounded-[0.5rem]" style={{ border: '1px solid rgba(72,72,71,0.2)' }}>
              <div className="flex items-center justify-between px-3 py-2" style={{ background: '#131313', borderBottom: '1px solid rgba(72,72,71,0.15)' }}>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
                    <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
                    <span className="h-2 w-2 rounded-full bg-[#28c840]" />
                  </div>
                  <span className="font-mono text-[10px] text-[var(--muted-foreground)]">claude auth login</span>
                </div>
                {!claudeLoginUrl && (
                  <button
                    onClick={async () => {
                      setClaudeLoggingIn(true)
                      try {
                        await api.post('/api/claude/login-pty/start', {})
                        // Poll output
                        const poll = setInterval(async () => {
                          try {
                            const res = await api.get<{ output: string; status: string; authUrl?: string }>('/api/claude/login-pty/output')
                            setClaudeLoginUrl(res.output)
                            if (res.authUrl) {
                              (window as any).__claudeAuthUrl = res.authUrl
                            }
                            if (res.status === 'done') {
                              clearInterval(poll)
                              api.get<any>('/api/claude/status').then(setClaudeStatus).catch(() => {})
                              setClaudeLoggingIn(false)
                            }
                          } catch { /* ignore */ }
                        }, 1500)
                        setTimeout(() => { clearInterval(poll); setClaudeLoggingIn(false) }, 300000)
                      } catch { setClaudeLoggingIn(false) }
                    }}
                    disabled={claudeLoggingIn}
                    className="rounded px-2 py-0.5 text-[10px] font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/10"
                  >
                    {claudeLoggingIn ? 'Starting...' : 'Run'}
                  </button>
                )}
              </div>
              <div className="h-36 overflow-auto p-3 font-mono text-xs leading-relaxed" style={{ background: '#0a0a0a', color: '#c9d1d9' }}>
                {!claudeLoginUrl ? (
                  <p style={{ color: '#767575' }}>Click &quot;Run&quot; to start authentication...</p>
                ) : (
                  <pre className="whitespace-pre-wrap break-all">{claudeLoginUrl}</pre>
                )}
              </div>
            </div>

            {/* Auth URL + Code input */}
            {(window as any).__claudeAuthUrl && (
              <a
                href={(window as any).__claudeAuthUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-[0.375rem] px-4 py-2 text-center text-sm font-medium text-white transition-all hover:brightness-110"
                style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dim))' }}
              >
                1. Open Authorization Page
              </a>
            )}

            {claudeLoginUrl && (
              <div>
                <p className="mb-2 text-xs text-[var(--muted-foreground)]">2. Paste the authentication code:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Paste code from Claude..."
                    className="flex-1 rounded-[0.375rem] px-3 py-2 font-mono text-sm text-white outline-none placeholder:text-[var(--muted-foreground)]/50 focus:ring-1 focus:ring-[var(--primary)]"
                    style={{ background: '#000', border: '1px solid rgba(72,72,71,0.2)' }}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        const input = e.currentTarget
                        const code = input.value.trim()
                        if (!code) return
                        await api.post('/api/claude/login-pty/input', { data: code + '\n' }).catch(() => {})
                        input.value = ''
                        // Poll for auth
                        setTimeout(async () => {
                          const status = await api.get<any>('/api/claude/status').catch(() => null)
                          if (status?.cliLoggedIn) {
                            setClaudeStatus(status)
                            setClaudeLoginUrl(null)
                          }
                        }, 3000)
                      }
                    }}
                  />
                  <button
                    onClick={async () => {
                      const input = document.querySelector<HTMLInputElement>('input[placeholder="Paste code from Claude..."]')
                      const code = input?.value?.trim()
                      if (!code) return
                      await api.post('/api/claude/login-pty/input', { data: code + '\n' }).catch(() => {})
                      if (input) input.value = ''
                      setTimeout(async () => {
                        const status = await api.get<any>('/api/claude/status').catch(() => null)
                        if (status?.cliLoggedIn) {
                          setClaudeStatus(status)
                          setClaudeLoginUrl(null)
                        }
                      }, 3000)
                    }}
                    className="shrink-0 rounded-[0.375rem] px-4 py-2 text-sm font-medium text-white transition-all hover:brightness-110"
                    style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dim))' }}
                  >
                    Submit
                  </button>
                </div>
              </div>
            )}

            {/* Check connection */}
            <button
              onClick={async () => {
                setClaudeLoggingIn(true)
                try {
                  const status = await api.get<any>('/api/claude/status')
                  setClaudeStatus(status)
                } catch { /* ignore */ }
                finally { setClaudeLoggingIn(false) }
              }}
              disabled={claudeLoggingIn}
              className="rounded-[0.375rem] px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:text-white"
              style={{ border: '1px solid rgba(72,72,71,0.2)' }}
            >
              {claudeLoggingIn ? 'Checking...' : 'Check Connection'}
            </button>
          </div>
        )}
      </div>

      {/* GitHub Accounts section */}
      <AccountSection
        title="GitHub Accounts"
        description="Manage GitHub Personal Access Tokens for API access. Each project can use a different account."
        type="github"
        accounts={accounts.filter((a) => a.type === 'github')}
        showAdd={showAddAccount === 'github'}
        onShowAdd={() => { setShowAddAccount(showAddAccount === 'github' ? null : 'github'); setNewAccount({ nickname: '', token: '' }) }}
        newAccount={newAccount}
        onNewAccountChange={setNewAccount}
        isAdding={isAddingAccount}
        onAdd={async () => {
          if (!newAccount.nickname.trim() || !newAccount.token.trim()) return
          setIsAddingAccount(true)
          try {
            await createAccount({ type: 'github', nickname: newAccount.nickname.trim(), token: newAccount.token.trim() })
            setShowAddAccount(null)
            setNewAccount({ nickname: '', token: '' })
          } catch (err) { console.error(err) }
          finally { setIsAddingAccount(false) }
        }}
        onSetDefault={async (id) => { await updateAccount(id, { isDefault: true }) }}
        onDelete={async (id) => { if (confirm('Delete this account?')) await deleteAccount(id) }}
        onTest={async (id) => {
          setTestingAccountId(id)
          try {
            const result = await testAccount(id)
            setTestResult({ id, ...result })
            setTimeout(() => setTestResult(null), 4000)
          } catch { setTestResult({ id, valid: false }) }
          finally { setTestingAccountId(null) }
        }}
        testingId={testingAccountId}
        testResult={testResult}
        tokenPlaceholder="ghp_xxxxxxxxxxxxxxxxxxxx"
      />

      {/* Claude API Keys section */}
      <AccountSection
        title="Claude API Keys"
        description="Manage Anthropic API keys. Each project can use a different key, or fall back to the server default."
        type="claude_api_key"
        accounts={accounts.filter((a) => a.type === 'claude_api_key')}
        showAdd={showAddAccount === 'claude_api_key'}
        onShowAdd={() => { setShowAddAccount(showAddAccount === 'claude_api_key' ? null : 'claude_api_key'); setNewAccount({ nickname: '', token: '' }) }}
        newAccount={newAccount}
        onNewAccountChange={setNewAccount}
        isAdding={isAddingAccount}
        onAdd={async () => {
          if (!newAccount.nickname.trim() || !newAccount.token.trim()) return
          setIsAddingAccount(true)
          try {
            await createAccount({ type: 'claude_api_key', nickname: newAccount.nickname.trim(), token: newAccount.token.trim() })
            setShowAddAccount(null)
            setNewAccount({ nickname: '', token: '' })
          } catch (err) { console.error(err) }
          finally { setIsAddingAccount(false) }
        }}
        onSetDefault={async (id) => { await updateAccount(id, { isDefault: true }) }}
        onDelete={async (id) => { if (confirm('Delete this API key?')) await deleteAccount(id) }}
        onTest={async (id) => {
          setTestingAccountId(id)
          try {
            const result = await testAccount(id)
            setTestResult({ id, ...result })
            setTimeout(() => setTestResult(null), 4000)
          } catch { setTestResult({ id, valid: false }) }
          finally { setTestingAccountId(null) }
        }}
        testingId={testingAccountId}
        testResult={testResult}
        tokenPlaceholder="sk-ant-xxxxxxxxxxxxxxxxxxxx"
      />

    </div>
  )
}

function AccountSection({
  title, description, type, accounts, showAdd, onShowAdd,
  newAccount, onNewAccountChange, isAdding, onAdd,
  onSetDefault, onDelete, onTest, testingId, testResult, tokenPlaceholder,
}: {
  title: string
  description: string
  type: ConnectedAccountType
  accounts: ConnectedAccount[]
  showAdd: boolean
  onShowAdd: () => void
  newAccount: { nickname: string; token: string }
  onNewAccountChange: (v: { nickname: string; token: string }) => void
  isAdding: boolean
  onAdd: () => void
  onSetDefault: (id: string) => void
  onDelete: (id: string) => void
  onTest: (id: string) => void
  testingId: string | null
  testResult: { id: string; valid: boolean; username?: string } | null
  tokenPlaceholder: string
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium">{title}</h2>
        <button
          type="button"
          onClick={onShowAdd}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--secondary)]"
        >
          {showAdd ? 'Cancel' : '+ Add'}
        </button>
      </div>
      <p className="mb-3 text-sm text-[var(--muted-foreground)]">{description}</p>

      {showAdd && (
        <div className="mb-3 space-y-2 rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/5 p-3">
          <input
            type="text"
            placeholder="Nickname (e.g. Work, Personal)"
            value={newAccount.nickname}
            onChange={(e) => onNewAccountChange({ ...newAccount, nickname: e.target.value })}
            className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          />
          <input
            type="password"
            placeholder={tokenPlaceholder}
            value={newAccount.token}
            onChange={(e) => onNewAccountChange({ ...newAccount, token: e.target.value })}
            className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--primary)]"
          />
          <button
            type="button"
            onClick={onAdd}
            disabled={isAdding || !newAccount.nickname.trim() || !newAccount.token.trim()}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isAdding ? 'Adding...' : 'Add Account'}
          </button>
        </div>
      )}

      {accounts.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)] italic">No {type === 'github' ? 'GitHub accounts' : 'API keys'} configured.</p>
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => (
            <div key={account.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium truncate">{account.nickname}</span>
                {account.username && (
                  <span className="text-xs text-[var(--muted-foreground)] font-mono">@{account.username}</span>
                )}
                {account.isDefault && (
                  <span className="rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--primary)]">
                    default
                  </span>
                )}
                {testResult?.id === account.id && (
                  <span className={`text-xs font-medium ${testResult.valid ? 'text-green-500' : 'text-red-500'}`}>
                    {testResult.valid ? (testResult.username ? `Valid (@${testResult.username})` : 'Valid') : 'Invalid'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onTest(account.id)}
                  disabled={testingId === account.id}
                  className="rounded px-2 py-1 text-xs transition-colors hover:bg-[var(--secondary)] disabled:opacity-50"
                  title="Test"
                >
                  {testingId === account.id ? '...' : 'Test'}
                </button>
                {!account.isDefault && (
                  <button
                    type="button"
                    onClick={() => onSetDefault(account.id)}
                    className="rounded px-2 py-1 text-xs transition-colors hover:bg-[var(--secondary)]"
                    title="Set as default"
                  >
                    Set Default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDelete(account.id)}
                  className="rounded px-2 py-1 text-xs text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
                  title="Delete"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

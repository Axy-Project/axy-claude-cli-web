'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth.store'

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<'welcome' | 'create' | 'claude'>('welcome')
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', displayName: '' })
  const [claudeKey, setClaudeKey] = useState('')
  const [claudeKeyNickname, setClaudeKeyNickname] = useState('Default')
  const [isTestingKey, setIsTestingKey] = useState(false)
  const [keyValid, setKeyValid] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.email || !form.password || !form.displayName) {
      setError('All fields are required')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await api.post<{ token: string; user: any }>('/api/setup/init', {
        email: form.email,
        password: form.password,
        displayName: form.displayName,
      })

      // Store token and go to Claude key step
      localStorage.setItem('axy_token', result.token)
      api.setToken(result.token)
      useAuthStore.setState({
        token: result.token,
        user: result.user,
        isAuthenticated: true,
      })
      setStep('claude')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--primary)]">
            <span className="text-2xl font-bold text-white">A</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Axy Web</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Claude CLI from your browser</p>
        </div>

        {step === 'welcome' ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <h2 className="text-lg font-semibold">Welcome to Axy</h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Set up your Axy instance. Create an admin account to get started.
            </p>
            <div className="mt-6 space-y-3 text-sm text-[var(--muted-foreground)]">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/15 text-xs font-bold text-[var(--primary)]">1</span>
                <span>Create your admin account</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--secondary)] text-xs font-bold text-[var(--muted-foreground)]">2</span>
                <span>Start creating projects and chatting with Claude</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--secondary)] text-xs font-bold text-[var(--muted-foreground)]">3</span>
                <span>Optionally connect GitHub, configure OAuth, and more from Settings</span>
              </div>
            </div>
            <button
              onClick={() => setStep('create')}
              className="mt-6 w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Get Started
            </button>
          </div>
        ) : step === 'create' ? (
          <form onSubmit={handleSetup} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <h2 className="text-lg font-semibold">Create Admin Account</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              This will be the main administrator of your Axy instance.
            </p>

            {error && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Display Name</label>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  placeholder="Admin"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="admin@example.com"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Min 8 characters"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Confirm Password</label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  placeholder="Repeat password"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Account & Start'}
            </button>

            <button
              type="button"
              onClick={() => setStep('welcome')}
              className="mt-2 w-full text-center text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              Back
            </button>
          </form>
        ) : step === 'claude' ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <h2 className="text-lg font-semibold">Connect Claude</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Add your Anthropic API key to start chatting. You can get one from{' '}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] underline">
                console.anthropic.com
              </a>
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">API Key</label>
                <input
                  type="password"
                  value={claudeKey}
                  onChange={(e) => { setClaudeKey(e.target.value); setKeyValid(null) }}
                  placeholder="sk-ant-..."
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--primary)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Nickname</label>
                <input
                  type="text"
                  value={claudeKeyNickname}
                  onChange={(e) => setClaudeKeyNickname(e.target.value)}
                  placeholder="Default"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                />
              </div>

              {keyValid === true && (
                <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-400">
                  API key is valid
                </div>
              )}
              {keyValid === false && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  Invalid API key. Check and try again.
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={async () => {
                  if (!claudeKey.trim()) return
                  setIsTestingKey(true)
                  try {
                    const result = await api.post<{ valid: boolean; error?: string }>('/api/claude/test-key', { apiKey: claudeKey })
                    setKeyValid(result.valid)
                  } catch { setKeyValid(false) }
                  finally { setIsTestingKey(false) }
                }}
                disabled={isTestingKey || !claudeKey.trim()}
                className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--secondary)] disabled:opacity-50"
              >
                {isTestingKey ? 'Testing...' : 'Test Key'}
              </button>

              <button
                onClick={async () => {
                  if (!claudeKey.trim()) { router.push('/dashboard'); return }
                  setIsSubmitting(true)
                  try {
                    await api.post('/api/accounts', {
                      type: 'claude_api_key',
                      nickname: claudeKeyNickname || 'Default',
                      token: claudeKey,
                      isDefault: true,
                    })
                    router.push('/dashboard')
                  } catch (err) {
                    setError((err as Error).message)
                  } finally { setIsSubmitting(false) }
                }}
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : claudeKey.trim() ? 'Save & Continue' : 'Skip for now'}
              </button>
            </div>

            <button
              onClick={() => router.push('/dashboard')}
              className="mt-2 w-full text-center text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              Skip — I will add it later in Settings
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

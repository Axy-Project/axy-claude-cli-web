'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth.store'

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<'welcome' | 'create' | 'claude'>('welcome')
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', displayName: '' })
  const [loginUrl, setLoginUrl] = useState<string | null>(null)
  const [loginStatus, setLoginStatus] = useState<string>('none')
  const [cliEmail, setCliEmail] = useState<string | null>(null)
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
            <h2 className="text-lg font-semibold">Sign in to Claude</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Connect your Claude account to start chatting. This uses the same login as the Claude CLI.
            </p>

            {loginStatus === 'success' || cliEmail ? (
              <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-400" />
                  <span className="text-sm font-medium text-green-400">Connected</span>
                </div>
                {cliEmail && <p className="mt-1 text-xs text-[var(--muted-foreground)]">{cliEmail}</p>}
              </div>
            ) : loginStatus === 'awaiting_auth' && loginUrl ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
                  <p className="text-sm font-medium text-yellow-400">Waiting for authorization...</p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">Click the link below to sign in with your Claude account:</p>
                </div>
                <a
                  href={loginUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-lg bg-[#d97706] px-4 py-2.5 text-center text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  Open Claude Login Page
                </a>
                <p className="text-center text-[10px] text-[var(--muted-foreground)]">
                  After authorizing, come back here. This page will detect the login automatically.
                </p>
              </div>
            ) : null}

            <div className="mt-6 flex gap-2">
              {loginStatus !== 'success' && !cliEmail && (
                <button
                  onClick={async () => {
                    setIsSubmitting(true)
                    setError(null)
                    try {
                      // Check if already logged in
                      const status = await api.get<{ cliLoggedIn: boolean; cliEmail: string | null }>('/api/claude/status')
                      if (status.cliLoggedIn && status.cliEmail) {
                        setCliEmail(status.cliEmail)
                        setLoginStatus('success')
                        return
                      }
                      // Start login flow
                      const result = await api.post<{ url: string | null; status: string }>('/api/claude/login', {})
                      if (result.url) {
                        setLoginUrl(result.url)
                        setLoginStatus('awaiting_auth')
                        // Poll for completion
                        const poll = setInterval(async () => {
                          try {
                            const s = await api.get<{ status: string; email?: string }>('/api/claude/login/status')
                            if (s.status === 'success') {
                              clearInterval(poll)
                              setLoginStatus('success')
                              setCliEmail(s.email || null)
                            }
                          } catch { /* ignore */ }
                        }, 2000)
                        // Stop polling after 5 minutes
                        setTimeout(() => clearInterval(poll), 300000)
                      } else {
                        setError('Could not start Claude login. Is the CLI installed?')
                      }
                    } catch (err) {
                      setError((err as Error).message)
                    } finally { setIsSubmitting(false) }
                  }}
                  disabled={isSubmitting || loginStatus === 'awaiting_auth'}
                  className="flex-1 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {isSubmitting ? 'Connecting...' : loginStatus === 'awaiting_auth' ? 'Waiting...' : 'Sign in to Claude'}
                </button>
              )}

              <button
                onClick={() => router.push('/dashboard')}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 ${
                  loginStatus === 'success' || cliEmail
                    ? 'flex-1 bg-[var(--primary)] text-white'
                    : 'border border-[var(--border)] text-[var(--muted-foreground)]'
                }`}
              >
                {loginStatus === 'success' || cliEmail ? 'Continue to Dashboard' : 'Skip for now'}
              </button>
            </div>

            {error && (
              <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

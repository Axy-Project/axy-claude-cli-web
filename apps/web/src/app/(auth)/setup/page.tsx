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
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const [authCode, setAuthCode] = useState('')
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

  const steps = [
    { key: 'welcome', label: 'Welcome' },
    { key: 'create', label: 'Account' },
    { key: 'claude', label: 'Claude' },
  ]
  const currentStepIdx = steps.findIndex((s) => s.key === step)

  const inputClassName = "w-full rounded-[0.375rem] px-4 py-2.5 text-sm text-white outline-none placeholder:text-[#adaaaa]/50 focus:ring-1 focus:ring-[#bd9dff]"
  const inputStyle = {
    background: '#000000',
    border: '1px solid rgba(72, 72, 71, 0.2)',
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ background: '#0e0e0e', fontFamily: 'Inter, sans-serif' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-6 text-center">
          <div
            className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-[0.75rem]"
            style={{ background: 'linear-gradient(135deg, #bd9dff, #8a4cfc)' }}
          >
            <span className="text-2xl font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>A</span>
          </div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Axy Web
          </h1>
          <p className="mt-1 text-sm" style={{ color: '#adaaaa' }}>Claude CLI from your browser</p>
        </div>

        {/* Steps indicator */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors"
                style={{
                  background: i <= currentStepIdx ? 'linear-gradient(135deg, #bd9dff, #8a4cfc)' : '#262626',
                  color: i <= currentStepIdx ? '#ffffff' : '#adaaaa',
                }}
              >
                {i + 1}
              </div>
              <span
                className="hidden text-xs font-medium sm:inline"
                style={{ color: i <= currentStepIdx ? '#ffffff' : '#adaaaa' }}
              >
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <div className="mx-1 h-px w-6" style={{ background: i < currentStepIdx ? '#bd9dff' : 'rgba(72, 72, 71, 0.2)' }} />
              )}
            </div>
          ))}
        </div>

        {/* Glassmorphism card */}
        <div
          className="rounded-[0.75rem] backdrop-blur-xl"
          style={{
            background: 'rgba(26, 26, 26, 0.8)',
            border: '1px solid rgba(72, 72, 71, 0.2)',
          }}
        >
          {step === 'welcome' ? (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Welcome to Axy</h2>
              <p className="mt-2 text-sm" style={{ color: '#adaaaa' }}>
                Set up your Axy instance. Create an admin account to get started.
              </p>
              <div className="mt-6 space-y-3 text-sm" style={{ color: '#adaaaa' }}>
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #bd9dff, #8a4cfc)' }}
                  >
                    1
                  </span>
                  <span>Create your admin account</span>
                </div>
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{ background: '#262626', color: '#adaaaa' }}
                  >
                    2
                  </span>
                  <span>Start creating projects and chatting with Claude</span>
                </div>
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{ background: '#262626', color: '#adaaaa' }}
                  >
                    3
                  </span>
                  <span>Optionally connect GitHub, configure OAuth, and more from Settings</span>
                </div>
              </div>
              <button
                onClick={() => setStep('create')}
                className="mt-6 w-full rounded-[0.375rem] px-4 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110"
                style={{ background: 'linear-gradient(135deg, #bd9dff, #8a4cfc)' }}
              >
                Get Started
              </button>
            </div>

          ) : step === 'create' ? (
            <form onSubmit={handleSetup} className="p-6">
              <h2 className="text-lg font-semibold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Create Admin Account</h2>
              <p className="mt-1 text-sm" style={{ color: '#adaaaa' }}>
                This will be the main administrator of your Axy instance.
              </p>

              {error && (
                <div
                  className="mt-4 rounded-[0.375rem] px-3 py-2 text-sm text-red-400"
                  style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                >
                  {error}
                </div>
              )}

              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-white">Display Name</label>
                  <input
                    type="text"
                    value={form.displayName}
                    onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                    placeholder="Admin"
                    className={inputClassName}
                    style={inputStyle}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-white">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="admin@example.com"
                    className={inputClassName}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-white">Password</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Min 8 characters"
                    className={inputClassName}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-white">Confirm Password</label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    placeholder="Repeat password"
                    className={inputClassName}
                    style={inputStyle}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-6 w-full rounded-[0.375rem] px-4 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100"
                style={{ background: 'linear-gradient(135deg, #bd9dff, #8a4cfc)' }}
              >
                {isSubmitting ? 'Creating...' : 'Create Account & Continue'}
              </button>

              <button
                type="button"
                onClick={() => setStep('welcome')}
                className="mt-3 w-full text-center text-xs transition-colors hover:text-white"
                style={{ color: '#adaaaa' }}
              >
                Back
              </button>
            </form>

          ) : step === 'claude' ? (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Sign in to Claude</h2>
              <p className="mt-1 text-sm" style={{ color: '#adaaaa' }}>
                Connect your Claude account to start chatting.
              </p>

              {loginStatus === 'success' || cliEmail ? (
                <div className="mt-4 rounded-[0.375rem] px-4 py-3" style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-400" />
                    <span className="text-sm font-medium text-green-400">Connected</span>
                  </div>
                  {cliEmail && <p className="mt-1 text-xs" style={{ color: '#adaaaa' }}>{cliEmail}</p>}
                </div>
              ) : (
                <>
                  {/* Embedded terminal for claude auth login */}
                  <div className="mt-4 overflow-hidden rounded-[0.5rem]" style={{ border: '1px solid rgba(72,72,71,0.2)' }}>
                    {/* Terminal header */}
                    <div className="flex items-center justify-between px-3 py-2" style={{ background: '#131313', borderBottom: '1px solid rgba(72,72,71,0.15)' }}>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                        </div>
                        <span className="font-mono text-[10px] text-[#767575]">claude auth login</span>
                      </div>
                      {!loginUrl && loginStatus !== 'awaiting_auth' && (
                        <button
                          onClick={async () => {
                            setIsSubmitting(true)
                            setError(null)
                            try {
                              await api.post('/api/claude/login-pty/start', {})
                              setLoginStatus('awaiting_auth')
                              // Poll output
                              const poll = setInterval(async () => {
                                try {
                                  const res = await api.get<{ output: string; status: string; authUrl?: string }>('/api/claude/login-pty/output')
                                  setLoginUrl(res.output)
                                  if (res.authUrl) setAuthUrl(res.authUrl)
                                  if (res.status === 'done') {
                                    clearInterval(poll)
                                    // Check if auth succeeded
                                    const status = await api.get<{ cliLoggedIn: boolean; cliEmail: string | null }>('/api/claude/status')
                                    if (status.cliLoggedIn) {
                                      setCliEmail(status.cliEmail)
                                      setLoginStatus('success')
                                    }
                                  }
                                } catch { /* ignore */ }
                              }, 1500)
                              setTimeout(() => clearInterval(poll), 300000)
                            } catch (err) {
                              setError((err as Error).message)
                            } finally { setIsSubmitting(false) }
                          }}
                          disabled={isSubmitting}
                          className="rounded px-2 py-0.5 text-[10px] font-medium text-[#bd9dff] transition-colors hover:bg-[#bd9dff]/10"
                        >
                          {isSubmitting ? 'Starting...' : 'Run'}
                        </button>
                      )}
                    </div>
                    {/* Terminal output */}
                    <div className="h-48 overflow-auto p-3 font-mono text-xs leading-relaxed" style={{ background: '#0a0a0a', color: '#c9d1d9' }}>
                      {!loginUrl && loginStatus !== 'awaiting_auth' ? (
                        <p style={{ color: '#767575' }}>Click &quot;Run&quot; to start authentication...</p>
                      ) : (
                        <pre className="whitespace-pre-wrap break-all">{loginUrl || 'Starting claude auth login...'}</pre>
                      )}
                    </div>
                  </div>

                  {/* Show clickable auth link — URL extracted server-side to avoid PTY corruption */}
                  {authUrl ? (<>
                      <a
                        href={authUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 block w-full rounded-[0.375rem] px-4 py-2.5 text-center text-sm font-medium text-white transition-all hover:brightness-110"
                        style={{ background: 'linear-gradient(135deg, #bd9dff, #8a4cfc)' }}
                      >
                        1. Open Authorization Page
                      </a>

                      {/* Code input — paste the code from Claude */}
                      <div className="mt-3">
                        <p className="mb-2 text-xs" style={{ color: '#adaaaa' }}>2. Paste the authentication code here:</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={authCode}
                            onChange={(e) => setAuthCode(e.target.value)}
                            placeholder="Paste code from Claude..."
                            className="flex-1 rounded-[0.375rem] px-3 py-2 font-mono text-sm text-white outline-none placeholder:text-[#767575]/50 focus:ring-1 focus:ring-[#bd9dff]"
                            style={{ background: '#000000', border: '1px solid rgba(72,72,71,0.2)' }}
                          />
                          <button
                            onClick={async () => {
                              if (!authCode.trim()) return
                              try {
                                await api.post('/api/claude/login-pty/input', { data: authCode.trim() + '\n' })
                                setAuthCode('')
                                // Poll for completion
                                setTimeout(async () => {
                                  const status = await api.get<{ cliLoggedIn: boolean; cliEmail: string | null }>('/api/claude/status')
                                  if (status.cliLoggedIn) {
                                    setCliEmail(status.cliEmail)
                                    setLoginStatus('success')
                                  }
                                }, 3000)
                              } catch (err) {
                                setError((err as Error).message)
                              }
                            }}
                            disabled={!authCode.trim()}
                            className="shrink-0 rounded-[0.375rem] px-4 py-2 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-40"
                            style={{ background: 'linear-gradient(135deg, #bd9dff, #8a4cfc)' }}
                          >
                            Submit
                          </button>
                        </div>
                      </div>
                  </>) : null}
                </>
              )}

              <div className="mt-6 flex gap-2">
                {loginStatus !== 'success' && !cliEmail && (
                  <button
                    onClick={async () => {
                      setIsSubmitting(true)
                      setError(null)
                      try {
                        const status = await api.get<{ cliLoggedIn: boolean; cliEmail: string | null }>('/api/claude/status')
                        if (status.cliLoggedIn && status.cliEmail) {
                          setCliEmail(status.cliEmail)
                          setLoginStatus('success')
                        } else {
                          setError('Not authenticated yet. Click "Run" above, then open the authorization link.')
                        }
                      } catch (err) {
                        setError((err as Error).message)
                      } finally { setIsSubmitting(false) }
                    }}
                    disabled={isSubmitting}
                    className="flex-1 rounded-[0.375rem] px-4 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #bd9dff, #8a4cfc)' }}
                  >
                    {isSubmitting ? 'Checking...' : 'Check Connection'}
                  </button>
                )}

                <button
                  onClick={async () => { await api.post('/api/setup/complete', {}).catch(() => {}); router.push('/dashboard') }}
                  className={`rounded-[0.375rem] px-4 py-2.5 text-sm font-medium transition-all ${
                    loginStatus === 'success' || cliEmail
                      ? 'flex-1 text-white hover:brightness-110'
                      : 'hover:text-white'
                  }`}
                  style={
                    loginStatus === 'success' || cliEmail
                      ? { background: 'linear-gradient(135deg, #bd9dff, #8a4cfc)' }
                      : { color: '#adaaaa' }
                  }
                >
                  {loginStatus === 'success' || cliEmail ? 'Continue to Dashboard' : 'Skip for now'}
                </button>
              </div>

              {error && (
                <p className="mt-3 rounded-[0.375rem] px-3 py-2 text-sm text-red-400" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  {error}
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

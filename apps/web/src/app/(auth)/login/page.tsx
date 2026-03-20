'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { api } from '@/lib/api-client'

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authMethod, setAuthMethod] = useState<string | null>(null)
  const [localForm, setLocalForm] = useState({ email: '', password: '' })
  const login = useAuthStore((s) => s.login)

  // Check setup status on load — redirect to setup if not complete
  useEffect(() => {
    api.get<{ setupComplete: boolean; authMethod: string }>('/api/setup/status')
      .then((data) => {
        if (!data.setupComplete) {
          router.replace('/setup')
          return
        }
        setAuthMethod(data.authMethod || 'local')
      })
      .catch(() => {
        // API failed — probably first launch, go to setup
        router.replace('/setup')
      })
  }, [router])

  const handleGitHubLogin = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const url = await login('github')
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
      setIsLoading(false)
    }
  }

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      const result = await api.post<{ token: string; user: any }>('/api/setup/login', {
        email: localForm.email,
        password: localForm.password,
      })
      localStorage.setItem('axy_token', result.token)
      api.setToken(result.token)
      useAuthStore.setState({
        token: result.token,
        user: result.user,
        isAuthenticated: true,
      })
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials')
    } finally {
      setIsLoading(false)
    }
  }

  if (authMethod === null) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#0e0e0e' }}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#bd9dff] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: '#0e0e0e', fontFamily: 'Inter, sans-serif' }}>
      <div className="w-full max-w-sm px-4">
        {/* Glassmorphism card */}
        <div
          className="rounded-[0.75rem] p-8 backdrop-blur-xl"
          style={{
            background: 'rgba(26, 26, 26, 0.8)',
            border: '1px solid rgba(72, 72, 71, 0.2)',
          }}
        >
          {/* Logo */}
          <div className="mb-8 text-center">
            <div
              className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-[0.75rem]"
              style={{ background: 'linear-gradient(135deg, #bd9dff, #8a4cfc)' }}
            >
              <span className="text-xl font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>A</span>
            </div>
            <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Claude CLI
            </h1>
            <p className="mt-1 text-sm" style={{ color: '#adaaaa' }}>
              Sign in to continue
            </p>
          </div>

          {/* Local login form */}
          <form onSubmit={handleLocalLogin} className="space-y-3">
            <div>
              <input
                type="email"
                value={localForm.email}
                onChange={(e) => setLocalForm({ ...localForm, email: e.target.value })}
                placeholder="Email"
                className="w-full rounded-[0.375rem] px-4 py-2.5 text-sm text-white outline-none placeholder:text-[#adaaaa]/50 focus:ring-1 focus:ring-[#bd9dff]"
                style={{
                  background: '#000000',
                  border: '1px solid rgba(72, 72, 71, 0.2)',
                }}
                autoFocus
              />
            </div>
            <div>
              <input
                type="password"
                value={localForm.password}
                onChange={(e) => setLocalForm({ ...localForm, password: e.target.value })}
                placeholder="Password"
                className="w-full rounded-[0.375rem] px-4 py-2.5 text-sm text-white outline-none placeholder:text-[#adaaaa]/50 focus:ring-1 focus:ring-[#bd9dff]"
                style={{
                  background: '#000000',
                  border: '1px solid rgba(72, 72, 71, 0.2)',
                }}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !localForm.email || !localForm.password}
              className="w-full rounded-[0.375rem] px-4 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100"
              style={{ background: 'linear-gradient(135deg, #bd9dff, #8a4cfc)' }}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1" style={{ background: 'rgba(72, 72, 71, 0.2)' }} />
            <span className="text-xs" style={{ color: '#adaaaa' }}>or</span>
            <div className="h-px flex-1" style={{ background: 'rgba(72, 72, 71, 0.2)' }} />
          </div>

          {/* GitHub login */}
          <button
            onClick={handleGitHubLogin}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-3 rounded-[0.375rem] px-4 py-2.5 text-sm font-medium text-white transition-all hover:brightness-125 disabled:opacity-50"
            style={{
              background: '#1a1a1a',
              border: '1px solid rgba(72, 72, 71, 0.2)',
            }}
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            Continue with GitHub
          </button>

          {error && (
            <p className="mt-4 rounded-[0.375rem] px-3 py-2 text-center text-sm text-red-400" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              {error}
            </p>
          )}
        </div>

        {/* Muted footer text */}
        <p className="mt-6 text-center text-xs" style={{ color: '#adaaaa' }}>
          Axy Web — Claude CLI from your browser
        </p>
      </div>
    </div>
  )
}

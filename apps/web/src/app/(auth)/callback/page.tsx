'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'

export default function CallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const handleCallback = useAuthStore((s) => s.handleCallback)
  const processed = useRef(false)

  useEffect(() => {
    if (processed.current) return
    processed.current = true

    const code = searchParams.get('code')
    if (code) {
      handleCallback(code)
        .then(() => router.replace('/dashboard'))
        .catch((err) => {
          console.error('Callback error:', err)
          router.replace('/login')
        })
    } else {
      router.replace('/login')
    }
  }, [searchParams, handleCallback, router])

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <img src="/logo.svg" alt="Axy" className="h-12 w-auto" />
      <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      <p className="text-sm text-[var(--muted-foreground)]">Authenticating...</p>
    </div>
  )
}

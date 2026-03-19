'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'

function CallbackContent() {
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
        .catch(() => router.replace('/login'))
    } else {
      router.replace('/login')
    }
  }, [searchParams, handleCallback, router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        <p className="mt-4 text-sm text-[var(--muted-foreground)]">Signing in...</p>
      </div>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    }>
      <CallbackContent />
    </Suspense>
  )
}

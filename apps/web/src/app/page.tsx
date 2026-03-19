'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'

export default function Home() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuthStore()

  useEffect(() => {
    if (!isLoading) {
      router.replace(isAuthenticated ? '/dashboard' : '/login')
    }
  }, [isAuthenticated, isLoading, router])

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <img src="/logo.svg" alt="Axy" className="h-12 w-auto animate-pulse" />
      <span className="text-sm text-[var(--muted-foreground)]">Loading...</span>
    </div>
  )
}

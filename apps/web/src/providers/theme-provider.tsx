'use client'

import { useEffect } from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { initColorTheme } from '@/lib/theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initColorTheme()
  }, [])

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}

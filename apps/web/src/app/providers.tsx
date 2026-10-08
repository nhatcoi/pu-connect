'use client'

import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { getQueryClient } from '@/lib/query-client'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'

export function Providers({ children }: { children: React.ReactNode }) {
  // QueryClient dùng chung toàn app (cache sống qua các lần chuyển trang)
  const queryClient = getQueryClient()

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    </ThemeProvider>
  )
}

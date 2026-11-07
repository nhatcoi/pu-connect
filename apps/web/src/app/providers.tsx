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
        <Toaster
          position="bottom-center"
          mobileOffset={{ bottom: 76, left: 12, right: 12 }}
          offset={{ bottom: 24 }}
          gap={8}
          visibleToasts={3}
          closeButton={false}
          toastOptions={{ duration: 3200, className: 'pu-toast' }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  )
}

'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store'
import { apiClient } from '@/lib/api-client'
import type { UserProfile } from '@pu/schemas'
import { Loader2 } from 'lucide-react'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()
  const user = useAppStore((state) => state.user)
  const isLoadingAuth = useAppStore((state) => state.isLoadingAuth)
  const setUser = useAppStore((state) => state.setUser)

  useEffect(() => {
    let isMounted = true
    async function verifyAuth() {
      try {
        const res = await apiClient<{ success: boolean; data: UserProfile }>('/auth/me')
        if (isMounted) {
          if (res && res.data) {
            setUser(res.data)
          } else {
            setUser(null)
            router.replace('/')
          }
        }
      } catch {
        if (isMounted) {
          setUser(null)
          router.replace('/')
        }
      }
    }

    if (!user) {
      verifyAuth()
    }
    return () => {
      isMounted = false
    }
  }, [user, setUser, router])

  if (isLoadingAuth && !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-black text-xl shadow-lg animate-pulse">
            PU
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Đang xác thực phiên làm việc...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <>{children}</>
}

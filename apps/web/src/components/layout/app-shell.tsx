'use client'

import React from 'react'
import { AuthGuard } from '@/components/auth/auth-guard'
import { Header } from '@/components/social/header'
import { Sidebar } from '@/components/social/sidebar'
import { RightSidebar } from '@/components/social/right-sidebar'
import { MobileBottomNav } from '@/components/navigation/mobile-bottom-nav'

// Bố cục 3 cột chuẩn (giống /home): Sidebar · nội dung · RightSidebar
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-surface text-foreground">
        <Header />
        <div className="mx-auto flex justify-center gap-6 max-w-7xl px-0 sm:px-4 lg:px-6 min-h-screen">
          <div className="hidden md:flex shrink-0 w-14 xl:w-56 sticky top-14 h-[calc(100vh-3.5rem)] py-3 flex-col justify-between z-30">
            <Sidebar />
          </div>
          <main className="flex-1 max-w-[640px] w-full min-w-0 min-h-screen pt-3 pb-20 md:pb-12">{children}</main>
          <div className="hidden lg:block w-64 xl:w-72 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-4">
            <RightSidebar />
          </div>
        </div>
        <MobileBottomNav />
      </div>
    </AuthGuard>
  )
}

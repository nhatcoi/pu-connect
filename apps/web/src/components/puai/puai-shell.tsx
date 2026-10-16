'use client'

import React from 'react'
import { Sheet } from '@/components/ui/sheet'
import { PuaiNavProvider, usePuaiNav } from './puai-nav'
import { PuaiSidebar } from './puai-sidebar'

// Khung không gian PU AI: thanh bên (desktop) / ngăn kéo (mobile) + nội dung giữa
export function PuaiShell({ children }: { children: React.ReactNode }) {
  return (
    <PuaiNavProvider>
      <div className="flex gap-4 lg:gap-6">
        <aside className="hidden md:block w-64 xl:w-72 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)]">
          <PuaiSidebar />
        </aside>
        <div className="mx-auto w-full min-w-0 max-w-[820px] flex-1">{children}</div>
      </div>
      <PuaiDrawer />
    </PuaiNavProvider>
  )
}

function PuaiDrawer() {
  const { open, setOpen } = usePuaiNav()
  return (
    <Sheet open={open} onOpenChange={setOpen} title="PU AI">
      <PuaiSidebar />
    </Sheet>
  )
}

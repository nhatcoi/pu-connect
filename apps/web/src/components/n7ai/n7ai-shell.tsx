'use client'

import React from 'react'
import { Sheet } from '@/components/ui/sheet'
import { N7AiNavProvider, useN7AiNav } from './n7ai-nav'
import { N7AiSidebar } from './n7ai-sidebar'

// Khung không gian N7AI: thanh bên (desktop) / ngăn kéo (mobile) + nội dung giữa
export function N7AiShell({ children }: { children: React.ReactNode }) {
  return (
    <N7AiNavProvider>
      <div className="flex gap-4 lg:gap-6">
        <aside className="hidden md:block w-64 xl:w-72 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)]">
          <N7AiSidebar />
        </aside>
        <div className="mx-auto w-full min-w-0 max-w-[820px] flex-1">{children}</div>
      </div>
      <N7AiDrawer />
    </N7AiNavProvider>
  )
}

function N7AiDrawer() {
  const { open, setOpen } = useN7AiNav()
  return (
    <Sheet open={open} onOpenChange={setOpen} title="N7AI">
      <N7AiSidebar />
    </Sheet>
  )
}

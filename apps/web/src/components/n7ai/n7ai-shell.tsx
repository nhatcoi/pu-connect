'use client'

import React from 'react'
import { Sheet } from '@/components/ui/sheet'
import { useFilePreviewHost } from '@/components/viewer/file-preview-panel'
import { cn } from '@/lib/utils'
import { N7AiNavProvider, useN7AiNav } from './n7ai-nav'
import { N7AiSidebar } from './n7ai-sidebar'
import { N7AiPanelToggle, N7AiSidePanel, useN7AiPanel, useOpenPanelOnPreview } from './side-panel/n7ai-side-panel'

// Khung không gian N7AI: thanh bên (desktop) / ngăn kéo (mobile) + nội dung giữa
// Mở panel phải (tài liệu · công cụ) trên desktop ⇒ thanh bên cố định, chat và panel chia đều phần còn lại
export function N7AiShell({ children }: { children: React.ReactNode }) {
  useFilePreviewHost()
  useOpenPanelOnPreview()
  const panelOpen = useN7AiPanel((s) => s.open)
  return (
    <N7AiNavProvider>
      <div
        className={cn(
          'flex [--app-header-height:0rem]',
          panelOpen && 'lg:grid lg:grid-cols-[16rem_minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)_minmax(0,1fr)]'
        )}
      >
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-border/60 md:block xl:w-72">
          <N7AiSidebar />
        </aside>
        <div className="w-full min-w-0 flex-1 sm:px-4">
          <div className="mx-auto w-full max-w-[820px]">{children}</div>
        </div>
        {panelOpen && <N7AiSidePanel className="hidden lg:flex" />}
      </div>
      <N7AiPanelToggle />
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

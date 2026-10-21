'use client'

import React from 'react'
import { Sheet } from '@/components/ui/sheet'
import { useFilePreviewHost } from '@/components/viewer/file-preview-panel'
import { cn } from '@/lib/utils'
import { N7AiRail } from './layout/n7ai-rail'
import { panelWidthFor, SIDEBAR, useN7AiLayout, useRestoreN7AiLayout, useSidebarShortcut, useViewportWidth } from './layout/n7ai-layout-store'
import { ResizeHandle } from './layout/resize-handle'
import { N7AiNavProvider, useN7AiNav } from './n7ai-nav'
import { N7AiSidebar } from './n7ai-sidebar'
import { N7AiPanelToggle, N7AiSidePanel, useOpenPanelOnPreview } from './side-panel/n7ai-side-panel'

// Khung không gian N7AI (full màn): thanh bên trái (thu gọn thành dải icon, kéo giãn) · nội dung · panel phải (mở / kéo giãn)
// Mobile: thanh bên là ngăn kéo, tệp mở bằng panel nổi
export function N7AiShell({ children }: { children: React.ReactNode }) {
  useRestoreN7AiLayout()
  useSidebarShortcut()
  useFilePreviewHost()
  useOpenPanelOnPreview()
  const viewport = useViewportWidth()
  const { sidebarCollapsed, sidebarWidth, panelOpen, panelWidth, resizing, setSidebarWidth, setPanelWidth } = useN7AiLayout()
  const sidebar = sidebarCollapsed ? SIDEBAR.rail : sidebarWidth
  const panel = panelWidthFor(panelWidth, viewport, sidebar)
  // Chỉ dựng nội dung panel từ lần mở đầu (tránh tải dữ liệu khi chưa dùng), sau đó giữ để đóng / mở có chuyển động
  const [panelMounted, setPanelMounted] = React.useState(false)
  if (panelOpen && !panelMounted) setPanelMounted(true)

  return (
    <N7AiNavProvider>
      {/* Đang kéo: khóa chọn chữ, iframe không nuốt sự kiện chuột */}
      <div className={cn('flex [--app-header-height:0rem]', resizing && 'cursor-col-resize select-none [&_iframe]:pointer-events-none')}>
        <aside
          style={{ width: sidebar }}
          className={cn('sticky top-0 hidden h-dvh shrink-0 overflow-hidden border-r border-border/60 md:block', !resizing && 'transition-[width] duration-200')}
        >
          {sidebarCollapsed ? <N7AiRail /> : <N7AiSidebar />}
        </aside>
        {!sidebarCollapsed && (
          <ResizeHandle
            label="Độ rộng thanh bên"
            className="hidden md:block"
            onResize={(x) => setSidebarWidth(x)}
            onNudge={(d) => setSidebarWidth(sidebarWidth + d)}
            onReset={() => setSidebarWidth(SIDEBAR.default)}
          />
        )}

        <div className="w-full min-w-0 flex-1 sm:px-4">
          <div className="mx-auto w-full max-w-[820px]">{children}</div>
        </div>

        {panelOpen && (
          <ResizeHandle
            label="Độ rộng panel tài liệu"
            className="hidden lg:block"
            onResize={(x) => setPanelWidth(viewport - x)}
            onNudge={(d) => setPanelWidth(panel - d)}
            onReset={() => setPanelWidth(null)}
          />
        )}
        {/* Khung panel đổi độ rộng mượt ⇒ cột chat dịch trái / phải theo; clip (không hidden) để sticky vẫn chạy */}
        <div
          style={{ width: panelOpen ? panel : 0 }}
          aria-hidden={!panelOpen}
          inert={!panelOpen}
          className={cn('hidden shrink-0 overflow-x-clip lg:block', !resizing && 'transition-[width] duration-300 ease-out')}
        >
          {panelMounted && <N7AiSidePanel className="flex" style={{ width: panel }} />}
        </div>
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

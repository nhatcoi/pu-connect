'use client'

import React, { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Sheet } from '@/components/ui/sheet'
import { useFilePreviewHost } from '@/components/viewer/file-preview-panel'
import { cn } from '@/lib/utils'
import { N7AiRail } from './layout/n7ai-rail'
import { panelWidthFor, SIDEBAR, useN7AiLayout, useRestoreN7AiLayout, useSidebarShortcut, useViewportWidth } from './layout/n7ai-layout-store'
import { ResizeHandle } from './layout/resize-handle'
import { N7AiNavProvider, useN7AiNav } from './n7ai-nav'
import { N7AiSidebar } from './n7ai-sidebar'
import { N7AiPanelToggle, N7AiSidePanel, useOpenPanelOnPreview } from './side-panel/n7ai-side-panel'

// Các route cho phép xuất hiện Right Panel (chat, chat<id>, library). Cho phép mở rộng thêm khi cần.
export function isRightPanelAllowed(pathname: string | null): boolean {
  if (!pathname) return false
  // Không cho phép ở notebook và settings
  if (pathname.startsWith('/n7ai/notebook') || pathname.startsWith('/n7ai/settings')) {
    return false
  }
  // Cho phép chat mới (/n7ai) và thư viện (/n7ai/library)
  if (pathname === '/n7ai' || pathname === '/n7ai/library') {
    return true
  }
  // Cho phép chat conversation theo id: /n7ai/[id]
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 2 && segments[0] === 'n7ai') {
    return true
  }
  return false
}

// Khung không gian N7AI (full màn): thanh bên trái (thu gọn thành dải icon, kéo giãn) · nội dung · panel phải (mở / kéo giãn)
// Mobile: thanh bên là ngăn kéo, tệp mở bằng panel nổi
export function N7AiShell({ children }: { children: React.ReactNode }) {
  useRestoreN7AiLayout()
  useSidebarShortcut()
  useFilePreviewHost()
  useOpenPanelOnPreview()
  const pathname = usePathname()
  const viewport = useViewportWidth()
  const { sidebarCollapsed, sidebarWidth, panelOpen, panelWidth, resizing, setSidebarWidth, setPanelWidth, setPanelOpen } = useN7AiLayout()
  const sidebar = sidebarCollapsed ? SIDEBAR.rail : sidebarWidth
  const panel = panelWidthFor(panelWidth, viewport, sidebar)

  const panelAllowed = isRightPanelAllowed(pathname)
  const isPanelOpen = panelOpen && panelAllowed
  const isWide = pathname.startsWith('/n7ai/notebook') || pathname.startsWith('/n7ai/library')

  // Tự động đóng panel khi vào trang không được phép xuất hiện (ví dụ notebook, settings)
  useEffect(() => {
    if (!panelAllowed && panelOpen) {
      setPanelOpen(false)
    }
  }, [panelAllowed, panelOpen, setPanelOpen])

  // Chỉ dựng nội dung panel từ lần mở đầu (tránh tải dữ liệu khi chưa dùng), sau đó giữ để đóng / mở có chuyển động
  const [panelMounted, setPanelMounted] = React.useState(false)
  if (isPanelOpen && !panelMounted) setPanelMounted(true)

  return (
    <N7AiNavProvider>
      {/* Đang kéo: khóa chọn chữ, iframe không nuốt sự kiện chuột. Thanh bên N7AI giữ cố định không animate khi chuyển route */}
      <div
        className={cn(
          'flex h-screen md:h-dvh overflow-hidden [--app-header-height:0rem] bg-surface',
          resizing && 'cursor-col-resize select-none [&_iframe]:pointer-events-none'
        )}
      >
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

        <div className="w-full min-w-0 flex-1 sm:px-4 h-full flex flex-col overflow-hidden">
          <div
            className={cn(
              'mx-auto w-full h-full min-h-0 flex flex-col',
              isWide ? 'max-w-none px-0 sm:px-2' : 'max-w-[820px]'
            )}
          >
            {children}
          </div>
        </div>

        {isPanelOpen && (
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
          style={{ width: isPanelOpen ? panel : 0 }}
          aria-hidden={!isPanelOpen}
          inert={!isPanelOpen}
          className={cn(
            'hidden shrink-0 overflow-x-clip lg:block py-2 pr-2',
            !resizing && 'transition-[width] duration-300 ease-out'
          )}
        >
          {panelMounted && panelAllowed && (
            <N7AiSidePanel className="flex" style={{ width: panel - 8 }} />
          )}
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

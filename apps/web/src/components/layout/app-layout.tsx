'use client'

import React, { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/auth/auth-guard'
import { AppShellSkeleton } from '@/components/skeletons/app-shell-skeleton'
import { Header } from '@/components/social/header'
import { RestrictionBanner } from '@/components/layout/restriction-banner'
import { Sidebar } from '@/components/social/sidebar'
import { RightSidebar } from '@/components/social/right-sidebar'
import { MobileBottomNav } from '@/components/navigation/mobile-bottom-nav'
import { N7AiFab } from '@/components/n7ai/n7ai-fab'
import { CreatePostDialog } from '@/components/social/create-post-dialog'
import { CreateDocumentDialog } from '@/components/social/create-document-dialog'
import { CreateGroupDialog } from '@/components/social/create-group-dialog'
import { DocumentPreviewModal } from '@/components/viewer/document-preview-modal'
import { SourceViewPanel } from '@/components/n7ai/sources/source-view'
import { FilePreviewPanel } from '@/components/viewer/file-preview-panel'
import { AsideSlotProvider } from '@/components/layout/page-aside'
import { useAppStore } from '@/store'
import { useNotificationsSync } from '@/hooks/use-notifications'
import { useChatRealtime } from '@/hooks/chat'
import { useBlocksRealtime } from '@/hooks/use-blocks'
import { cn } from '@/lib/utils'
import { SHELL_WIDTH, MAIN_WIDTH, MESSAGES_WORKSPACE_WIDTH, WIDE_MAIN_WIDTH, isFullWidthPath, isCompactSidebarPath } from '@/lib/layout'
import { useFeedViewMode } from '@/hooks/use-feed-view-mode'
import { isN7AiPath } from '@/lib/n7ai-routes'

// Hộp thoại dùng chung: mở được từ mọi trang (soạn bài, tài liệu, nhóm, xem tài liệu)
function GlobalDialogs() {
  const router = useRouter()
  // Notifications stay live while immersive pages hide the global Header.
  useNotificationsSync((link) => router.push(link))
  // Socket nhắn tin / chặn → cache (một lần cho cả app)
  useChatRealtime()
  useBlocksRealtime()
  const isCreateDocumentOpen = useAppStore((state) => state.isCreateDocumentOpen)
  const setCreateDocumentOpen = useAppStore((state) => state.setCreateDocumentOpen)
  const isCreateGroupOpen = useAppStore((state) => state.isCreateGroupOpen)
  const setCreateGroupOpen = useAppStore((state) => state.setCreateGroupOpen)
  const previewDocument = useAppStore((state) => state.previewDocument)
  const setPreviewDocument = useAppStore((state) => state.setPreviewDocument)

  return (
    <>
      <CreatePostDialog />
      <CreateDocumentDialog open={isCreateDocumentOpen} onOpenChange={setCreateDocumentOpen} />
      <CreateGroupDialog open={isCreateGroupOpen} onOpenChange={setCreateGroupOpen} />
      <DocumentPreviewModal
        document={previewDocument}
        open={!!previewDocument}
        onOpenChange={(open) => {
          if (!open) setPreviewDocument(null)
        }}
      />
      <FilePreviewPanel />
      <SourceViewPanel />
    </>
  )
}

// Khung 3 cột dựng MỘT lần cho mọi trang cần đăng nhập: chuyển trang chỉ thay cột giữa
// (Header, Sidebar, RightSidebar, socket thông báo không bị mount lại)
// Không gian N7AI (/n7ai) có header/thanh bên riêng ⇒ ẩn Header, Sidebar & cột phải
export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { mode } = useFeedViewMode()
  const n7ai = isN7AiPath(pathname)
  const immersive = n7ai || (pathname === '/' && mode === 'focus')
  // Công cụ (/tools): không cần cột phải
  const fullWidth = isFullWidthPath(pathname)
  // Trang cần không gian rộng (/messages): thanh bên thu gọn thành icon-only giống X (Twitter)
  const compactSidebar = isCompactSidebarPath(pathname)
  const [asideNode, setAsideNode] = useState<HTMLElement | null>(null)
  const [hasCustomAside, setHasCustomAside] = useState(false)
  const onCustomChange = React.useCallback((count: number) => setHasCustomAside(count > 0), [])

  return (
    <AuthGuard fallback={<AppShellSkeleton immersive={immersive} />}>
      <AsideSlotProvider node={asideNode} onCustomChange={onCustomChange}>
        <div className="min-h-screen bg-surface text-foreground selection:bg-primary selection:text-primary-foreground">
          {!immersive && <Header />}
          <RestrictionBanner />
          <GlobalDialogs />
          {/* N7AI: dùng hết chiều ngang (thanh bên sát trái, panel sát phải) */}
          <div className={cn('mx-auto flex justify-center min-h-screen transition-all duration-300', n7ai ? 'w-full' : cn('gap-6 px-0 sm:px-4 lg:px-6', SHELL_WIDTH))}>
            {!immersive && (
              <div
                className={cn(
                  'hidden md:flex shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] py-3 flex-col justify-between z-30 transition-[width] duration-300 ease-in-out',
                  compactSidebar ? 'w-14 xl:w-16' : 'w-14 xl:w-56'
                )}
              >
                <Sidebar compact={compactSidebar} />
              </div>
            )}
            <main
              className={cn(
                'flex-1 w-full min-w-0 min-h-screen transition-[max-width] duration-300 ease-in-out',
                immersive
                  ? 'pb-14 md:pb-0'
                  : cn(
                      compactSidebar ? 'pb-16 md:pb-6' : 'pb-20 md:pb-12',
                      compactSidebar
                        ? MESSAGES_WORKSPACE_WIDTH
                        : fullWidth
                          ? WIDE_MAIN_WIDTH
                          : MAIN_WIDTH
                    )
              )}
            >
              {children}
            </main>
            {!immersive && !fullWidth && (
              <aside className="hidden lg:block w-64 xl:w-72 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto no-scrollbar py-4 transition-opacity duration-300">
                {/* Cột phải riêng của trang được portal vào đây */}
                <div ref={setAsideNode} className="space-y-4" />
                {!hasCustomAside && <RightSidebar />}
              </aside>
            )}
          </div>
          <N7AiFab />
          <MobileBottomNav />
        </div>
      </AsideSlotProvider>
    </AuthGuard>
  )
}

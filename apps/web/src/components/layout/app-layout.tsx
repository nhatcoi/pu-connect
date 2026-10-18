'use client'

import React, { useState } from 'react'
import { usePathname } from 'next/navigation'
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
import { AsideSlotProvider } from '@/components/layout/page-aside'
import { useAppStore } from '@/store'
import { useChatRealtime } from '@/hooks/chat'
import { useBlocksRealtime } from '@/hooks/use-blocks'
import { cn } from '@/lib/utils'
import { SHELL_WIDTH, MAIN_WIDTH, WIDE_MAIN_WIDTH, isFullWidthPath } from '@/lib/layout'
import { isN7AiPath } from '@/lib/n7ai-routes'

// Hộp thoại dùng chung: mở được từ mọi trang (soạn bài, tài liệu, nhóm, xem tài liệu)
function GlobalDialogs() {
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
    </>
  )
}

// Khung 3 cột dựng MỘT lần cho mọi trang cần đăng nhập: chuyển trang chỉ thay cột giữa
// (Header, Sidebar, RightSidebar, socket thông báo không bị mount lại)
// Không gian N7AI (/n7ai) tự dựng thanh bên riêng ⇒ ẩn Sidebar & cột phải, cột giữa giãn hết
export function AppLayout({ children }: { children: React.ReactNode }) {
  const immersive = isN7AiPath(usePathname())
  // Công cụ (/tools): không cần cột phải
  const fullWidth = isFullWidthPath(pathname)
  const [asideNode, setAsideNode] = useState<HTMLElement | null>(null)
  const [hasCustomAside, setHasCustomAside] = useState(false)
  const onCustomChange = React.useCallback((count: number) => setHasCustomAside(count > 0), [])

  return (
    <AuthGuard fallback={<AppShellSkeleton />}>
      <AsideSlotProvider node={asideNode} onCustomChange={onCustomChange}>
        <div className="min-h-screen bg-surface text-foreground selection:bg-primary selection:text-primary-foreground">
          <Header />
          <RestrictionBanner />
          <GlobalDialogs />
          <div className={cn('mx-auto flex justify-center gap-6 px-0 sm:px-4 lg:px-6 min-h-screen', SHELL_WIDTH)}>
            {!immersive && (
              <div className="hidden md:flex shrink-0 w-14 xl:w-56 sticky top-14 h-[calc(100vh-3.5rem)] py-3 flex-col justify-between z-30">
                <Sidebar />
              </div>
            )}
            <main className={cn('flex-1 w-full min-w-0 min-h-screen', immersive ? 'pb-14 md:pb-0' : cn('pb-20 md:pb-12', fullWidth ? WIDE_MAIN_WIDTH : MAIN_WIDTH))}>{children}</main>
            {!immersive && !fullWidth && (
              <aside className="hidden lg:block w-64 xl:w-72 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto no-scrollbar py-4">
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

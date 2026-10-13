'use client'

import React, { useState } from 'react'
import { AuthGuard } from '@/components/auth/auth-guard'
import { Header } from '@/components/social/header'
import { Sidebar } from '@/components/social/sidebar'
import { RightSidebar } from '@/components/social/right-sidebar'
import { MobileBottomNav } from '@/components/navigation/mobile-bottom-nav'
import { CreatePostDialog } from '@/components/social/create-post-dialog'
import { CreateDocumentDialog } from '@/components/social/create-document-dialog'
import { CreateGroupDialog } from '@/components/social/create-group-dialog'
import { DocumentPreviewModal } from '@/components/viewer/document-preview-modal'
import { AsideSlotProvider } from '@/components/layout/page-aside'
import { useAppStore } from '@/store'
import { useChatRealtime } from '@/hooks/chat'

// Hộp thoại dùng chung: mở được từ mọi trang (soạn bài, tài liệu, nhóm, xem tài liệu)
function GlobalDialogs() {
  // Socket nhắn tin → cache (một lần cho cả app)
  useChatRealtime()
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
export function AppLayout({ children }: { children: React.ReactNode }) {
  const [asideNode, setAsideNode] = useState<HTMLElement | null>(null)
  const [hasCustomAside, setHasCustomAside] = useState(false)
  const onCustomChange = React.useCallback((count: number) => setHasCustomAside(count > 0), [])

  return (
    <AuthGuard>
      <AsideSlotProvider node={asideNode} onCustomChange={onCustomChange}>
        <div className="min-h-screen bg-surface text-foreground selection:bg-primary selection:text-primary-foreground">
          <Header />
          <GlobalDialogs />
          <div className="mx-auto flex justify-center gap-6 max-w-7xl px-0 sm:px-4 lg:px-6 min-h-screen">
            <div className="hidden md:flex shrink-0 w-14 xl:w-56 sticky top-14 h-[calc(100vh-3.5rem)] py-3 flex-col justify-between z-30">
              <Sidebar />
            </div>
            <main className="flex-1 max-w-[640px] w-full min-w-0 min-h-screen pb-20 md:pb-12">{children}</main>
            <aside className="hidden lg:block w-64 xl:w-72 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto no-scrollbar py-4">
              {/* Cột phải riêng của trang được portal vào đây */}
              <div ref={setAsideNode} className="space-y-4" />
              {!hasCustomAside && <RightSidebar />}
            </aside>
          </div>
          <MobileBottomNav />
        </div>
      </AsideSlotProvider>
    </AuthGuard>
  )
}

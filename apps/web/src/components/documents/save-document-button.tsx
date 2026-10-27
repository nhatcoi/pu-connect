'use client'

import React from 'react'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { useSavedDocumentIds, useToggleSaveDocument } from '@/hooks/use-document-library'
import { cn } from '@/lib/utils'

// Lưu tài liệu vào kho cá nhân (tham chiếu; tài liệu gốc bị xóa ⇒ tự biến mất khỏi kho)
export function SaveDocumentButton({ documentId, withLabel = false, className }: { documentId: string; withLabel?: boolean; className?: string }) {
  const user = useAppStore((s) => s.user)
  const savedIds = useSavedDocumentIds()
  const toggle = useToggleSaveDocument()
  const saved = savedIds.has(documentId)
  const Icon = saved ? BookmarkCheck : Bookmark

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!user) return void toast.info('Đăng nhập để lưu tài liệu vào kho của bạn')
        toggle.mutate({ documentId, saved })
      }}
      disabled={toggle.isPending}
      aria-pressed={saved}
      title={saved ? 'Bỏ khỏi kho của tôi' : 'Lưu vào kho của tôi'}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground cursor-pointer disabled:opacity-60',
        saved && 'text-primary hover:text-primary',
        withLabel && 'border border-border px-3 py-1.5 text-xs font-semibold',
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {withLabel && (saved ? 'Đã lưu' : 'Lưu vào kho')}
    </button>
  )
}

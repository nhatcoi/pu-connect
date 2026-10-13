'use client'

import React, { useRef } from 'react'
import { Camera, Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import type { ConversationSummary } from '@pu/schemas'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useConversationActions } from '@/hooks/chat'
import { ConversationAvatar } from '../conversation-avatar'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif'

// Ảnh nhóm + nút máy ảnh: tải ảnh mới / xóa ảnh (mọi thành viên)
export function GroupAvatarEditor({ conversation: c }: { conversation: ConversationSummary }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { changeAvatar } = useConversationActions(c.id)
  const busy = changeAvatar.isPending

  const pick = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('Chỉ chọn tệp ảnh')
    if (file.size > MAX_BYTES) return toast.error('Ảnh tối đa 5 MB')
    changeAvatar.mutate(file, { onSuccess: () => toast.success('Đã đổi ảnh nhóm') })
  }

  return (
    <div className="relative">
      <ConversationAvatar conversation={c} className="h-16 w-16" />
      {busy && (
        <div className="absolute inset-0 rounded-full bg-background/60 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            disabled={busy}
            aria-label="Đổi ảnh nhóm"
            className="absolute -bottom-0.5 -right-0.5 h-7 w-7 rounded-full bg-muted ring-2 ring-card flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          <DropdownMenuItem onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Tải ảnh mới
          </DropdownMenuItem>
          {c.avatarUrl && (
            <DropdownMenuItem onClick={() => changeAvatar.mutate(null)} className="text-destructive">
              <Trash2 className="h-4 w-4" /> Xóa ảnh nhóm
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}

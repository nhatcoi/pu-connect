'use client'

import React from 'react'
import { Copy, Ellipsis, Pencil, Pin, PinOff, Reply, SmilePlus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { CHAT_REACTIONS } from '@pu/schemas'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { UiMessage } from '@/hooks/chat'
import { cn } from '@/lib/utils'

const EDIT_WINDOW_MS = 15 * 60 * 1000

export interface MessageHandlers {
  onReply: (m: UiMessage) => void
  onEdit: (m: UiMessage) => void
  onReact: (m: UiMessage, emoji: string) => void
  onPin: (m: UiMessage) => void
  onDelete: (m: UiMessage) => void
}

// Thanh thao tác nổi cạnh bong bóng: cảm xúc, trả lời, menu (chép, sửa, ghim, thu hồi)
export function MessageActions({ message: m, mine, visible, handlers }: { message: UiMessage; mine: boolean; visible: boolean; handlers: MessageHandlers }) {
  const canEdit = mine && m.kind === 'text' && !!m.content && Date.now() - new Date(m.createdAt).getTime() < EDIT_WINDOW_MS
  const itemCls = 'flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg cursor-pointer'

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 rounded-full bg-card border shadow-sm px-0.5 transition-opacity',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto',
        mine && 'flex-row-reverse'
      )}
    >
      <Popover>
        <PopoverTrigger asChild>
          <IconButton label="Bày tỏ cảm xúc">
            <SmilePlus className="h-3.5 w-3.5" />
          </IconButton>
        </PopoverTrigger>
        <PopoverContent side="top" className="w-auto p-1 rounded-full flex gap-0.5">
          {CHAT_REACTIONS.map((e) => {
            const reacted = m.reactions.some((r) => r.emoji === e)
            return (
              <button
                key={e}
                onClick={() => handlers.onReact(m, e)}
                className={cn('h-8 w-8 rounded-full text-lg hover:bg-muted hover:scale-110 transition-transform cursor-pointer', reacted && 'bg-primary/10')}
              >
                {e}
              </button>
            )
          })}
        </PopoverContent>
      </Popover>
      <IconButton label="Trả lời" onClick={() => handlers.onReply(m)}>
        <Reply className="h-3.5 w-3.5" />
      </IconButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton label="Thêm">
            <Ellipsis className="h-3.5 w-3.5" />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={mine ? 'end' : 'start'} className="w-44 p-1 rounded-xl">
          {m.content && (
            <DropdownMenuItem className={itemCls} onClick={() => navigator.clipboard.writeText(m.content).then(() => toast.success('Đã chép tin nhắn'))}>
              <Copy className="h-3.5 w-3.5" /> Sao chép
            </DropdownMenuItem>
          )}
          {canEdit && (
            <DropdownMenuItem className={itemCls} onClick={() => handlers.onEdit(m)}>
              <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa
            </DropdownMenuItem>
          )}
          <DropdownMenuItem className={itemCls} onClick={() => handlers.onPin(m)}>
            {m.pinnedAt ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />} {m.pinnedAt ? 'Bỏ ghim' : 'Ghim tin'}
          </DropdownMenuItem>
          {mine && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className={cn(itemCls, 'text-destructive')} onClick={() => handlers.onDelete(m)}>
                <Trash2 className="h-3.5 w-3.5" /> Thu hồi
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

const IconButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>(
  ({ label, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center cursor-pointer"
      {...props}
    >
      {children}
    </button>
  )
)
IconButton.displayName = 'IconButton'

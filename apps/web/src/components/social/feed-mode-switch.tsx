'use client'

import { LayoutList, GalleryVerticalEnd } from 'lucide-react'
import type { FeedViewMode } from '@pu/schemas'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

export function FeedModeSwitch({ mode, onChange }: { mode: FeedViewMode; onChange: (mode: FeedViewMode) => void }) {
  const Icon = mode === 'focus' ? GalleryVerticalEnd : LayoutList
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full"
          aria-label={`Chế độ bảng tin: ${mode === 'focus' ? 'Tập trung' : 'Danh sách'}`}
        >
          <Icon className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onChange('list')} className={mode === 'list' ? 'bg-muted' : ''}>
          <LayoutList className="mr-2 h-4 w-4" />
          Danh sách
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onChange('focus')} className={mode === 'focus' ? 'bg-muted' : ''}>
          <GalleryVerticalEnd className="mr-2 h-4 w-4" />
          Tập trung
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

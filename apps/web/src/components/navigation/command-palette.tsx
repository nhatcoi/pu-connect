'use client'

import React, { useEffect } from 'react'
import { Command } from 'cmdk'
import {
  Search,
  FileText,
  GraduationCap,
  Users,
  Flame,
  Sparkles,
  Plus
} from 'lucide-react'
import { useAppStore } from '@/store'
import { Dialog, DialogContent } from '@/components/ui/dialog'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectTab: (tab: 'feed' | 'courses' | 'documents') => void
}

export function CommandPalette({ open, onOpenChange, onSelectTab }: CommandPaletteProps) {
  const setCreatePostOpen = useAppStore((state) => state.setCreatePostOpen)
  const setCreateDocOpen = useAppStore((state) => state.setCreateDocumentOpen)
  const setCreateGroupOpen = useAppStore((state) => state.setCreateGroupOpen)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden shadow-2xl border-border bg-card">
        <Command className="w-full rounded-lg border-none bg-transparent">
          <div className="flex items-center border-b border-border px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              placeholder="Tìm kiếm nhanh môn học, đề thi, hoặc hành động (Ctrl+K)..."
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <Command.List className="max-h-[300px] overflow-y-auto p-2 text-xs">
            <Command.Empty className="py-6 text-center text-xs text-muted-foreground">
              Không tìm thấy kết quả nào phù hợp.
            </Command.Empty>

            <Command.Group heading="Hành động nhanh" className="px-2 py-1.5 text-[11px] font-bold text-muted-foreground">
              <Command.Item
                onSelect={() => {
                  onOpenChange(false)
                  setCreatePostOpen(true)
                }}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer text-foreground hover:bg-muted"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Tạo bài viết thảo luận mới</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  onOpenChange(false)
                  setCreateDocOpen(true)
                }}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer text-foreground hover:bg-muted"
              >
                <Plus className="h-4 w-4 text-primary" />
                <span>Thêm tài liệu hoặc đề thi</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  onOpenChange(false)
                  setCreateGroupOpen(true)
                }}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer text-foreground hover:bg-muted"
              >
                <Users className="h-4 w-4 text-accent" />
                <span>Tạo nhóm ghép đồ án PBL</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Phân hệ chính" className="px-2 py-1.5 text-[11px] font-bold text-muted-foreground border-t border-border mt-1 pt-1">
              <Command.Item
                onSelect={() => {
                  onSelectTab('feed')
                  onOpenChange(false)
                }}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer text-foreground hover:bg-muted"
              >
                <Flame className="h-4 w-4 text-accent" />
                <span>Bảng tin học thuật</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  onSelectTab('courses')
                  onOpenChange(false)
                }}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer text-foreground hover:bg-muted"
              >
                <GraduationCap className="h-4 w-4 text-primary" />
                <span>Danh mục học phần</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  onSelectTab('documents')
                  onOpenChange(false)
                }}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer text-foreground hover:bg-muted"
              >
                <FileText className="h-4 w-4 text-primary" />
                <span>Kho tài liệu đề thi</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

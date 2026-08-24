'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Settings, SlidersHorizontal, Search, X } from 'lucide-react'

interface SearchOptionsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenSettings: () => void
  onOpenFilters: () => void
  onOpenAdvanced: () => void
}

export function SearchOptionsSheet({
  open,
  onOpenChange,
  onOpenSettings,
  onOpenFilters,
  onOpenAdvanced
}: SearchOptionsSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-2 rounded-3xl border-border bg-card shadow-2xl">
        <DialogTitle className="sr-only">Tùy chọn tìm kiếm</DialogTitle>
        <div className="space-y-1 p-1">
          {/* 1. Search Settings */}
          <button
            type="button"
            onClick={() => {
              onOpenChange(false)
              onOpenSettings()
            }}
            className="w-full flex items-center gap-3.5 px-4 py-3 text-sm font-semibold text-foreground rounded-2xl hover:bg-muted transition-colors cursor-pointer text-left"
          >
            <Settings className="h-5 w-5 text-muted-foreground shrink-0" />
            <span>Cài đặt tìm kiếm (Search settings)</span>
          </button>

          {/* 2. Search Filters */}
          <button
            type="button"
            onClick={() => {
              onOpenChange(false)
              onOpenFilters()
            }}
            className="w-full flex items-center gap-3.5 px-4 py-3 text-sm font-semibold text-foreground rounded-2xl hover:bg-muted transition-colors cursor-pointer text-left"
          >
            <SlidersHorizontal className="h-5 w-5 text-muted-foreground shrink-0" />
            <span>Bộ lọc tìm kiếm (Search filters)</span>
          </button>

          {/* 3. Advanced Search */}
          <button
            type="button"
            onClick={() => {
              onOpenChange(false)
              onOpenAdvanced()
            }}
            className="w-full flex items-center gap-3.5 px-4 py-3 text-sm font-semibold text-foreground rounded-2xl hover:bg-muted transition-colors cursor-pointer text-left"
          >
            <Search className="h-5 w-5 text-muted-foreground shrink-0" />
            <span>Tìm kiếm nâng cao (Advanced search)</span>
          </button>
        </div>

        {/* Cancel Button */}
        <div className="pt-1 border-t border-border mt-1">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full rounded-full h-11 text-sm font-bold border-border text-foreground hover:bg-muted cursor-pointer"
          >
            Hủy (Cancel)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

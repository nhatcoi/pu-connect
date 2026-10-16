'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Check } from 'lucide-react'
import { toast } from 'sonner'

export interface SearchSettings {
  hideSensitive: boolean
  removeBlocked: boolean
  prioritizeFaculty: boolean
}

const DEFAULT_SETTINGS: SearchSettings = {
  hideSensitive: true,
  removeBlocked: true,
  prioritizeFaculty: true
}

const SEARCH_SETTINGS_KEY = 'pu_search_settings'

interface SearchSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SearchSettingsDialog({ open, onOpenChange }: SearchSettingsDialogProps) {
  const [settings, setSettings] = useState<SearchSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SEARCH_SETTINGS_KEY)
      if (saved) {
        setSettings(JSON.parse(saved))
      }
    } catch {
      // Ignore storage errors
    }
  }, [])

  const handleToggle = (key: keyof SearchSettings) => {
    const updated = { ...settings, [key]: !settings[key] }
    setSettings(updated)
    try {
      localStorage.setItem(SEARCH_SETTINGS_KEY, JSON.stringify(updated))
      toast.success('Đã lưu cài đặt tìm kiếm')
    } catch {
      // Ignore
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-2xl border-border bg-card">
        {/* Header (Like X Search Settings) */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted text-foreground cursor-pointer transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <DialogTitle className="text-base font-bold text-foreground">Cài đặt tìm kiếm (Search settings)</DialogTitle>
        </div>

        {/* Content list */}
        <div className="p-4 space-y-6">
          {/* Option 1: Hide sensitive content */}
          <div onClick={() => handleToggle('hideSensitive')} className="flex items-start justify-between gap-4 cursor-pointer select-none group">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Ẩn nội dung nhạy cảm</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ngăn bài viết có nội dung chưa được kiểm duyệt hoặc nhạy cảm xuất hiện trong kết quả tìm kiếm học thuật.
              </p>
            </div>
            <div
              className={`h-5 w-5 rounded border flex items-center justify-center transition-colors shrink-0 mt-0.5 ${
                settings.hideSensitive ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/50 bg-background'
              }`}
            >
              {settings.hideSensitive && <Check className="h-3.5 w-3.5 stroke-[3]" />}
            </div>
          </div>

          {/* Option 2: Remove blocked and muted accounts */}
          <div onClick={() => handleToggle('removeBlocked')} className="flex items-start justify-between gap-4 cursor-pointer select-none group">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Loại bỏ tài khoản đã chặn và ẩn</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tự động loại trừ kết quả từ các tài khoản bạn đã đưa vào danh sách chặn hoặc tắt tiếng.
              </p>
            </div>
            <div
              className={`h-5 w-5 rounded border flex items-center justify-center transition-colors shrink-0 mt-0.5 ${
                settings.removeBlocked ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/50 bg-background'
              }`}
            >
              {settings.removeBlocked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
            </div>
          </div>

          {/* Option 3: Prioritize your faculty */}
          <div onClick={() => handleToggle('prioritizeFaculty')} className="flex items-start justify-between gap-4 cursor-pointer select-none group">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Ưu tiên kết quả cùng Khoa / Viện của bạn</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tự động đưa các học phần, đề thi và bài thảo luận thuộc Khoa / Viện của bạn lên vị trí ưu tiên.
              </p>
            </div>
            <div
              className={`h-5 w-5 rounded border flex items-center justify-center transition-colors shrink-0 mt-0.5 ${
                settings.prioritizeFaculty ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/50 bg-background'
              }`}
            >
              {settings.prioritizeFaculty && <Check className="h-3.5 w-3.5 stroke-[3]" />}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-muted/40 border-t border-border flex justify-end">
          <Button size="sm" onClick={() => onOpenChange(false)} className="rounded-full px-5 text-xs font-semibold cursor-pointer">
            Hoàn tất
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

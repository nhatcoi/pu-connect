'use client'

import { useState } from 'react'
import { LayoutList, GalleryVerticalEnd } from 'lucide-react'
import type { FeedViewMode } from '@pu/schemas'
import { useFeaturePreferences } from '@/hooks/use-settings'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { SettingsGroup } from './settings-ui'

export function FeedAppearanceSection() {
  const { preferences, update } = useFeaturePreferences()
  const [saving, setSaving] = useState(false)
  const setOverride = useAppStore((s) => s.setFeedViewOverride)
  const save = async (feedViewMode: FeedViewMode) => {
    setSaving(true)
    try {
      if (await update({ feedViewMode })) setOverride(null)
    } finally {
      setSaving(false)
    }
  }
  return (
    <SettingsGroup label="Chế độ bảng tin mặc định" hint="Đồng bộ theo tài khoản trên mọi thiết bị. Switch ở Home chỉ thay đổi phiên đang dùng.">
      <div role="radiogroup" aria-label="Chế độ bảng tin mặc định" className="grid grid-cols-2 gap-3 py-3">
        {(
          [
            { id: 'list', label: 'Danh sách', description: 'Cuộn liên tục, đọc nhiều bài.', icon: LayoutList },
            { id: 'focus', label: 'Tập trung', description: 'Mỗi màn hình một bài, vuốt để chuyển.', icon: GalleryVerticalEnd }
          ] as const
        ).map(({ id, label, description, icon: Icon }) => (
          <button
            key={id}
            role="radio"
            aria-checked={preferences.feedViewMode === id}
            disabled={saving}
            onClick={() => void save(id)}
            className={cn(
              'min-h-28 rounded-xl border p-3 text-left disabled:opacity-60',
              preferences.feedViewMode === id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted'
            )}
          >
            <Icon className="mb-2 h-5 w-5 text-primary" />
            <span className="block text-sm font-semibold">{label}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
          </button>
        ))}
      </div>
    </SettingsGroup>
  )
}

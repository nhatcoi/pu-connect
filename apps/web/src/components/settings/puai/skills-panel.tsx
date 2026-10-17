'use client'

import React from 'react'
import { SkillsManager } from '@/components/chat/composer/skills-dialog'

// Kỹ năng: dùng chung bộ quản lý với hộp thoại trong ô soạn tin
export function SkillsPanel() {
  return (
    <div className="px-4 pb-5 sm:px-5">
      <p className="pb-3 text-xs leading-relaxed text-muted-foreground">
        Gọi nhanh bằng <code>/lệnh</code>. Ghim để lên đầu, tắt để tạm ẩn.
      </p>
      <SkillsManager />
    </div>
  )
}

'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { AI_PROFILE_LIMITS, type AiLearnerProfile } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useAiSettings } from '@/hooks/chat'
import { useAppStore } from '@/store'
import { SettingsGroup } from '../settings-ui'

const FIELDS: { key: keyof AiLearnerProfile; label: string; placeholder: string }[] = [
  { key: 'goal', label: 'Mục tiêu học', placeholder: 'Vd. IELTS 6.5 trước tháng 6, qua môn Giải tích 2 với điểm B' },
  { key: 'about', label: 'N7AI nên biết gì về bạn?', placeholder: 'Vd. Mình học năm 2 CNTT, yếu phần xác suất, đang tự học React buổi tối' },
  { key: 'style', label: 'N7AI nên trả lời thế nào?', placeholder: 'Vd. Ngắn gọn, có ví dụ code, giải thích thuật ngữ bằng tiếng Anh' }
]

// Hồ sơ học: điều N7AI luôn biết khi trả lời trong thread riêng (kèm ngành / khóa từ hồ sơ PU); không dùng trong nhóm chat
export function ProfilePanel() {
  const { settings, isLoading } = useAiSettings()
  const user = useAppStore((s) => s.user)
  const academic = [user?.major, user?.faculty, user?.school, user?.className, user?.academicYear].filter(Boolean).join(' · ')

  return (
    <>
      <SettingsGroup label="Từ hồ sơ PU" hint="N7AI tự dùng ngành, khoa, lớp, khóa trong hồ sơ của bạn.">
        <p className="py-2.5 text-[13px]">
          {academic || 'Chưa có thông tin học vụ.'}{' '}
          {user?.username && (
            <Link href={`/${user.username}`} className="text-primary hover:underline">
              Sửa hồ sơ
            </Link>
          )}
        </p>
      </SettingsGroup>
      {isLoading || !settings ? (
        <div className="space-y-3 px-4 py-3 sm:px-5">
          {FIELDS.map((f) => (
            <Skeleton key={f.key} className="h-[104px] w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <ProfileForm initial={settings.profile} />
      )}
    </>
  )
}

function ProfileForm({ initial }: { initial: AiLearnerProfile }) {
  const { update } = useAiSettings()
  const [draft, setDraft] = useState<Record<keyof AiLearnerProfile, string>>({
    goal: initial.goal ?? '',
    about: initial.about ?? '',
    style: initial.style ?? ''
  })
  const changed = FIELDS.some((f) => draft[f.key].trim() !== (initial[f.key] ?? ''))

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    update.mutate(
      { profile: { goal: draft.goal.trim() || null, about: draft.about.trim() || null, style: draft.style.trim() || null } },
      { onSuccess: () => toast.success('Đã lưu hồ sơ học') }
    )
  }

  return (
    <form onSubmit={save}>
      <SettingsGroup hint="Chỉ dùng trong hội thoại N7AI của riêng bạn. Để trống ô nào thì N7AI bỏ qua ô đó.">
        {FIELDS.map((f) => (
          <label key={f.key} className="block py-3">
            <span className="flex items-baseline justify-between gap-2 pb-1.5">
              <span className="text-[13px] font-medium">{f.label}</span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {draft[f.key].length}/{AI_PROFILE_LIMITS[f.key]}
              </span>
            </span>
            <Textarea
              value={draft[f.key]}
              maxLength={AI_PROFILE_LIMITS[f.key]}
              rows={f.key === 'about' ? 4 : 2}
              placeholder={f.placeholder}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              className="min-h-0 resize-none text-[13px]"
            />
          </label>
        ))}
      </SettingsGroup>
      <div className="px-4 pb-5 sm:px-5">
        <Button type="submit" size="sm" className="rounded-full" disabled={!changed || update.isPending}>
          {update.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Lưu hồ sơ học
        </Button>
      </div>
    </form>
  )
}

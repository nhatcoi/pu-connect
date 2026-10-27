'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, X } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'

const DISMISS_KEY = 'pu_profile_card_dismissed'

// Thẻ nhắc hoàn thiện hồ sơ (không chặn người dùng, ẩn được)
export function ProfileCompletionCard() {
  const user = useAppStore((state) => state.user)
  const [dismissed, setDismissed] = useState(true) // ẩn tới khi đọc xong localStorage (tránh nhấp nháy)

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1')
    } catch {
      setDismissed(false)
    }
  }, [])

  if (!user || dismissed) return null

  // Bắt buộc: trường (mặc định Phenikaa). Còn lại là tùy chọn
  // Core: school (Phenikaa by default). Everything else is optional
  const steps = [
    { label: 'Trường đại học', done: !!user.school?.trim(), core: true },
    { label: 'Ảnh đại diện', done: !!user.avatarUrl && !user.avatarUrl.includes('dicebear'), core: false },
    { label: 'Tiểu sử', done: !!user.bio?.trim(), core: false },
    { label: 'Liên kết cá nhân', done: !!user.website?.trim(), core: false }
  ]
  const doneCount = steps.filter((s) => s.done).length
  if (doneCount === steps.length) return null
  const coreDone = steps.filter((s) => s.core).every((s) => s.done)
  const percent = Math.round((doneCount / steps.length) * 100)

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // bỏ qua nếu trình duyệt chặn localStorage
    }
  }

  return (
    <section className="rounded-xl bg-card p-4 space-y-3" aria-label="Hoàn thiện hồ sơ">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-semibold text-foreground">{coreDone ? 'Bổ sung hồ sơ' : 'Hoàn thiện hồ sơ'}</h3>
          <p className="text-xs text-muted-foreground">
            {coreDone ? `${percent}% · các mục dưới đây đều tùy chọn` : `${percent}% · chọn trường & ngành để bạn bè dễ tìm thấy bạn`}
          </p>
        </div>
        <button type="button" onClick={dismiss} aria-label="Ẩn thẻ hoàn thiện hồ sơ" className="text-muted-foreground hover:text-foreground cursor-pointer">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-brand-orange transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>

      <ul className="space-y-1.5">
        {steps.map((step) => (
          <li key={step.label} className="flex items-center gap-2 text-xs">
            <span
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded-full border',
                step.done ? 'bg-primary border-primary text-primary-foreground' : 'border-input'
              )}
            >
              {step.done && <Check className="h-3 w-3" />}
            </span>
            <span className={step.done ? 'text-muted-foreground line-through' : 'text-foreground'}>{step.label}</span>
            {!step.done && !step.core && <span className="text-[10px] text-muted-foreground/70">tùy chọn</span>}
          </li>
        ))}
      </ul>

      <Link
        href={`/${user.username}?edit=1`}
        prefetch={false}
        className="block w-full rounded-full bg-primary py-2 text-center text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Cập nhật hồ sơ
      </Link>
    </section>
  )
}

'use client'

import React, { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { AI_SUPPORT_CATEGORIES, type AiSupportInput } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { chatApi, useAiUsage } from '@/hooks/chat'
import { errorMessage } from '@/lib/api-client'
import { SettingsGroup } from '../settings-ui'

const CATEGORY_LABEL: Record<(typeof AI_SUPPORT_CATEGORIES)[number], string> = {
  bug: 'Lỗi ứng dụng',
  wrong_answer: 'PU AI trả lời sai',
  idea: 'Góp ý tính năng',
  other: 'Khác'
}

// Phản hồi & Hỗ trợ: lượt dùng 7 ngày + gửi báo lỗi / góp ý
export function SupportPanel() {
  const { data: usage } = useAiUsage()
  const [form, setForm] = useState<AiSupportInput>({ category: 'bug', message: '', includeContext: false })
  const [sending, setSending] = useState(false)
  const max = Math.max(1, ...(usage?.days.map((d) => d.count) ?? [1]))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.message.trim().length < 10) return toast.error('Mô tả tối thiểu 10 ký tự')
    setSending(true)
    try {
      await chatApi.support(form)
      toast.success('Đã gửi — cảm ơn bạn đã góp ý!')
      setForm((f) => ({ ...f, message: '' }))
    } catch (err) {
      toast.error(errorMessage(err, 'Không gửi được'))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <SettingsGroup label="Lượt dùng PU AI" hint="Research tính 2 lượt. Lượt làm mới lúc 0h (giờ Việt Nam). Chấm 👍/👎 dưới mỗi câu trả lời để PU AI tốt hơn.">
        {usage && (
          <div className="py-3">
            <p className="text-sm">
              Hôm nay: <b>{usage.used}</b>/{usage.limit} lượt
            </p>
            <div className="mt-3 flex h-20 items-end gap-1.5" role="img" aria-label="Lượt dùng 7 ngày">
              {usage.days.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                  <div className="w-full rounded-t bg-primary/70" style={{ height: `${(d.count / max) * 56}px` }} title={`${d.date}: ${d.count} lượt`} />
                  <span className="text-[10px] text-muted-foreground">{d.date.slice(8)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </SettingsGroup>
      <SettingsGroup label="Báo lỗi / góp ý">
        <form onSubmit={submit} className="space-y-2 py-3">
          <div className="flex flex-wrap gap-1.5">
            {AI_SUPPORT_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForm((f) => ({ ...f, category: c }))}
                className={`h-7 rounded-full px-3 text-xs font-medium cursor-pointer ${form.category === c ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
          <Textarea
            rows={4}
            maxLength={2000}
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            placeholder="Mô tả chuyện gì xảy ra…"
          />
          <Button type="submit" size="sm" className="rounded-full" disabled={sending}>
            {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Gửi
          </Button>
        </form>
      </SettingsGroup>
    </>
  )
}

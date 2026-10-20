import React, { useEffect, useState } from 'react'
import type { AdminBotAccount, AdminBotProfileInput, AdminBotTopic } from '@pu/schemas'
import { Button, Dialog, Field, Input } from '@/components/ui'
import { Checkbox } from '@/components/ui/data'

type Draft = Required<AdminBotProfileInput>

const FLAGS: { key: 'canPost' | 'canComment' | 'canLike'; label: string; hint: string }[] = [
  { key: 'canPost', label: 'Đăng bài tự sinh', hint: 'AI viết bài trong chủ đề được phép' },
  { key: 'canComment', label: 'Bình luận', hint: 'Chỉ bình luận bài liên quan chủ đề, bám nội dung' },
  { key: 'canLike', label: 'Thả tim', hint: 'Chỉ bài liên quan chủ đề' }
]
const LIMITS: { key: 'maxPostsPerDay' | 'maxCommentsPerDay' | 'maxLikesPerDay'; label: string; used: 'post' | 'comment' | 'like'; max: number }[] = [
  { key: 'maxPostsPerDay', label: 'Bài/ngày', used: 'post', max: 50 },
  { key: 'maxCommentsPerDay', label: 'Bình luận/ngày', used: 'comment', max: 100 },
  { key: 'maxLikesPerDay', label: 'Tim/ngày', used: 'like', max: 200 }
]

// Hộp thoại cấu hình quyền, chủ đề và hạn mức của 1 bot
export function BotProfileDialog({
  bot,
  topics,
  saving,
  onClose,
  onSave
}: {
  bot: AdminBotAccount | null
  topics: AdminBotTopic[]
  saving: boolean
  onClose: () => void
  onSave: (username: string, draft: Draft) => void
}) {
  const [draft, setDraft] = useState<Draft | null>(null)
  useEffect(() => setDraft(bot ? { ...bot.profile } : null), [bot])
  if (!bot || !draft) return null
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v })
  const toggleTopic = (slug: string) => set('topics', draft.topics.includes(slug) ? draft.topics.filter((t) => t !== slug) : [...draft.topics, slug])

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={`@${bot.username}`}
      description={`${bot.displayName} · mọi quyền mặc định tắt, bật từng việc cho từng bot`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button variant="primary" loading={saving} onClick={() => onSave(bot.username, draft)}>
            Lưu
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Checkbox checked={draft.enabled} onChange={(v) => set('enabled', v)} label="Bot đang hoạt động" /> Bot đang hoạt động
          <span className="font-normal text-muted-foreground">(tắt ⇒ không làm gì kể cả lệnh thủ công)</span>
        </label>

        <Field label="Việc được phép">
          <div className="space-y-2">
            {FLAGS.map((f) => (
              <label key={f.key} className="flex items-start gap-2 text-sm">
                <Checkbox checked={draft[f.key]} onChange={(v) => set(f.key, v)} label={f.label} className="mt-0.5" />
                <span>
                  <span className="font-medium">{f.label}</span> <span className="text-muted-foreground">— {f.hint}</span>
                </span>
              </label>
            ))}
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={draft.interactHumans} onChange={(v) => set('interactHumans', v)} label="Tương tác bài người thật" className="mt-0.5" />
              <span>
                <span className="font-medium">Tương tác bài của người thật</span> <span className="text-muted-foreground">— tắt: chỉ tương tác với bài của bot. Bot không bao giờ trả lời bình luận của người thật.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={draft.feedPoster} onChange={(v) => set('feedPoster', v)} label="Đăng bài từ dữ liệu crawl" className="mt-0.5" />
              <span>
                <span className="font-medium">Đăng bài từ dữ liệu crawl</span> <span className="text-muted-foreground">— thay phiên với các bot khác cùng bật</span>
              </span>
            </label>
          </div>
        </Field>

        <Field label="Chủ đề được phép" hint="Bài đăng và tương tác chỉ trong các chủ đề này">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {topics.map((t) => (
              <label key={t.slug} className="flex items-center gap-2 text-sm">
                <Checkbox checked={draft.topics.includes(t.slug)} onChange={() => toggleTopic(t.slug)} label={t.label} />
                <span className={t.enabled ? '' : 'text-muted-foreground line-through'}>{t.label}</span>
              </label>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-3 gap-3">
          {LIMITS.map((l) => (
            <Field key={l.key} label={l.label} hint={`đã dùng ${bot.usedToday[l.used]}`}>
              <Input type="number" min={0} max={l.max} value={draft[l.key]} onChange={(e) => set(l.key, Math.min(l.max, Math.max(0, Number(e.target.value) || 0)))} />
            </Field>
          ))}
        </div>
      </div>
    </Dialog>
  )
}

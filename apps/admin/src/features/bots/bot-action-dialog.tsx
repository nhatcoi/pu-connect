import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { AdminBotAccount, AdminBotCommandInput, AdminBotOverview, BotCommandType } from '@pu/schemas'
import { adminApi } from '@/lib/api'
import { Button, Dialog, Field, Input, Segmented, Select, Textarea } from '@/components/ui'
import { Checkbox } from '@/components/ui/data'
import { useBotMutation } from './use-bots'

const TYPE_LABEL: Record<BotCommandType, string> = { post: 'Đăng bài', comment: 'Bình luận', like: 'Thả tim' }

export interface BotActionPreset {
  type?: BotCommandType
  bot?: string
}

// datetime-local (giờ máy admin) → ISO; bỏ trống ⇒ chạy ngay
const toIso = (local: string) => (local ? new Date(local).toISOString() : undefined)

// Giao 1 việc cho bot: đăng / bình luận / thả tim, chạy ngay hoặc hẹn giờ, tùy chọn AI viết lại
export function BotActionDialog({ preset, bots, onClose }: { preset: BotActionPreset | null; bots: AdminBotAccount[]; onClose: () => void }) {
  const [type, setType] = useState<BotCommandType>('post')
  const [bot, setBot] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [topic, setTopic] = useState('')
  const [postId, setPostId] = useState('')
  const [enhance, setEnhance] = useState(false)
  const [later, setLater] = useState(false)
  const [when, setWhen] = useState('')

  useEffect(() => {
    if (!preset) return
    setType(preset.type ?? 'post')
    setBot(preset.bot ?? '')
    setTitle('')
    setContent('')
    setTopic('')
    setPostId('')
    setEnhance(false)
    setLater(false)
    setWhen('')
  }, [preset])

  const send = useBotMutation(
    (body: AdminBotCommandInput) => adminApi.post<AdminBotOverview>('/admin/bots/commands', body),
    () => {
      toast.success(later ? 'Đã hẹn giờ' : 'Đã giao việc, bot sẽ chạy trong vài giây')
      onClose()
    }
  )
  if (!preset) return null

  const hasText = !!content.trim()
  const scheduledAt = later ? toIso(when) : undefined
  const mode = enhance && hasText && type !== 'like' ? 'ai' : 'none'

  const build = (): AdminBotCommandInput => {
    if (type === 'like') return { type, bot, postId: postId.trim(), scheduledAt }
    if (type === 'comment') return { type, bot: bot || undefined, postId: postId.trim(), content: content.trim() || undefined, enhance: mode, scheduledAt }
    return { type, bot: bot || undefined, title: title.trim() || undefined, content: content.trim() || undefined, topic: content.trim() ? undefined : topic.trim() || undefined, enhance: mode, scheduledAt }
  }
  const missing = type === 'like' && !bot ? 'Chọn bot' : type !== 'post' && !postId.trim() ? 'Nhập ID bài viết' : later && !when ? 'Chọn giờ hẹn' : ''

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title="Giao việc cho bot"
      description="Bỏ qua hạn mức ngày; bot đang tắt thì không chạy."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button variant="primary" loading={send.isPending} disabled={!!missing} title={missing} onClick={() => send.mutate(build())}>
            {later ? 'Hẹn giờ' : 'Chạy ngay'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Segmented value={type} onChange={setType} items={(Object.keys(TYPE_LABEL) as BotCommandType[]).map((id) => ({ id, label: TYPE_LABEL[id] }))} />

        <Field label="Bot">
          <Select value={bot} onChange={(e) => setBot(e.target.value)}>
            <option value="">{type === 'like' ? 'Chọn bot…' : 'Ngẫu nhiên'}</option>
            {bots.map((b) => (
              <option key={b.id} value={b.username}>
                {b.displayName} (@{b.username}){b.profile.enabled ? '' : ' — đang tắt'}
              </option>
            ))}
          </Select>
        </Field>

        {type !== 'post' && (
          <Field label="ID bài viết">
            <Input value={postId} onChange={(e) => setPostId(e.target.value)} placeholder="UUID bài viết" className="font-mono" />
          </Field>
        )}

        {type === 'post' && (
          <Field label="Tiêu đề">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Tùy chọn" />
          </Field>
        )}

        {type !== 'like' && (
          <Field label="Nội dung">
            <Textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} maxLength={5000} placeholder="Để trống = AI tự viết theo soul và chủ đề của bot" />
          </Field>
        )}

        {type === 'post' && !content.trim() && (
          <Field label="Gợi ý chủ đề">
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} placeholder="Tùy chọn (VD: mẹo ôn thi cuối kỳ)" />
          </Field>
        )}

        {type !== 'like' && hasText && (
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={enhance} onChange={setEnhance} label="AI viết lại" className="mt-0.5" />
            <span>
              <span className="font-medium">AI viết lại trước khi đăng</span> <span className="text-muted-foreground">— giữ nguyên sự thật, không thêm thông tin; lỗi AI thì lệnh thất bại, không đăng bản gốc</span>
            </span>
          </label>
        )}

        <Field label="Thời điểm">
          <div className="flex flex-wrap items-center gap-3">
            <Segmented value={later ? 'later' : 'now'} onChange={(v) => setLater(v === 'later')} items={[{ id: 'now', label: 'Ngay' }, { id: 'later', label: 'Hẹn giờ' }]} />
            {later && <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="w-56" />}
          </div>
        </Field>
      </div>
    </Dialog>
  )
}

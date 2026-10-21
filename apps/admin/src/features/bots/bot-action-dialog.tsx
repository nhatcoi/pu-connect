import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Heart, Loader2, MessageCircle, Sparkles, Zap } from 'lucide-react'
import { toast } from 'sonner'
import type {
  AdminBotAccount,
  AdminBotCommandInput,
  AdminBotOverview,
  BotCommandType,
  BotGenerateContentResult,
  BotRecentPost
} from '@pu/schemas'
import { adminApi, formatRelativeTime } from '@/lib/api'
import { Badge, Button, Dialog, Field, Input, Segmented, Select, Textarea } from '@/components/ui'
import { Checkbox } from '@/components/ui/data'
import { useBotMutation } from './use-bots'

const TYPE_CONFIG = {
  post: { label: 'Đăng bài', icon: FileText },
  comment: { label: 'Bình luận', icon: MessageCircle },
  like: { label: 'Thả tim', icon: Heart }
} as const

export interface BotActionPreset {
  type?: BotCommandType
  bot?: string
}

const toIso = (local: string) => (local ? new Date(local).toISOString() : undefined)

// Bộ chỉ huy Bot: ra lệnh đăng bài, bình luận, thả tim trực tiếp hoặc hẹn giờ, hỗ trợ AI sinh nội dung theo Persona
export function BotActionDialog({
  preset,
  bots,
  onClose
}: {
  preset: BotActionPreset | null
  bots: AdminBotAccount[]
  onClose: () => void
}) {
  const [type, setType] = useState<BotCommandType>('post')
  const [bot, setBot] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [topic, setTopic] = useState('')
  const [postId, setPostId] = useState('')
  const [manualPostId, setManualPostId] = useState(false)
  const [enhance, setEnhance] = useState(false)
  const [later, setLater] = useState(false)
  const [when, setWhen] = useState('')
  const [generating, setGenerating] = useState(false)

  // Tải danh sách bài viết gần đây để admin chọn nhanh khi bình luận hoặc thả tim
  const recentPosts = useQuery({
    queryKey: ['admin', 'bots', 'recent-posts'],
    queryFn: () => adminApi.get<BotRecentPost[]>('/admin/bots/recent-posts'),
    enabled: !!preset && type !== 'post'
  })

  useEffect(() => {
    if (!preset) return
    setType(preset.type ?? 'post')
    setBot(preset.bot ?? (bots.find((b) => b.profile.enabled)?.username ?? bots[0]?.username ?? ''))
    setTitle('')
    setContent('')
    setTopic('')
    setPostId('')
    setManualPostId(false)
    setEnhance(false)
    setLater(false)
    setWhen('')
    setGenerating(false)
  }, [preset, bots])

  const send = useBotMutation(
    (body: AdminBotCommandInput) => adminApi.post<AdminBotOverview>('/admin/bots/commands', body),
    () => {
      const msg = later
        ? 'Đã lên lịch thành công'
        : type === 'post'
          ? 'Đã đăng bài thành công!'
          : type === 'comment'
            ? 'Đã bình luận thành công!'
            : 'Đã thả tim bài viết thành công!'
      toast.success(msg)
      onClose()
    }
  )

  if (!preset) return null

  const selectedBot = bots.find((b) => b.username === bot)
  const hasText = !!content.trim()
  const scheduledAt = later ? toIso(when) : undefined
  const mode = enhance && hasText && type !== 'like' ? 'ai' : 'none'

  const handleAiGenerate = async () => {
    if (!bot) {
      toast.error('Vui lòng chọn Bot trước khi sinh nội dung')
      return
    }
    if (type === 'comment' && !postId.trim()) {
      toast.error('Vui lòng chọn bài viết trước khi để AI viết bình luận')
      return
    }

    try {
      setGenerating(true)
      const res = await adminApi.post<BotGenerateContentResult>('/admin/bots/generate-content', {
        bot,
        type: type === 'post' ? 'post' : 'comment',
        prompt: topic.trim() || undefined,
        postId: type === 'comment' ? postId.trim() : undefined
      })
      if (res.title && !title) setTitle(res.title)
      if (res.content) setContent(res.content)
      toast.success('AI đã soạn thảo xong theo Persona của Bot!')
    } catch (err: any) {
      toast.error(err.message || 'Không thể sinh nội dung bằng AI')
    } finally {
      setGenerating(false)
    }
  }

  const build = (): AdminBotCommandInput => {
    if (type === 'like') return { type, bot, postId: postId.trim(), scheduledAt }
    if (type === 'comment') return { type, bot: bot || undefined, postId: postId.trim(), content: content.trim() || undefined, enhance: mode, scheduledAt }
    return {
      type,
      bot: bot || undefined,
      title: title.trim() || undefined,
      content: content.trim() || undefined,
      topic: content.trim() ? undefined : topic.trim() || undefined,
      enhance: mode,
      scheduledAt
    }
  }

  const missing =
    type === 'like' && !bot
      ? 'Chọn bot thả tim'
      : type !== 'post' && !postId.trim()
        ? 'Chọn hoặc nhập ID bài viết'
        : later && !when
          ? 'Chọn giờ hẹn'
          : ''

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title="Điều hành Bot"
      description="Ra lệnh cho Bot đăng bài, bình luận hoặc tương tác trên mạng xã hội."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button variant="primary" loading={send.isPending} disabled={!!missing || generating} title={missing} onClick={() => send.mutate(build())}>
            {later ? '⏰ Lên lịch' : '⚡ Thực thi ngay'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Chọn hành động */}
        <Segmented
          value={type}
          onChange={setType}
          items={(Object.keys(TYPE_CONFIG) as BotCommandType[]).map((id) => ({
            id,
            label: TYPE_CONFIG[id].label
          }))}
        />

        {/* Chọn bot */}
        <Field label="Bot thực hiện">
          <Select value={bot} onChange={(e) => setBot(e.target.value)}>
            <option value="">{type === 'like' ? 'Chọn bot…' : 'Ngẫu nhiên trong các Bot đang hoạt động'}</option>
            {bots.map((b) => (
              <option key={b.id} value={b.username}>
                {b.displayName} (@{b.username}) — {b.role === 'lecturer' ? 'Giảng viên' : b.role === 'ta' ? 'Trợ giảng' : 'Sinh viên'} {b.faculty ? `[${b.faculty}]` : ''} {b.profile.enabled ? '' : '(Đang tắt)'}
              </option>
            ))}
          </Select>
          {selectedBot && (
            <div className="mt-2 rounded-lg border border-border/80 bg-muted/40 p-2.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Phong cách (Soul):</span>{' '}
              {selectedBot.soul ? selectedBot.soul : 'Chưa có mô tả linh hồn (bot sẽ dùng giọng điệu mặc định).'}
            </div>
          )}
        </Field>

        {/* Bộ chọn bài viết khi bình luận hoặc thả tim */}
        {type !== 'post' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bài viết mục tiêu</label>
              <button
                type="button"
                onClick={() => setManualPostId(!manualPostId)}
                className="text-xs text-primary hover:underline"
              >
                {manualPostId ? '← Chọn từ bài gần đây' : 'Nhập UUID thủ công →'}
              </button>
            </div>

            {manualPostId ? (
              <Input
                value={postId}
                onChange={(e) => setPostId(e.target.value)}
                placeholder="Dán UUID hoặc Link bài viết"
                className="font-mono text-sm"
              />
            ) : (
              <Select value={postId} onChange={(e) => setPostId(e.target.value)}>
                <option value="">
                  {recentPosts.isPending ? 'Đang tải bài viết gần đây…' : '-- Chọn bài viết gần đây --'}
                </option>
                {(recentPosts.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} (bởi @{p.authorUsername} · {p.commentsCount} bl, {p.likesCount} tim · {formatRelativeTime(p.createdAt)})
                  </option>
                ))}
              </Select>
            )}

            {postId && recentPosts.data?.find((p) => p.id === postId) && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
                <p className="font-semibold text-foreground">
                  {recentPosts.data.find((p) => p.id === postId)?.title}
                </p>
                <p className="mt-1 line-clamp-2 text-muted-foreground">
                  {recentPosts.data.find((p) => p.id === postId)?.snippet}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tiêu đề bài viết */}
        {type === 'post' && (
          <Field label="Tiêu đề bài viết" hint="Tùy chọn">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Nhập tiêu đề hoặc để AI tự đặt..." />
          </Field>
        )}

        {/* Hỗ trợ AI sinh nội dung */}
        {type !== 'like' && (
          <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                {type === 'post' ? 'Gợi ý chủ đề cho AI' : 'Gợi ý góc nhìn cho AI'}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                loading={generating}
                disabled={generating || !bot}
                onClick={handleAiGenerate}
                className="border-primary/30 text-primary hover:bg-primary/10"
              >
                {generating ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {type === 'post' ? 'AI viết bài theo Soul' : 'AI viết bình luận theo Soul'}
              </Button>
            </div>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={200}
              placeholder={type === 'post' ? 'Ví dụ: Mẹo ôn thi cuối kỳ, chia sẻ tài liệu môn Giải tích...' : 'Ví dụ: Đưa ra lời khuyên hữu ích, hỏi thăm kinh nghiệm học nhóm...'}
              className="mt-2 text-sm"
            />
          </div>
        )}

        {/* Nội dung bài / bình luận */}
        {type !== 'like' && (
          <Field
            label={type === 'post' ? 'Nội dung bài viết' : 'Nội dung bình luận'}
            hint="Có thể chỉnh sửa nội dung do AI sinh trước khi đăng"
          >
            <Textarea
              rows={type === 'post' ? 6 : 3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={5000}
              placeholder={type === 'post' ? 'Nhập nội dung bài viết hoặc bấm nút AI viết bài ở trên...' : 'Nhập nội dung bình luận hoặc bấm nút AI viết bình luận ở trên...'}
            />
          </Field>
        )}

        {/* Tùy chọn thời điểm */}
        <Field label="Thời điểm thực hiện">
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              value={later ? 'later' : 'now'}
              onChange={(v) => setLater(v === 'later')}
              items={[
                { id: 'now', label: '⚡ Chạy ngay' },
                { id: 'later', label: '⏰ Hẹn giờ' }
              ]}
            />
            {later && <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="w-56" />}
          </div>
        </Field>
      </div>
    </Dialog>
  )
}

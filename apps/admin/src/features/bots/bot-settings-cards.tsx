import React, { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { AdminBotOverview, AdminBotTopic, AdminBotTopicInput } from '@pu/schemas'
import { adminApi } from '@/lib/api'
import { Badge, Button, Card, CardHeader, Field, Input, Select } from '@/components/ui'
import { Checkbox } from '@/components/ui/data'
import { useBotMutation } from './use-bots'

const AI_MODELS = ['v10', 'v9', 'n7ai-fast']

// AI dùng để tự viết bài/bình luận và viết lại nội dung import. Key API nằm ở env của server, không nhập ở đây.
export function AiConfigCard({ data }: { data: AdminBotOverview }) {
  const [custom, setCustom] = useState(!AI_MODELS.includes(data.ai.model))
  const [model, setModel] = useState(data.ai.model)
  const [baseUrl, setBaseUrl] = useState(data.ai.baseUrl ?? '')
  const save = useBotMutation((v: { aiModel: string; aiBaseUrl: string | null }) => adminApi.patch<AdminBotOverview>('/admin/bots/control', v))
  const dirty = model !== data.ai.model || (baseUrl.trim() || null) !== data.ai.baseUrl

  return (
    <Card>
      <CardHeader title="AI viết nội dung" description="Model dùng khi bot tự đăng theo soul, bình luận/trả lời, và khi “AI viết lại” nội dung import." />
      <div className="space-y-4 p-4 pt-0">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Model" hint="api-ai.vnhat.dev">
            <Select
              value={custom ? '__custom' : model}
              onChange={(e) => {
                const v = e.target.value
                setCustom(v === '__custom')
                if (v !== '__custom') setModel(v)
              }}
            >
              {AI_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              <option value="__custom">Khác…</option>
            </Select>
            {custom && <Input className="mt-2" value={model} onChange={(e) => setModel(e.target.value)} placeholder="tên model" maxLength={80} />}
          </Field>
          <Field label="Base URL" hint="Bỏ trống = mặc định của server">
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api-ai.vnhat.dev/v1" />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button variant="primary" disabled={!dirty || !model.trim()} loading={save.isPending} onClick={() => save.mutate({ aiModel: model.trim(), aiBaseUrl: baseUrl.trim() || null })}>
            Lưu AI
          </Button>
        </div>
      </div>
    </Card>
  )
}

// Chủ đề bot được phép đăng/tương tác; từ khóa dùng để khớp bài liên quan (không dấu, nguyên từ)
export function TopicsCard({ topics }: { topics: AdminBotTopic[] }) {
  const [draft, setDraft] = useState({ slug: '', label: '', keywords: '' })
  const save = useBotMutation((t: AdminBotTopicInput) => adminApi.put<AdminBotOverview>('/admin/bots/topics', t))
  const remove = useBotMutation((slug: string) => adminApi.delete<AdminBotOverview>(`/admin/bots/topics/${slug}`))
  const add = () =>
    save.mutate({ slug: draft.slug.trim(), label: draft.label.trim(), keywords: draft.keywords.split(',').map((k) => k.trim()).filter(Boolean), enabled: true }, { onSuccess: () => setDraft({ slug: '', label: '', keywords: '' }) })

  return (
    <Card>
      <CardHeader title={`Chủ đề được phép (${topics.length})`} description="Bot chỉ đăng/tương tác trong chủ đề được cấp và đang bật. Từ khóa cách nhau bằng dấu phẩy." />
      <div className="divide-y divide-border border-t border-border">
        {topics.map((t) => (
          <div key={t.slug} className="flex items-start gap-3 px-4 py-2.5 text-sm">
            <Checkbox checked={t.enabled} onChange={(enabled) => save.mutate({ ...t, enabled })} label={`Bật ${t.label}`} className="mt-1" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">
                {t.label} <Badge>{t.slug}</Badge>
              </p>
              <p className="break-words text-xs text-muted-foreground">{t.keywords.join(' · ') || 'Chưa có từ khóa'}</p>
            </div>
            <Button variant="danger-soft" size="icon-sm" aria-label={`Xóa ${t.label}`} loading={remove.isPending && remove.variables === t.slug} onClick={() => remove.mutate(t.slug)}>
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
      <div className="grid gap-2 border-t border-border p-4 sm:grid-cols-[140px_1fr_2fr_auto]">
        <Input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} placeholder="slug" maxLength={40} />
        <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Tên chủ đề" maxLength={80} />
        <Input value={draft.keywords} onChange={(e) => setDraft({ ...draft, keywords: e.target.value })} placeholder="từ khóa, cách nhau, bằng dấu phẩy" />
        <Button variant="primary" disabled={!draft.slug.trim() || !draft.label.trim()} loading={save.isPending} onClick={add}>
          <Plus /> Thêm
        </Button>
      </div>
    </Card>
  )
}

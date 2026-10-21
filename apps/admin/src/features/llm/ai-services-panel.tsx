import React, { useState } from 'react'
import { Edit2, Play } from 'lucide-react'
import type { AdminAiServiceItem, AdminAiServicesOverview } from '@pu/schemas'
import { Badge, Button, Card, CardHeader, Dialog, Field, Input } from '@/components/ui'
import { formatRelativeTime } from '@/lib/api'
import type { LlmActions } from './use-llm'

export function AiServicesPanel({
  data,
  canManage,
  actions
}: {
  data?: AdminAiServicesOverview
  canManage: boolean
  actions: LlmActions
}) {
  const [editing, setEditing] = useState<{ item: AdminAiServiceItem; title: string } | null>(null)

  if (!data) return null

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ServiceCard
          title="RAG"
          item={data.embedding}
          canManage={canManage}
          actions={actions}
          onEdit={() => setEditing({ item: data.embedding, title: 'RAG' })}
        />
        <ServiceCard
          title="OCR"
          item={data.ocr}
          canManage={canManage}
          actions={actions}
          onEdit={() => setEditing({ item: data.ocr, title: 'OCR' })}
        />
      </div>

      {editing && (
        <ServiceDialog
          item={editing.item}
          title={editing.title}
          onClose={() => setEditing(null)}
          actions={actions}
        />
      )}
    </>
  )
}

export function ServiceCard({
  title,
  item,
  canManage,
  actions,
  onEdit
}: {
  title: string
  item: AdminAiServiceItem
  canManage: boolean
  actions: LlmActions
  onEdit: () => void
}) {
  const isTesting = actions.testService.isPending && actions.testService.variables === item.service

  return (
    <Card className="flex flex-col justify-between">
      <div>
        <CardHeader
          title={title}
          action={
            <Badge tone={item.enabled ? 'success' : 'neutral'}>
              {item.enabled ? 'Bật' : 'Tắt'}
            </Badge>
          }
        />
        <div className="p-4 space-y-2.5 text-xs">
          <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
            <span className="text-muted-foreground">Base URL</span>
            <span className="font-mono text-foreground truncate max-w-[240px] text-right" title={item.baseUrl || 'Chưa đặt'}>
              {item.baseUrl || <span className="text-muted-foreground">—</span>}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
            <span className="text-muted-foreground">Model</span>
            <span className="font-mono font-medium text-foreground">{item.model || '—'}</span>
          </div>

          <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
            <span className="text-muted-foreground">API key</span>
            <span className="text-foreground font-mono">
              {item.keyHint ? `…${item.keyHint}` : <span className="text-muted-foreground">Không</span>}
            </span>
          </div>

          {item.service === 'ocr' && (
            <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
              <span className="text-muted-foreground">Giới hạn trang</span>
              <span className="text-foreground font-medium">{item.maxPages || 30} trang</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground">
            <span>Cập nhật</span>
            <span>{formatRelativeTime(item.updatedAt)}</span>
          </div>
        </div>
      </div>

      <div className="p-3 bg-muted/20 border-t border-border/60 flex items-center justify-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          loading={isTesting}
          onClick={() => actions.testService.mutate(item.service)}
        >
          <Play className="h-3.5 w-3.5" /> Thử kết nối
        </Button>
        {canManage && (
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Edit2 className="h-3.5 w-3.5" /> Sửa
          </Button>
        )}
      </div>
    </Card>
  )
}

export function ServiceDialog({
  item,
  title,
  onClose,
  actions
}: {
  item: AdminAiServiceItem
  title?: string
  onClose: () => void
  actions: LlmActions
}) {
  const [form, setForm] = useState({
    baseUrl: item.baseUrl,
    model: item.model,
    apiKey: '',
    maxPages: item.maxPages || 30,
    enabled: item.enabled
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    actions.updateService.mutate(
      {
        service: item.service,
        baseUrl: form.baseUrl.trim(),
        model: form.model.trim(),
        apiKey: form.apiKey.trim() || undefined,
        maxPages: item.service === 'ocr' ? Number(form.maxPages) : undefined,
        enabled: form.enabled
      },
      { onSuccess: onClose }
    )
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Cấu hình ${title || item.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button variant="primary" loading={actions.updateService.isPending} onClick={submit}>
            Lưu
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4 text-sm">
        <Field label="Base URL">
          <Input
            required
            autoFocus
            type="url"
            value={form.baseUrl}
            placeholder={item.service === 'embedding' ? 'http://127.0.0.1:11435/v1' : 'https://api-ai.vnhat.dev/v1'}
            className="font-mono text-xs"
            onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Model">
            <Input
              required
              value={form.model}
              placeholder={item.service === 'embedding' ? 'qwen3-embedding:0.6b' : 'gemini-3.7-flash-medium'}
              className="font-mono text-xs"
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            />
          </Field>

          {item.service === 'ocr' ? (
            <Field label="Giới hạn trang">
              <Input
                type="number"
                min={1}
                max={100}
                value={form.maxPages}
                onChange={(e) => setForm({ ...form, maxPages: Number(e.target.value) })}
              />
            </Field>
          ) : (
            <Field label="API Key">
              <Input
                type="password"
                autoComplete="off"
                value={form.apiKey}
                placeholder={item.keyHint ? `…${item.keyHint}` : 'Tùy chọn'}
                className="font-mono text-xs"
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              />
            </Field>
          )}
        </div>

        {item.service === 'ocr' && (
          <Field label="API Key">
            <Input
              type="password"
              autoComplete="off"
              value={form.apiKey}
              placeholder={item.keyHint ? `…${item.keyHint}` : 'Tùy chọn'}
              className="font-mono text-xs"
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            />
          </Field>
        )}

        <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          />
          Bật
        </label>
      </form>
    </Dialog>
  )
}

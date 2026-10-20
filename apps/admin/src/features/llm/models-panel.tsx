import React, { useState } from 'react'
import { Eye, EyeOff, MoreHorizontal, Pencil, Plus, Power, Star, Trash2 } from 'lucide-react'
import type { AdminAiModel, AdminAiProvider, AiReasoningEffort } from '@pu/schemas'
import { cn, formatNumber } from '@/lib/api'
import { Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, Field, Input, Menu, MenuItem, MenuSeparator, Select } from '@/components/ui'
import type { LlmActions } from './use-llm'

const EFFORT: Record<AiReasoningEffort, string> = { low: 'Thấp', medium: 'Vừa', high: 'Cao' }
const tokens = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))

// Model = mục người dùng chọn trong N7AI: gắn provider + tên model thật + effort + giới hạn token
export function ModelsPanel({
  models,
  providers,
  canManage,
  actions
}: {
  models: AdminAiModel[]
  providers: AdminAiProvider[]
  canManage: boolean
  actions: LlmActions
}) {
  const [edit, setEdit] = useState<{ model?: AdminAiModel } | null>(null)
  const [del, setDel] = useState<AdminAiModel | null>(null)

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">Model</h2>
        <span className="text-xs text-muted-foreground">Tắt model ⇒ người đang chọn về model mặc định</span>
        {canManage && (
          <Button size="sm" className="ml-auto" onClick={() => setEdit({})}>
            <Plus /> Thêm
          </Button>
        )}
      </div>

      {models.length === 0 ? (
        <EmptyState title="Chưa có model" />
      ) : (
        <Card className="divide-y divide-border">
          {models.map((m) => (
            <div key={m.id} className={cn('flex items-center gap-3 px-4 py-2.5', !m.enabled && 'opacity-55')}>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-foreground">
                  {m.label}
                  {m.isDefault && <Badge tone="primary">Mặc định</Badge>}
                  {!m.enabled && <Badge tone="danger">Tắt</Badge>}
                  {m.enabled && !m.visible && <Badge>Ẩn</Badge>}
                  {m.reasoningEffort && <Badge>Effort {EFFORT[m.reasoningEffort]}</Badge>}
                </p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {m.providerName ?? 'Provider mặc định'} · {m.upstreamModel ?? m.id}
                  {m.maxInputTokens ? ` · in ${tokens(m.maxInputTokens)}` : ''}
                  {m.maxOutputTokens ? ` · out ${tokens(m.maxOutputTokens)}` : ''}
                </p>
              </div>
              <div className="hidden shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:block">
                <p>{m.cost} lượt / câu</p>
                <p>
                  {formatNumber(m.users)} người · {formatNumber(m.runs7d)} lượt/7 ngày
                  {m.errors7d > 0 && <span className="text-danger"> · {m.errors7d} lỗi</span>}
                </p>
              </div>
              {canManage && (
                <Menu
                  trigger={(p) => (
                    <Button size="sm" variant="ghost" aria-label="Thao tác" {...p}>
                      <MoreHorizontal />
                    </Button>
                  )}
                >
                  <MenuItem icon={Pencil} onSelect={() => setEdit({ model: m })}>
                    Sửa
                  </MenuItem>
                  {!m.isDefault && m.enabled && (
                    <MenuItem icon={Star} onSelect={() => actions.updateModel.mutate({ id: m.id, isDefault: true })}>
                      Đặt mặc định
                    </MenuItem>
                  )}
                  <MenuItem icon={m.visible ? EyeOff : Eye} onSelect={() => actions.updateModel.mutate({ id: m.id, visible: !m.visible })}>
                    {m.visible ? 'Ẩn khỏi menu' : 'Hiện trong menu'}
                  </MenuItem>
                  {!m.isDefault && (
                    <>
                      <MenuItem icon={Power} onSelect={() => actions.updateModel.mutate({ id: m.id, enabled: !m.enabled })}>
                        {m.enabled ? 'Tắt' : 'Bật lại'}
                      </MenuItem>
                      <MenuSeparator />
                      <MenuItem icon={Trash2} danger onSelect={() => setDel(m)}>
                        Xóa
                      </MenuItem>
                    </>
                  )}
                </Menu>
              )}
            </div>
          ))}
        </Card>
      )}

      <ModelDialog state={edit} providers={providers} onClose={() => setEdit(null)} actions={actions} />
      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        title={`Xóa model "${del?.label}"?`}
        description={`${del?.users ?? 0} người đang chọn sẽ chuyển về model mặc định. Lịch sử lượt chạy giữ nguyên.`}
        confirmLabel="Xóa"
        loading={actions.removeModel.isPending}
        onConfirm={() => del && actions.removeModel.mutate(del.id, { onSuccess: () => setDel(null) })}
      />
    </section>
  )
}

const num = (v: string) => (v.trim() === '' ? null : Number(v))

function ModelDialog({
  state,
  providers,
  onClose,
  actions
}: {
  state: { model?: AdminAiModel } | null
  providers: AdminAiProvider[]
  onClose: () => void
  actions: LlmActions
}) {
  const editing = state?.model
  const blank = { label: '', hint: '', cost: 1, visible: true, providerId: '', upstream: '', effort: '', maxIn: '', maxOut: '' }
  const [form, setForm] = useState(blank)
  // Nạp lại form mỗi khi mở
  const key = state ? (editing?.id ?? 'new') : ''
  const [loaded, setLoaded] = useState('')
  if (state && loaded !== key) {
    setLoaded(key)
    setForm(
      editing
        ? {
            label: editing.label,
            hint: editing.hint,
            cost: editing.cost,
            visible: editing.visible,
            providerId: editing.providerId ?? '',
            upstream: editing.upstreamModel ?? editing.id,
            effort: editing.reasoningEffort ?? '',
            maxIn: editing.maxInputTokens?.toString() ?? '',
            maxOut: editing.maxOutputTokens?.toString() ?? ''
          }
        : blank
    )
  }
  if (!state && loaded) setLoaded('')
  const busy = actions.createModel.isPending || actions.updateModel.isPending
  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch })

  return (
    <Dialog
      open={!!state}
      onClose={onClose}
      title={editing ? 'Sửa model' : 'Thêm model'}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" type="submit" form="llm-model-form" loading={busy}>
            Lưu
          </Button>
        </>
      }
    >
      <form
        id="llm-model-form"
        onSubmit={(e) => {
          e.preventDefault()
          const body = {
            label: form.label,
            hint: form.hint,
            cost: form.cost,
            visible: form.visible,
            providerId: form.providerId || null,
            upstreamModel: form.upstream.trim() || null,
            reasoningEffort: (form.effort || null) as AiReasoningEffort | null,
            maxInputTokens: num(form.maxIn),
            maxOutputTokens: num(form.maxOut)
          }
          if (editing) actions.updateModel.mutate({ id: editing.id, ...body }, { onSuccess: onClose })
          else actions.createModel.mutate(body, { onSuccess: onClose })
        }}
        className="space-y-4"
      >
        <Field label="Tên hiển thị">
          <Input required autoFocus value={form.label} maxLength={40} onChange={(e) => set({ label: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Provider">
            <Select value={form.providerId} onChange={(e) => set({ providerId: e.target.value })}>
              <option value="">Mặc định (theo thứ tự)</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tên model trên provider">
            <Input required value={form.upstream} maxLength={120} className="font-mono" onChange={(e) => set({ upstream: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Effort">
            <Select value={form.effort} onChange={(e) => set({ effort: e.target.value })}>
              <option value="">Mặc định</option>
              <option value="low">Thấp</option>
              <option value="medium">Vừa</option>
              <option value="high">Cao</option>
            </Select>
          </Field>
          <Field label="Max input" hint="token">
            <Input type="number" min={1000} max={2000000} placeholder="Không giới hạn" value={form.maxIn} onChange={(e) => set({ maxIn: e.target.value })} />
          </Field>
          <Field label="Max output" hint="token">
            <Input type="number" min={256} max={200000} placeholder="Mặc định" value={form.maxOut} onChange={(e) => set({ maxOut: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-3">
            <Field label="Mô tả ngắn" hint="hiện trong menu">
              <Input value={form.hint} maxLength={160} onChange={(e) => set({ hint: e.target.value })} />
            </Field>
          </div>
          <Field label="Lượt / câu">
            <Input type="number" required min={1} max={10} value={form.cost} onChange={(e) => set({ cost: Number(e.target.value) })} />
          </Field>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={form.visible} onChange={(e) => set({ visible: e.target.checked })} /> Hiện trong menu chọn của người dùng
        </label>
      </form>
    </Dialog>
  )
}

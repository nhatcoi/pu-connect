import React, { useState } from 'react'
import { Eye, EyeOff, MoreHorizontal, Pencil, Plus, Power, Star, Trash2 } from 'lucide-react'
import type { AdminAiModel, AdminAiProvider, AiReasoningEffort } from '@pu/schemas'
import { cn, formatNumber } from '@/lib/api'
import { Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, Field, Input, Menu, MenuItem, MenuSeparator, Select } from '@/components/ui'
import { useDiscovery, type LlmActions } from './use-llm'

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
                  <span className="font-mono text-xs text-muted-foreground">({m.id})</span>
                  {m.isDefault && <Badge tone="primary">Mặc định</Badge>}
                  {!m.enabled && <Badge tone="danger">Tắt</Badge>}
                  {m.enabled && !m.visible && <Badge>Ẩn</Badge>}
                  {m.reasoningEffort && <Badge>Effort {EFFORT[m.reasoningEffort]}</Badge>}
                </p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {m.providerName ? (
                    <span className="text-foreground">{m.providerName}</span>
                  ) : (
                    <span className="text-warning font-medium">Chưa gắn provider</span>
                  )}
                  {' · '}
                  <span>{m.upstreamModel ?? m.id}</span>
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
  const defaultProviderId = providers.find((p) => p.enabled)?.id ?? providers[0]?.id ?? ''
  const blank = { id: '', label: '', hint: '', cost: 1, visible: true, providerId: defaultProviderId, upstream: '', effort: '', maxIn: '', maxOut: '' }
  const [form, setForm] = useState(blank)
  const [manualInput, setManualInput] = useState(false)
  // Nạp lại form mỗi khi mở
  const key = state ? (editing?.id ?? 'new') : ''
  const [loaded, setLoaded] = useState('')
  if (state && loaded !== key) {
    setLoaded(key)
    setManualInput(false)
    setForm(
      editing
        ? {
            id: editing.id,
            label: editing.label,
            hint: editing.hint,
            cost: editing.cost,
            visible: editing.visible,
            providerId: editing.providerId ?? defaultProviderId,
            upstream: editing.upstreamModel ?? editing.id,
            effort: editing.reasoningEffort ?? '',
            maxIn: editing.maxInputTokens?.toString() ?? '',
            maxOut: editing.maxOutputTokens?.toString() ?? ''
          }
        : {
            ...blank,
            providerId: defaultProviderId
          }
    )
  }
  if (!state && loaded) setLoaded('')
  const busy = actions.createModel.isPending || actions.updateModel.isPending
  const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }))

  const discovery = useDiscovery(form.providerId || null)

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
            id: form.id.trim() || undefined,
            label: form.label.trim(),
            hint: form.hint,
            cost: form.cost,
            visible: form.visible,
            providerId: form.providerId || null,
            upstreamModel: form.upstream.trim() || null,
            reasoningEffort: (form.effort || null) as AiReasoningEffort | null,
            maxInputTokens: num(form.maxIn),
            maxOutputTokens: num(form.maxOut)
          }
          if (editing) actions.updateModel.mutate({ currentId: editing.id, ...body }, { onSuccess: onClose })
          else actions.createModel.mutate(body, { onSuccess: onClose })
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tên hiển thị" hint="hiện cho người dùng">
            <Input
              required
              autoFocus
              value={form.label}
              maxLength={40}
              placeholder="vd. Nhanh, Cân bằng, Sâu..."
              onChange={(e) => set({ label: e.target.value })}
            />
          </Field>
          <Field label="Tên model map" hint="mã định danh N7AI, vd. n7ai-fast">
            <Input
              required
              value={form.id}
              maxLength={40}
              className="font-mono"
              placeholder="vd. n7ai-fast"
              onChange={(e) => set({ id: e.target.value.toLowerCase().replace(/[^a-z0-9._:/-]+/g, '-') })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Provider">
            <Select
              required
              value={form.providerId}
              onChange={(e) => {
                const pid = e.target.value
                set({ providerId: pid })
                setManualInput(false)
              }}
            >
              {providers.length === 0 ? (
                <option value="">Chưa có provider</option>
              ) : (
                <>
                  <option value="">-- Chọn Provider --</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {!p.enabled ? '(Đang tắt)' : ''}
                    </option>
                  ))}
                </>
              )}
            </Select>
          </Field>
          <Field
            label="Model trên provider"
            hint={
              discovery.isFetching
                ? 'Đang dò model...'
                : discovery.data?.ok
                  ? `${discovery.data.models.length} model`
                  : undefined
            }
          >
            {!form.providerId ? (
              <Input disabled placeholder="Chọn provider ở ô bên trái trước" value="" />
            ) : manualInput || !discovery.data?.ok || (discovery.data?.models.length === 0 && !discovery.isFetching) ? (
              <div className="relative">
                <Input
                  required
                  autoFocus={manualInput}
                  value={form.upstream}
                  maxLength={120}
                  className="font-mono pr-20"
                  placeholder="vd. n7ai-fast, gpt-4o..."
                  onChange={(e) => set({ upstream: e.target.value })}
                />
                {discovery.data?.ok && discovery.data.models.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setManualInput(false)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-primary hover:underline cursor-pointer"
                  >
                    Chọn lại
                  </button>
                )}
              </div>
            ) : discovery.isFetching ? (
              <Select disabled>
                <option>Đang tải model từ provider...</option>
              </Select>
            ) : (
              <Select
                required
                value={form.upstream}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === '__custom__') {
                    setManualInput(true)
                  } else {
                    const cleanSlug = val
                      .toLowerCase()
                      .replace(/[^a-z0-9._:/-]+/g, '-')
                      .replace(/^[^a-z0-9]+/, '')
                      .slice(0, 36)
                    set({
                      upstream: val,
                      ...(form.label.trim() ? {} : { label: val.slice(0, 40) }),
                      ...(form.id.trim() ? {} : { id: cleanSlug })
                    })
                  }
                }}
              >
                <option value="">-- Chọn model của provider --</option>
                {form.upstream && !discovery.data.models.some((m) => m.name === form.upstream) && (
                  <option value={form.upstream}>{form.upstream} (đang chọn)</option>
                )}
                {discovery.data.models.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                  </option>
                ))}
                <option value="__custom__">✎ Nhập tên khác (thủ công)...</option>
              </Select>
            )}
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

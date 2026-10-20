import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, MoreHorizontal, Pencil, Plus, Power, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { AdminAiModel, AdminAiModelInput, AdminAiModelPatch } from '@pu/schemas'
import { adminApi, cn, formatNumber } from '@/lib/api'
import { Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, ErrorState, Field, Input, LoadingRows, Menu, MenuItem, MenuSeparator } from '@/components/ui'

const KEY = ['admin', 'ai', 'models']

function useModelActions(onDone?: () => void) {
  const qc = useQueryClient()
  const done = (msg: string) => () => {
    toast.success(msg)
    onDone?.()
    void qc.invalidateQueries({ queryKey: ['admin', 'ai'] })
  }
  const onError = (err: Error) => toast.error(err.message)
  return {
    create: useMutation({ mutationFn: (b: AdminAiModelInput) => adminApi.post('/admin/ai/models', b), onSuccess: done('Đã thêm model'), onError }),
    update: useMutation({
      mutationFn: ({ id, ...b }: AdminAiModelPatch & { id: string }) => adminApi.patch(`/admin/ai/models/${encodeURIComponent(id)}`, b),
      onSuccess: done('Đã cập nhật model'),
      onError
    }),
    remove: useMutation({ mutationFn: (id: string) => adminApi.delete(`/admin/ai/models/${encodeURIComponent(id)}`), onSuccess: done('Đã xóa model'), onError })
  }
}

// N7AI › Model: danh mục model người dùng được chọn. Chỉ tên model + mô tả + quota; API key / gateway nằm ở env của server
export function ModelsSection({ canManage }: { canManage: boolean }) {
  const { data, isPending, isError, error } = useQuery({ queryKey: KEY, queryFn: () => adminApi.get<AdminAiModel[]>('/admin/ai/models'), staleTime: 30_000 })
  const actions = useModelActions(() => setEdit(null))
  const [edit, setEdit] = useState<{ model?: AdminAiModel } | null>(null)
  const [delTarget, setDelTarget] = useState<AdminAiModel | null>(null)

  if (isPending) return <LoadingRows rows={4} />
  if (isError) return <ErrorState message={(error as Error).message} />

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          Tên model phải khớp tên trên gateway (<span className="font-mono">AI_BASE_URL</span>). Model tắt thì người đang chọn tự về model mặc định.
        </p>
        {canManage && (
          <Button variant="primary" className="ml-auto" onClick={() => setEdit({})}>
            <Plus /> Thêm model
          </Button>
        )}
      </div>

      {data.length === 0 ? (
        <EmptyState title="Chưa có model" />
      ) : (
        <Card className="divide-y divide-border">
          {data.map((m) => (
            <div key={m.id} className={cn('flex items-center gap-3 px-4 py-3', !m.enabled && 'opacity-55')}>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground">
                  {m.label}
                  <span className="font-mono text-xs font-normal text-muted-foreground">{m.id}</span>
                  {m.isDefault && <Badge tone="primary">Mặc định</Badge>}
                  {!m.enabled && <Badge tone="danger">Tắt</Badge>}
                  {m.enabled && !m.visible && <Badge>Ẩn khỏi menu</Badge>}
                </p>
                {m.hint && <p className="truncate text-xs text-muted-foreground">{m.hint}</p>}
              </div>
              <div className="hidden shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:block">
                <p>{m.cost} lượt / câu</p>
                <p>
                  {formatNumber(m.users)} người chọn · {formatNumber(m.runs7d)} lượt 7 ngày
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
                    <MenuItem icon={Star} onSelect={() => actions.update.mutate({ id: m.id, isDefault: true })}>
                      Đặt làm mặc định
                    </MenuItem>
                  )}
                  <MenuItem icon={m.visible ? EyeOff : Eye} onSelect={() => actions.update.mutate({ id: m.id, visible: !m.visible })}>
                    {m.visible ? 'Ẩn khỏi menu' : 'Hiện trong menu'}
                  </MenuItem>
                  {!m.isDefault && (
                    <MenuItem icon={Power} onSelect={() => actions.update.mutate({ id: m.id, enabled: !m.enabled })}>
                      {m.enabled ? 'Tắt' : 'Bật lại'}
                    </MenuItem>
                  )}
                  {!m.isDefault && (
                    <>
                      <MenuSeparator />
                      <MenuItem icon={Trash2} danger onSelect={() => setDelTarget(m)}>
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

      <ModelDialog state={edit} onClose={() => setEdit(null)} actions={actions} />
      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        title={`Xóa model "${delTarget?.label}"?`}
        description={`${delTarget?.users ?? 0} người đang chọn model này sẽ chuyển về model mặc định. Lịch sử lượt chạy giữ nguyên.`}
        confirmLabel="Xóa"
        loading={actions.remove.isPending}
        onConfirm={() => delTarget && actions.remove.mutate(delTarget.id, { onSuccess: () => setDelTarget(null) })}
      />
    </>
  )
}

function ModelDialog({ state, onClose, actions }: { state: { model?: AdminAiModel } | null; onClose: () => void; actions: ReturnType<typeof useModelActions> }) {
  const editing = state?.model
  const [form, setForm] = useState({ id: '', label: '', hint: '', cost: 1, visible: true })
  // Nạp lại form mỗi khi mở hộp thoại
  const key = state ? (editing?.id ?? 'new') : ''
  const [loaded, setLoaded] = useState('')
  if (state && loaded !== key) {
    setLoaded(key)
    setForm({ id: editing?.id ?? '', label: editing?.label ?? '', hint: editing?.hint ?? '', cost: editing?.cost ?? 1, visible: editing?.visible ?? true })
  }
  if (!state && loaded) setLoaded('')
  const busy = actions.create.isPending || actions.update.isPending

  return (
    <Dialog
      open={!!state}
      onClose={onClose}
      title={editing ? 'Sửa model' : 'Thêm model'}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" type="submit" form="ai-model-form" loading={busy}>
            Lưu
          </Button>
        </>
      }
    >
      <form
        id="ai-model-form"
        onSubmit={(e) => {
          e.preventDefault()
          const { id, ...rest } = form
          if (editing) actions.update.mutate({ id: editing.id, ...rest })
          else actions.create.mutate({ id, ...rest })
        }}
        className="space-y-4"
      >
        <Field label="Tên model trên gateway" hint={editing ? 'Không đổi được' : 'vd. n7ai-fast'}>
          <Input required disabled={!!editing} autoFocus={!editing} value={form.id} maxLength={40} className="font-mono" onChange={(e) => setForm({ ...form, id: e.target.value })} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label="Tên hiển thị">
              <Input required autoFocus={!!editing} value={form.label} maxLength={40} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </Field>
          </div>
          <Field label="Lượt / câu" hint="1–10">
            <Input type="number" required min={1} max={10} value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Mô tả ngắn" hint="Hiện trong menu chọn">
          <Input value={form.hint} maxLength={160} onChange={(e) => setForm({ ...form, hint: e.target.value })} />
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={form.visible} onChange={(e) => setForm({ ...form, visible: e.target.checked })} /> Hiện trong menu chọn của người dùng
        </label>
      </form>
    </Dialog>
  )
}

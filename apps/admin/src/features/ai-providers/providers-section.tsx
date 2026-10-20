import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Download, MoreHorizontal, Pencil, Plug, Plus, Power, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { AdminAiProvider, AdminAiProviderInput, AdminAiProviderList, AdminAiProviderPatch, AdminAiProviderTest } from '@pu/schemas'
import { adminApi, cn } from '@/lib/api'
import { Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, ErrorState, Field, Input, LoadingRows, Menu, MenuItem, MenuSeparator } from '@/components/ui'

const KEY = ['admin', 'ai', 'providers']
const base = '/admin/ai/providers'

function useProviderActions(onDone?: () => void) {
  const qc = useQueryClient()
  const done = (msg: string) => () => {
    toast.success(msg)
    onDone?.()
    void qc.invalidateQueries({ queryKey: KEY })
  }
  const onError = (err: Error) => toast.error(err.message)
  return {
    create: useMutation({ mutationFn: (b: AdminAiProviderInput) => adminApi.post(base, b), onSuccess: done('Đã thêm provider'), onError }),
    update: useMutation({ mutationFn: ({ id, ...b }: AdminAiProviderPatch & { id: string }) => adminApi.patch(`${base}/${id}`, b), onSuccess: done('Đã cập nhật provider'), onError }),
    remove: useMutation({ mutationFn: (id: string) => adminApi.delete(`${base}/${id}`), onSuccess: done('Đã xóa provider'), onError }),
    move: useMutation({ mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) => adminApi.post(`${base}/${id}/move`, { direction }), onSuccess: done('Đã đổi thứ tự'), onError }),
    importEnv: useMutation({ mutationFn: () => adminApi.post(`${base}/import-env`, {}), onSuccess: done('Đã nhập cấu hình từ máy chủ'), onError }),
    test: useMutation({
      mutationFn: (p: AdminAiProvider) => adminApi.post<AdminAiProviderTest>(`${base}/${p.id}/test`, {}),
      onSuccess: (r, p) => (r.ok ? toast.success(`${p.name}: kết nối được · ${r.latencyMs}ms${r.models != null ? ` · ${r.models} model` : ''}`) : toast.error(`${p.name}: ${r.error ?? 'Lỗi không rõ'}`)),
      onError
    })
  }
}

// N7AI › Provider: gateway OpenAI-compatible (URL + API key). Provider đầu là chính, các provider sau là dự phòng khi gateway lỗi
// API key mã hóa trong DB và không bao giờ hiển thị lại (chỉ 4 ký tự cuối)
export function ProvidersSection({ canManage }: { canManage: boolean }) {
  const { data, isPending, isError, error } = useQuery({ queryKey: KEY, queryFn: () => adminApi.get<AdminAiProviderList>(base), staleTime: 30_000 })
  const actions = useProviderActions(() => setEdit(null))
  const [edit, setEdit] = useState<{ provider?: AdminAiProvider } | null>(null)
  const [delTarget, setDelTarget] = useState<AdminAiProvider | null>(null)

  if (isPending) return <LoadingRows rows={3} />
  if (isError) return <ErrorState message={(error as Error).message} />

  const primaryId = data.items.find((p) => p.enabled)?.id
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">Provider đầu tiên đang bật là chính; khi gateway lỗi (mất kết nối, 5xx, hết lượt) hệ thống tự thử provider kế tiếp. Đổi có hiệu lực trong vài giây.</p>
        {canManage && (
          <Button variant="primary" className="ml-auto" onClick={() => setEdit({})}>
            <Plus /> Thêm provider
          </Button>
        )}
      </div>

      {data.source === 'env' && (
        <Card className="mb-3 space-y-2 border-warning/40 p-4">
          <p className="text-sm font-semibold text-foreground">Đang dùng cấu hình từ máy chủ (.env)</p>
          {data.env.length ? (
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {data.env.map((e) => (
                <li key={e.name}>
                  {e.name}: <span className="font-mono">{e.host}</span>
                  {e.modelOverride && <span> · model {e.modelOverride}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Máy chủ chưa có AI_API_KEY nên N7AI đang tắt.</p>
          )}
          <p className="text-xs text-muted-foreground">Thêm provider vào danh sách sẽ thay thế cấu hình này. Muốn giữ nguyên, hãy nhập nó trước.</p>
          {canManage && data.env.length > 0 && (
            <Button size="sm" loading={actions.importEnv.isPending} onClick={() => actions.importEnv.mutate()}>
              <Download /> Nhập cấu hình từ máy chủ
            </Button>
          )}
        </Card>
      )}

      {data.items.length === 0 ? (
        <EmptyState title="Chưa có provider trong danh sách" />
      ) : (
        <Card className="divide-y divide-border">
          {data.items.map((p, i) => (
            <div key={p.id} className={cn('flex items-center gap-3 px-4 py-3', !p.enabled && 'opacity-55')}>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground">
                  {p.name}
                  {p.id === primaryId ? <Badge tone="primary">Chính</Badge> : p.enabled && <Badge>Dự phòng</Badge>}
                  {!p.enabled && <Badge tone="danger">Tắt</Badge>}
                </p>
                <p className="truncate font-mono text-xs text-muted-foreground">{p.baseUrl}</p>
              </div>
              <div className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
                <p className="font-mono">key …{p.keyHint}</p>
                <p>{p.modelOverride ? `model ${p.modelOverride}` : 'giữ tên model gốc'}</p>
              </div>
              {canManage && (
                <Menu
                  trigger={(t) => (
                    <Button size="sm" variant="ghost" aria-label="Thao tác" {...t}>
                      <MoreHorizontal />
                    </Button>
                  )}
                >
                  <MenuItem icon={Plug} onSelect={() => actions.test.mutate(p)}>
                    Thử kết nối
                  </MenuItem>
                  <MenuItem icon={Pencil} onSelect={() => setEdit({ provider: p })}>
                    Sửa
                  </MenuItem>
                  {i > 0 && (
                    <MenuItem icon={ArrowUp} onSelect={() => actions.move.mutate({ id: p.id, direction: 'up' })}>
                      Đưa lên
                    </MenuItem>
                  )}
                  {i < data.items.length - 1 && (
                    <MenuItem icon={ArrowDown} onSelect={() => actions.move.mutate({ id: p.id, direction: 'down' })}>
                      Đưa xuống
                    </MenuItem>
                  )}
                  <MenuItem icon={Power} onSelect={() => actions.update.mutate({ id: p.id, enabled: !p.enabled })}>
                    {p.enabled ? 'Tắt' : 'Bật lại'}
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem icon={Trash2} danger onSelect={() => setDelTarget(p)}>
                    Xóa
                  </MenuItem>
                </Menu>
              )}
            </div>
          ))}
        </Card>
      )}

      <ProviderDialog state={edit} onClose={() => setEdit(null)} actions={actions} />
      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        title={`Xóa provider "${delTarget?.name}"?`}
        description="Key đã lưu bị xóa vĩnh viễn. Nếu đây là provider cuối cùng, hệ thống quay về cấu hình .env của máy chủ."
        confirmLabel="Xóa"
        loading={actions.remove.isPending}
        onConfirm={() => delTarget && actions.remove.mutate(delTarget.id, { onSuccess: () => setDelTarget(null) })}
      />
    </>
  )
}

function ProviderDialog({ state, onClose, actions }: { state: { provider?: AdminAiProvider } | null; onClose: () => void; actions: ReturnType<typeof useProviderActions> }) {
  const editing = state?.provider
  const [form, setForm] = useState({ name: '', baseUrl: '', apiKey: '', modelOverride: '' })
  // Nạp lại form mỗi khi mở hộp thoại (key không bao giờ được nạp lại)
  const key = state ? (editing?.id ?? 'new') : ''
  const [loaded, setLoaded] = useState('')
  if (state && loaded !== key) {
    setLoaded(key)
    setForm({ name: editing?.name ?? '', baseUrl: editing?.baseUrl ?? '', apiKey: '', modelOverride: editing?.modelOverride ?? '' })
  }
  if (!state && loaded) setLoaded('')
  const busy = actions.create.isPending || actions.update.isPending

  return (
    <Dialog
      open={!!state}
      onClose={onClose}
      title={editing ? 'Sửa provider' : 'Thêm provider'}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" type="submit" form="ai-provider-form" loading={busy}>
            Lưu
          </Button>
        </>
      }
    >
      <form
        id="ai-provider-form"
        onSubmit={(e) => {
          e.preventDefault()
          const modelOverride = form.modelOverride.trim() || null
          if (editing) actions.update.mutate({ id: editing.id, name: form.name, baseUrl: form.baseUrl, modelOverride, ...(form.apiKey ? { apiKey: form.apiKey } : {}) })
          else actions.create.mutate({ name: form.name, baseUrl: form.baseUrl, apiKey: form.apiKey, modelOverride })
        }}
        className="space-y-4"
      >
        <Field label="Tên gợi nhớ">
          <Input required autoFocus value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Base URL (OpenAI-compatible)" hint="vd. https://gateway.example.com/v1">
          <Input required type="url" value={form.baseUrl} maxLength={300} className="font-mono" onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} />
        </Field>
        <Field label="API key" hint={editing ? `Đang lưu key …${editing.keyHint}; để trống nếu không đổi` : 'Được mã hóa, không hiển thị lại'}>
          <Input required={!editing} type="password" autoComplete="off" value={form.apiKey} maxLength={400} className="font-mono" onChange={(e) => setForm({ ...form, apiKey: e.target.value })} />
        </Field>
        <Field label="Model riêng (tùy chọn)" hint="Để trống = dùng đúng tên model N7AI đang chọn. Điền khi provider này dùng tên model khác (thường là provider dự phòng)">
          <Input value={form.modelOverride} maxLength={60} className="font-mono" onChange={(e) => setForm({ ...form, modelOverride: e.target.value })} />
        </Field>
      </form>
    </Dialog>
  )
}

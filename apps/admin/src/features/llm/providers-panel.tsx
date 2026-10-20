import React, { useState } from 'react'
import { ArrowDown, ArrowUp, Download, ListChecks, MoreHorizontal, Pencil, Plug, Plus, Power, Trash2 } from 'lucide-react'
import type { AdminAiProvider, AdminAiProviderList } from '@pu/schemas'
import { cn } from '@/lib/api'
import { Badge, Button, Card, ConfirmDialog, Dialog, Field, Input, Menu, MenuItem, MenuSeparator } from '@/components/ui'
import type { LlmActions } from './use-llm'

// Provider = gateway OpenAI-compatible (URL + key). Key mã hóa trong DB, không hiển thị lại
export function ProvidersPanel({
  data,
  canManage,
  actions,
  onDiscover
}: {
  data: AdminAiProviderList
  canManage: boolean
  actions: LlmActions
  onDiscover: (p: AdminAiProvider) => void
}) {
  const [edit, setEdit] = useState<{ provider?: AdminAiProvider } | null>(null)
  const [del, setDel] = useState<AdminAiProvider | null>(null)
  const primaryId = data.items.find((p) => p.enabled)?.id

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">Provider</h2>
        <span className="text-xs text-muted-foreground">Lỗi gateway ⇒ tự chuyển provider kế tiếp</span>
        {canManage && (
          <Button size="sm" className="ml-auto" onClick={() => setEdit({})}>
            <Plus /> Thêm
          </Button>
        )}
      </div>

      {data.source === 'env' && (
        <Card className="mb-2 flex flex-wrap items-center gap-3 border-warning/40 px-4 py-3 text-xs text-muted-foreground">
          <p className="min-w-0 flex-1">
            Đang dùng <b className="text-foreground">.env</b> của máy chủ:{' '}
            {data.env.length
              ? data.env.map((e) => (
                  <span key={e.name} className="font-mono">
                    {e.host}{' '}
                  </span>
                ))
              : 'chưa có AI_API_KEY, N7AI đang tắt'}
          </p>
          {canManage && data.env.length > 0 && (
            <Button size="sm" loading={actions.importEnv.isPending} onClick={() => actions.importEnv.mutate()}>
              <Download /> Nhập vào đây
            </Button>
          )}
        </Card>
      )}

      {data.items.length > 0 && (
        <Card className="divide-y divide-border">
          {data.items.map((p, i) => (
            <div key={p.id} className={cn('flex items-center gap-3 px-4 py-2.5', !p.enabled && 'opacity-55')}>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-foreground">
                  {p.name}
                  {p.id === primaryId ? <Badge tone="primary">Chính</Badge> : p.enabled && <Badge>Dự phòng</Badge>}
                  {!p.enabled && <Badge tone="danger">Tắt</Badge>}
                </p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {p.baseUrl} · key …{p.keyHint}
                </p>
              </div>
              {canManage && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => onDiscover(p)}>
                    <ListChecks /> Model
                  </Button>
                  <Menu
                    trigger={(t) => (
                      <Button size="sm" variant="ghost" aria-label="Thao tác" {...t}>
                        <MoreHorizontal />
                      </Button>
                    )}
                  >
                    <MenuItem icon={Plug} onSelect={() => actions.testProvider.mutate(p)}>
                      Thử kết nối
                    </MenuItem>
                    <MenuItem icon={Pencil} onSelect={() => setEdit({ provider: p })}>
                      Sửa
                    </MenuItem>
                    {i > 0 && (
                      <MenuItem icon={ArrowUp} onSelect={() => actions.moveProvider.mutate({ id: p.id, direction: 'up' })}>
                        Đưa lên
                      </MenuItem>
                    )}
                    {i < data.items.length - 1 && (
                      <MenuItem icon={ArrowDown} onSelect={() => actions.moveProvider.mutate({ id: p.id, direction: 'down' })}>
                        Đưa xuống
                      </MenuItem>
                    )}
                    <MenuItem icon={Power} onSelect={() => actions.updateProvider.mutate({ id: p.id, enabled: !p.enabled })}>
                      {p.enabled ? 'Tắt' : 'Bật lại'}
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem icon={Trash2} danger onSelect={() => setDel(p)}>
                      Xóa
                    </MenuItem>
                  </Menu>
                </>
              )}
            </div>
          ))}
        </Card>
      )}

      <ProviderDialog state={edit} onClose={() => setEdit(null)} actions={actions} onCreated={(p) => onDiscover(p)} />
      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        title={`Xóa provider "${del?.name}"?`}
        description="Key bị xóa vĩnh viễn. Model gắn với provider này chuyển về chuỗi provider mặc định."
        confirmLabel="Xóa"
        loading={actions.removeProvider.isPending}
        onConfirm={() => del && actions.removeProvider.mutate(del.id, { onSuccess: () => setDel(null) })}
      />
    </section>
  )
}

function ProviderDialog({
  state,
  onClose,
  actions,
  onCreated
}: {
  state: { provider?: AdminAiProvider } | null
  onClose: () => void
  actions: LlmActions
  onCreated: (p: AdminAiProvider) => void
}) {
  const editing = state?.provider
  const [form, setForm] = useState({ name: '', baseUrl: '', apiKey: '', modelOverride: '' })
  // Nạp lại form mỗi khi mở (key không bao giờ được nạp lại)
  const key = state ? (editing?.id ?? 'new') : ''
  const [loaded, setLoaded] = useState('')
  if (state && loaded !== key) {
    setLoaded(key)
    setForm({ name: editing?.name ?? '', baseUrl: editing?.baseUrl ?? '', apiKey: '', modelOverride: editing?.modelOverride ?? '' })
  }
  if (!state && loaded) setLoaded('')
  const busy = actions.createProvider.isPending || actions.updateProvider.isPending

  return (
    <Dialog
      open={!!state}
      onClose={onClose}
      title={editing ? 'Sửa provider' : 'Thêm provider'}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" type="submit" form="llm-provider-form" loading={busy}>
            {editing ? 'Lưu' : 'Lưu & lấy model'}
          </Button>
        </>
      }
    >
      <form
        id="llm-provider-form"
        onSubmit={(e) => {
          e.preventDefault()
          const modelOverride = form.modelOverride.trim() || null
          if (editing) {
            actions.updateProvider.mutate(
              { id: editing.id, name: form.name, baseUrl: form.baseUrl, modelOverride, ...(form.apiKey ? { apiKey: form.apiKey } : {}) },
              { onSuccess: onClose }
            )
          } else {
            const input = { name: form.name, baseUrl: form.baseUrl, apiKey: form.apiKey, modelOverride }
            actions.createProvider.mutate(input, {
              onSuccess: (r) => {
                onClose()
                onCreated({ id: r.id, name: input.name, baseUrl: input.baseUrl, keyHint: input.apiKey.slice(-4), modelOverride, enabled: true, priority: 0 })
              }
            })
          }
        }}
        className="space-y-4"
      >
        <Field label="Tên">
          <Input required autoFocus value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Base URL" hint="OpenAI-compatible, vd. https://host/v1">
          <Input
            required
            type="url"
            value={form.baseUrl}
            maxLength={300}
            className="font-mono"
            onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
          />
        </Field>
        <Field label="API key" hint={editing ? `Đang lưu …${editing.keyHint}; trống = giữ nguyên` : undefined}>
          <Input
            required={!editing}
            type="password"
            autoComplete="off"
            value={form.apiKey}
            maxLength={400}
            className="font-mono"
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
          />
        </Field>
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Nâng cao</summary>
          <div className="mt-3">
            <Field label="Model dự phòng" hint="Dùng khi provider này đứng sau, tên model khác">
              <Input value={form.modelOverride} maxLength={60} className="font-mono" onChange={(e) => setForm({ ...form, modelOverride: e.target.value })} />
            </Field>
          </div>
        </details>
      </form>
    </Dialog>
  )
}

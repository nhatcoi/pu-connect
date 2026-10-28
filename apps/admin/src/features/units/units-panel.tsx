import React, { useState } from 'react'
import { GitMerge, MoreHorizontal, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import type { AdminUnit, AdminUnitRequest, UnitKind } from '@pu/schemas'
import { cn, formatNumber } from '@/lib/api'
import { Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, ErrorState, Field, Input, LoadingRows, Menu, MenuItem, MenuSeparator, Select } from '@/components/ui'
import { KIND_LABEL, useAdminUnits, useUnitActions } from './use-units'

type Actions = ReturnType<typeof useUnitActions>

// Học thuật › Đơn vị: danh mục trường / lĩnh vực quan tâm (hàng chờ duyệt nằm ở trang Đề xuất)
export function UnitsSection({ canManage }: { canManage: boolean }) {
  const { data, isPending, isError, error } = useAdminUnits()
  const actions = useUnitActions(() => setEdit(null))
  const [edit, setEdit] = useState<{ kind: UnitKind; unit?: AdminUnit } | null>(null)
  const [mergeFrom, setMergeFrom] = useState<{ kind: UnitKind; unit: AdminUnit } | null>(null)
  const [delTarget, setDelTarget] = useState<{ kind: UnitKind; unit: AdminUnit } | null>(null)

  if (isPending) return <LoadingRows rows={8} />
  if (isError) return <ErrorState message={(error as Error).message} />

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        {(['university', 'field'] as const).map((kind) => (
          <CatalogCard
            key={kind}
            kind={kind}
            units={kind === 'university' ? data.universities : data.fields}
            canManage={canManage}
            actions={actions}
            onAdd={() => setEdit({ kind })}
            onEdit={(unit) => setEdit({ kind, unit })}
            onMerge={(unit) => setMergeFrom({ kind, unit })}
            onDelete={(unit) => setDelTarget({ kind, unit })}
          />
        ))}
      </div>

      <UnitDialog state={edit} onClose={() => setEdit(null)} actions={actions} />
      <MergeDialog from={mergeFrom} units={data} onClose={() => setMergeFrom(null)} actions={actions} />
      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        title={`Xóa "${delTarget?.unit.name}"?`}
        description="Chỉ xóa được mục không còn người dùng / môn học. Nếu còn, hãy gộp sang mục khác hoặc tắt hiển thị."
        confirmLabel="Xóa"
        loading={actions.remove.isPending}
        onConfirm={() => delTarget && actions.remove.mutate({ kind: delTarget.kind, id: delTarget.unit.id }, { onSuccess: () => setDelTarget(null) })}
      />
    </div>
  )
}

function CatalogCard({
  kind,
  units,
  canManage,
  actions,
  onAdd,
  onEdit,
  onMerge,
  onDelete
}: {
  kind: UnitKind
  units: AdminUnit[]
  canManage: boolean
  actions: Actions
  onAdd: () => void
  onEdit: (u: AdminUnit) => void
  onMerge: (u: AdminUnit) => void
  onDelete: (u: AdminUnit) => void
}) {
  const users = units.reduce((s, u) => s + u.userCount, 0)
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">{KIND_LABEL[kind]}</h3>
        <span className="text-xs text-muted-foreground">
          {units.length} mục · {formatNumber(users)} người dùng
        </span>
        {canManage && (
          <Button size="sm" variant="primary" className="ml-auto" onClick={onAdd}>
            <Plus /> Thêm
          </Button>
        )}
      </div>
      {units.length === 0 ? (
        <EmptyState title="Chưa có mục nào" />
      ) : (
        <Card className="divide-y divide-border">
          {units.map((u) => (
            <div key={u.id} className={cn('flex items-center gap-2 px-3 py-2', !u.isActive && 'opacity-55')}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{u.name}</span>
                {!u.isActive && <span className="text-xs text-muted-foreground">Đã tắt — không còn trong danh sách chọn</span>}
              </span>
              <span className="hidden text-right text-xs tabular-nums text-muted-foreground sm:block">
                {u.userCount} người{kind === 'field' ? ` · ${u.courseCount} môn` : ''}
              </span>
              {canManage && (
                <Menu
                  trigger={(p) => (
                    <Button size="sm" variant="ghost" aria-label="Thao tác" {...p}>
                      <MoreHorizontal />
                    </Button>
                  )}
                >
                  <MenuItem icon={Pencil} onSelect={() => onEdit(u)}>
                    Đổi tên
                  </MenuItem>
                  <MenuItem icon={Power} onSelect={() => actions.update.mutate({ kind, id: u.id, isActive: !u.isActive })}>
                    {u.isActive ? 'Tắt' : 'Bật lại'}
                  </MenuItem>
                  <MenuItem icon={GitMerge} onSelect={() => onMerge(u)}>
                    Gộp vào mục khác…
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem icon={Trash2} danger onSelect={() => onDelete(u)}>
                    Xóa
                  </MenuItem>
                </Menu>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

export function UnitRequestApproveDialog({
  request,
  data,
  onClose,
  actions
}: {
  request: AdminUnitRequest | null
  data: { universities: AdminUnit[]; fields: AdminUnit[] }
  onClose: () => void
  actions: Actions
}) {
  const [mode, setMode] = useState<'new' | 'merge'>('new')
  const [name, setName] = useState('')
  const [existingId, setExistingId] = useState('')
  const [loaded, setLoaded] = useState<string | null>(null)
  // Nạp lại form mỗi khi mở hộp thoại cho một yêu cầu
  if (request && loaded !== request.id) {
    setLoaded(request.id)
    setName(request.name)
    setExistingId(request.suggestion?.id ?? '')
    setMode(request.suggestion ? 'merge' : 'new')
  }
  if (!request && loaded) setLoaded(null)

  const options = request ? (request.kind === 'university' ? data.universities : data.fields).filter((u) => u.isActive) : []
  const submit = () =>
    request &&
    actions.approve.mutate(mode === 'merge' ? { id: request.id, existingId } : { id: request.id, name: name.trim() }, { onSuccess: onClose })

  return (
    <Dialog
      open={!!request}
      onClose={onClose}
      title={`Duyệt "${request?.name}"`}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" disabled={mode === 'merge' ? !existingId : name.trim().length < 2} loading={actions.approve.isPending} onClick={submit}>
            Duyệt
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">
        Người dùng gửi{request && request.sameNameCount > 1 ? ` (cùng ${request.sameNameCount} người)` : ''} sẽ được cập nhật sang mục bạn chọn và nhận thông báo.
      </p>
      <div className="mb-3 flex gap-4 text-sm">
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="radio" checked={mode === 'new'} onChange={() => setMode('new')} /> Thêm mục mới
        </label>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="radio" checked={mode === 'merge'} onChange={() => setMode('merge')} /> Gộp vào mục có sẵn
        </label>
      </div>
      {mode === 'new' ? (
        <Field label="Tên hiển thị (sửa lỗi chính tả nếu cần)">
          <Input autoFocus value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
        </Field>
      ) : (
        <Field label="Gộp vào">
          <Select value={existingId} onChange={(e) => setExistingId(e.target.value)}>
            <option value="">Chọn mục…</option>
            {options.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
    </Dialog>
  )
}

export function UnitRequestRejectDialog({ request, onClose, actions }: { request: AdminUnitRequest | null; onClose: () => void; actions: Actions }) {
  const [reason, setReason] = useState('')
  return (
    <Dialog
      open={!!request}
      onClose={() => {
        setReason('')
        onClose()
      }}
      title={`Từ chối "${request?.name}"`}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button
            variant="primary"
            loading={actions.reject.isPending}
            onClick={() => request && actions.reject.mutate({ id: request.id, reason: reason.trim() || undefined }, { onSuccess: () => { setReason(''); onClose() } })}
          >
            Từ chối
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">Người dùng nhận thông báo kèm lý do; hồ sơ của họ vẫn hiển thị là "Khác" cho tới khi họ chọn lại.</p>
      <Field label="Lý do (tùy chọn)">
        <Input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Vd. Trùng với mục có sẵn, tên không rõ nghĩa" />
      </Field>
    </Dialog>
  )
}

function UnitDialog({ state, onClose, actions }: { state: { kind: UnitKind; unit?: AdminUnit } | null; onClose: () => void; actions: Actions }) {
  const editing = state?.unit
  const [name, setName] = useState('')
  const [loaded, setLoaded] = useState<string | null>(null)
  const key = state ? `${state.kind}-${editing?.id ?? 'new'}` : null
  // Nạp lại form mỗi khi mở hộp thoại
  if (state && loaded !== key) {
    setLoaded(key)
    setName(editing?.name ?? '')
  }
  if (!state && loaded) setLoaded(null)

  return (
    <Dialog
      open={!!state}
      onClose={onClose}
      title={`${editing ? 'Đổi tên' : 'Thêm'} ${state ? KIND_LABEL[state.kind].toLowerCase() : ''}`}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" type="submit" form="unit-form" loading={actions.create.isPending || actions.update.isPending}>
            Lưu
          </Button>
        </>
      }
    >
      <form
        id="unit-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!state) return
          if (editing) actions.update.mutate({ kind: state.kind, id: editing.id, name })
          else actions.create.mutate({ kind: state.kind, name })
        }}
        className="space-y-4"
      >
        <Field label="Tên">
          <Input required autoFocus value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
        </Field>
        {editing && <p className="text-xs text-muted-foreground">Đổi tên sẽ hiển thị ngay trên hồ sơ của {editing.userCount} người dùng thuộc mục này.</p>}
      </form>
    </Dialog>
  )
}

function MergeDialog({
  from,
  units,
  onClose,
  actions
}: {
  from: { kind: UnitKind; unit: AdminUnit } | null
  units: { universities: AdminUnit[]; fields: AdminUnit[] }
  onClose: () => void
  actions: Actions
}) {
  const [target, setTarget] = useState('')
  const options = from ? (from.kind === 'university' ? units.universities : units.fields).filter((u) => u.id !== from.unit.id) : []
  const close = () => {
    setTarget('')
    onClose()
  }
  return (
    <Dialog
      open={!!from}
      onClose={close}
      title={`Gộp "${from?.unit.name}"`}
      footer={
        <>
          <Button onClick={close}>Hủy</Button>
          <Button variant="primary" disabled={!target} loading={actions.merge.isPending} onClick={() => from && actions.merge.mutate({ kind: from.kind, id: from.unit.id, targetId: target }, { onSuccess: close })}>
            Gộp
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">
        Chuyển toàn bộ người dùng ({from?.unit.userCount ?? 0}){from?.kind === 'field' ? ` và ${from.unit.courseCount} môn học` : ''} sang mục đích, rồi xóa mục này. Không hoàn tác được.
      </p>
      <Field label="Gộp vào">
        <Select value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">Chọn mục đích…</option>
          {options.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      </Field>
    </Dialog>
  )
}

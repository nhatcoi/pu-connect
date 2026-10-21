import React, { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, GitMerge, MoreHorizontal, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import type { AdminAcademicUnit, AcademicUnitKind } from '@pu/schemas'
import { formatNumber } from '@/lib/api'
import { cn } from '@/lib/api'
import { Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, ErrorState, Field, Input, LoadingRows, Menu, MenuItem, MenuSeparator, Select } from '@/components/ui'
import { flattenUnits, PARENT_TYPES, UNIT_TYPE_LABEL, useAdminUnits, useUnitActions } from './use-units'

const TONE: Record<string, 'primary' | 'orange' | 'success' | 'warning' | 'neutral'> = {
  school: 'primary',
  faculty: 'orange',
  major: 'success',
  institute: 'warning',
  center: 'neutral'
}

// Học thuật › Đơn vị: cây trường → khoa → ngành (+ viện, trung tâm); người dùng chọn từ cây này
export function UnitsSection({ canManage }: { canManage: boolean }) {
  const { data, isPending, isError, error } = useAdminUnits()
  const actions = useUnitActions(() => setEdit(null))
  const nodes = useMemo(() => flattenUnits(data ?? []), [data])
  const [edit, setEdit] = useState<{ unit?: AdminAcademicUnit; parentId?: string | null; type?: AcademicUnitKind } | null>(null)
  const [mergeFrom, setMergeFrom] = useState<AdminAcademicUnit | null>(null)
  const [delTarget, setDelTarget] = useState<AdminAcademicUnit | null>(null)
  const [hideInactive, setHideInactive] = useState(false)

  if (isPending) return <LoadingRows rows={8} />
  if (isError) return <ErrorState message={(error as Error).message} />

  const visible = hideInactive ? nodes.filter((n) => n.unit.isActive) : nodes
  const total = (data ?? []).filter((u) => u.parentId === null).reduce((s, u) => s + u.userTotal, 0)

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {data.length} đơn vị · {formatNumber(total)} người dùng đã chọn đơn vị. Tên viết tắt (CNTT, KHMT…) hiển thị trên hồ sơ.
        </p>
        <label className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={hideInactive} onChange={(e) => setHideInactive(e.target.checked)} /> Ẩn đơn vị đã tắt
        </label>
        {canManage && (
          <Button variant="primary" onClick={() => setEdit({ type: 'school' })}>
            <Plus /> Thêm đơn vị
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState title="Chưa có đơn vị" />
      ) : (
        <Card className="divide-y divide-border">
          {visible.map(({ unit: u, depth }) => (
            <div key={u.id} className={cn('flex items-center gap-2 px-3 py-2', !u.isActive && 'opacity-55')} style={{ paddingLeft: 12 + depth * 22 }}>
              <Badge tone={TONE[u.type]}>{UNIT_TYPE_LABEL[u.type]}</Badge>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{u.name}</span>
                {!u.isActive && <span className="text-xs text-muted-foreground">Đã tắt — không còn trong danh sách chọn</span>}
              </span>
              {u.shortName && <Badge>{u.shortName}</Badge>}
              <span className="hidden w-24 text-right text-xs tabular-nums text-muted-foreground sm:block" title="Người dùng (gồm đơn vị con)">
                {u.userTotal} người
              </span>
              {canManage && (
                <Menu
                  trigger={(p) => (
                    <Button size="sm" variant="ghost" aria-label="Thao tác" {...p}>
                      <MoreHorizontal />
                    </Button>
                  )}
                >
                  <MenuItem icon={Pencil} onSelect={() => setEdit({ unit: u })}>
                    Sửa
                  </MenuItem>
                  {u.type !== 'major' && (
                    <MenuItem icon={Plus} onSelect={() => setEdit({ parentId: u.id, type: u.type === 'school' ? 'faculty' : 'major' })}>
                      Thêm đơn vị con
                    </MenuItem>
                  )}
                  <MenuItem icon={ArrowUp} onSelect={() => actions.reorder.mutate({ id: u.id, direction: 'up' })}>
                    Lên
                  </MenuItem>
                  <MenuItem icon={ArrowDown} onSelect={() => actions.reorder.mutate({ id: u.id, direction: 'down' })}>
                    Xuống
                  </MenuItem>
                  <MenuItem icon={Power} onSelect={() => actions.update.mutate({ id: u.id, isActive: !u.isActive })}>
                    {u.isActive ? 'Tắt' : 'Bật lại'}
                  </MenuItem>
                  <MenuItem icon={GitMerge} onSelect={() => setMergeFrom(u)}>
                    Gộp vào đơn vị khác…
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem icon={Trash2} danger onSelect={() => setDelTarget(u)}>
                    Xóa
                  </MenuItem>
                </Menu>
              )}
            </div>
          ))}
        </Card>
      )}

      <UnitDialog state={edit} units={data} onClose={() => setEdit(null)} actions={actions} />
      <MergeDialog from={mergeFrom} units={data} onClose={() => setMergeFrom(null)} actions={actions} />
      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        title={`Xóa "${delTarget?.name}"?`}
        description="Chỉ xóa được đơn vị không còn đơn vị con và không có người dùng. Nếu có người dùng, hãy gộp sang đơn vị khác."
        confirmLabel="Xóa"
        loading={actions.remove.isPending}
        onConfirm={() => delTarget && actions.remove.mutate(delTarget.id, { onSuccess: () => setDelTarget(null) })}
      />
    </>
  )
}

function UnitDialog({
  state,
  units,
  onClose,
  actions
}: {
  state: { unit?: AdminAcademicUnit; parentId?: string | null; type?: AcademicUnitKind } | null
  units: AdminAcademicUnit[]
  onClose: () => void
  actions: ReturnType<typeof useUnitActions>
}) {
  const editing = state?.unit
  const [form, setForm] = useState({ type: 'faculty' as AcademicUnitKind, name: '', shortName: '', parentId: '' })
  // Nạp lại form mỗi khi mở hộp thoại
  const key = state ? `${editing?.id ?? 'new'}-${state.parentId ?? ''}-${state.type ?? ''}` : ''
  const [loaded, setLoaded] = useState('')
  if (state && loaded !== key) {
    setLoaded(key)
    setForm({
      type: editing?.type ?? state.type ?? 'faculty',
      name: editing?.name ?? '',
      shortName: editing?.shortName ?? '',
      parentId: (editing ? editing.parentId : state.parentId) ?? ''
    })
  }
  if (!state && loaded) setLoaded('')

  const allowed = PARENT_TYPES[form.type]
  const parents = units.filter((u) => allowed.includes(u.type) && u.id !== editing?.id)
  const busy = actions.create.isPending || actions.update.isPending

  return (
    <Dialog
      open={!!state}
      onClose={onClose}
      title={editing ? 'Sửa đơn vị' : 'Thêm đơn vị'}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" type="submit" form="unit-form" loading={busy}>
            Lưu
          </Button>
        </>
      }
    >
      <form
        id="unit-form"
        onSubmit={(e) => {
          e.preventDefault()
          const body = { type: form.type, name: form.name, shortName: form.shortName || null, parentId: allowed.length ? form.parentId || null : null }
          if (editing) actions.update.mutate({ id: editing.id, ...body })
          else actions.create.mutate(body)
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Loại">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AcademicUnitKind, parentId: '' })}>
              {Object.entries(UNIT_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tên viết tắt">
            <Input value={form.shortName} maxLength={40} placeholder="CNTT, KHMT…" onChange={(e) => setForm({ ...form, shortName: e.target.value })} />
          </Field>
        </div>
        <Field label="Tên đầy đủ">
          <Input required autoFocus value={form.name} maxLength={200} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        {allowed.length > 0 && (
          <Field label="Đơn vị cha">
            <Select value={form.parentId} required={form.type === 'major'} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
              <option value="">{form.type === 'major' ? 'Chọn khoa…' : '— Độc lập (không có) —'}</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {UNIT_TYPE_LABEL[p.type]} · {p.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {editing && <p className="text-xs text-muted-foreground">Đổi tên / tên viết tắt sẽ tự cập nhật hồ sơ của {editing.userTotal} người dùng thuộc đơn vị này.</p>}
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
  from: AdminAcademicUnit | null
  units: AdminAcademicUnit[]
  onClose: () => void
  actions: ReturnType<typeof useUnitActions>
}) {
  const [target, setTarget] = useState('')
  const options = flattenUnits(units).filter((n) => from && n.unit.id !== from.id && n.unit.type === from.type)
  return (
    <Dialog
      open={!!from}
      onClose={() => {
        setTarget('')
        onClose()
      }}
      title={`Gộp "${from?.name}"`}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button
            variant="primary"
            disabled={!target}
            loading={actions.merge.isPending}
            onClick={() => from && actions.merge.mutate({ id: from.id, targetId: target }, { onSuccess: () => { setTarget(''); onClose() } })}
          >
            Gộp
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">
        Chuyển toàn bộ người dùng ({from?.userCount ?? 0}) và đơn vị con sang đơn vị đích, rồi xóa đơn vị này. Không hoàn tác được.
      </p>
      <Field label="Gộp vào">
        <Select value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">Chọn đơn vị đích…</option>
          {options.map(({ unit: u, depth }) => (
            <option key={u.id} value={u.id}>
              {'— '.repeat(depth)}
              {u.name}
            </option>
          ))}
        </Select>
      </Field>
    </Dialog>
  )
}

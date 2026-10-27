import React, { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, ShieldCheck, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { ADMIN_ONLY_PERMISSIONS, ADMIN_PERMISSIONS, ADMIN_PERMISSION_META, type AdminGroup, type AdminGroupMember, type AdminPermission } from '@pu/schemas'
import { adminApi, cn, formatNumber } from '@/lib/api'
import { useDebounced } from '@/hooks/use-debounced'
import { Avatar, Badge, Button, Card, Checkbox, ConfirmDialog, EmptyState, Field, Input, LoadingRows, PageHeader } from '@/components/ui'

const KEY = ['admin', 'groups']
const GROUPABLE = ADMIN_PERMISSIONS.filter((p) => !ADMIN_ONLY_PERMISSIONS.includes(p))

type Draft = { id: string | null; name: string; description: string; permissions: AdminPermission[] }
const NEW_DRAFT: Draft = { id: null, name: '', description: '', permissions: ['dashboard:view'] }

export function GroupsPage() {
  const qc = useQueryClient()
  const groups = useQuery({ queryKey: KEY, queryFn: () => adminApi.get<AdminGroup[]>('/admin/groups') })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const byGroup = useMemo(() => {
    const m = new Map<string, AdminPermission[]>()
    for (const p of GROUPABLE) m.set(ADMIN_PERMISSION_META[p].group, [...(m.get(ADMIN_PERMISSION_META[p].group) ?? []), p])
    return [...m]
  }, [])

  const refresh = () => void qc.invalidateQueries({ queryKey: KEY })
  const onError = (err: Error) => toast.error(err.message)
  const save = useMutation({
    mutationFn: (d: Draft) => {
      const body = { name: d.name, description: d.description || null, permissions: d.permissions }
      return d.id ? adminApi.put<{ id: string }>(`/admin/groups/${d.id}`, body) : adminApi.post<{ id: string }>('/admin/groups', body)
    },
    onSuccess: (res) => {
      toast.success('Đã lưu nhóm')
      setDraft((d) => (d ? { ...d, id: res.id } : d))
      refresh()
    },
    onError
  })
  const remove = useMutation({
    mutationFn: (id: string) => adminApi.delete(`/admin/groups/${id}`),
    onSuccess: () => {
      toast.success('Đã xóa nhóm')
      setDraft(null)
      setConfirmDelete(false)
      refresh()
    },
    onError
  })

  const toggle = (p: AdminPermission) => setDraft((d) => (d ? { ...d, permissions: d.permissions.includes(p) ? d.permissions.filter((x) => x !== p) : [...d.permissions, p] } : d))

  return (
    <>
      <PageHeader
        title="Nhóm quyền"
        description="Gộp quyền chi tiết thành nhóm rồi gán cho người dùng để họ vào cổng quản trị mà không cần vai trò admin. Quyền đổi vai trò, xem dữ liệu cá nhân hóa và quản lý nhóm chỉ vai trò admin có."
        actions={
          <Button variant="primary" onClick={() => setDraft(NEW_DRAFT)}>
            <Plus /> Tạo nhóm
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          {groups.isPending ? (
            <LoadingRows rows={3} />
          ) : (groups.data ?? []).length === 0 ? (
            <EmptyState icon={ShieldCheck} title="Chưa có nhóm quyền" />
          ) : (
            <ul className="space-y-2">
              {groups.data!.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => setDraft({ id: g.id, name: g.name, description: g.description ?? '', permissions: g.permissions })}
                    className={cn('w-full rounded-xl border bg-card p-3 text-left transition-colors hover:bg-accent/60', draft?.id === g.id ? 'border-primary' : 'border-border')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">{g.name}</span>
                      <Badge>{formatNumber(g.memberCount)} người</Badge>
                    </div>
                    {g.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{g.description}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">{g.permissions.length} quyền</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-3">
          {!draft ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">Chọn một nhóm để sửa hoặc tạo nhóm mới.</Card>
          ) : (
            <Card className="space-y-4 p-5">
              <Field label="Tên nhóm">
                <Input value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field label="Mô tả">
                <Input value={draft.description} maxLength={255} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </Field>
              <div className="space-y-3">
                {byGroup.map(([group, perms]) => (
                  <fieldset key={group} className="space-y-1.5">
                    <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</legend>
                    {perms.map((p) => (
                      <label key={p} className="flex items-start gap-2 text-sm">
                        <Checkbox className="mt-0.5" checked={draft.permissions.includes(p)} onChange={() => toggle(p)} label={ADMIN_PERMISSION_META[p].label} />
                        <span>{ADMIN_PERMISSION_META[p].label}</span>
                      </label>
                    ))}
                  </fieldset>
                ))}
              </div>
              <div className="flex items-center justify-between pt-1">
                {draft.id ? (
                  <Button variant="danger-soft" size="sm" onClick={() => setConfirmDelete(true)}>
                    <Trash2 /> Xóa nhóm
                  </Button>
                ) : (
                  <span />
                )}
                <Button variant="primary" loading={save.isPending} disabled={draft.name.trim().length < 2 || draft.permissions.length === 0} onClick={() => save.mutate(draft)}>
                  Lưu
                </Button>
              </div>
              {draft.id && <Members groupId={draft.id} onChange={refresh} />}
            </Card>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Xóa nhóm quyền?"
        description="Mọi thành viên mất quyền từ nhóm này ngay (quyền theo vai trò giữ nguyên)."
        confirmLabel="Xóa"
        loading={remove.isPending}
        onConfirm={() => draft?.id && remove.mutate(draft.id)}
      />
    </>
  )
}

function Members({ groupId, onChange }: { groupId: string; onChange: () => void }) {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 300)
  useEffect(() => setQ(''), [groupId])
  const key = ['admin', 'group-members', groupId]
  const members = useQuery({ queryKey: key, queryFn: () => adminApi.get<AdminGroupMember[]>(`/admin/groups/${groupId}/members`) })
  const candidates = useQuery({
    queryKey: ['admin', 'group-candidates', dq],
    queryFn: () => adminApi.get<AdminGroupMember[]>(`/admin/groups/member-candidates?q=${encodeURIComponent(dq)}`),
    enabled: dq.length > 0
  })
  const done = () => {
    void qc.invalidateQueries({ queryKey: key })
    onChange()
  }
  const add = useMutation({
    mutationFn: (userId: string) => adminApi.post(`/admin/groups/${groupId}/members`, { userIds: [userId] }),
    onSuccess: () => (setQ(''), done()),
    onError: (err: Error) => toast.error(err.message)
  })
  const drop = useMutation({
    mutationFn: (userId: string) => adminApi.delete(`/admin/groups/${groupId}/members/${userId}`),
    onSuccess: done,
    onError: (err: Error) => toast.error(err.message)
  })
  const inGroup = new Set((members.data ?? []).map((m) => m.id))

  return (
    <div className="space-y-2 border-t border-border pt-4">
      <span className="text-sm font-medium">Thành viên</span>
      <div className="flex flex-wrap gap-1.5">
        {(members.data ?? []).length === 0 && <span className="text-xs text-muted-foreground">Chưa có thành viên.</span>}
        {(members.data ?? []).map((m) => (
          <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full bg-muted py-0.5 pl-0.5 pr-2 text-xs">
            <Avatar src={m.avatarUrl} name={m.displayName} className="size-5 text-[10px]" />
            {m.displayName} <span className="text-muted-foreground">@{m.username}</span>
            <button type="button" aria-label="Bỏ khỏi nhóm" onClick={() => drop.mutate(m.id)}>
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Thêm người: tìm theo tên hoặc @username" />
      {dq && (candidates.data ?? []).filter((c) => !inGroup.has(c.id)).length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border">
          {candidates.data!.filter((c) => !inGroup.has(c.id)).map((c) => (
            <li key={c.id}>
              <button type="button" className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => add.mutate(c.id)}>
                <Avatar src={c.avatarUrl} name={c.displayName} className="size-6 text-[10px]" />
                {c.displayName} <span className="text-muted-foreground">@{c.username}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

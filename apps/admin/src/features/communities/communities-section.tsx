import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Compass, Crown, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { AdminCommunityRow } from '@pu/schemas'
import { adminApi, cn, formatNumber } from '@/lib/api'
import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  Input,
  LoadingRows,
  SortTh,
  Table,
  TBody,
  Td,
  Textarea,
  Th,
  THead,
  Toolbar,
  Tr
} from '@/components/ui'
import { ListFooter, ListSearch, ParamSelect, useListState, usePaged } from '@/components/list/list-kit'

const TYPE_LABELS: Record<string, string> = { campus: 'Toàn trường', faculty: 'Lĩnh vực', academic: 'Học thuật', life: 'Đời sống', club: 'CLB' }
const STATUS: Record<AdminCommunityRow['status'], { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  active: { label: 'Hoạt động', tone: 'success' },
  pending: { label: 'Chờ duyệt', tone: 'warning' },
  rejected: { label: 'Từ chối', tone: 'danger' }
}

type Create = { slug: string; name: string; description: string; communityType: string; ownerUsername: string }
const EMPTY: Create = { slug: '', name: '', description: '', communityType: 'academic', ownerUsername: '' }

// Cộng đồng: duyệt cộng đồng người dùng tạo, tạo thẳng, đổi chủ sở hữu, gỡ
export function CommunitiesSection({ canManage, createOpen, onCloseCreate }: { canManage: boolean; createOpen: boolean; onCloseCreate: () => void }) {
  const state = useListState({ sort: 'recent' })
  const list = usePaged<AdminCommunityRow>('communities', '/admin/communities', state.params, ['q', 'type', 'status'])
  const rows = list.data?.items ?? []
  const qc = useQueryClient()
  const [rejecting, setRejecting] = useState<AdminCommunityRow | null>(null)
  const [deleting, setDeleting] = useState<AdminCommunityRow | null>(null)
  const [owning, setOwning] = useState<AdminCommunityRow | null>(null)
  const [ownerName, setOwnerName] = useState('')

  const done = (msg: string, close: () => void) => () => {
    toast.success(msg)
    close()
    void qc.invalidateQueries({ queryKey: ['admin'] })
  }
  const onError = (err: Error) => toast.error(err.message)
  const approve = useMutation({
    mutationFn: (id: string) => adminApi.post(`/admin/communities/${id}/approve`),
    onSuccess: done('Đã duyệt cộng đồng', () => {}),
    onError
  })
  const reject = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => adminApi.post(`/admin/communities/${id}/reject`, { note: note || undefined }),
    onSuccess: done('Đã từ chối', () => setRejecting(null)),
    onError
  })
  const remove = useMutation({
    mutationFn: (id: string) => adminApi.delete(`/admin/communities/${id}`),
    onSuccess: done('Đã gỡ cộng đồng', () => setDeleting(null)),
    onError
  })
  const changeOwner = useMutation({
    mutationFn: ({ id, username }: { id: string; username: string }) => adminApi.put(`/admin/communities/${id}/owner`, { username }),
    onSuccess: done('Đã đổi chủ cộng đồng', () => setOwning(null)),
    onError
  })

  return (
    <>
      <Toolbar>
        <ListSearch state={state} placeholder="Tên hoặc slug" />
        <ParamSelect
          state={state}
          name="status"
          all="Mọi trạng thái"
          options={(list.data?.facets?.status ?? []).map((f) => ({
            value: f.value,
            label: STATUS[f.value as AdminCommunityRow['status']]?.label ?? f.value,
            count: f.count
          }))}
          className="w-40"
        />
        <ParamSelect
          state={state}
          name="type"
          all="Mọi loại"
          options={(list.data?.facets?.type ?? []).map((f) => ({ value: f.value, label: TYPE_LABELS[f.value] ?? f.value, count: f.count }))}
          className="w-40"
        />
        <span className="ml-auto text-sm tabular-nums text-muted-foreground">{list.data ? `${formatNumber(list.data.total)} cộng đồng` : ''}</span>
      </Toolbar>
      {list.isPending ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <EmptyState icon={Compass} title="Không có cộng đồng phù hợp" />
      ) : (
        <div className={cn(list.isPlaceholderData && 'opacity-60')}>
          <Table>
            <THead>
              <Th>Cộng đồng</Th>
              <Th className="hidden sm:table-cell">Loại</Th>
              <Th>Trạng thái</Th>
              <Th className="hidden md:table-cell">Chủ</Th>
              <SortTh id="members" sort={state.sort} dir={state.dir} onSort={state.onSort} align="right">
                Thành viên
              </SortTh>
              <SortTh id="recent" sort={state.sort} dir={state.dir} onSort={state.onSort} className="hidden lg:table-cell">
                Ngày tạo
              </SortTh>
              {canManage && <Th />}
            </THead>
            <TBody>
              {rows.map((c) => (
                <Tr key={c.id}>
                  <Td className="max-w-[360px]">
                    <p className="truncate font-medium text-foreground">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">c/{c.slug}</p>
                  </Td>
                  <Td className="hidden sm:table-cell">
                    <Badge>{TYPE_LABELS[c.communityType] ?? c.communityType}</Badge>
                  </Td>
                  <Td>
                    <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                  </Td>
                  <Td className="hidden text-muted-foreground md:table-cell">{c.ownerName ?? (c.createdByName ? `${c.createdByName} (người tạo)` : '—')}</Td>
                  <Td className="text-right tabular-nums">{formatNumber(c.membersCount)}</Td>
                  <Td className="hidden text-muted-foreground lg:table-cell">{new Date(c.createdAt).toLocaleDateString('vi-VN')}</Td>
                  {canManage && (
                    <Td className="text-right">
                      <div className="flex justify-end gap-0.5">
                        {c.status === 'pending' && (
                          <>
                            <Button size="sm" onClick={() => setRejecting(c)}>
                              <X /> Từ chối
                            </Button>
                            <Button size="sm" variant="primary" loading={approve.isPending && approve.variables === c.id} onClick={() => approve.mutate(c.id)}>
                              <Check /> Duyệt
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Đổi chủ cộng đồng"
                          onClick={() => {
                            setOwning(c)
                            setOwnerName('')
                          }}
                        >
                          <Crown />
                        </Button>
                        <Button variant="danger-soft" size="icon-sm" title="Gỡ cộng đồng" onClick={() => setDeleting(c)}>
                          <Trash2 />
                        </Button>
                      </div>
                    </Td>
                  )}
                </Tr>
              ))}
            </TBody>
          </Table>
          <ListFooter state={state} total={list.data?.total ?? 0} />
        </div>
      )}

      <ConfirmDialog
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Từ chối cộng đồng?"
        description={rejecting ? `Chủ cộng đồng “${rejecting.name}” sẽ nhận thông báo kèm lý do.` : undefined}
        confirmLabel="Từ chối"
        withReason
        loading={reject.isPending}
        onConfirm={(note) => rejecting && reject.mutate({ id: rejecting.id, note })}
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Gỡ cộng đồng?"
        description={deleting ? `“${deleting.name}” và danh sách thành viên sẽ bị xóa. Bài viết vẫn được giữ lại. Không thể hoàn tác.` : undefined}
        confirmLabel="Gỡ"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
      <Dialog
        open={!!owning}
        onClose={() => setOwning(null)}
        title="Đổi chủ cộng đồng"
        description={owning ? `Chủ hiện tại của “${owning.name}” sẽ xuống làm điều hành viên.` : undefined}
        footer={
          <>
            <Button onClick={() => setOwning(null)}>Hủy</Button>
            <Button
              variant="primary"
              loading={changeOwner.isPending}
              disabled={ownerName.trim().length < 2}
              onClick={() => owning && changeOwner.mutate({ id: owning.id, username: ownerName.trim().replace(/^@/, '') })}
            >
              Đổi chủ
            </Button>
          </>
        }
      >
        <Field label="Username chủ mới">
          <Input autoFocus value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="@username" />
        </Field>
      </Dialog>
      {canManage && <CreateDialog open={createOpen} onClose={onCloseCreate} />}
    </>
  )
}

function CreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState<Create>(EMPTY)
  const qc = useQueryClient()
  const create = useMutation({
    mutationFn: (body: Create) => adminApi.post('/admin/communities', { ...body, ownerUsername: body.ownerUsername.trim().replace(/^@/, '') || undefined }),
    onSuccess: () => {
      toast.success('Đã tạo cộng đồng')
      setForm(EMPTY)
      onClose()
      void qc.invalidateQueries({ queryKey: ['admin'] })
    },
    onError: (err: Error) => toast.error(err.message)
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Tạo cộng đồng"
      description="Cộng đồng admin tạo hoạt động ngay, không cần duyệt."
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" type="submit" form="create-community" loading={create.isPending}>
            Tạo
          </Button>
        </>
      }
    >
      <form
        id="create-community"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate(form)
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tên cộng đồng">
            <Input required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Khoa Toán" />
          </Field>
          <Field label="Đường dẫn (c/…)">
            <Input
              required
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              placeholder="khoa-toan"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Loại">
            <select
              value={form.communityType}
              onChange={(e) => setForm({ ...form, communityType: e.target.value })}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {Object.entries(TYPE_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Chủ sở hữu (tùy chọn)">
            <Input value={form.ownerUsername} onChange={(e) => setForm({ ...form, ownerUsername: e.target.value })} placeholder="@username" />
          </Field>
        </div>
        <Field label="Mô tả">
          <Textarea required minLength={10} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
      </form>
    </Dialog>
  )
}

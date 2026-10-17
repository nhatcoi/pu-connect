import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bookmark, BookmarkPlus, Check, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import type { AdminSavedView } from '@pu/schemas'
import { adminApi, cn } from '@/lib/api'
import { useHashQuery } from '@/hooks/use-hash-query'
import { Button, Dialog, Field, Input, Menu, MenuLabel, MenuSeparator, useMenuClose } from '@/components/ui'

export type ViewPage = 'users' | 'moderation' | 'academic' | 'ai' | 'audit'

// View có sẵn — bộ lọc hay dùng nhất của từng trang
const BUILTIN: Record<ViewPage, { name: string; query: string }[]> = {
  users: [
    { name: 'SV mới bị báo cáo', query: 'role=student&joined=7d&reported=yes' },
    { name: 'Rủi ro cao', query: 'risk=high&sort=risk' },
    { name: 'Đang bị hạn chế', query: 'status=restricted' },
    { name: 'Google chưa xác thực', query: 'auth=google&verified=no' }
  ],
  moderation: [
    { name: 'Báo cáo lộ đề thi', query: 'reason=exam_leak' },
    { name: 'Bài bị báo cáo nhiều', query: 'tab=posts&filter=reported&sort=reports' },
    { name: 'Bài đang ẩn', query: 'tab=posts&filter=hidden' }
  ],
  academic: [
    { name: 'Tài liệu chưa vào N7AI', query: 'tab=documents&indexed=no' },
    { name: 'Đề thi', query: 'tab=documents&docType=final_exam' }
  ],
  ai: [{ name: 'Skill đã tắt', query: 'tab=skills&status=disabled' }],
  audit: [
    { name: '24 giờ qua', query: 'days=1' },
    { name: 'Đăng nhập thất bại 24h', query: 'tab=logins&result=failed&days=1' },
    { name: 'Xem insight', query: 'action=user.insight_view' },
    { name: 'Khóa tài khoản', query: 'action=user.suspend' }
  ]
}

// Bỏ tham số không thuộc bộ lọc (trang, ngăn chi tiết đang mở)
function normalize(q: string) {
  const p = new URLSearchParams(q)
  p.delete('page')
  p.delete('user')
  p.sort()
  return p.toString()
}

export function SavedViews({ page }: { page: ViewPage }) {
  const [params, set] = useHashQuery()
  const [saveOpen, setSaveOpen] = useState(false)
  const qc = useQueryClient()
  const current = normalize(new URLSearchParams(params).toString())

  const views = useQuery({
    queryKey: ['admin', 'views', page],
    queryFn: () => adminApi.get<AdminSavedView[]>(`/admin/views?page=${page}`),
    staleTime: 5 * 60_000
  })
  const remove = useMutation({
    mutationFn: (id: string) => adminApi.delete(`/admin/views/${id}`),
    onSuccess: () => {
      toast.success('Đã xóa view')
      void qc.invalidateQueries({ queryKey: ['admin', 'views', page] })
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const apply = (query: string) => set(Object.fromEntries(new URLSearchParams(query)), { replace: true })
  const all = [...BUILTIN[page].map((v) => ({ ...v, id: `b:${v.name}`, builtin: true as const })), ...(views.data ?? [])]
  const active = all.find((v) => normalize(v.query) === current && current !== '')

  return (
    <>
      <Menu
        width={280}
        trigger={(p) => (
          <Button {...p}>
            <Bookmark className={cn(active && 'fill-primary text-primary')} />
            <span className="max-w-36 truncate">{active ? active.name : 'View'}</span>
          </Button>
        )}
      >
        <MenuLabel>Có sẵn</MenuLabel>
        {BUILTIN[page].map((v) => (
          <ViewRow key={v.name} name={v.name} on={normalize(v.query) === current} onApply={() => apply(v.query)} />
        ))}
        {(views.data?.length ?? 0) > 0 && (
          <>
            <MenuSeparator />
            <MenuLabel>Đã lưu</MenuLabel>
            {views.data!.map((v) => (
              <ViewRow
                key={v.id}
                name={v.name}
                shared={v.shared}
                owner={v.mine ? null : v.owner}
                on={normalize(v.query) === current}
                onApply={() => apply(v.query)}
                onDelete={v.mine ? () => remove.mutate(v.id) : undefined}
              />
            ))}
          </>
        )}
        <MenuSeparator />
        <SaveRow disabled={!current || !!active} onClick={() => setSaveOpen(true)} />
      </Menu>
      <SaveViewDialog open={saveOpen} onClose={() => setSaveOpen(false)} page={page} query={current} />
    </>
  )
}

function ViewRow({
  name,
  on,
  shared,
  owner,
  onApply,
  onDelete
}: {
  name: string
  on: boolean
  shared?: boolean
  owner?: string | null
  onApply: () => void
  onDelete?: () => void
}) {
  const close = useMenuClose()
  return (
    <div className="group flex items-center rounded-md hover:bg-accent">
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          close()
          onApply()
        }}
        className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5 text-left text-sm text-foreground cursor-pointer"
      >
        {on ? <Check className="size-4 shrink-0 text-primary" /> : <span className="size-4 shrink-0" />}
        <span className="truncate">{name}</span>
        {shared && <Users className="size-3.5 shrink-0 text-muted-foreground" aria-label="Chia sẻ" />}
        {owner && <span className="truncate text-xs text-muted-foreground">@{owner}</span>}
      </button>
      {onDelete && (
        <button
          type="button"
          aria-label={`Xóa view ${name}`}
          onClick={onDelete}
          className="mr-1 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 focus:opacity-100 cursor-pointer"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  )
}

function SaveRow({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  const close = useMenuClose()
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        close()
        onClick()
      }}
      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-primary hover:bg-accent disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
    >
      <BookmarkPlus className="size-4" /> Lưu bộ lọc hiện tại…
    </button>
  )
}

function SaveViewDialog({ open, onClose, page, query }: { open: boolean; onClose: () => void; page: ViewPage; query: string }) {
  const [name, setName] = useState('')
  const [shared, setShared] = useState(false)
  const qc = useQueryClient()
  const save = useMutation({
    mutationFn: () => adminApi.post<AdminSavedView[]>('/admin/views', { page, name: name.trim(), query, shared }),
    onSuccess: (list) => {
      qc.setQueryData(['admin', 'views', page], list)
      toast.success('Đã lưu view')
      setName('')
      onClose()
    },
    onError: (err: Error) => toast.error(err.message)
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title="Lưu bộ lọc thành view"
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" loading={save.isPending} disabled={!name.trim()} onClick={() => save.mutate()}>
            Lưu
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) save.mutate()
        }}
      >
        <Field label="Tên view">
          <Input autoFocus maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: SV khoa FIT bị báo cáo" />
        </Field>
        <p className="break-all rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs text-muted-foreground">{query}</p>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="size-4 accent-[var(--primary)]" />
          Chia sẻ cho mọi quản trị viên
        </label>
      </form>
    </Dialog>
  )
}

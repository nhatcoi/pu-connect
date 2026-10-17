import React, { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Compass, ExternalLink, FileText, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { AdminCommunityRow, AdminCourseInput, AdminCourseRow, AdminDocumentRow, AdminPermission } from '@pu/schemas'
import { adminApi, cn, formatBytes, formatNumber, formatRelativeTime } from '@/lib/api'
import { useDebounced } from '@/hooks/use-debounced'
import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  Input,
  LoadingRows,
  PageHeader,
  SearchInput,
  Table,
  TBody,
  Td,
  Textarea,
  Th,
  THead,
  Tabs,
  Toolbar,
  Tr
} from '@/components/ui'

type Sub = 'courses' | 'documents' | 'communities'

export function AcademicTab({ permissions }: { permissions: AdminPermission[] }) {
  const [tab, setTab] = useState<Sub>('courses')
  const [createOpen, setCreateOpen] = useState(false)
  const canManage = permissions.includes('academic:manage')

  return (
    <>
      <PageHeader
        title="Học thuật"
        actions={
          canManage && tab === 'courses' ? (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus /> Thêm học phần
            </Button>
          ) : undefined
        }
        tabs={
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: 'courses', label: 'Học phần' },
              { id: 'documents', label: 'Tài liệu' },
              { id: 'communities', label: 'Cộng đồng' }
            ]}
          />
        }
      />
      {tab === 'courses' && <CoursesSection />}
      {tab === 'documents' && <DocumentsSection canManage={canManage} />}
      {tab === 'communities' && <CommunitiesSection />}
      {canManage && <CreateCourseDialog open={createOpen} onClose={() => setCreateOpen(false)} />}
    </>
  )
}

// Hook tìm kiếm có debounce dùng chung cho 3 danh sách
function useSearchList<T>(key: string, path: string) {
  const [q, setQ] = useState('')
  const query = useDebounced(q.trim())
  const result = useQuery({
    queryKey: ['admin', key, query],
    queryFn: () => adminApi.get<T[]>(`${path}?q=${encodeURIComponent(query)}`),
    placeholderData: keepPreviousData
  })
  return { q, setQ, result }
}

function CoursesSection() {
  const { q, setQ, result } = useSearchList<AdminCourseRow>('courses', '/admin/courses')

  return (
    <>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Mã môn, tên môn, khoa" className="min-w-[220px] flex-1 sm:max-w-sm" />
      </Toolbar>
      {result.isPending ? (
        <LoadingRows />
      ) : !result.data?.length ? (
        <EmptyState icon={BookOpen} title="Không có học phần phù hợp" />
      ) : (
        <Table className={cn(result.isPlaceholderData && 'opacity-60')}>
          <THead>
            <Th className="w-28">Mã</Th>
            <Th>Tên học phần</Th>
            <Th className="hidden md:table-cell">Khoa</Th>
            <Th className="hidden text-right sm:table-cell">Tín chỉ</Th>
            <Th className="text-right">Tài liệu</Th>
            <Th className="hidden text-right sm:table-cell">Thảo luận</Th>
          </THead>
          <TBody>
            {result.data.map((c) => (
              <Tr key={c.id}>
                <Td className="font-mono text-xs font-semibold text-primary">{c.code}</Td>
                <Td className="max-w-[360px]">
                  <p className="truncate font-medium text-foreground">{c.name}</p>
                  {c.description && <p className="truncate text-xs text-muted-foreground">{c.description}</p>}
                </Td>
                <Td className="hidden text-muted-foreground md:table-cell">{c.facultyCode || '—'}</Td>
                <Td className="hidden text-right tabular-nums sm:table-cell">{c.credits}</Td>
                <Td className="text-right tabular-nums">{formatNumber(c.documentCount)}</Td>
                <Td className="hidden text-right tabular-nums sm:table-cell">{formatNumber(c.postCount)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </>
  )
}

const EMPTY_COURSE: AdminCourseInput = { code: '', name: '', credits: 3, facultyCode: '', description: '', syllabusUrl: '' }

function CreateCourseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState<AdminCourseInput>(EMPTY_COURSE)
  const qc = useQueryClient()
  const create = useMutation({
    mutationFn: (body: AdminCourseInput) => adminApi.post('/admin/courses', body),
    onSuccess: () => {
      toast.success('Đã thêm học phần')
      setForm(EMPTY_COURSE)
      onClose()
      void qc.invalidateQueries({ queryKey: ['admin'] })
    },
    onError: (err: Error) => toast.error(err.message)
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Thêm học phần"
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" type="submit" form="create-course" loading={create.isPending}>
            Thêm
          </Button>
        </>
      }
    >
      <form
        id="create-course"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate(form)
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-3 gap-3">
          <Field label="Mã môn">
            <Input required autoFocus value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="IT302" />
          </Field>
          <Field label="Khoa">
            <Input required value={form.facultyCode} onChange={(e) => setForm({ ...form, facultyCode: e.target.value })} placeholder="CNTT" />
          </Field>
          <Field label="Tín chỉ">
            <Input
              type="number"
              min={1}
              max={15}
              value={form.credits}
              onChange={(e) => setForm({ ...form, credits: Number(e.target.value) || 3 })}
            />
          </Field>
        </div>
        <Field label="Tên học phần">
          <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Trí tuệ nhân tạo" />
        </Field>
        <Field label="Mô tả" hint="Không bắt buộc">
          <Textarea rows={3} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
      </form>
    </Dialog>
  )
}

function DocumentsSection({ canManage }: { canManage: boolean }) {
  const { q, setQ, result } = useSearchList<AdminDocumentRow>('documents', '/admin/documents')
  const [delTarget, setDelTarget] = useState<AdminDocumentRow | null>(null)
  const qc = useQueryClient()

  const del = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      adminApi.delete(`/admin/documents/${id}`, { reason: reason || 'Vi phạm quy chế / bản quyền' }),
    onSuccess: () => {
      toast.success('Đã xóa tài liệu')
      setDelTarget(null)
      void qc.invalidateQueries({ queryKey: ['admin'] })
    },
    onError: (err: Error) => toast.error(err.message)
  })

  return (
    <>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Tên tài liệu, mã môn, @username" className="min-w-[220px] flex-1 sm:max-w-sm" />
      </Toolbar>
      {result.isPending ? (
        <LoadingRows />
      ) : !result.data?.length ? (
        <EmptyState icon={FileText} title="Không có tài liệu phù hợp" />
      ) : (
        <Table className={cn(result.isPlaceholderData && 'opacity-60')}>
          <THead>
            <Th>Tài liệu</Th>
            <Th className="hidden md:table-cell">Người đăng</Th>
            <Th className="hidden text-right sm:table-cell">Kích thước</Th>
            <Th className="hidden text-right lg:table-cell">Lượt tải</Th>
            <Th className="hidden text-right lg:table-cell">Chỉ mục AI</Th>
            <Th className="w-20" />
          </THead>
          <TBody>
            {result.data.map((d) => (
              <Tr key={d.id}>
                <Td className="max-w-[380px]">
                  <p className="truncate font-medium text-foreground">{d.title}</p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {d.courseCode && <span className="font-mono text-primary">{d.courseCode}</span>}
                    <span className="uppercase">{d.docType}</span>
                    <span>· {formatRelativeTime(d.createdAt)}</span>
                  </div>
                </Td>
                <Td className="hidden text-muted-foreground md:table-cell">@{d.owner.username}</Td>
                <Td className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">{formatBytes(d.fileSize)}</Td>
                <Td className="hidden text-right tabular-nums lg:table-cell">{formatNumber(d.downloadCount)}</Td>
                <Td className="hidden text-right lg:table-cell">
                  {d.chunkCount > 0 ? <Badge tone="success">{d.chunkCount} đoạn</Badge> : <Badge>Chưa có</Badge>}
                </Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-0.5">
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Mở file"
                      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                    {canManage && (
                      <Button variant="danger-soft" size="icon-sm" title="Xóa" onClick={() => setDelTarget(d)}>
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}

      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        title="Xóa tài liệu?"
        description={delTarget ? `“${delTarget.title}” sẽ bị xóa cùng chỉ mục AI. Không thể hoàn tác.` : undefined}
        confirmLabel="Xóa"
        withReason
        loading={del.isPending}
        onConfirm={(reason) => delTarget && del.mutate({ id: delTarget.id, reason })}
      />
    </>
  )
}

function CommunitiesSection() {
  const { q, setQ, result } = useSearchList<AdminCommunityRow>('communities', '/admin/communities')

  return (
    <>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Tên hoặc slug" className="min-w-[220px] flex-1 sm:max-w-sm" />
      </Toolbar>
      {result.isPending ? (
        <LoadingRows />
      ) : !result.data?.length ? (
        <EmptyState icon={Compass} title="Không có cộng đồng phù hợp" />
      ) : (
        <Table className={cn(result.isPlaceholderData && 'opacity-60')}>
          <THead>
            <Th>Cộng đồng</Th>
            <Th className="hidden sm:table-cell">Loại</Th>
            <Th className="text-right">Thành viên</Th>
            <Th className="hidden text-right sm:table-cell">Bài viết</Th>
          </THead>
          <TBody>
            {result.data.map((c) => (
              <Tr key={c.id}>
                <Td className="max-w-[420px]">
                  <p className="truncate font-medium text-foreground">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.description || `c/${c.slug}`}</p>
                </Td>
                <Td className="hidden sm:table-cell">
                  <Badge>{c.communityType}</Badge>
                </Td>
                <Td className="text-right tabular-nums">{formatNumber(c.membersCount)}</Td>
                <Td className="hidden text-right tabular-nums sm:table-cell">{formatNumber(c.postsCount)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </>
  )
}

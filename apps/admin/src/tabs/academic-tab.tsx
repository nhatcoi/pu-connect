import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Compass, ExternalLink, FileSpreadsheet, FileText, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { AdminCommunityRow, AdminCourseInput, AdminCourseRow, AdminDocumentRow, AdminPermission } from '@pu/schemas'
import { adminApi, cn, formatBytes, formatNumber, formatRelativeTime } from '@/lib/api'
import { SavedViews } from '@/components/list/saved-views'
import { UnitsSection } from '@/features/units/units-panel'
import { FieldSelect } from '@/features/units/field-select'
import { CourseEditDialog } from '@/features/courses/course-edit-dialog'
import { CourseImportDialog } from '@/features/courses/course-import-dialog'
import { useHashQuery } from '@/hooks/use-hash-query'
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
  Segmented,
  SortTh,
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
import { ListFooter, ListSearch, ParamSelect, useListState, usePaged, type ListState } from '@/components/list/list-kit'

type Sub = 'courses' | 'documents' | 'communities' | 'units'

const DOC_TYPE_LABELS: Record<string, string> = {
  midterm_exam: 'Đề giữa kỳ',
  final_exam: 'Đề cuối kỳ',
  lecture_slide: 'Slide bài giảng',
  syllabus: 'Đề cương',
  sample_project: 'Đồ án mẫu',
  internship_report: 'Báo cáo thực tập',
  scientific_paper: 'Bài báo khoa học'
}

const COMMUNITY_TYPE_LABELS: Record<string, string> = {
  campus: 'Toàn trường',
  faculty: 'Lĩnh vực',
  academic: 'Học thuật',
  life: 'Đời sống',
  club: 'CLB'
}

export function AcademicTab({ permissions }: { permissions: AdminPermission[] }) {
  const [params, set] = useHashQuery()
  const tab = (['courses', 'documents', 'communities', 'units'].includes(params.tab) ? params.tab : 'courses') as Sub
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const canManage = permissions.includes('academic:manage')

  return (
    <>
      <PageHeader
        title="Học thuật"
        actions={
          <>
            <SavedViews page="academic" />
            {canManage && tab === 'courses' && (
              <>
                <Button onClick={() => setImportOpen(true)}>
                  <FileSpreadsheet /> Nhập file
                </Button>
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  <Plus /> Thêm học phần
                </Button>
              </>
            )}
          </>
        }
        tabs={
          <Tabs
            value={tab}
            onChange={(t) => set({ tab: t === 'courses' ? undefined : t }, { replace: true })}
            items={[
              { id: 'courses', label: 'Học phần' },
              { id: 'documents', label: 'Tài liệu' },
              { id: 'communities', label: 'Cộng đồng' },
              { id: 'units', label: 'Đơn vị' }
            ]}
          />
        }
      />
      {tab === 'courses' && <CoursesSection canManage={canManage} />}
      {tab === 'documents' && <DocumentsSection canManage={canManage} />}
      {tab === 'communities' && <CommunitiesSection />}
      {tab === 'units' && <UnitsSection canManage={canManage} />}
      {canManage && <CreateCourseDialog open={createOpen} onClose={() => setCreateOpen(false)} />}
      {canManage && <CourseImportDialog open={importOpen} onClose={() => setImportOpen(false)} />}
    </>
  )
}

// Tiêu đề cột sắp xếp gắn với state URL
function Sort({ state, id, children, align, className }: { state: ListState; id: string; children: React.ReactNode; align?: 'right'; className?: string }) {
  return (
    <SortTh id={id} sort={state.sort} dir={state.dir} onSort={state.onSort} align={align} className={className}>
      {children}
    </SortTh>
  )
}

function Total({ n, unit }: { n?: number; unit: string }) {
  if (n === undefined) return null
  return (
    <span className="ml-auto text-sm tabular-nums text-muted-foreground">
      {formatNumber(n)} {unit}
    </span>
  )
}

/* ── Học phần ────────────────────────────────────────────── */

function CoursesSection({ canManage }: { canManage: boolean }) {
  const [editing, setEditing] = useState<AdminCourseRow | null>(null)
  const state = useListState({ sort: 'posts' })
  const list = usePaged<AdminCourseRow>('courses', '/admin/courses', state.params, ['q', 'field'])
  const rows = list.data?.items ?? []

  return (
    <>
      <Toolbar>
        <ListSearch state={state} placeholder="Mã môn, tên môn (không dấu)" />
        <ParamSelect
          state={state}
          name="field"
          all="Mọi lĩnh vực"
          options={(list.data?.facets?.field ?? []).map((f) => ({ value: f.value, label: f.value, count: f.count }))}
          className="w-40"
        />
        <Total n={list.data?.total} unit="học phần" />
      </Toolbar>
      {list.isPending ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <EmptyState icon={BookOpen} title="Không có học phần phù hợp" />
      ) : (
        <div className={cn(list.isPlaceholderData && 'opacity-60')}>
          <Table>
            <THead>
              <Sort state={state} id="code" className="w-28">
                Mã
              </Sort>
              <Th>Tên học phần</Th>
              <Th className="hidden md:table-cell">Lĩnh vực</Th>
              <Th className="hidden text-right sm:table-cell">Tín chỉ</Th>
              <Sort state={state} id="documents" align="right">
                Tài liệu
              </Sort>
              <Sort state={state} id="posts" align="right" className="hidden sm:table-cell">
                Thảo luận
              </Sort>
              <Sort state={state} id="recent" className="hidden lg:table-cell">
                Ngày tạo
              </Sort>
            </THead>
            <TBody>
              {rows.map((c) => (
                <Tr key={c.id} onClick={canManage ? () => setEditing(c) : undefined}>
                  <Td className="font-mono text-xs font-semibold text-primary">{c.code}</Td>
                  <Td className="max-w-[420px]">
                    <p className="truncate font-medium text-foreground">{c.name}</p>
                    {c.description && <p className="truncate text-xs text-muted-foreground">{c.description}</p>}
                  </Td>
                  <Td className="hidden text-muted-foreground md:table-cell">{c.fieldName || '—'}</Td>
                  <Td className="hidden text-right tabular-nums sm:table-cell">{c.credits}</Td>
                  <Td className="text-right tabular-nums">{formatNumber(c.documentCount)}</Td>
                  <Td className="hidden text-right tabular-nums sm:table-cell">{formatNumber(c.postCount)}</Td>
                  <Td className="hidden text-muted-foreground lg:table-cell">{new Date(c.createdAt).toLocaleDateString('vi-VN')}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          <ListFooter state={state} total={list.data?.total ?? 0} />
        </div>
      )}
      {canManage && <CourseEditDialog course={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

const EMPTY_COURSE: AdminCourseInput = { code: '', name: '', credits: 3, fieldId: null, description: '', syllabusUrl: '' }

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
          <Field label="Lĩnh vực">
            <FieldSelect value={form.fieldId} onChange={(fieldId) => setForm({ ...form, fieldId })} />
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
        <Field label="Mô tả">
          <Textarea rows={3} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Tùy chọn..." />
        </Field>
      </form>
    </Dialog>
  )
}


/* ── Tài liệu ────────────────────────────────────────────── */

function DocumentsSection({ canManage }: { canManage: boolean }) {
  const state = useListState({ sort: 'recent' })
  const list = usePaged<AdminDocumentRow>('documents', '/admin/documents', state.params, ['q', 'docType', 'indexed'])
  const rows = list.data?.items ?? []
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
        <ListSearch state={state} placeholder="Tên tài liệu, mã môn, @người đăng" />
        <ParamSelect
          state={state}
          name="docType"
          all="Mọi loại"
          options={(list.data?.facets?.docType ?? []).map((f) => ({ value: f.value, label: DOC_TYPE_LABELS[f.value] ?? f.value, count: f.count }))}
        />
        <Segmented
          value={state.params.indexed ?? ''}
          onChange={(v) => state.set({ indexed: v })}
          items={[
            { id: '', label: 'Tất cả' },
            { id: 'yes', label: 'Đã vào N7AI' },
            { id: 'no', label: 'Chưa vào N7AI' }
          ]}
        />
        <Total n={list.data?.total} unit="tài liệu" />
      </Toolbar>
      {list.isPending ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <EmptyState icon={FileText} title="Không có tài liệu phù hợp" />
      ) : (
        <div className={cn(list.isPlaceholderData && 'opacity-60')}>
          <Table>
            <THead>
              <Th>Tài liệu</Th>
              <Th className="hidden md:table-cell">Người đăng</Th>
              <Sort state={state} id="size" align="right" className="hidden sm:table-cell">
                Kích thước
              </Sort>
              <Sort state={state} id="downloads" align="right" className="hidden lg:table-cell">
                Lượt tải
              </Sort>
              <Sort state={state} id="chunks" align="right" className="hidden lg:table-cell">
                Chỉ mục AI
              </Sort>
              <Sort state={state} id="recent" className="hidden xl:table-cell">
                Ngày đăng
              </Sort>
              <Th className="w-20" />
            </THead>
            <TBody>
              {rows.map((d) => (
                <Tr key={d.id}>
                  <Td className="max-w-[380px]">
                    <p className="truncate font-medium text-foreground">{d.title}</p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      {d.courseCode && <span className="font-mono text-primary">{d.courseCode}</span>}
                      <span>{DOC_TYPE_LABELS[d.docType] ?? d.docType}</span>
                    </div>
                  </Td>
                  <Td className="hidden text-muted-foreground md:table-cell">@{d.owner.username}</Td>
                  <Td className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">{formatBytes(d.fileSize)}</Td>
                  <Td className="hidden text-right tabular-nums lg:table-cell">{formatNumber(d.downloadCount)}</Td>
                  <Td className="hidden text-right lg:table-cell">
                    {d.chunkCount > 0 ? <Badge tone="success">{d.chunkCount} đoạn</Badge> : <Badge>Chưa có</Badge>}
                  </Td>
                  <Td className="hidden text-muted-foreground xl:table-cell">{formatRelativeTime(d.createdAt)}</Td>
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
          <ListFooter state={state} total={list.data?.total ?? 0} />
        </div>
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

/* ── Cộng đồng ───────────────────────────────────────────── */

function CommunitiesSection() {
  const state = useListState({ sort: 'members' })
  const list = usePaged<AdminCommunityRow>('communities', '/admin/communities', state.params, ['q', 'type'])
  const rows = list.data?.items ?? []

  return (
    <>
      <Toolbar>
        <ListSearch state={state} placeholder="Tên hoặc slug" />
        <ParamSelect
          state={state}
          name="type"
          all="Mọi loại"
          options={(list.data?.facets?.type ?? []).map((f) => ({ value: f.value, label: COMMUNITY_TYPE_LABELS[f.value] ?? f.value, count: f.count }))}
          className="w-40"
        />
        <Total n={list.data?.total} unit="cộng đồng" />
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
              <Sort state={state} id="members" align="right">
                Thành viên
              </Sort>
              <Sort state={state} id="posts" align="right" className="hidden sm:table-cell">
                Bài viết
              </Sort>
              <Sort state={state} id="recent" className="hidden lg:table-cell">
                Ngày tạo
              </Sort>
            </THead>
            <TBody>
              {rows.map((c) => (
                <Tr key={c.id}>
                  <Td className="max-w-[420px]">
                    <p className="truncate font-medium text-foreground">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.description || `c/${c.slug}`}</p>
                  </Td>
                  <Td className="hidden sm:table-cell">
                    <Badge>{COMMUNITY_TYPE_LABELS[c.communityType] ?? c.communityType}</Badge>
                  </Td>
                  <Td className="text-right tabular-nums">{formatNumber(c.membersCount)}</Td>
                  <Td className="hidden text-right tabular-nums sm:table-cell">{formatNumber(c.postsCount)}</Td>
                  <Td className="hidden text-muted-foreground lg:table-cell">{new Date(c.createdAt).toLocaleDateString('vi-VN')}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          <ListFooter state={state} total={list.data?.total ?? 0} />
        </div>
      )}
    </>
  )
}

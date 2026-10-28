'use client'

import React, { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { DOC_CATEGORIES, DOC_CATEGORY_LABELS, type ClassifyDocumentInput, type DocCategory, type DocumentDetail } from '@pu/schemas'
import { ArrowLeft, Bookmark, Download, Eye, FileQuestion, Library, Lock, Pencil, Share2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { PageAside } from '@/components/layout/page-aside'
import { PreviewBody } from '@/components/viewer/preview-body'
import { CourseSelect } from '@/components/documents/course-select'
import { DocumentRow } from '@/components/documents/document-row'
import { AddToCollection } from '@/components/documents/add-to-collection'
import { SaveDocumentButton } from '@/components/documents/save-document-button'
import { RatingBadge, StarInput } from '@/components/documents/star-rating'
import { StudyWithAi } from '@/components/documents/study-with-ai'
import { docExt, docMetaLine } from '@/components/documents/document-format'
import { useCourses } from '@/hooks/use-course'
import { useDocumentDetail } from '@/hooks/use-document-library'
import { useRateDocument } from '@/hooks/use-document-community'
import { useAppStore } from '@/store'
import { errorMessage } from '@/lib/api-client'
import { classifyDocument, deleteDocument, openDocument } from '@/lib/document-api'
import { queryKeys } from '@/lib/query-keys'
import { formatRelativeTime } from '@/lib/utils'

const SELECT = 'h-8 min-w-0 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer'

// /documents/[id]: xem trước tệp, thông tin + phân loại, bài viết có đính kèm, tài liệu cùng môn; chủ tài liệu sửa / xóa
export default function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: doc, isPending, isError } = useDocumentDetail(id)

  return (
    <>
      <div className="sticky top-0 md:top-14 z-30 bg-surface/90 backdrop-blur-md px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0" onClick={() => router.back()} aria-label="Quay lại">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="min-w-0 truncate text-[15px] font-semibold tracking-tight">{doc?.title ?? 'Tài liệu'}</h1>
      </div>

      {isPending ? (
        <div className="mx-2 sm:mx-0 space-y-2.5">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-[60vh] w-full rounded-xl" />
        </div>
      ) : isError || !doc ? (
        <div className="py-24 text-center space-y-3 text-muted-foreground">
          <FileQuestion className="h-10 w-10 mx-auto opacity-30 text-primary" />
          <p className="text-sm font-medium">Tài liệu không tồn tại hoặc bạn không có quyền xem</p>
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => router.push('/courses?tab=documents')}>
            Xem kho tài liệu
          </Button>
        </div>
      ) : (
        <DocumentView doc={doc} />
      )}
    </>
  )
}

function DocumentView({ doc }: { doc: DocumentDetail }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const user = useAppStore((s) => s.user)
  const rate = useRateDocument(doc.id)
  const meta = docMetaLine(doc)
  const fileName = doc.originalName || `${doc.title}.${docExt(doc).toLowerCase()}`

  const handleShare = () => {
    void navigator.clipboard.writeText(window.location.href)
    toast.success('Đã sao chép liên kết tài liệu')
  }

  const handleDelete = async () => {
    if (!window.confirm(`Xóa hẳn “${doc.title}”? Tài liệu sẽ bị gỡ khỏi mọi bài viết, bình luận và kho của người khác.`)) return
    try {
      await deleteDocument(doc.id)
      toast.success('Đã xóa tài liệu')
      void queryClient.invalidateQueries({ queryKey: queryKeys.libraryAll })
      router.replace('/courses?tab=library')
    } catch (err) {
      toast.error(errorMessage(err, 'Không xóa được tài liệu'))
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="mx-2 sm:mx-0 rounded-xl bg-card p-4 sm:p-5 space-y-3">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">{docExt(doc)}</span>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-base sm:text-lg font-bold leading-snug">{doc.title}</h2>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {doc.courseCode && (
                <Link href={`/courses/${encodeURIComponent(doc.courseCode)}`} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold text-primary hover:bg-primary/15">
                  {doc.courseName ?? 'Môn học'}
                </Link>
              )}
              {meta && <span>{meta}</span>}
              {doc.listed && (
                <span className="inline-flex items-center gap-1 text-primary">
                  <Library className="h-3.5 w-3.5" /> Kho môn học
                </span>
              )}
              {doc.visibility === 'private' && (
                <span className="inline-flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5" /> Chỉ mình bạn
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              <Link href={`/${doc.ownerUsername}`} className="font-medium text-foreground hover:underline">
                {doc.ownerName}
              </Link>{' '}
              · {formatRelativeTime(doc.createdAt)}
            </p>
          </div>
        </div>

        {doc.description && <p className="text-sm leading-relaxed text-muted-foreground">{doc.description}</p>}

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <RatingBadge avg={doc.ratingAvg} count={doc.ratingCount} className="text-[11px]" />
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" /> {doc.viewCount} lượt xem
          </span>
          <span className="inline-flex items-center gap-1">
            <Download className="h-3.5 w-3.5" /> {doc.downloadCount} lượt tải
          </span>
          <span className="inline-flex items-center gap-1">
            <Bookmark className="h-3.5 w-3.5" /> {doc.saveCount} lượt lưu
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" className="h-8 gap-1.5 rounded-full text-xs" onClick={() => void openDocument(doc)}>
            <Download className="h-3.5 w-3.5" /> Tải về
          </Button>
          <SaveDocumentButton documentId={doc.id} withLabel />
          <AddToCollection documentId={doc.id} />
          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full text-xs" onClick={handleShare}>
            <Share2 className="h-3.5 w-3.5" /> Chia sẻ
          </Button>
          {doc.isMine && (
            <>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full text-xs" onClick={() => setEditing((v) => !v)}>
                <Pencil className="h-3.5 w-3.5" /> Phân loại
              </Button>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-full text-xs text-destructive hover:text-destructive" onClick={handleDelete}>
                <Trash2 className="h-3.5 w-3.5" /> Xóa
              </Button>
            </>
          )}
        </div>

        {!doc.isMine && doc.visibility === 'public' && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{doc.myRating ? 'Đánh giá của bạn' : 'Tài liệu này có hữu ích không?'}</span>
            <StarInput value={doc.myRating} disabled={rate.isPending} onChange={(v) => (user ? rate.mutate(v) : toast.info('Đăng nhập để đánh giá tài liệu'))} />
          </div>
        )}

        {doc.isMine && editing && <ClassifyForm doc={doc} onDone={() => setEditing(false)} />}
      </div>

      <StudyWithAi documentId={doc.id} />

      <div className="mx-2 sm:mx-0 h-[70vh] overflow-hidden rounded-xl border border-border bg-card">
        <PreviewBody file={{ url: doc.fileUrl, name: fileName, size: doc.fileSize, mime: doc.mimeType }} />
      </div>

      {doc.posts.length > 0 && (
        <section className="mx-2 sm:mx-0 rounded-xl bg-card p-4 space-y-2">
          <h3 className="text-[13px] font-semibold">Bài viết có tài liệu này</h3>
          {doc.posts.map((p) => (
            <Link key={p.id} href={`/post/${p.id}`} className="block rounded-lg px-2 py-1.5 hover:bg-muted/50">
              <p className="truncate text-xs font-semibold">{p.title || p.excerpt}</p>
              <p className="text-[11px] text-muted-foreground">
                {p.authorName} · {formatRelativeTime(p.createdAt)}
              </p>
            </Link>
          ))}
        </section>
      )}

      <PageAside>
        <div className="rounded-xl bg-card p-4 space-y-2">
          <p className="text-[13px] font-semibold">{doc.courseCode ? `Tài liệu khác của môn ${doc.courseName ?? ''}`.trim() : 'Tài liệu liên quan'}</p>
          {doc.related.length === 0 ? (
            <p className="text-xs text-muted-foreground">Chưa có tài liệu nào khác.</p>
          ) : (
            <div className="-mx-3 space-y-1">
              {doc.related.map((r) => (
                <DocumentRow key={r.id} document={r} />
              ))}
            </div>
          )}
        </div>
      </PageAside>
    </div>
  )
}

// Chủ tài liệu sửa phân loại; vào kho môn học cần môn + loại và tài liệu công khai
function ClassifyForm({ doc, onDone }: { doc: DocumentDetail; onDone: () => void }) {
  const queryClient = useQueryClient()
  const { data: courses = [] } = useCourses()
  const [courseId, setCourseId] = useState(doc.courseId ?? '')
  const [category, setCategory] = useState<DocCategory | ''>(doc.docCategory ?? '')
  const [year, setYear] = useState(doc.academicYear ?? '')
  const [listed, setListed] = useState(doc.listed)
  const [saving, setSaving] = useState(false)
  const canList = !!courseId && !!category && doc.visibility === 'public'

  const save = async () => {
    const body: ClassifyDocumentInput = {
      courseId: courseId || null,
      docCategory: category || null,
      academicYear: /^\d{4}-\d{4}$/.test(year.trim()) ? year.trim() : null,
      listed: listed && canList
    }
    setSaving(true)
    try {
      await classifyDocument(doc.id, body)
      toast.success('Đã lưu phân loại')
      void queryClient.invalidateQueries({ queryKey: queryKeys.documentDetail(doc.id) })
      onDone()
    } catch (err) {
      toast.error(errorMessage(err, 'Không lưu được phân loại'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
        <CourseSelect courses={courses} value={courseId} onChange={setCourseId} placeholder="Môn học" />
        <select aria-label="Loại tài liệu" value={category} onChange={(e) => setCategory(e.target.value as DocCategory | '')} className={SELECT}>
          <option value="">Loại tài liệu</option>
          {DOC_CATEGORIES.map((k) => (
            <option key={k} value={k}>
              {DOC_CATEGORY_LABELS[k]}
            </option>
          ))}
        </select>
        <input aria-label="Năm học" value={year} onChange={(e) => setYear(e.target.value)} placeholder="Năm học, vd. 2025-2026" className={SELECT} />
      </div>
      <label className="flex items-center justify-between gap-2 text-xs">
        <span className={canList ? 'text-foreground' : 'text-muted-foreground'}>
          Đưa vào kho môn học {!canList && (doc.visibility === 'public' ? '(chọn môn + loại)' : '(tài liệu riêng tư)')}
        </span>
        <Switch checked={listed && canList} disabled={!canList} onCheckedChange={(v: boolean) => setListed(v)} />
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" className="h-8 rounded-full text-xs" onClick={onDone}>
          Hủy
        </Button>
        <Button size="sm" className="h-8 rounded-full text-xs" onClick={save} disabled={saving}>
          Lưu
        </Button>
      </div>
    </div>
  )
}

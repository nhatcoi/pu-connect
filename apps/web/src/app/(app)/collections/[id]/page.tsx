'use client'

import React, { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FileQuestion, FolderOpen, Lock, Pencil, Share2, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { DocumentCollectionDetail } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { DocumentCard } from '@/components/documents/document-card'
import { useCollection, useCollectionActions } from '@/hooks/use-document-community'
import { formatRelativeTime } from '@/lib/utils'

// /collections/[id]: bộ sưu tập tài liệu; chủ bộ đổi tên / công khai, bỏ tài liệu, xóa bộ
export default function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data, isPending, isError } = useCollection(id)

  return (
    <>
      <div className="sticky top-0 md:top-14 z-30 bg-surface/90 backdrop-blur-md px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0" onClick={() => router.back()} aria-label="Quay lại">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="min-w-0 truncate text-[15px] font-semibold tracking-tight">{data?.title ?? 'Bộ sưu tập'}</h1>
      </div>

      {isPending ? (
        <div className="mx-2 sm:mx-0 space-y-2.5">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : isError || !data ? (
        <div className="py-24 text-center space-y-3 text-muted-foreground">
          <FileQuestion className="h-10 w-10 mx-auto opacity-30 text-primary" />
          <p className="text-sm font-medium">Bộ sưu tập không tồn tại hoặc là bộ riêng tư</p>
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => router.push('/courses?tab=collections')}>
            Xem các bộ sưu tập
          </Button>
        </div>
      ) : (
        <CollectionView collection={data} />
      )}
    </>
  )
}

function CollectionView({ collection: c }: { collection: DocumentCollectionDetail }) {
  const router = useRouter()
  const { update, remove, setDocument } = useCollectionActions()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(c.title)
  const [description, setDescription] = useState(c.description ?? '')
  const [isPublic, setIsPublic] = useState(c.visibility === 'public')

  const save = async () => {
    if (!title.trim()) return
    try {
      await update.mutateAsync({ id: c.id, body: { title: title.trim(), description: description.trim() || null, visibility: isPublic ? 'public' : 'private' } })
      setEditing(false)
      toast.success('Đã lưu bộ sưu tập')
    } catch {
      // lỗi đã báo qua toast của mutation
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Xóa bộ “${c.title}”? Các tài liệu bên trong vẫn còn nguyên.`)) return
    try {
      await remove.mutateAsync(c.id)
      toast.success('Đã xóa bộ sưu tập')
      router.replace('/courses?tab=collections')
    } catch {
      // lỗi đã báo qua toast của mutation
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="mx-2 sm:mx-0 space-y-3 rounded-xl bg-card p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FolderOpen className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-base font-bold leading-snug sm:text-lg">{c.title}</h2>
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <Link href={`/${c.ownerUsername}`} className="font-medium text-foreground hover:underline">
                {c.isMine ? 'Của bạn' : c.ownerName}
              </Link>
              <span>· {c.itemCount} tài liệu</span>
              <span>· cập nhật {formatRelativeTime(c.updatedAt)}</span>
              {c.visibility === 'private' && (
                <span className="inline-flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5" /> Chỉ mình bạn
                </span>
              )}
            </p>
          </div>
        </div>
        {c.description && <p className="text-sm leading-relaxed text-muted-foreground">{c.description}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-full text-xs"
            onClick={() => {
              void navigator.clipboard.writeText(window.location.href)
              toast.success('Đã sao chép liên kết bộ sưu tập')
            }}
          >
            <Share2 className="h-3.5 w-3.5" /> Chia sẻ
          </Button>
          {c.isMine && (
            <>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full text-xs" onClick={() => setEditing((v) => !v)}>
                <Pencil className="h-3.5 w-3.5" /> Sửa
              </Button>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-full text-xs text-destructive hover:text-destructive" onClick={handleDelete}>
                <Trash2 className="h-3.5 w-3.5" /> Xóa bộ
              </Button>
            </>
          )}
        </div>

        {c.isMine && editing && (
          <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Tên bộ" className="h-8 text-sm" />
            <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} placeholder="Mô tả ngắn (không bắt buộc)" className="h-8 text-sm" />
            <label className="flex items-center justify-between gap-2 text-xs">
              <span>Công khai (mọi người xem được qua liên kết và mục Khám phá)</span>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-8 rounded-full text-xs" onClick={() => setEditing(false)}>
                Hủy
              </Button>
              <Button size="sm" className="h-8 rounded-full text-xs" disabled={!title.trim() || update.isPending} onClick={save}>
                Lưu
              </Button>
            </div>
          </div>
        )}
      </div>

      {c.documents.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Bộ này chưa có tài liệu. Mở một tài liệu và bấm “Bộ sưu tập” để thêm vào.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-2 sm:grid-cols-3 sm:px-0 lg:grid-cols-4">
          {c.documents.map((doc) => (
            <div key={doc.id} className="relative">
              <DocumentCard document={doc} className="h-full" />
              {c.isMine && (
                <button
                  type="button"
                  aria-label="Bỏ khỏi bộ"
                  title="Bỏ khỏi bộ"
                  onClick={() => setDocument.mutate({ id: c.id, documentId: doc.id, add: false })}
                  className="absolute left-2 top-2 rounded-full bg-background/90 p-1 text-muted-foreground shadow-sm backdrop-blur hover:text-destructive cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

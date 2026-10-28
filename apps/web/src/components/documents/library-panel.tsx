'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { LibraryItem } from '@pu/schemas'
import { Check, Folder, FolderPlus, LayoutGrid, Library, List, Loader2, MoreHorizontal, Pencil, Search, Trash2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CardListSkeleton } from '@/components/skeletons/catalog-skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useLibrary, useLibraryFolders } from '@/hooks/use-document-library'
import { useLoadMore } from '@/hooks/use-load-more'
import { errorMessage } from '@/lib/api-client'
import {
  createLibraryFolder,
  deleteDocument,
  deleteLibraryFolder,
  moveLibraryItem,
  removeFromLibrary,
  renameLibraryFolder,
  uploadToLibrary,
  type LibraryScope
} from '@/lib/document-api'
import { queryKeys } from '@/lib/query-keys'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { DocumentCard } from './document-card'
import { DocumentRow } from './document-row'

const CHIP = 'shrink-0 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors cursor-pointer'
const VIEW_KEY = 'pu:library-view'
type ViewMode = 'grid' | 'list'
const ITEM = 'flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl hover:bg-muted cursor-pointer'

// Tab "Kho của tôi": tài liệu đã lưu (từ bài, bình luận, kho môn học) + tệp riêng tải lên, chia thư mục; tài liệu mình đã đăng
export function LibraryPanel() {
  const user = useAppStore((s) => s.user)
  const queryClient = useQueryClient()
  const [scope, setScope] = useState<LibraryScope>('saved')
  const [folder, setFolder] = useState<string>('') // '' = tất cả, 'none' = chưa phân thư mục
  const [input, setInput] = useState('')
  const [q, setQ] = useState('')
  const [folderForm, setFolderForm] = useState<{ mode: 'create' | 'rename'; name: string } | null>(null)
  const [uploading, setUploading] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  // Cách xem nhớ theo trình duyệt; mặc định dạng thẻ giống trang Tài liệu
  const [view, setView] = useState<ViewMode>('grid')
  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === 'list') setView('list')
    } catch {}
  }, [])
  const changeView = (next: ViewMode) => {
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {}
  }

  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 300)
    return () => clearTimeout(t)
  }, [input])

  const { data: folders = [] } = useLibraryFolders()
  const lib = useLibrary(scope, folder || undefined, q || undefined)
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = lib
  const sentinel = useLoadMore(!!hasNextPage && !isFetchingNextPage, () => void fetchNextPage())
  const current = folders.find((f) => f.id === folder)
  const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.libraryAll })

  if (!user) {
    return (
      <div className="space-y-3 py-16 text-center text-muted-foreground">
        <Library className="mx-auto h-10 w-10 text-primary opacity-30" />
        <p className="text-sm font-medium">Đăng nhập để dùng kho tài liệu của riêng bạn</p>
      </div>
    )
  }

  const run = async (task: () => Promise<unknown>, ok: string, fail: string) => {
    try {
      await task()
      toast.success(ok)
      refresh()
    } catch (err) {
      toast.error(errorMessage(err, fail))
    }
  }

  const submitFolder = async () => {
    if (!folderForm?.name.trim()) return
    const name = folderForm.name.trim()
    if (folderForm.mode === 'create') {
      await run(
        async () => setFolder((await createLibraryFolder(name)).id),
        'Đã tạo thư mục',
        'Không tạo được thư mục'
      )
    } else if (current) {
      await run(() => renameLibraryFolder(current.id, name), 'Đã đổi tên thư mục', 'Không đổi được tên')
    }
    setFolderForm(null)
  }

  const handleUpload = async (files: File[]) => {
    const docs = files.filter((f) => !f.type.startsWith('image/'))
    if (docs.length < files.length) toast.info('Kho tài liệu chưa nhận ảnh')
    for (const file of docs) {
      setUploading((n) => n + 1)
      try {
        const res = await uploadToLibrary(file, current?.id)
        toast.success(res.duplicateOf ? `Đã tải lên — kho môn học đã có bản giống: ${res.duplicateOf.title}` : `Đã thêm ${file.name} vào kho`)
      } catch (err) {
        toast.error(errorMessage(err, `Không tải được ${file.name}`))
      } finally {
        setUploading((n) => n - 1)
      }
    }
    setScope('saved')
    refresh()
  }

  const rowActions = (item: LibraryItem) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 rounded-full text-muted-foreground" aria-label="Thao tác">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl p-1.5">
        {scope === 'saved' && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className={ITEM}>
              <Folder className="h-4 w-4 shrink-0 text-muted-foreground" /> Chuyển vào thư mục
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52 rounded-xl p-1">
              {[{ id: null as string | null, name: 'Chưa phân thư mục' }, ...folders].map((f) => (
                <DropdownMenuItem
                  key={f.id ?? 'none'}
                  className={ITEM}
                  onClick={() => void run(() => moveLibraryItem(item.document.id, f.id), `Đã chuyển vào “${f.name}”`, 'Không chuyển được')}
                >
                  {item.folderId === f.id ? <Check className="h-3.5 w-3.5 text-primary" /> : <span className="w-3.5" />}
                  <span className="truncate">{f.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {scope === 'saved' && (
          <DropdownMenuItem className={ITEM} onClick={() => void run(() => removeFromLibrary(item.document.id), 'Đã bỏ khỏi kho', 'Không bỏ được')}>
            <X className="h-4 w-4 shrink-0 text-muted-foreground" /> Bỏ khỏi kho
          </DropdownMenuItem>
        )}
        {item.ownedByMe && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className={cn(ITEM, 'text-destructive')}
              onClick={() =>
                window.confirm(`Xóa hẳn “${item.document.title}”? Tài liệu sẽ bị gỡ khỏi mọi bài viết và kho của người khác.`) &&
                void run(() => deleteDocument(item.document.id), 'Đã xóa tài liệu', 'Không xóa được tài liệu')
              }
            >
              <Trash2 className="h-4 w-4 shrink-0" /> Xóa tài liệu
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="space-y-2.5">
      <div className="mx-2 sm:mx-0 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-muted/60 p-0.5 text-xs font-semibold">
            {(
              [
                ['saved', 'Đã lưu'],
                ['mine', 'Tôi đã đăng']
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setScope(id)}
                className={cn('rounded-full px-3 py-1 transition-colors cursor-pointer', scope === id ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground')}
              >
                {label}
              </button>
            ))}
          </div>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => (void handleUpload(Array.from(e.target.files ?? [])), (e.target.value = ''))} />
          <div className="ml-auto flex rounded-full bg-muted/60 p-0.5" role="group" aria-label="Cách xem">
            {(
              [
                ['grid', 'Dạng thẻ', LayoutGrid],
                ['list', 'Dạng danh sách', List]
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => changeView(id)}
                aria-pressed={view === id}
                title={label}
                aria-label={label}
                className={cn('rounded-full p-1.5 transition-colors cursor-pointer', view === id ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground')}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full text-xs" onClick={() => fileRef.current?.click()} disabled={uploading > 0}>
            {uploading > 0 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Tải tệp lên kho
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Tìm trong kho của tôi" className="h-9 rounded-full pl-9 text-sm" />
        </div>

        <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {[
            { id: '', name: 'Tất cả' },
            { id: 'none', name: 'Chưa phân thư mục' },
            ...folders.map((f) => ({ id: f.id, name: `${f.name} · ${f.itemCount}` }))
          ].map((f) => (
            <button
              key={f.id || 'all'}
              type="button"
              onClick={() => setFolder(f.id)}
              className={cn(CHIP, folder === f.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}
            >
              {f.id && f.id !== 'none' && <Folder className="h-3 w-3" />}
              {f.name}
            </button>
          ))}
          <button type="button" onClick={() => setFolderForm({ mode: 'create', name: '' })} className={cn(CHIP, 'border-dashed border-border text-muted-foreground hover:text-foreground')}>
            <FolderPlus className="h-3 w-3" /> Thư mục mới
          </button>
        </div>

        {current && !folderForm && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <button type="button" onClick={() => setFolderForm({ mode: 'rename', name: current.name })} className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-muted cursor-pointer">
              <Pencil className="h-3 w-3" /> Đổi tên
            </button>
            <button
              type="button"
              onClick={() =>
                window.confirm(`Xóa thư mục “${current.name}”? Tài liệu bên trong vẫn giữ trong kho.`) &&
                void run(
                  async () => {
                    await deleteLibraryFolder(current.id)
                    setFolder('')
                  },
                  'Đã xóa thư mục',
                  'Không xóa được thư mục'
                )
              }
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-muted hover:text-destructive cursor-pointer"
            >
              <Trash2 className="h-3 w-3" /> Xóa thư mục
            </button>
          </div>
        )}

        {folderForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submitFolder()
            }}
            className="flex items-center gap-2"
          >
            <Input
              autoFocus
              value={folderForm.name}
              maxLength={80}
              onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
              placeholder={folderForm.mode === 'create' ? 'Tên thư mục, vd. Ôn thi cuối kỳ' : 'Tên mới'}
              className="h-8 rounded-full text-xs"
            />
            <Button type="submit" size="sm" className="h-8 rounded-full text-xs" disabled={!folderForm.name.trim()}>
              {folderForm.mode === 'create' ? 'Tạo' : 'Lưu'}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 rounded-full text-xs" onClick={() => setFolderForm(null)}>
              Hủy
            </Button>
          </form>
        )}
      </div>

      {lib.isPending ? (
        <CardListSkeleton label="Đang tải kho của bạn" />
      ) : lib.items.length === 0 ? (
        <div className="space-y-2 py-16 text-center text-muted-foreground">
          <Library className="mx-auto h-10 w-10 text-primary opacity-30" />
          <p className="text-sm font-medium">{scope === 'saved' ? 'Kho của bạn đang trống' : 'Bạn chưa đăng tài liệu nào'}</p>
          <p className="text-xs">
            {scope === 'saved' ? 'Bấm biểu tượng lưu trên tài liệu ở bài viết, bình luận hoặc kho môn học — hoặc tải tệp riêng lên.' : 'Tài liệu bạn đính kèm khi đăng bài sẽ hiện ở đây.'}
          </p>
        </div>
      ) : (
        view === 'grid' ? (
          <div className="grid grid-cols-2 gap-3 px-2 sm:grid-cols-3 sm:px-0 lg:grid-cols-4">
            {lib.items.map((item) => (
              <DocumentCard
                key={item.document.id}
                document={item.document}
                subtitle={<span className="truncate">{item.ownedByMe ? 'Của tôi' : item.ownerName}</span>}
                privateBadge={item.document.visibility === 'private'}
                actions={rowActions(item)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-1.5 px-2 sm:px-0">
            {lib.items.map((item) => (
              <DocumentRow
                key={item.document.id}
                document={item.document}
                subtitle={<span>{item.ownedByMe ? 'Của tôi' : item.ownerName}</span>}
                privateBadge={item.document.visibility === 'private'}
                actions={rowActions(item)}
              />
            ))}
          </div>
        )
      )}
      <div ref={sentinel} className="flex h-10 items-center justify-center">
        {isFetchingNextPage && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
      </div>
    </div>
  )
}

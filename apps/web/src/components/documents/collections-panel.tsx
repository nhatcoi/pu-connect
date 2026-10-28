'use client'

import React, { useState } from 'react'
import { FolderPlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useCollectionActions, useCollections } from '@/hooks/use-document-community'
import { useAppStore } from '@/store'
import { CollectionCard } from './collection-card'

// Tab "Bộ sưu tập": bộ của mình (tạo mới ngay đầu trang) + bộ công khai của mọi người
export function CollectionsPanel() {
  const user = useAppStore((s) => s.user)
  const mine = useCollections('mine')
  const pub = useCollections('public')
  const { create } = useCollectionActions()
  const [title, setTitle] = useState('')
  const [isPublic, setIsPublic] = useState(true)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    try {
      await create.mutateAsync({ title: title.trim(), visibility: isPublic ? 'public' : 'private' })
      setTitle('')
      toast.success('Đã tạo bộ sưu tập. Mở một tài liệu và bấm “Bộ sưu tập” để thêm vào.')
    } catch {
      // lỗi đã báo qua toast của mutation
    }
  }

  return (
    <div className="space-y-6 px-2 sm:px-0">
      <section className="space-y-2">
        <h2 className="text-[15px] font-bold tracking-tight">Của tôi</h2>
        {user ? (
          <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tên bộ mới, vd. Ôn thi Giải tích" maxLength={120} className="h-9 max-w-xs rounded-full text-sm" />
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Switch checked={isPublic} onCheckedChange={setIsPublic} /> Công khai
            </label>
            <Button type="submit" size="sm" className="h-9 gap-1.5 rounded-full text-xs" disabled={!title.trim() || create.isPending}>
              <FolderPlus className="h-3.5 w-3.5" /> Tạo bộ
            </Button>
          </form>
        ) : (
          <p className="text-xs text-muted-foreground">Đăng nhập để tạo bộ sưu tập riêng.</p>
        )}
        {user && !mine.isPending && mine.items.length === 0 && <p className="py-4 text-xs text-muted-foreground">Bạn chưa có bộ nào. Gom đề thi, slide theo chủ đề để ôn nhanh và chia sẻ cho bạn bè.</p>}
        <Grid items={mine.items} />
      </section>

      <section className="space-y-2">
        <h2 className="text-[15px] font-bold tracking-tight">Khám phá</h2>
        {pub.isPending ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /> : pub.items.length === 0 ? <p className="py-4 text-xs text-muted-foreground">Chưa có bộ sưu tập công khai nào.</p> : <Grid items={pub.items} />}
        {pub.hasNextPage && (
          <div className="text-center">
            <Button variant="outline" size="sm" className="rounded-full text-xs" disabled={pub.isFetchingNextPage} onClick={() => void pub.fetchNextPage()}>
              Xem thêm
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}

function Grid({ items }: { items: ReturnType<typeof useCollections>['items'] }) {
  if (!items.length) return null
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((c) => (
        <CollectionCard key={c.id} collection={c} />
      ))}
    </div>
  )
}

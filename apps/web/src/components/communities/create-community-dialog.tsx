'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useCreateCommunity } from '@/hooks/use-community-manage'
import { errorMessage } from '@/lib/api-client'
import type { CreateCommunityInput } from '@/lib/community-api'

const TYPES: { id: CreateCommunityInput['communityType']; label: string }[] = [
  { id: 'academic', label: 'Học thuật & Đồ án' },
  { id: 'life', label: 'Đời sống & Nhà trọ' },
  { id: 'club', label: 'Câu lạc bộ' }
]

// "Học Lập Trình" → "hoc-lap-trinh" (bỏ dấu tiếng Việt, chỉ giữ a-z 0-9 và gạch ngang)
const slugify = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)

// Tạo cộng đồng: gửi lên chờ admin duyệt, người tạo là chủ sở hữu
export function CreateCommunityDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter()
  const create = useCreateCommunity()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [communityType, setCommunityType] = useState<CreateCommunityInput['communityType']>('academic')
  const [description, setDescription] = useState('')

  const valid = name.trim().length >= 3 && slug.length >= 3 && description.trim().length >= 10

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || create.isPending) return
    try {
      const made = await create.mutateAsync({ name: name.trim(), slug, communityType, description: description.trim() })
      toast.success('Đã gửi cộng đồng, chờ quản trị viên duyệt')
      onOpenChange(false)
      setName('')
      setSlug('')
      setSlugTouched(false)
      setDescription('')
      router.push(`/c/${made.slug}`)
    } catch (err) {
      toast.error(errorMessage(err, 'Không tạo được cộng đồng'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <Users className="h-4 w-4 text-primary" />
            Tạo cộng đồng
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3 text-xs">
          <label className="block space-y-1.5">
            <span className="font-semibold text-foreground">Tên cộng đồng</span>
            <Input
              value={name}
              maxLength={100}
              placeholder="Ví dụ: Lập trình Web Phenikaa"
              onChange={(e) => {
                setName(e.target.value)
                if (!slugTouched) setSlug(slugify(e.target.value))
              }}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="font-semibold text-foreground">Đường dẫn</span>
            <div className="flex items-center gap-1.5 rounded-md border border-input bg-background pl-3 text-muted-foreground focus-within:ring-1 focus-within:ring-ring">
              c/
              <input
                value={slug}
                maxLength={50}
                onChange={(e) => {
                  setSlugTouched(true)
                  setSlug(slugify(e.target.value))
                }}
                className="h-9 min-w-0 flex-1 bg-transparent pr-3 text-foreground outline-none"
              />
            </div>
          </label>
          <label className="block space-y-1.5">
            <span className="font-semibold text-foreground">Loại</span>
            <select
              value={communityType}
              onChange={(e) => setCommunityType(e.target.value as CreateCommunityInput['communityType'])}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              {TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="font-semibold text-foreground">Mô tả</span>
            <Textarea
              value={description}
              maxLength={500}
              rows={3}
              placeholder="Cộng đồng dành cho ai, nói về điều gì…"
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <p className="text-muted-foreground">Cần tài khoản đã xác thực hoặc đủ điểm uy tín. Cộng đồng chỉ hiện công khai sau khi quản trị viên duyệt.</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={!valid || create.isPending}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gửi duyệt'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

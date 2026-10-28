'use client'

import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Crown, ImagePlus, Loader2, Plus, ShieldCheck, Trash2, UserMinus } from 'lucide-react'
import type { Community, CommunityMemberItem, CommunityRule } from '@pu/schemas'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SlidingTabs } from '@/components/navigation/sliding-tabs'
import { useCommunityMembers, useHiddenPosts, useHidePostActions, useMemberActions, useUpdateCommunity } from '@/hooks/use-community-manage'
import { errorMessage, uploadFileToR2 } from '@/lib/api-client'
import { cn } from '@/lib/utils'

type Tab = 'info' | 'members' | 'hidden'
const MAX_RULES = 10

// Hộp quản lý cộng đồng: chủ sở hữu và điều hành viên (chỉ chủ mới đặt / gỡ điều hành viên)
export function ManageCommunityDialog({ community, open, onOpenChange }: { community: Community; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [tab, setTab] = useState<Tab>('info')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-3 p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Quản lý c/{community.slug}
          </DialogTitle>
        </DialogHeader>
        <SlidingTabs<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { id: 'info', label: 'Giới thiệu' },
            { id: 'members', label: 'Thành viên' },
            { id: 'hidden', label: 'Bài đã ẩn' }
          ]}
        />
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {tab === 'info' && <InfoTab community={community} />}
          {tab === 'members' && <MembersTab community={community} />}
          {tab === 'hidden' && <HiddenTab slug={community.slug} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Ảnh đại diện / ảnh bìa: chọn tệp ⇒ tải lên R2 ⇒ lưu URL
function ImagePicker({ label, url, wide, onPick }: { label: string; url: string | null | undefined; wide?: boolean; onPick: (url: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      onPick((await uploadFileToR2(file, 'posts/images')).url)
    } catch (err) {
      toast.error(errorMessage(err, 'Không tải ảnh lên được'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={cn(
          'relative flex items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/40 text-muted-foreground hover:bg-muted cursor-pointer',
          wide ? 'h-24 w-full' : 'h-16 w-16'
        )}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- ảnh cộng đồng từ R2, kích thước động
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ImagePlus className="h-4 w-4" />
        )}
        {url && busy && <Loader2 className="absolute h-4 w-4 animate-spin text-white" />}
      </button>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
    </div>
  )
}

function InfoTab({ community }: { community: Community }) {
  const update = useUpdateCommunity(community.slug)
  const [description, setDescription] = useState(community.description)
  const [rules, setRules] = useState<CommunityRule[]>(community.rules ?? [])
  const [avatarUrl, setAvatarUrl] = useState(community.avatarUrl ?? null)
  const [bannerUrl, setBannerUrl] = useState(community.bannerUrl ?? null)
  useEffect(() => {
    setDescription(community.description)
    setRules(community.rules ?? [])
    setAvatarUrl(community.avatarUrl ?? null)
    setBannerUrl(community.bannerUrl ?? null)
  }, [community])

  const cleanRules = rules.filter((r) => r.title.trim()).map((r) => ({ title: r.title.trim(), desc: r.desc.trim() }))
  const dirty =
    description.trim() !== community.description ||
    avatarUrl !== (community.avatarUrl ?? null) ||
    bannerUrl !== (community.bannerUrl ?? null) ||
    JSON.stringify(cleanRules) !== JSON.stringify(community.rules ?? [])
  const setRule = (i: number, patch: Partial<CommunityRule>) => setRules((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  return (
    <div className="space-y-4 text-xs">
      <div className="flex items-end gap-4">
        <ImagePicker label="Ảnh đại diện" url={avatarUrl} onPick={setAvatarUrl} />
        <div className="min-w-0 flex-1">
          <ImagePicker label="Ảnh bìa" url={bannerUrl} wide onPick={setBannerUrl} />
        </div>
      </div>
      <label className="block space-y-1.5">
        <span className="font-semibold text-foreground">Mô tả</span>
        <Textarea value={description} maxLength={500} rows={3} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-foreground">Nội quy</span>
          {rules.length < MAX_RULES && (
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setRules([...rules, { title: '', desc: '' }])}>
              <Plus className="h-3.5 w-3.5" /> Thêm
            </Button>
          )}
        </div>
        {rules.map((r, i) => (
          <div key={i} className="space-y-1.5 rounded-lg bg-muted/40 p-2.5">
            <div className="flex gap-1.5">
              <Input
                value={r.title}
                maxLength={80}
                placeholder={`Quy tắc ${i + 1}`}
                className="h-8 text-xs"
                onChange={(e) => setRule(i, { title: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Xóa quy tắc"
                onClick={() => setRules(rules.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Textarea
              value={r.desc}
              maxLength={300}
              rows={2}
              placeholder="Giải thích ngắn"
              className="text-xs"
              onChange={(e) => setRule(i, { desc: e.target.value })}
            />
          </div>
        ))}
        {rules.length === 0 && <p className="text-muted-foreground">Chưa có nội quy.</p>}
      </div>
      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={!dirty || description.trim().length < 10 || update.isPending}
          onClick={() => update.mutate({ description: description.trim(), rules: cleanRules, avatarUrl, bannerUrl })}
        >
          {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lưu thay đổi'}
        </Button>
      </div>
    </div>
  )
}

const ROLE_LABEL: Record<CommunityMemberItem['role'], string> = { owner: 'Chủ', moderator: 'Điều hành viên', member: 'Thành viên' }

function MembersTab({ community }: { community: Community }) {
  const [q, setQ] = useState('')
  const [applied, setApplied] = useState('')
  const members = useCommunityMembers(community.slug, applied, true)
  const { setRole, remove } = useMemberActions(community.slug)
  const isOwner = community.userRole === 'owner'

  useEffect(() => {
    const t = setTimeout(() => setApplied(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  const confirmRemove = (m: CommunityMemberItem) => {
    if (window.confirm(`Xóa ${m.displayName} khỏi cộng đồng?`)) remove.mutate(m.userId)
  }

  return (
    <div className="space-y-2 text-xs">
      <Input value={q} placeholder="Tìm thành viên theo tên hoặc @username" className="h-8 text-xs" onChange={(e) => setQ(e.target.value)} />
      {members.isPending ? (
        <p className="py-6 text-center text-muted-foreground">Đang tải…</p>
      ) : members.data?.items.length ? (
        <ul className="divide-y divide-border/70">
          {members.data.items.map((m) => {
            // Chủ: quản được mọi người trừ chủ. Điều hành viên: chỉ thành viên thường.
            const canRemove = m.role !== 'owner' && (isOwner || m.role === 'member')
            return (
              <li key={m.userId} className="flex items-center gap-2.5 py-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={m.avatarUrl ?? undefined} alt="" />
                  <AvatarFallback>{m.displayName.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate font-semibold text-foreground">
                    {m.displayName}
                    {m.role === 'owner' && <Crown className="h-3 w-3 text-amber-500" aria-label="Chủ cộng đồng" />}
                  </p>
                  <p className="truncate text-muted-foreground">
                    @{m.username} · {ROLE_LABEL[m.role]}
                  </p>
                </div>
                {isOwner && m.role !== 'owner' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-full px-2.5 text-[11px]"
                    disabled={setRole.isPending}
                    onClick={() => setRole.mutate({ userId: m.userId, role: m.role === 'moderator' ? 'member' : 'moderator' })}
                  >
                    {m.role === 'moderator' ? 'Gỡ điều hành' : 'Đặt điều hành'}
                  </Button>
                )}
                {canRemove && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    aria-label={`Xóa ${m.displayName}`}
                    disabled={remove.isPending}
                    onClick={() => confirmRemove(m)}
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="py-6 text-center text-muted-foreground">Không có thành viên phù hợp.</p>
      )}
      {members.data && <p className="pt-1 text-muted-foreground">{members.data.total} thành viên</p>}
    </div>
  )
}

function HiddenTab({ slug }: { slug: string }) {
  const hidden = useHiddenPosts(slug, true)
  const { unhide } = useHidePostActions(slug)
  if (hidden.isPending) return <p className="py-6 text-center text-xs text-muted-foreground">Đang tải…</p>
  if (!hidden.data?.length) return <p className="py-6 text-center text-xs text-muted-foreground">Chưa có bài nào bị ẩn.</p>
  return (
    <ul className="space-y-2 text-xs">
      {hidden.data.map((p) => (
        <li key={p.id} className="space-y-1 rounded-lg bg-muted/40 p-2.5">
          <p className="font-semibold text-foreground">{p.title || p.excerpt.slice(0, 80)}</p>
          <p className="line-clamp-2 text-muted-foreground">{p.excerpt}</p>
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="truncate text-muted-foreground">
              {p.authorName}
              {p.hiddenReason ? ` · ${p.hiddenReason}` : ''}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 shrink-0 rounded-full px-3 text-[11px]"
              disabled={unhide.isPending}
              onClick={() => unhide.mutate(p.id)}
            >
              Khôi phục
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}

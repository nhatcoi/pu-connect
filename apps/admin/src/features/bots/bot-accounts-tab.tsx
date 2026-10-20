import React, { useState } from 'react'
import { Bot, Pencil, Play, Plus, Settings2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { AdminBotAccount, AdminBotAccountInput, AdminBotOverview, BotProfile } from '@pu/schemas'
import { adminApi } from '@/lib/api'
import { Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, Table, TBody, Td, Th, THead, Tr } from '@/components/ui'
import { BotAccountDialog } from './bot-account-dialog'
import type { BotActionPreset } from './bot-action-dialog'
import { BotProfileDialog } from './bot-profile-dialog'
import { useBotMutation } from './use-bots'

function permissions(p: BotProfile): string[] {
  return [p.canPost && 'đăng bài', p.canComment && 'bình luận', p.canLike && 'thả tim'].filter(Boolean) as string[]
}

// CRUD tài khoản bot + quyền/chủ đề/hạn mức + giao việc
export function BotAccountsTab({ data, onAct }: { data: AdminBotOverview; onAct: (preset: BotActionPreset) => void }) {
  const [profileOf, setProfileOf] = useState<AdminBotAccount | null>(null)
  const [account, setAccount] = useState<{ bot: AdminBotAccount | null } | null>(null)
  const [removing, setRemoving] = useState<AdminBotAccount | null>(null)
  const topicsLabel = Object.fromEntries(data.topics.map((t) => [t.slug, t.label]))

  const saveProfile = useBotMutation(
    (v: { username: string; draft: Partial<BotProfile> }) => adminApi.patch<AdminBotOverview>(`/admin/bots/profiles/${v.username}`, v.draft),
    () => {
      setProfileOf(null)
      toast.success('Đã lưu cấu hình bot')
    }
  )
  const saveAccount = useBotMutation(
    (v: AdminBotAccountInput) => (account?.bot ? adminApi.patch<AdminBotOverview>(`/admin/bots/accounts/${account.bot.username}`, { displayName: v.displayName, role: v.role, faculty: v.faculty, bio: v.bio, tone: v.tone, major: v.major, soul: v.soul }) : adminApi.post<AdminBotOverview>('/admin/bots/accounts', v)),
    () => {
      toast.success(account?.bot ? 'Đã lưu hồ sơ bot' : 'Đã tạo bot, daemon sẽ đăng nhập trong ≤ 30 giây')
      setAccount(null)
    }
  )
  const remove = useBotMutation(
    (b: AdminBotAccount) => adminApi.delete<AdminBotOverview>(`/admin/bots/accounts/${b.username}`),
    () => {
      toast.success('Đã xóa bot')
      setRemoving(null)
    }
  )

  return (
    <>
      <Card>
        <CardHeader
          title={`Tài khoản bot (${data.bots.length})`}
          description="Tạo, sửa, xóa bot; viết soul; cấp quyền/chủ đề/hạn mức; giao việc. Bot mới mặc định mọi quyền tắt."
          action={
            <Button variant="primary" onClick={() => setAccount({ bot: null })}>
              <Plus /> Tạo bot
            </Button>
          }
        />
        {data.bots.length === 0 ? (
          <EmptyState icon={Bot} title="Chưa có bot" description="Bấm Tạo bot để thêm tài khoản bot đầu tiên." />
        ) : (
          <Table className="rounded-none border-x-0 border-b-0">
            <THead>
              <Th>Bot</Th>
              <Th>Được phép</Th>
              <Th className="hidden lg:table-cell">Chủ đề</Th>
              <Th className="hidden text-right sm:table-cell">Hôm nay (bài/bl/tim)</Th>
              <Th className="text-right"> </Th>
            </THead>
            <TBody>
              {data.bots.map((b) => {
                const perms = permissions(b.profile)
                return (
                  <Tr key={b.id}>
                    <Td>
                      <a href={`#/users?user=${b.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                        {b.displayName}
                      </a>
                      <span className="ml-1.5 text-xs text-muted-foreground">@{b.username}</span>
                      {!b.profile.enabled && (
                        <Badge tone="danger" className="ml-2">
                          Tắt
                        </Badge>
                      )}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {perms.length ? perms.map((p) => <Badge key={p}>{p}</Badge>) : <span className="text-xs text-muted-foreground">Chưa cấp quyền</span>}
                        {b.profile.interactHumans && <Badge tone="warning">người thật</Badge>}
                      </div>
                    </Td>
                    <Td className="hidden text-xs text-muted-foreground lg:table-cell">{b.profile.topics.map((t) => topicsLabel[t] ?? t).join(' · ') || '—'}</Td>
                    <Td className="hidden text-right tabular-nums sm:table-cell">
                      {b.usedToday.post}/{b.profile.maxPostsPerDay} · {b.usedToday.comment}/{b.profile.maxCommentsPerDay} · {b.usedToday.like}/{b.profile.maxLikesPerDay}
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="primary" onClick={() => onAct({ bot: b.username })} title="Giao việc">
                          <Play /> Giao việc
                        </Button>
                        <Button size="sm" onClick={() => setProfileOf(b)}>
                          <Settings2 /> Cấu hình
                        </Button>
                        <Button size="icon-sm" variant="ghost" onClick={() => setAccount({ bot: b })} title="Sửa hồ sơ">
                          <Pencil />
                        </Button>
                        <Button size="icon-sm" variant="danger-soft" onClick={() => setRemoving(b)} title="Xóa bot">
                          <Trash2 />
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                )
              })}
            </TBody>
          </Table>
        )}
      </Card>

      <BotAccountDialog open={!!account} bot={account?.bot ?? null} saving={saveAccount.isPending} onClose={() => setAccount(null)} onSave={(v) => saveAccount.mutate(v)} />
      <BotProfileDialog bot={profileOf} topics={data.topics} saving={saveProfile.isPending} onClose={() => setProfileOf(null)} onSave={(username, draft) => saveProfile.mutate({ username, draft })} />
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Xóa hẳn @${removing?.username ?? ''}?`}
        description="Xóa tài khoản kèm toàn bộ bài viết, bình luận, lượt thích của bot này (không khôi phục được). Muốn chỉ dừng bot, dùng Cấu hình → tắt “Bot đang hoạt động”."
        confirmLabel="Xóa hẳn"
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </>
  )
}

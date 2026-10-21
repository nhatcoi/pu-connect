import React, { useState } from 'react'
import { Bot, Pencil, Plus, Settings2, Trash2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import type { AdminBotAccount, AdminBotAccountInput, AdminBotOverview, BotProfile } from '@pu/schemas'
import { adminApi } from '@/lib/api'
import { Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, Table, TBody, Td, Th, THead, Tr } from '@/components/ui'
import { BotAccountDialog } from './bot-account-dialog'
import type { BotActionPreset } from './bot-action-dialog'
import { BotProfileDialog } from './bot-profile-dialog'
import { useBotMutation } from './use-bots'

const ROLE_LABEL: Record<string, string> = {
  student: 'Sinh viên',
  lecturer: 'Giảng viên',
  ta: 'Trợ giảng'
}

export function BotAccountsTab({
  data,
  onAct
}: {
  data: AdminBotOverview
  onAct: (preset: BotActionPreset) => void
}) {
  const [profileOf, setProfileOf] = useState<AdminBotAccount | null>(null)
  const [account, setAccount] = useState<{ bot: AdminBotAccount | null } | null>(null)
  const [removing, setRemoving] = useState<AdminBotAccount | null>(null)

  const saveProfile = useBotMutation(
    (v: { username: string; draft: Partial<BotProfile> }) =>
      adminApi.patch<AdminBotOverview>(`/admin/bots/profiles/${v.username}`, v.draft),
    () => {
      setProfileOf(null)
      toast.success('Đã lưu cấu hình bot')
    }
  )

  const toggleBotStatus = (b: AdminBotAccount) => {
    saveProfile.mutate({
      username: b.username,
      draft: { enabled: !b.profile.enabled }
    })
  }

  const saveAccount = useBotMutation(
    (v: AdminBotAccountInput) =>
      account?.bot
        ? adminApi.patch<AdminBotOverview>(`/admin/bots/accounts/${account.bot.username}`, {
            displayName: v.displayName,
            role: v.role,
            faculty: v.faculty,
            bio: v.bio,
            tone: v.tone,
            major: v.major,
            soul: v.soul
          })
        : adminApi.post<AdminBotOverview>('/admin/bots/accounts', v),
    () => {
      toast.success(account?.bot ? 'Đã lưu thông tin bot' : 'Đã khởi tạo Bot thành công, sẵn sàng nhận lệnh!')
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
          title={`Danh sách Bot (${data.bots.length})`}
          action={
            <Button variant="primary" onClick={() => setAccount({ bot: null })}>
              <Plus /> Khởi tạo Bot
            </Button>
          }
        />

        {data.bots.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="Chưa có bot nào"
          />
        ) : (
          <Table className="rounded-none border-x-0 border-b-0">
            <THead>
              <Th>Bot & Vai trò</Th>
              <Th className="hidden md:table-cell">Linh hồn / Persona (Soul)</Th>
              <Th>Trạng thái</Th>
              <Th className="hidden text-right lg:table-cell">Hôm nay (bài/bl/tim)</Th>
              <Th className="text-right">Thao tác</Th>
            </THead>
            <TBody>
              {data.bots.map((b) => {
                return (
                  <Tr key={b.id}>
                    <Td>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <span>{b.displayName}</span>
                          <span className="text-xs text-muted-foreground">@{b.username}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Badge tone="neutral" className="text-[11px] px-1.5 py-0">
                            {ROLE_LABEL[b.role] || b.role}
                          </Badge>
                          {b.faculty && <span>{b.faculty}</span>}
                          {b.major && <span>· {b.major}</span>}
                        </div>
                      </div>
                    </Td>

                    <Td className="hidden max-w-xs md:table-cell">
                      {b.soul ? (
                        <p className="line-clamp-2 text-xs italic text-muted-foreground" title={b.soul}>
                          "{b.soul}"
                        </p>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">— Chưa viết soul —</span>
                      )}
                    </Td>

                    <Td>
                      <button
                        type="button"
                        onClick={() => toggleBotStatus(b)}
                        className="cursor-pointer transition-transform active:scale-95"
                        title="Bấm để bật / tắt bot"
                      >
                        <Badge tone={b.profile.enabled ? 'success' : 'neutral'} dot>
                          {b.profile.enabled ? 'Hoạt động' : 'Tạm dừng'}
                        </Badge>
                      </button>
                    </Td>

                    <Td className="hidden text-right tabular-nums text-xs text-muted-foreground lg:table-cell">
                      {b.usedToday.post}/{b.profile.maxPostsPerDay} bài · {b.usedToday.comment}/{b.profile.maxCommentsPerDay} bl · {b.usedToday.like}/{b.profile.maxLikesPerDay} tim
                    </Td>

                    <Td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => onAct({ bot: b.username })}
                          title="Giao việc cho bot này"
                        >
                          <Zap className="size-3.5" /> Điều hành
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="outline"
                          onClick={() => setAccount({ bot: b })}
                          title="Sửa hồ sơ & Soul"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setProfileOf(b)}
                          title="Cấu hình hạn mức & quyền"
                        >
                          <Settings2 className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="danger-soft"
                          onClick={() => setRemoving(b)}
                          title="Xóa bot"
                        >
                          <Trash2 className="size-3.5" />
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

      <BotAccountDialog
        open={!!account}
        bot={account?.bot ?? null}
        saving={saveAccount.isPending}
        onClose={() => setAccount(null)}
        onSave={(v) => saveAccount.mutate(v)}
      />

      <BotProfileDialog
        bot={profileOf}
        topics={data.topics}
        saving={saveProfile.isPending}
        onClose={() => setProfileOf(null)}
        onSave={(username, draft) => saveProfile.mutate({ username, draft })}
      />

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Xóa bot @${removing?.username ?? ''}?`}
        description="Hành động này không thể hoàn tác."
        confirmLabel="Xóa bot"
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </>
  )
}

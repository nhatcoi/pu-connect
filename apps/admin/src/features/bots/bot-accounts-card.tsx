import React, { useState } from 'react'
import { Bot, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { AdminBotAccount, AdminBotAccountInput, AdminBotOverview } from '@pu/schemas'
import { adminApi } from '@/lib/api'
import { Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, Table, TBody, Td, Th, THead, Tr } from '@/components/ui'
import { BotAccountDialog } from './bot-account-dialog'
import { useBotMutation } from './use-bots'

const ROLE_LABEL: Record<string, string> = { student: 'Sinh viên', lecturer: 'Giảng viên', ta: 'Trợ giảng' }

export function BotAccountsCard({ data }: { data: AdminBotOverview }) {
  const [account, setAccount] = useState<{ bot: AdminBotAccount | null } | null>(null)
  const [removing, setRemoving] = useState<AdminBotAccount | null>(null)

  const save = useBotMutation(
    (v: AdminBotAccountInput) => (account?.bot ? adminApi.patch<AdminBotOverview>(`/admin/bots/accounts/${account.bot.username}`, { ...v, username: undefined }) : adminApi.post<AdminBotOverview>('/admin/bots/accounts', v)),
    () => {
      toast.success(account?.bot ? 'Đã lưu bot' : 'Đã tạo bot')
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
          title={`Bot (${data.bots.length})`}
          action={
            <Button onClick={() => setAccount({ bot: null })}>
              <Plus /> Tạo bot
            </Button>
          }
        />
        {data.bots.length === 0 ? (
          <EmptyState icon={Bot} title="Chưa có bot nào" />
        ) : (
          <Table className="rounded-none border-x-0 border-b-0">
            <THead>
              <Th>Bot</Th>
              <Th className="hidden md:table-cell">Soul</Th>
              <Th className="hidden text-right sm:table-cell">Job · Bài</Th>
              <Th className="text-right">Thao tác</Th>
            </THead>
            <TBody>
              {data.bots.map((b) => (
                <Tr key={b.id}>
                  <Td>
                    <p className="font-medium text-foreground">
                      {b.displayName} <span className="text-xs font-normal text-muted-foreground">@{b.username}</span>
                    </p>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Badge tone="neutral">{ROLE_LABEL[b.role] ?? b.role}</Badge>
                      {b.faculty && <span>{b.faculty}</span>}
                    </div>
                  </Td>
                  <Td className="hidden max-w-xs md:table-cell">
                    {b.soul ? <p className="line-clamp-2 text-xs italic text-muted-foreground" title={b.soul}>{b.soul}</p> : <span className="text-xs text-muted-foreground/60">Chưa viết soul</span>}
                  </Td>
                  <Td className="hidden text-right text-xs tabular-nums text-muted-foreground sm:table-cell">
                    {b.jobsCount} job · {b.postsCount} bài
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button size="icon-sm" variant="outline" title="Sửa bot" onClick={() => setAccount({ bot: b })}>
                        <Pencil />
                      </Button>
                      <Button size="icon-sm" variant="danger-soft" title="Xóa bot" onClick={() => setRemoving(b)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <BotAccountDialog open={!!account} bot={account?.bot ?? null} saving={save.isPending} onClose={() => setAccount(null)} onSave={(v) => save.mutate(v)} />
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Xóa bot @${removing?.username ?? ''}?`}
        description="Xóa luôn job, bài, bình luận và tim của bot này. Không thể hoàn tác."
        confirmLabel="Xóa bot"
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </>
  )
}

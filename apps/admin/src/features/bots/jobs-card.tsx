import React, { useState } from 'react'
import { ClipboardList, Eye, Pause, Play, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { AdminBotJob, AdminBotJobPatch, AdminBotOverview } from '@pu/schemas'
import { adminApi } from '@/lib/api'
import { Badge, Button, Card, CardHeader, Checkbox, ConfirmDialog, EmptyState, Table, TBody, Td, Th, THead, Tr } from '@/components/ui'
import { JobCreateDialog } from './job-create-dialog'
import { JobDetailDialog } from './job-detail-dialog'
import { useBotMutation } from './use-bots'

export function JobsCard({ data }: { data: AdminBotOverview }) {
  const [creating, setCreating] = useState(false)
  const [viewing, setViewing] = useState<string | null>(null)
  const [removing, setRemoving] = useState<AdminBotJob | null>(null)

  const patch = useBotMutation((v: { id: string; body: AdminBotJobPatch }) => adminApi.patch<AdminBotOverview>(`/admin/bots/jobs/${v.id}`, v.body))
  const remove = useBotMutation(
    (j: AdminBotJob) => adminApi.delete<AdminBotOverview>(`/admin/bots/jobs/${j.id}`),
    () => {
      toast.success('Đã xóa job')
      setRemoving(null)
    }
  )

  return (
    <>
      <Card>
        <CardHeader
          title={`Job đăng bài (${data.jobs.length})`}
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus /> Tạo job
            </Button>
          }
        />
        {data.jobs.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Chưa có job nào" />
        ) : (
          <Table className="rounded-none border-x-0 border-b-0">
            <THead>
              <Th>Job</Th>
              <Th>Tiến độ</Th>
              <Th className="hidden md:table-cell">Bot tự động</Th>
              <Th>Trạng thái</Th>
              <Th className="text-right">Thao tác</Th>
            </THead>
            <TBody>
              {data.jobs.map((j) => {
                const total = j.counts.pending + j.counts.posting + j.counts.posted + j.counts.failed
                return (
                  <Tr key={j.id}>
                    <Td>
                      <p className="font-medium text-foreground">{j.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {j.botName} · @{j.botUsername}
                      </p>
                    </Td>
                    <Td className="text-xs">
                      <span className="tabular-nums">
                        {j.counts.posted}/{total} đã đăng
                      </span>
                      {j.counts.failed > 0 && <Badge tone="danger" className="ml-1.5">{j.counts.failed} lỗi</Badge>}
                      {j.nextAt && <p className="text-muted-foreground">Kế tiếp {new Date(j.nextAt).toLocaleString('vi-VN')}</p>}
                    </Td>
                    <Td className="hidden md:table-cell">
                      <div className="flex flex-col gap-1 text-xs">
                        <label className="flex cursor-pointer items-center gap-1.5">
                          <Checkbox checked={j.autoReply} onChange={(v) => patch.mutate({ id: j.id, body: { autoReply: v } })} label="Tự trả lời" /> Trả lời ({j.replies})
                        </label>
                        <label className="flex cursor-pointer items-center gap-1.5">
                          <Checkbox checked={j.autoReact} onChange={(v) => patch.mutate({ id: j.id, body: { autoReact: v } })} label="Tự thả tim" /> Thả tim ({j.reactions})
                        </label>
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={j.status === 'active' ? 'success' : 'neutral'} dot>
                        {j.status === 'active' ? 'Đang chạy' : 'Tạm dừng'}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="icon-sm" variant="outline" title="Xem bài" onClick={() => setViewing(j.id)}>
                          <Eye />
                        </Button>
                        <Button size="icon-sm" variant="outline" title={j.status === 'active' ? 'Tạm dừng' : 'Chạy tiếp'} onClick={() => patch.mutate({ id: j.id, body: { status: j.status === 'active' ? 'paused' : 'active' } })}>
                          {j.status === 'active' ? <Pause /> : <Play />}
                        </Button>
                        <Button size="icon-sm" variant="danger-soft" title="Xóa job" onClick={() => setRemoving(j)}>
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

      <JobCreateDialog open={creating} bots={data.bots} onClose={() => setCreating(false)} />
      <JobDetailDialog jobId={viewing} onClose={() => setViewing(null)} />
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Xóa job "${removing?.name ?? ''}"?`}
        description="Bài chưa đăng sẽ bị hủy. Bài đã đăng vẫn ở lại bảng tin."
        confirmLabel="Xóa job"
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </>
  )
}

import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, RotateCw, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { AdminBotJobDetail, BotJobPostStatus } from '@pu/schemas'
import { adminApi } from '@/lib/api'
import { Badge, Button, Dialog, LoadingRows, Table, TBody, Td, Th, THead, Tr } from '@/components/ui'
import { BOTS_KEY } from './use-bots'

const TONE = { pending: 'neutral', posting: 'primary', posted: 'success', failed: 'danger' } as const
const LABEL: Record<BotJobPostStatus, string> = { pending: 'Chờ', posting: 'Đang đăng', posted: 'Đã đăng', failed: 'Lỗi' }
const WEB = 'https://puc.vnhat.dev'

// Chi tiết job: từng bài, giờ đăng, lỗi; đăng ngay / thử lại / bỏ bài
export function JobDetailDialog({ jobId, onClose }: { jobId: string | null; onClose: () => void }) {
  const qc = useQueryClient()
  const key = ['admin', 'bots', 'job', jobId]
  const detail = useQuery({ queryKey: key, queryFn: () => adminApi.get<AdminBotJobDetail>(`/admin/bots/jobs/${jobId}`), enabled: !!jobId, refetchInterval: 10_000 })
  const done = (res: AdminBotJobDetail) => {
    qc.setQueryData(key, res)
    void qc.invalidateQueries({ queryKey: BOTS_KEY })
  }
  const publish = useMutation({
    mutationFn: (id: string) => adminApi.post<AdminBotJobDetail>(`/admin/bots/jobs/${jobId}/posts/${id}/publish`),
    onSuccess: done,
    onError: (e: Error) => toast.error(e.message)
  })
  const remove = useMutation({
    mutationFn: (id: string) => adminApi.delete<AdminBotJobDetail>(`/admin/bots/jobs/${jobId}/posts/${id}`),
    onSuccess: done,
    onError: (e: Error) => toast.error(e.message)
  })
  const d = detail.data

  return (
    <Dialog open={!!jobId} onClose={onClose} size="lg" title={d ? `${d.name} · @${d.botUsername}` : 'Job'}>
      {!d ? (
        <LoadingRows rows={4} />
      ) : (
        <Table>
          <THead>
            <Th>Bài</Th>
            <Th>Trạng thái</Th>
            <Th className="hidden sm:table-cell">Giờ đăng</Th>
            <Th className="text-right">Thao tác</Th>
          </THead>
          <TBody>
            {d.posts.map((p) => (
              <Tr key={p.id}>
                <Td className="max-w-[18rem]">
                  <p className="truncate font-medium text-foreground">{p.title || p.content.slice(0, 80)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.postType}
                    {p.mediaUrls.length > 0 && ` · ${p.mediaUrls.length} ảnh`}
                    {p.tags.length > 0 && ` · #${p.tags.join(' #')}`}
                  </p>
                </Td>
                <Td>
                  <Badge tone={TONE[p.status]}>{LABEL[p.status]}</Badge>
                  {p.error && <p className="mt-0.5 max-w-[14rem] text-xs text-red-500">{p.error}</p>}
                </Td>
                <Td className="hidden whitespace-nowrap text-xs text-muted-foreground sm:table-cell">{new Date(p.postedAt ?? p.scheduledAt).toLocaleString('vi-VN')}</Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1.5">
                    {p.postId && (
                      <a href={`${WEB}/post/${p.postId}`} target="_blank" rel="noreferrer" title="Mở bài">
                        <Button size="icon-sm" variant="outline">
                          <ExternalLink />
                        </Button>
                      </a>
                    )}
                    {(p.status === 'pending' || p.status === 'failed') && (
                      <>
                        <Button size="icon-sm" variant="outline" title={p.status === 'failed' ? 'Thử lại' : 'Đăng ngay'} loading={publish.isPending && publish.variables === p.id} onClick={() => publish.mutate(p.id)}>
                          {p.status === 'failed' ? <RotateCw /> : <Send />}
                        </Button>
                        <Button size="icon-sm" variant="danger-soft" title="Bỏ bài" loading={remove.isPending && remove.variables === p.id} onClick={() => remove.mutate(p.id)}>
                          <Trash2 />
                        </Button>
                      </>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </Dialog>
  )
}

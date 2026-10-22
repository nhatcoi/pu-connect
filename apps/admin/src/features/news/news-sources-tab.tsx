import React, { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { NewsCategory, NewsOverview, NewsSource, NewsSourceInput } from '@pu/schemas'
import { formatRelativeTime } from '@/lib/api'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  Dialog,
  Field,
  Input,
  Select,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr
} from '@/components/ui'
import { Checkbox } from '@/components/ui/data'
import { useCreateSource, useDeleteSource, useUpdateSource } from './use-news'

const CATEGORY_MAP: Record<NewsCategory, string> = {
  ai: 'AI & Khoa học dữ liệu',
  tech: 'Công nghệ',
  security: 'An ninh mạng',
  robotics: 'Robotics',
  general: 'Chung'
}

export function NewsSourcesTab({ data }: { data: NewsOverview }) {
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<NewsSource | null>(null)

  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState<NewsCategory>('ai')

  const create = useCreateSource()
  const update = useUpdateSource()
  const del = useDeleteSource()

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !url.trim()) return

    create.mutate(
      { name: name.trim(), url: url.trim(), category, enabled: true },
      {
        onSuccess: () => {
          toast.success('Đã thêm nguồn tin mới')
          setName('')
          setUrl('')
          setAdding(false)
        },
        onError: (err: any) => toast.error(err.message || 'Lỗi khi thêm nguồn')
      }
    )
  }

  const toggleEnabled = (src: NewsSource) => {
    update.mutate(
      { id: src.id, input: { enabled: !src.enabled } },
      {
        onSuccess: () => toast.success(`Đã ${src.enabled ? 'tạm dừng' : 'kích hoạt'} nguồn ${src.name}`)
      }
    )
  }

  return (
    <>
      <Card>
        <CardHeader
          title={`Nguồn thu thập tin tức (${data.sources.length})`}
          action={
            <Button variant="primary" onClick={() => setAdding(true)}>
              <Plus /> Thêm nguồn RSS
            </Button>
          }
        />

        <Table className="rounded-none border-x-0 border-b-0">
          <THead>
            <Th>Nguồn tin & RSS</Th>
            <Th>Chuyên mục</Th>
            <Th>Trạng thái</Th>
            <Th className="text-right">Số bài đã lấy</Th>
            <Th className="text-right">Lần quét gần nhất</Th>
            <Th className="text-right">Thao tác</Th>
          </THead>
          <TBody>
            {data.sources.map((s) => (
              <Tr key={s.id}>
                <Td>
                  <div>
                    <p className="font-semibold text-foreground">{s.name}</p>
                    <p className="max-w-md truncate text-xs font-mono text-muted-foreground">{s.url}</p>
                  </div>
                </Td>
                <Td>
                  <Badge tone="neutral">{CATEGORY_MAP[s.category] || s.category}</Badge>
                </Td>
                <Td>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={s.enabled} onChange={() => toggleEnabled(s)} />
                    <span className="text-xs">{s.enabled ? 'Đang bật' : 'Tạm dừng'}</span>
                  </label>
                </Td>
                <Td className="text-right font-mono text-xs">{s.itemsCount}</Td>
                <Td className="text-right text-xs text-muted-foreground">
                  {s.lastRunAt ? formatRelativeTime(s.lastRunAt) : 'Chưa quét'}
                </Td>
                <Td className="text-right">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setRemoving(s)}
                    className="text-muted-foreground hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Card>

      {/* Modal Thêm nguồn */}
      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title="Thêm nguồn tin RSS"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Hủy
            </Button>
            <Button
              variant="primary"
              loading={create.isPending}
              disabled={!name.trim() || !url.trim()}
              onClick={handleCreate}
            >
              Lưu nguồn
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Field label="Tên nguồn">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="vd: Google News AI, TechCrunch..."
              required
            />
          </Field>
          <Field label="URL RSS Feed">
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/rss.xml"
              required
            />
          </Field>
          <Field label="Chuyên mục">
            <Select value={category} onChange={(e) => setCategory(e.target.value as NewsCategory)}>
              {Object.entries(CATEGORY_MAP).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </form>
      </Dialog>

      {/* Xóa nguồn */}
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Xóa nguồn "${removing?.name ?? ''}"?`}
        description="Nguồn này sẽ bị gỡ khỏi danh sách thu thập tự động."
        confirmLabel="Xóa nguồn"
        loading={del.isPending}
        onConfirm={() => removing && del.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
      />
    </>
  )
}

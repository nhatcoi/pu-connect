import React, { useMemo, useState } from 'react'
import type { AdminAiProvider } from '@pu/schemas'
import { Badge, Button, Dialog, ErrorState, Input, LoadingRows, SearchInput } from '@/components/ui'
import { useDiscovery, type LlmActions } from './use-llm'

// Dò model của provider ⇒ chọn model + đặt tên hiển thị ⇒ thêm vào danh mục (gắn provider này)
export function DiscoverDialog({ provider, onClose, actions }: { provider: AdminAiProvider | null; onClose: () => void; actions: LlmActions }) {
  const { data, isPending, isError, error } = useDiscovery(provider?.id ?? null)
  const [picked, setPicked] = useState<Record<string, string>>({}) // tên upstream → tên hiển thị
  const [q, setQ] = useState('')
  const shown = useMemo(() => (data?.models ?? []).filter((m) => m.name.toLowerCase().includes(q.trim().toLowerCase())), [data, q])
  const names = Object.keys(picked)

  const close = () => {
    setPicked({})
    setQ('')
    onClose()
  }
  const toggle = (name: string) =>
    setPicked((p) => {
      const { [name]: had, ...rest } = p
      return had === undefined ? { ...p, [name]: name.slice(0, 40) } : rest
    })

  return (
    <Dialog
      open={!!provider}
      onClose={close}
      title={provider ? `Model của ${provider.name}` : ''}
      footer={
        <>
          <Button onClick={close}>Đóng</Button>
          <Button
            variant="primary"
            disabled={!names.length}
            loading={actions.createModels.isPending}
            onClick={() =>
              provider &&
              actions.createModels.mutate(
                names.map((name) => ({ label: picked[name].trim() || name.slice(0, 40), providerId: provider.id, upstreamModel: name, visible: false })),
                { onSuccess: close }
              )
            }
          >
            Thêm {names.length || ''} model
          </Button>
        </>
      }
    >
      {isPending ? (
        <LoadingRows rows={4} />
      ) : isError ? (
        <ErrorState message={(error as Error).message} />
      ) : !data.ok ? (
        <ErrorState message={data.error ?? 'Không lấy được danh sách model'} />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {data.models.length} model · {data.latencyMs}ms. Model thêm vào ở trạng thái ẩn khỏi menu, bật hiển thị sau khi chỉnh xong.
          </p>
          <SearchInput value={q} onChange={setQ} placeholder="Lọc model" />
          <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {shown.map((m) => (
              <li key={m.name} className="flex items-center gap-2 px-3 py-2">
                <input type="checkbox" disabled={m.imported} checked={m.name in picked} onChange={() => toggle(m.name)} aria-label={m.name} />
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{m.name}</span>
                {m.imported ? (
                  <Badge>Đã thêm</Badge>
                ) : (
                  m.name in picked && (
                    <Input
                      value={picked[m.name]}
                      maxLength={40}
                      className="h-8 w-44"
                      placeholder="Tên hiển thị"
                      onChange={(e) => setPicked({ ...picked, [m.name]: e.target.value })}
                    />
                  )
                )}
              </li>
            ))}
            {!shown.length && <li className="px-3 py-4 text-center text-xs text-muted-foreground">Không có model</li>}
          </ul>
        </div>
      )}
    </Dialog>
  )
}

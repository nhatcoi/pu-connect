import React, { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import { toast } from 'sonner'
import type { AdminBotAccount, AdminBotJobInput, BotImportField, BotImportMapping, BotImportResult, BotImportRowStatus } from '@pu/schemas'
import { adminApi } from '@/lib/api'
import { Badge, Button, Checkbox, Dialog, Field, Input, Select, Table, TBody, Td, Th, THead, Tr } from '@/components/ui'
import { BOTS_KEY } from './use-bots'
import { buildRows, COLUMNS, downloadJsonTemplate, downloadXlsxTemplate, guessMapping, readSheetFile, type Sheet } from './job-sheet'

const TONE: Record<BotImportRowStatus, 'success' | 'warning' | 'danger'> = { ok: 'success', duplicate: 'warning', invalid: 'danger' }
const LABEL: Record<BotImportRowStatus, string> = { ok: 'Hợp lệ', duplicate: 'Trùng', invalid: 'Lỗi' }

// Tạo job: chọn bot, tải file bài đã sưu tầm (xlsx/csv/json), kiểm tra từng dòng rồi tạo lịch đăng
export function JobCreateDialog({ open, bots, onClose }: { open: boolean; bots: AdminBotAccount[]; onClose: () => void }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [bot, setBot] = useState('')
  const [autoReply, setAutoReply] = useState(true)
  const [autoReact, setAutoReact] = useState(true)
  const [spacing, setSpacing] = useState(30)
  const [sheet, setSheet] = useState<(Sheet & { mapping: BotImportMapping }) | null>(null)
  const [result, setResult] = useState<BotImportResult | null>(null)

  const run = useMutation({
    mutationFn: (v: AdminBotJobInput) => adminApi.post<BotImportResult>('/admin/bots/jobs', v),
    onSuccess: (res) => {
      setResult(res)
      if (!res.dryRun) {
        toast.success(`Đã tạo job: ${res.summary.ok} bài (${res.summary.duplicate} trùng, ${res.summary.invalid} lỗi)`)
        void qc.invalidateQueries({ queryKey: BOTS_KEY })
        close()
      }
    },
    onError: (e: Error) => toast.error(e.message)
  })

  const rows = sheet ? buildRows(sheet, sheet.mapping) : []
  const selectedBot = bot || bots[0]?.username || ''
  const submit = (dryRun: boolean, s = sheet) =>
    s && run.mutate({ name: name.trim() || s.name.replace(/\.[^.]+$/, ''), bot: selectedBot, autoReply, autoReact, rows: buildRows(s, s.mapping), dryRun, spacingMinutes: spacing })

  const onFile = async (file: File) => {
    try {
      const raw = await readSheetFile(file)
      const next = { ...raw, mapping: guessMapping(raw.headers) }
      setSheet(next)
      setResult(null)
      if (next.mapping.content && selectedBot) submit(true, next)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không đọc được file')
    }
  }
  const setMap = (field: BotImportField, header: string) => {
    if (!sheet) return
    const mapping = { ...sheet.mapping }
    if (header) mapping[field] = header
    else delete mapping[field]
    setSheet({ ...sheet, mapping })
    setResult(null)
  }
  function close() {
    setSheet(null)
    setResult(null)
    setName('')
    onClose()
  }
  if (!open) return null

  return (
    <Dialog
      open
      onClose={close}
      size="lg"
      title="Tạo job đăng bài"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Hủy
          </Button>
          {sheet && (
            <Button onClick={() => submit(true)} loading={run.isPending && run.variables?.dryRun} disabled={!sheet.mapping.content || !selectedBot}>
              Kiểm tra lại
            </Button>
          )}
          <Button variant="primary" loading={run.isPending && run.variables?.dryRun === false} disabled={!result?.dryRun || result.summary.ok === 0} onClick={() => submit(false)}>
            Tạo job · {result?.dryRun ? result.summary.ok : 0} bài
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Tên job">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="vd: Thông báo tuần 8" />
          </Field>
          <Field label="Bot đăng">
            <Select value={selectedBot} onChange={(e) => { setBot(e.target.value); setResult(null) }}>
              {bots.map((b) => (
                <option key={b.id} value={b.username}>
                  {b.displayName} (@{b.username})
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox checked={autoReply} onChange={setAutoReply} label="Tự trả lời bình luận" /> Tự trả lời bình luận
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox checked={autoReact} onChange={setAutoReact} label="Tự thả tim bình luận" /> Tự thả tim bình luận
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.csv,.json" className="hidden" onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])} />
          <Button variant="primary" onClick={() => fileRef.current?.click()} disabled={!bots.length}>
            <Upload /> Chọn file .xlsx / .csv / .json
          </Button>
          <Button onClick={() => void downloadXlsxTemplate()}>
            <Download /> Mẫu Excel
          </Button>
          <Button onClick={downloadJsonTemplate}>
            <Download /> Mẫu JSON
          </Button>
          {sheet && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <FileSpreadsheet className="size-4" /> {sheet.name} · {rows.length} bài
            </span>
          )}
        </div>
        {!bots.length && <p className="text-sm text-muted-foreground">Chưa có bot, hãy tạo bot trước.</p>}

        {sheet && (
          <>
            <details open={!sheet.mapping.content} className="rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">Ghép cột {!sheet.mapping.content && <span className="text-red-500">· chưa thấy cột nội dung</span>}</summary>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {COLUMNS.map((c) => (
                  <label key={c.field} className="flex items-center gap-2 text-sm">
                    <span className="w-28 shrink-0 text-muted-foreground" title={c.hint}>
                      {c.label}
                      {c.field === 'content' && ' *'}
                    </span>
                    <Select value={sheet.mapping[c.field] ?? ''} onChange={(e) => setMap(c.field, e.target.value)}>
                      <option value="">— không dùng —</option>
                      {sheet.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </Select>
                  </label>
                ))}
              </div>
            </details>
            <div className="w-48">
              <Field label="Giãn cách (phút)" hint="cho bài không có giờ">
                <Input type="number" min={1} max={1440} value={spacing} onChange={(e) => setSpacing(Math.min(1440, Math.max(1, Number(e.target.value) || 1)))} />
              </Field>
            </div>
          </>
        )}

        {result && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(result.summary) as BotImportRowStatus[]).map((s) => (
                <Badge key={s} tone={TONE[s]}>
                  {LABEL[s]}: {result.summary[s]}
                </Badge>
              ))}
            </div>
            <div className="max-h-72 overflow-auto">
              <Table>
                <THead>
                  <Th>#</Th>
                  <Th>Trạng thái</Th>
                  <Th>Bài</Th>
                </THead>
                <TBody>
                  {result.rows.map((r) => {
                    const row = rows[r.index]
                    return (
                      <Tr key={r.index}>
                        <Td className="tabular-nums text-muted-foreground">{r.index + 2}</Td>
                        <Td>
                          <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>
                          {(r.reason || r.warning) && <p className="mt-0.5 text-xs text-muted-foreground">{r.reason ?? r.warning}</p>}
                        </Td>
                        <Td className="max-w-[20rem] truncate text-xs">{String(row?.title || row?.content || '').slice(0, 90)}</Td>
                      </Tr>
                    )
                  })}
                </TBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  )
}

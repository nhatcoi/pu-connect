import React, { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, FileSpreadsheet, Sparkles, Upload } from 'lucide-react'
import { toast } from 'sonner'
import type { BotImportField, BotImportInput, BotImportMapRequest, BotImportMapping, BotImportResult, BotImportRowStatus } from '@pu/schemas'
import { adminApi } from '@/lib/api'
import { Badge, Button, Dialog, Field, Input, Select, Table, TBody, Td, Th, THead, Tr } from '@/components/ui'
import { BOTS_KEY } from './use-bots'
import { buildRows, downloadTemplate, guessMapping, IMPORT_COLUMNS, readSheetFile } from './bot-import-sheet'

type Sheet = { name: string; headers: string[]; data: unknown[][]; mapping: BotImportMapping }
const TONE: Record<BotImportRowStatus, 'success' | 'warning' | 'danger'> = { ok: 'success', duplicate: 'warning', invalid: 'danger' }
const LABEL: Record<BotImportRowStatus, string> = { ok: 'Hợp lệ', duplicate: 'Trùng', invalid: 'Lỗi' }
const PLAN = { now: 'Đăng ngay', scheduled: 'Hẹn giờ' } as const

// Import Excel/CSV: chọn file → ghép cột (tự động, AI nếu header lạ) → kiểm tra từng dòng → nhập
export function BotImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [spacing, setSpacing] = useState(30)
  const [result, setResult] = useState<BotImportResult | null>(null)

  const run = useMutation({
    mutationFn: (v: BotImportInput) => adminApi.post<BotImportResult>('/admin/bots/import', v),
    onSuccess: (res) => {
      setResult(res)
      if (!res.dryRun) {
        toast.success(`Đã nhập ${res.summary.ok} dòng (${res.summary.duplicate} trùng, ${res.summary.invalid} lỗi)`)
        void qc.invalidateQueries({ queryKey: BOTS_KEY })
      }
    },
    onError: (e: Error) => toast.error(e.message)
  })
  const mapAi = useMutation({
    mutationFn: (v: BotImportMapRequest) => adminApi.post<BotImportMapping>('/admin/bots/import/map-columns', v),
    onError: (e: Error) => toast.error(e.message)
  })

  const check = (s: Sheet, dryRun: boolean, space = spacing) => run.mutate({ rows: buildRows(s.headers, s.data, s.mapping), dryRun, spacingMinutes: space })
  const aiMap = async (s: Sheet) => {
    const sample = s.data.slice(0, 3).map((r) => s.headers.map((_, i) => String(r[i] ?? '').slice(0, 200)))
    const guess = await mapAi.mutateAsync({ headers: s.headers, sample })
    return { ...s, mapping: { ...guess, ...s.mapping } }
  }

  const onFile = async (file: File) => {
    try {
      const { headers, data } = await readSheetFile(file)
      let next: Sheet = { name: file.name, headers, data, mapping: guessMapping(headers) }
      setResult(null)
      // Header lạ không ghép được cột nội dung ⇒ nhờ AI đoán (admin vẫn chỉnh được)
      if (!next.mapping.content) next = await aiMap(next).catch(() => next)
      setSheet(next)
      if (next.mapping.content) check(next, true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không đọc được file')
    }
  }

  const setMap = (field: BotImportField, header: string) => {
    if (!sheet) return
    const mapping = { ...sheet.mapping }
    if (header) mapping[field] = header
    else delete mapping[field]
    const next = { ...sheet, mapping }
    setSheet(next)
    setResult(null)
  }
  const close = () => {
    setSheet(null)
    setResult(null)
    onClose()
  }
  if (!open) return null
  const rows = sheet ? buildRows(sheet.headers, sheet.data, sheet.mapping) : []

  return (
    <Dialog
      open
      onClose={close}
      size="lg"
      title="Import Excel / CSV"
      description="Mỗi dòng là một bài hẹn giờ. Có giờ ⇒ đăng đúng giờ, không giờ ⇒ giãn cách. Không ghi bot ⇒ hệ thống chia đều cho bot được phép đăng bài."
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Đóng
          </Button>
          {sheet && (
            <Button onClick={() => check(sheet, true)} loading={run.isPending && run.variables?.dryRun} disabled={!sheet.mapping.content}>
              Kiểm tra lại
            </Button>
          )}
          <Button variant="primary" loading={run.isPending && run.variables?.dryRun === false} disabled={!result?.dryRun || result.summary.ok === 0} onClick={() => sheet && check(sheet, false)}>
            Nhập {result?.dryRun ? result.summary.ok : 0} dòng
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])} />
          <Button variant="primary" onClick={() => fileRef.current?.click()} loading={mapAi.isPending}>
            <Upload /> Chọn file .xlsx / .csv
          </Button>
          <Button onClick={() => void downloadTemplate()}>
            <Download /> Tải file mẫu
          </Button>
          {sheet && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <FileSpreadsheet className="size-4" /> {sheet.name} · {rows.length} dòng
            </span>
          )}
        </div>

        {sheet && (
          <>
            <Field label="Ghép cột" hint={sheet.mapping.content ? 'Kiểm tra lại nếu tên cột lạ' : 'Chưa thấy cột nội dung, hãy chọn'}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {IMPORT_COLUMNS.map((c) => (
                  <label key={c.field} className="flex items-center gap-2 text-sm">
                    <span className="w-24 shrink-0 text-muted-foreground" title={c.hint}>
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
            </Field>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-44">
                <Field label="Giãn cách (phút)" hint="dòng không có giờ">
                  <Input type="number" min={1} max={1440} value={spacing} onChange={(e) => setSpacing(Math.min(1440, Math.max(1, Number(e.target.value) || 1)))} />
                </Field>
              </div>
              <Button size="sm" onClick={() => void aiMap(sheet).then(setSheet)} loading={mapAi.isPending}>
                <Sparkles /> AI ghép cột
              </Button>
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
              {!result.dryRun && <Badge tone="primary">Đã nhập xong</Badge>}
            </div>
            <div className="max-h-72 overflow-auto">
              <Table>
                <THead>
                  <Th>#</Th>
                  <Th>Trạng thái</Th>
                  <Th>Nội dung</Th>
                  <Th className="hidden sm:table-cell">Bot</Th>
                  <Th>Xử lý</Th>
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
                        <Td className="max-w-[16rem] truncate text-xs">{String(row?.content ?? '').slice(0, 90)}</Td>
                        <Td className="hidden text-xs sm:table-cell">{r.bot || row?.bot ? `@${String(r.bot ?? row?.bot)}` : '—'}</Td>
                        <Td className="text-xs">{r.plan ? PLAN[r.plan] : '—'}</Td>
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

import React, { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileSpreadsheet } from 'lucide-react'
import { readSheet } from 'read-excel-file/browser'
import writeExcelFile from 'write-excel-file/browser'
import { toast } from 'sonner'
import type { AdminCourseImportResult } from '@pu/schemas'
import { adminApi } from '@/lib/api'
import { Badge, Button, Dialog } from '@/components/ui'

const FIELDS = ['code', 'name', 'credits', 'field', 'description', 'syllabusUrl'] as const
const ALIASES: Record<(typeof FIELDS)[number], string[]> = {
  code: ['code', 'ma', 'mamon', 'mahocphan', 'mahp'],
  name: ['name', 'ten', 'tenmon', 'tenhocphan'],
  credits: ['credits', 'tinchi', 'sotinchi', 'tc'],
  field: ['field', 'linhvuc', 'tenlinhvuc', 'linhvucquantam'],
  description: ['description', 'mota'],
  syllabusUrl: ['syllabusurl', 'syllabus', 'decuong', 'linkdecuong']
}
const SAMPLE = [['IT302', 'Trí tuệ nhân tạo', 3, 'Công nghệ thông tin', 'Giới thiệu học máy cơ bản', '']]

const fold = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '')

// Excel/CSV: hàng đầu là tiêu đề (tự ghép theo tên VI/EN); JSON: mảng object cùng khóa
async function readRows(file: File): Promise<Record<string, unknown>[]> {
  if (/\.json$/i.test(file.name)) {
    const json = JSON.parse(await file.text()) as unknown
    if (!Array.isArray(json)) throw new Error('JSON phải là mảng các môn')
    return json as Record<string, unknown>[]
  }
  const [head, ...data] = (await readSheet(file)) as unknown[][]
  if (!head?.length) throw new Error('File trống')
  const col = (f: (typeof FIELDS)[number]) => head.findIndex((h) => ALIASES[f].includes(fold(h)))
  const idx = Object.fromEntries(FIELDS.map((f) => [f, col(f)])) as Record<(typeof FIELDS)[number], number>
  if (idx.code < 0 || idx.name < 0) throw new Error('Thiếu cột bắt buộc: mã môn, tên môn')
  return data
    .filter((r) => r.some((v) => String(v ?? '').trim()))
    .map((r) => Object.fromEntries(FIELDS.map((f) => [f, idx[f] >= 0 ? (r[idx[f]] ?? undefined) : undefined])))
}

export function CourseImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null)
  const [check, setCheck] = useState<AdminCourseImportResult | null>(null)

  const run = useMutation({
    mutationFn: (v: { rows: Record<string, unknown>[]; dryRun: boolean }) => adminApi.post<AdminCourseImportResult>('/admin/courses/import', v),
    onSuccess: (res, v) => {
      setCheck(res)
      if (res.applied) {
        toast.success(`Đã nhập: ${res.created} mới, ${res.updated} cập nhật`)
        void qc.invalidateQueries({ queryKey: ['admin'] })
        close()
      } else if (!v.dryRun) toast.error('Còn dòng lỗi, chưa nhập gì')
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const close = () => {
    setRows(null)
    setCheck(null)
    onClose()
  }

  const pick = async (file?: File) => {
    if (!file) return
    try {
      const r = await readRows(file)
      setRows(r)
      setCheck(null)
      run.mutate({ rows: r, dryRun: true })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const template = async () => {
    const head = FIELDS.map((f) => ({ value: f, fontWeight: 'bold' as const }))
    const blob = await writeExcelFile([head, ...SAMPLE.map((r) => r.map((v) => (v === '' ? null : { value: v })))]).toBlob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'hoc-phan-mau.xlsx'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Nhập học phần từ file"
      footer={
        <>
          <Button onClick={close}>Đóng</Button>
          <Button variant="primary" disabled={!rows || !check || check.errors.length > 0 || run.isPending} loading={run.isPending && !!check} onClick={() => rows && run.mutate({ rows, dryRun: false })}>
            Nhập {check ? check.created + check.updated : ''} môn
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Cột: <code>code</code>, <code>name</code>, <code>field</code> (tên lĩnh vực, tùy chọn), <code>credits</code>, <code>description</code>, <code>syllabusUrl</code>. Mã môn đã có thì cập nhật, chưa có thì tạo mới. Tối đa 500 dòng.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => input.current?.click()}>
            <FileSpreadsheet /> Chọn file (.xlsx, .csv, .json)
          </Button>
          <Button variant="ghost" onClick={() => void template()}>
            Tải file mẫu
          </Button>
          <input ref={input} type="file" accept=".xlsx,.csv,.json" hidden onChange={(e) => void pick(e.target.files?.[0])} />
        </div>
        {check && (
          <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge tone="success">{check.created} mới</Badge>
              <Badge tone="primary">{check.updated} cập nhật</Badge>
              {check.errors.length > 0 && <Badge tone="danger">{check.errors.length} lỗi</Badge>}
            </div>
            {check.errors.length > 0 && (
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-destructive">
                {check.errors.slice(0, 50).map((e) => (
                  <li key={e.row}>
                    Dòng {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Dialog>
  )
}

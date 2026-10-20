import { readSheet } from 'read-excel-file/browser'
import writeExcelFile from 'write-excel-file/browser'
import type { BotImportField, BotImportMapping } from '@pu/schemas'

// Cột chuẩn của file import + các tên cột thường gặp (VI/EN) để tự ghép
export const IMPORT_COLUMNS: { field: BotImportField; header: string; label: string; hint: string; aliases: string[] }[] = [
  { field: 'content', header: 'content', label: 'Nội dung', hint: 'Bắt buộc, 40–3000 ký tự', aliases: ['content', 'noidung', 'text', 'body', 'message', 'baiviet', 'noidungbai', 'mota', 'caption'] },
  { field: 'key', header: 'key', label: 'Mã bài', hint: 'Chống trùng; bỏ trống = tự sinh từ nội dung', aliases: ['key', 'id', 'ma', 'mabai', 'postid', 'sourcekey', 'stt'] },
  { field: 'title', header: 'title', label: 'Tiêu đề', hint: 'Tùy chọn', aliases: ['title', 'tieude', 'ten', 'tenbai', 'headline'] },
  { field: 'images', header: 'images', label: 'Ảnh', hint: 'URL https, nhiều ảnh cách nhau bằng xuống dòng hoặc |', aliases: ['images', 'image', 'anh', 'hinhanh', 'linkanh', 'photo', 'photos', 'imageurls'] },
  { field: 'topic', header: 'topic', label: 'Chủ đề', hint: 'Mã hoặc tên chủ đề đã có', aliases: ['topic', 'chude', 'category', 'danhmuc'] },
  { field: 'bot', header: 'bot', label: 'Bot đăng', hint: 'Username bot; bỏ trống = vào kho cho AI/xoay vòng', aliases: ['bot', 'botdang', 'nguoidang', 'username', 'account', 'taikhoan'] },
  { field: 'scheduledAt', header: 'scheduled_at', label: 'Giờ đăng', hint: 'VD 2026-10-21 08:30 hoặc 21/10/2026 08:30', aliases: ['scheduledat', 'scheduled', 'gio', 'giodang', 'thoigian', 'hengio', 'ngaydang', 'time', 'date', 'postat', 'publishat'] },
  { field: 'enhance', header: 'enhance', label: 'AI viết lại', hint: 'ai / none (có/không)', aliases: ['enhance', 'ai', 'aiviet', 'vietlai', 'aienhance', 'rewrite'] }
]

const fold = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '')

// Ghép header của file với trường chuẩn bằng bảng tên gọi; header chưa nhận ra để trống (AI hoặc admin chọn)
export function guessMapping(headers: string[]): BotImportMapping {
  const mapping: BotImportMapping = {}
  const used = new Set<string>()
  for (const col of IMPORT_COLUMNS) {
    const hit = headers.find((h) => !used.has(h) && col.aliases.includes(fold(h)))
    if (hit) {
      mapping[col.field] = hit
      used.add(hit)
    }
  }
  return mapping
}

// CSV có ngoặc kép, dấu phẩy/chấm phẩy, xuống dòng trong ô
function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const delim = (src.split('\n', 1)[0].match(/;/g)?.length ?? 0) > (src.split('\n', 1)[0].match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') (cell += '"'), i++
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === delim) (row.push(cell), (cell = ''))
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell || row.length) (row.push(cell), rows.push(row))
  return rows.filter((r) => r.some((x) => x.trim()))
}

export async function readSheetFile(file: File): Promise<{ headers: string[]; data: unknown[][] }> {
  const rows: unknown[][] = /\.csv$/i.test(file.name) ? parseCsv(await file.text()) : ((await readSheet(file)) as unknown[][])
  const [head, ...data] = rows
  if (!head?.length) throw new Error('File trống')
  return { headers: head.map((h, i) => String(h ?? '').trim() || `Cột ${i + 1}`), data }
}

const text = (v: unknown) => (v == null ? '' : v instanceof Date ? v.toISOString() : String(v).trim())

// Giờ trong ô Excel là giờ treo (không múi giờ): đọc thành giờ địa phương của admin
function toIso(v: unknown): string | undefined {
  if (v instanceof Date) return new Date(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate(), v.getUTCHours(), v.getUTCMinutes()).toISOString()
  const s = text(v)
  if (!s) return undefined
  const vn = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/.exec(s)
  const d = vn ? new Date(+vn[3], +vn[2] - 1, +vn[1], +(vn[4] ?? 0), +(vn[5] ?? 0)) : new Date(s.replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? s : d.toISOString()
}

const YES = new Set(['ai', 'co', 'yes', 'true', '1', 'x', 'y'])
const NO = new Set(['none', 'khong', 'no', 'false', '0'])

// Dòng thô → dòng chuẩn theo mapping (giá trị sai định dạng giữ nguyên để API báo lỗi đúng dòng)
export function buildRows(headers: string[], data: unknown[][], mapping: BotImportMapping): Record<string, unknown>[] {
  const idx = (f: BotImportField) => (mapping[f] ? headers.indexOf(mapping[f]!) : -1)
  const cell = (r: unknown[], f: BotImportField) => (idx(f) >= 0 ? r[idx(f)] : undefined)
  return data
    .filter((r) => r.some((v) => text(v)))
    .map((r) => {
      const enh = fold(cell(r, 'enhance'))
      return {
        content: text(cell(r, 'content')),
        key: text(cell(r, 'key')) || undefined,
        title: text(cell(r, 'title')) || undefined,
        images: text(cell(r, 'images')) ? text(cell(r, 'images')).split(/[\n|;]+/).map((u) => u.trim()).filter(Boolean) : undefined,
        topic: text(cell(r, 'topic')) || undefined,
        bot: text(cell(r, 'bot')).replace(/^@/, '') || undefined,
        scheduledAt: toIso(cell(r, 'scheduledAt')),
        enhance: YES.has(enh) ? 'ai' : NO.has(enh) ? 'none' : undefined
      }
    })
}

// File mẫu .xlsx đúng cột chuẩn (có 2 dòng ví dụ)
export async function downloadTemplate() {
  const head = IMPORT_COLUMNS.map((c) => ({ value: c.header, fontWeight: 'bold' as const }))
  const sample = [
    ['fb:123', 'Thông báo: lịch thi cuối kỳ học kỳ 1 sẽ được công bố trên cổng đào tạo vào thứ Hai tuần sau.', '', '', 'thong-bao-truong', 'tranngocbot', '2026-10-21 08:30', 'ai'],
    ['', 'Workshop Docker cơ bản diễn ra 14h thứ Sáu tại phòng A2-301, sinh viên quan tâm vui lòng đăng ký.', 'Workshop Docker', 'https://example.com/anh.jpg', 'cntt', '', '', '']
  ]
  const blob = await writeExcelFile([head, ...sample.map((r) => r.map((v) => (v ? { value: v } : null)))]).toBlob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'bot-import-mau.xlsx'
  a.click()
  URL.revokeObjectURL(a.href)
}

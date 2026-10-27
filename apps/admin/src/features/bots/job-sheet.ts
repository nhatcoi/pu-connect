import { readSheet } from 'read-excel-file/browser'
import writeExcelFile from 'write-excel-file/browser'
import type { BotImportField, BotImportMapping } from '@pu/schemas'

// Cột chuẩn của file nhập + các tên cột thường gặp (VI/EN) để tự ghép
export const COLUMNS: { field: BotImportField; label: string; hint: string; aliases: string[] }[] = [
  { field: 'content', label: 'Nội dung', hint: 'Bắt buộc', aliases: ['content', 'noidung', 'text', 'body', 'message', 'baiviet', 'noidungbai', 'mota', 'caption'] },
  { field: 'title', label: 'Tiêu đề', hint: 'Tùy chọn', aliases: ['title', 'tieude', 'ten', 'tenbai', 'headline'] },
  { field: 'images', label: 'Ảnh', hint: 'URL https, nhiều ảnh cách nhau bằng | hoặc xuống dòng', aliases: ['images', 'image', 'anh', 'hinhanh', 'linkanh', 'photo', 'photos', 'imageurls', 'mediaurls', 'media'] },
  { field: 'tags', label: 'Thẻ', hint: 'Nhiều thẻ cách nhau bằng dấu phẩy', aliases: ['tags', 'tag', 'the', 'hashtag', 'hashtags', 'nhan'] },
  { field: 'postType', label: 'Loại bài', hint: 'general / qa / document / group_recruit / review', aliases: ['posttype', 'type', 'loai', 'loaibai'] },
  { field: 'visibility', label: 'Hiển thị', hint: 'public / followers / private', aliases: ['visibility', 'hienthi', 'quyenxem', 'chedo'] },
  { field: 'course', label: 'Môn học', hint: 'Mã môn hoặc id', aliases: ['course', 'courseid', 'coursecode', 'monhoc', 'mamon', 'mamonhoc'] },
  { field: 'community', label: 'Cộng đồng', hint: 'Slug cộng đồng', aliases: ['community', 'communityslug', 'congdong', 'nhom'] },
  { field: 'pollQuestion', label: 'Câu hỏi khảo sát', hint: 'Cần kèm lựa chọn', aliases: ['pollquestion', 'poll', 'khaosat', 'cauhoi', 'cauhoikhaosat'] },
  { field: 'pollOptions', label: 'Lựa chọn khảo sát', hint: 'Ít nhất 2, cách nhau bằng |', aliases: ['polloptions', 'options', 'luachon', 'cacluachon'] },
  { field: 'scheduledAt', label: 'Giờ đăng', hint: 'VD 2026-10-21 08:30 hoặc 21/10/2026 08:30; bỏ trống = giãn cách đều', aliases: ['scheduledat', 'scheduled', 'gio', 'giodang', 'thoigian', 'hengio', 'ngaydang', 'time', 'date', 'postat', 'publishat'] }
]

const fold = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '')

// Ghép header của file với trường chuẩn bằng bảng tên gọi; header lạ để admin chọn tay
export function guessMapping(headers: string[]): BotImportMapping {
  const mapping: BotImportMapping = {}
  const used = new Set<string>()
  for (const col of COLUMNS) {
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
  const first = src.split('\n', 1)[0]
  const delim = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ','
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

export type Sheet = { name: string; headers: string[]; data: unknown[][] }

// JSON: mảng object (hoặc { posts|items|data: [...] }); khóa = tên cột, giá trị mảng giữ nguyên
function fromJson(text: string): { headers: string[]; data: unknown[][] } {
  const json = JSON.parse(text) as unknown
  const list = Array.isArray(json) ? json : Object.values((json ?? {}) as Record<string, unknown>).find(Array.isArray)
  if (!Array.isArray(list) || !list.length || list.some((x) => !x || typeof x !== 'object' || Array.isArray(x))) throw new Error('JSON phải là mảng các bài (object)')
  const headers = [...new Set(list.flatMap((o) => Object.keys(o as object)))]
  return { headers, data: list.map((o) => headers.map((h) => (o as Record<string, unknown>)[h])) }
}

export async function readSheetFile(file: File): Promise<Sheet> {
  if (/\.json$/i.test(file.name)) return { name: file.name, ...fromJson(await file.text()) }
  const rows: unknown[][] = /\.csv$/i.test(file.name) ? parseCsv(await file.text()) : ((await readSheet(file)) as unknown[][])
  const [head, ...data] = rows
  if (!head?.length) throw new Error('File trống')
  return { name: file.name, headers: head.map((h, i) => String(h ?? '').trim() || `Cột ${i + 1}`), data }
}

const text = (v: unknown) => (v == null ? '' : v instanceof Date ? v.toISOString() : String(v).trim())
const list = (v: unknown, sep: RegExp) => (Array.isArray(v) ? v.map(text) : text(v).split(sep)).map((x) => x.trim()).filter(Boolean)

// Giờ trong ô Excel là giờ treo (không múi giờ): đọc thành giờ địa phương của admin
function toIso(v: unknown): string | undefined {
  if (v instanceof Date) return new Date(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate(), v.getUTCHours(), v.getUTCMinutes()).toISOString()
  const s = text(v)
  if (!s) return undefined
  const vn = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/.exec(s)
  const d = vn ? new Date(+vn[3], +vn[2] - 1, +vn[1], +(vn[4] ?? 0), +(vn[5] ?? 0)) : new Date(s.replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? s : d.toISOString()
}

const POST_TYPES: Record<string, string> = {
  general: 'general', chung: 'general', thongthuong: 'general',
  qa: 'qa', question: 'qa', hoidap: 'qa', cauhoi: 'qa',
  document: 'document', resourceshare: 'document', tailieu: 'document',
  grouprecruit: 'group_recruit', pblrecruitment: 'group_recruit', tuyennhom: 'group_recruit',
  review: 'review', danhgia: 'review'
}
const VISIBILITY: Record<string, string> = { public: 'public', congkhai: 'public', followers: 'followers', nguoitheodoi: 'followers', private: 'private', riengtu: 'private' }

// Dòng thô → dòng chuẩn theo mapping (giá trị sai định dạng giữ nguyên để API báo lỗi đúng dòng)
export function buildRows({ headers, data }: Pick<Sheet, 'headers' | 'data'>, mapping: BotImportMapping): Record<string, unknown>[] {
  const idx = (f: BotImportField) => (mapping[f] ? headers.indexOf(mapping[f]!) : -1)
  const cell = (r: unknown[], f: BotImportField) => (idx(f) >= 0 ? r[idx(f)] : undefined)
  const norm = (v: unknown, table: Record<string, string>) => (text(v) ? (table[fold(v)] ?? text(v)) : undefined)
  return data
    .filter((r) => r.some((v) => text(v)))
    .map((r) => {
      const images = list(cell(r, 'images'), /[\n|;]+/)
      const tags = list(cell(r, 'tags'), /[,\n|;]+/).map((t) => t.replace(/^#/, ''))
      const options = list(cell(r, 'pollOptions'), /[\n|;]+/)
      return {
        content: text(cell(r, 'content')),
        title: text(cell(r, 'title')) || undefined,
        images: images.length ? images : undefined,
        tags: tags.length ? tags : undefined,
        postType: norm(cell(r, 'postType'), POST_TYPES),
        visibility: norm(cell(r, 'visibility'), VISIBILITY),
        course: text(cell(r, 'course')) || undefined,
        community: text(cell(r, 'community')) || undefined,
        pollQuestion: text(cell(r, 'pollQuestion')) || undefined,
        pollOptions: options.length ? options : undefined,
        scheduledAt: toIso(cell(r, 'scheduledAt'))
      }
    })
}

const SAMPLES: string[][] = [
  ['Thông báo: lịch thi cuối kỳ học kỳ 1 sẽ được công bố trên cổng đào tạo vào thứ Hai tuần sau.', 'Lịch thi cuối kỳ', '', 'thongbao,lichthi', 'general', 'public', '', '', '', '', '2026-10-21 08:30'],
  ['Workshop Docker cơ bản diễn ra 14h thứ Sáu tại phòng A2-301, bạn nào tham gia?', 'Workshop Docker', 'https://example.com/anh.jpg', 'docker,workshop', 'qa', 'public', '', '', 'Bạn có tham gia?', 'Có|Không|Chưa chắc', '']
]

function save(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export async function downloadXlsxTemplate() {
  const head = COLUMNS.map((c) => ({ value: c.field, fontWeight: 'bold' as const }))
  const blob = await writeExcelFile([head, ...SAMPLES.map((r) => r.map((v) => (v ? { value: v } : null)))]).toBlob()
  save(blob, 'bot-job-mau.xlsx')
}

export function downloadJsonTemplate() {
  const posts = SAMPLES.map((r) => {
    const o: Record<string, unknown> = {}
    COLUMNS.forEach((c, i) => {
      if (!r[i]) return
      o[c.field] = c.field === 'images' || c.field === 'tags' ? r[i].split(/[,|]/) : c.field === 'pollOptions' ? r[i].split('|') : r[i]
    })
    return o
  })
  save(new Blob([JSON.stringify(posts, null, 2)], { type: 'application/json' }), 'bot-job-mau.json')
}

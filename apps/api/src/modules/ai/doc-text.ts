import { PDFParse } from 'pdf-parse'
import * as mammoth from 'mammoth'
import * as JSZip from 'jszip' // jszip là CommonJS (export =): không dùng default import vì tsconfig không bật esModuleInterop
import readXlsxFile from 'read-excel-file/node'

// Trích văn bản từ tệp (dùng chung: đính kèm chat, Google Drive) / Shared document text extraction
export const TEXT_MIMES = ['text/plain', 'text/markdown', 'text/csv']
export const PDF_MIME = 'application/pdf'
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const MAX_SHEET_ROWS = 500
const MAX_PDF_PAGES = 40

// Tệp Office / PDF là nhị phân nén ⇒ cho tải lớn hơn tệp văn bản thuần
export const isBinaryDocMime = (mime: string) => [PDF_MIME, DOCX_MIME, PPTX_MIME, XLSX_MIME].includes(mime)
export const isExtractableMime = (mime: string) => TEXT_MIMES.includes(mime) || isBinaryDocMime(mime)

export async function bufferToText(buf: Buffer, mime: string, maxPages = MAX_PDF_PAGES): Promise<string> {
  let text: string
  if (mime === PDF_MIME) {
    const parser = new PDFParse({ data: new Uint8Array(buf) })
    try {
      const res = await parser.getText({ first: maxPages })
      text = res.text.replace(/\n-- \d+ of \d+ --\n/g, '\n')
      if (res.total > maxPages) text += `\n…(chỉ đọc ${maxPages}/${res.total} trang đầu)`
    } finally {
      await parser.destroy()
    }
  } else if (mime === DOCX_MIME) {
    text = (await mammoth.extractRawText({ buffer: buf })).value
  } else if (mime === PPTX_MIME) {
    text = await pptxToText(buf)
  } else if (mime === XLSX_MIME) {
    text = await xlsxToText(buf)
  } else {
    text = buf.toString('utf8')
  }
  return text.replace(/\n{3,}/g, '\n\n').trim()
}

// PDF ⇒ chữ từng trang (RAG cần theo trang: bỏ header/footer lặp, OCR riêng trang scan)
export async function pdfPageTexts(buf: Buffer, maxPages: number): Promise<{ pages: string[]; total: number }> {
  const parser = new PDFParse({ data: new Uint8Array(buf) })
  try {
    const res = await parser.getText({ first: maxPages })
    return { pages: res.pages.map((p) => p.text), total: res.total }
  } finally {
    await parser.destroy()
  }
}

const XML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const decodeXml = (s: string) => s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e: string) => XML_ENTITIES[e])

// PowerPoint ⇒ chữ từng slide (theo thứ tự slide, gom các đoạn <a:t>)
async function pptxToText(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf)
  const slides = Object.keys(zip.files)
    .map((name) => ({ name, n: /^ppt\/slides\/slide(\d+)\.xml$/.exec(name)?.[1] }))
    .filter((s): s is { name: string; n: string } => !!s.n)
    .sort((a, b) => Number(a.n) - Number(b.n))
  const out: string[] = []
  for (const { name, n } of slides) {
    const xml = await zip.files[name].async('text')
    const paragraphs = xml.split('</a:p>').map((p) => Array.from(p.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g), (m) => decodeXml(m[1])).join(''))
    out.push(`## Slide ${n}\n${paragraphs.filter((p) => p.trim()).join('\n')}`)
  }
  return out.join('\n\n')
}

// Excel ⇒ mỗi sheet một khối, dòng "ô | ô | ô" (cắt MAX_SHEET_ROWS dòng đầu)
async function xlsxToText(buf: Buffer): Promise<string> {
  const sheets = await readXlsxFile(buf)
  return sheets
    .map(({ sheet, data }) => {
      const rows = data.slice(0, MAX_SHEET_ROWS).map((row) => row.map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : (c ?? ''))).join(' | '))
      const more = data.length > MAX_SHEET_ROWS ? `\n…(chỉ đọc ${MAX_SHEET_ROWS}/${data.length} dòng đầu)` : ''
      return `## Sheet ${sheet}\n${rows.join('\n')}${more}`
    })
    .join('\n\n')
}

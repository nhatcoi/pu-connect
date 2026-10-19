import { PDFParse } from 'pdf-parse'
import * as mammoth from 'mammoth'

// Trích văn bản từ tệp (dùng chung: đính kèm chat, Google Drive) / Shared document text extraction
export const TEXT_MIMES = ['text/plain', 'text/markdown', 'text/csv']
export const PDF_MIME = 'application/pdf'
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const MAX_PDF_PAGES = 40

export const isExtractableMime = (mime: string) => TEXT_MIMES.includes(mime) || mime === PDF_MIME || mime === DOCX_MIME

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

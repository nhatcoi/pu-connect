import { PDFParse } from 'pdf-parse'
import * as mammoth from 'mammoth'

// Trích văn bản từ tệp (dùng chung: đính kèm chat, Google Drive) / Shared document text extraction
export const TEXT_MIMES = ['text/plain', 'text/markdown', 'text/csv']
export const PDF_MIME = 'application/pdf'
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const MAX_PDF_PAGES = 40

export const isExtractableMime = (mime: string) => TEXT_MIMES.includes(mime) || mime === PDF_MIME || mime === DOCX_MIME

export async function bufferToText(buf: Buffer, mime: string): Promise<string> {
  let text: string
  if (mime === PDF_MIME) {
    const parser = new PDFParse({ data: new Uint8Array(buf) })
    try {
      const res = await parser.getText({ first: MAX_PDF_PAGES })
      text = res.text.replace(/\n-- \d+ of \d+ --\n/g, '\n')
      if (res.total > MAX_PDF_PAGES) text += `\n…(chỉ đọc ${MAX_PDF_PAGES}/${res.total} trang đầu)`
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

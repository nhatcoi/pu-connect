import * as JSZipModule from 'jszip'
import { PPTX_MIME, XLSX_MIME, bufferToText } from '../src/modules/ai/doc-text'
import { pickTrack, transcriptLines, youtubeId } from '../src/modules/chat/n7ai/sources/youtube-transcript'
import { sourceTextParts } from '../src/modules/chat/n7ai/sources/source-context'

const CONTENT_TYPES = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'

const JSZip = JSZipModule as unknown as typeof import('jszip') // CommonJS: giá trị của module chính là constructor

// Trích văn bản PowerPoint / Excel cho N7AI + nhận dạng liên kết YouTube
describe('đọc tài liệu cho N7AI', () => {
  it('PowerPoint ⇒ chữ từng slide theo thứ tự', async () => {
    const zip = new JSZip()
    const slide = (text: string) => `<p:sld xmlns:a="x" xmlns:p="y"><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:sld>`
    zip.file('ppt/slides/slide2.xml', slide('Chuẩn hoá &amp; 3NF'))
    zip.file('ppt/slides/slide1.xml', slide('Giới thiệu CSDL'))
    const text = await bufferToText(await zip.generateAsync({ type: 'nodebuffer' }), PPTX_MIME)
    expect(text).toBe('## Slide 1\nGiới thiệu CSDL\n\n## Slide 2\nChuẩn hoá & 3NF')
  })

  it('Excel ⇒ mỗi sheet một khối, ô nối bằng " | "', async () => {
    const zip = new JSZip()
    zip.file('[Content_Types].xml', `${CONTENT_TYPES}<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`)
    zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
    zip.file('xl/workbook.xml', '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Điểm" sheetId="1" r:id="rId1"/></sheets></workbook>')
    zip.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')
    zip.file('xl/worksheets/sheet1.xml', '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Tên</t></is></c><c r="B1"><v>9.5</v></c></row></sheetData></worksheet>')
    expect(await bufferToText(await zip.generateAsync({ type: 'nodebuffer' }), XLSX_MIME)).toBe('## Sheet Điểm\nTên | 9.5')
  })

  it('nhận id video từ các dạng liên kết YouTube', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ&t=10',
      'https://youtu.be/dQw4w9WgXcQ?si=abc',
      'https://m.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ'
    ]) {
      expect(youtubeId(url)).toBe('dQw4w9WgXcQ')
    }
    expect(youtubeId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(youtubeId('https://www.youtube.com/@kenh')).toBeNull()
  })

  it('phụ đề YouTube ⇒ dòng ~30 giây có mốc [mm:ss]', () => {
    const seg = (tStartMs: number, utf8: string) => ({ tStartMs, segs: [{ utf8 }] })
    const lines = transcriptLines([seg(0, 'Xin chào'), seg(4000, 'các bạn\n'), seg(31_000, 'Bài hôm nay'), seg(62_500, '  '), seg(65_000, 'Kết thúc')])
    expect(lines).toEqual(['[00:00] Xin chào các bạn', '[00:31] Bài hôm nay', '[01:05] Kết thúc'])
  })

  it('chọn phụ đề: tiếng Việt do người làm > Việt tự động > tiếng Anh', () => {
    const track = (languageCode: string, kind?: string) => ({ baseUrl: 'https://www.youtube.com/api/timedtext', languageCode, kind })
    expect(pickTrack([track('en'), track('vi', 'asr'), track('vi')])).toMatchObject({ languageCode: 'vi', kind: undefined })
    expect(pickTrack([track('en', 'asr'), track('vi', 'asr')])).toMatchObject({ languageCode: 'vi' })
    expect(pickTrack([track('fr'), track('en')])).toMatchObject({ languageCode: 'en' })
  })

  it('nguồn video gửi cho N7AI kèm hướng dẫn dẫn mốc thời gian', () => {
    const [part] = sourceTextParts([{ title: 'Bài giảng', kind: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', content: '[00:00] Xin chào', meta: { author: 'Thầy A', seconds: 1800, lang: 'vi', auto: true } }])
    expect(part).toMatchObject({ type: 'text' })
    const text = (part as { text: string }).text
    expect(text).toContain('kênh Thầy A, dài 30 phút, phụ đề tự động vi')
    expect(text).toContain('[00:00] Xin chào')
  })
})

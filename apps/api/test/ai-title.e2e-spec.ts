import { cleanTitle } from '../src/modules/chat/n7ai/ai-title.service'

describe('cleanTitle', () => {
  it('bỏ ngoặc kép, tiền tố, dấu chấm cuối', () => {
    expect(cleanTitle('"Giải bài tập Lagrange."')).toBe('Giải bài tập Lagrange')
    expect(cleanTitle('Tên: **Ôn tập nội quy trường**')).toBe('Ôn tập nội quy trường')
  })
  it('SKIP / rỗng ⇒ null', () => {
    expect(cleanTitle('SKIP')).toBeNull()
    expect(cleanTitle('  \n ')).toBeNull()
  })
  it('cắt ≤ 60 ký tự, lấy dòng đầu', () => {
    const t = cleanTitle(`${'a'.repeat(80)}\nline2`)!
    expect(t.length).toBeLessThanOrEqual(60)
    expect(t.endsWith('…')).toBe(true)
  })
})

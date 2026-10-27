import { buildProfanityChecker, checkVietnameseProfanity } from '../../src/modules/moderation/vi-profanity.filter'
import { normalize } from '../../src/modules/moderation/vi-text-normalizer'

const verdict = (s: string) => checkVietnameseProfanity(s).verdict

describe('normalize', () => {
  it('NFC + lowercase', () => {
    // "Địt" viết dạng tổ hợp (d + dấu) vẫn ra cùng token
    expect(normalize('ĐỊT'.normalize('NFD'))[0].value).toBe('địt')
  })
  it('ghép chữ rời và bỏ ký tự chèn', () => {
    expect(normalize('đ.m.m')[0].value).toBe('đmm')
    expect(normalize('đ m m')[0].value).toBe('đmm')
    expect(normalize('d-i-t')[0].value).toBe('dit')
  })
  it('leet chỉ giữa hai chữ cái', () => {
    expect(normalize('l0n')[0].value).toBe('lon')
    expect(normalize('d1t')[0].value).toBe('dit')
    expect(normalize('5 dm').map(t => t.value)).toEqual(['5', 'dm'])
  })
  it('thu gọn chữ lặp', () => {
    expect(normalize('địttttt')[0].key).toBe('địt')
  })
})

describe('checkVietnameseProfanity', () => {
  it.each([
    'địt mẹ mày',
    'lồn',
    'cái lồn gì vậy',
    'đụ má nó',
    'con cặc',
    'địttttt',
    'd1t me mày',
    'dit me',
    'du ma',
    'l0n',
    'đ.ị.t',
    'c4c'
  ])('block nặng: %s', s => expect(verdict(s)).toBe('block'))

  it.each(['đm', 'đ.m.m', 'đ m m', 'đmmmm', 'vcl', 'v.c.l', 'dmm', 'đéo biết', 'd3o cần', 'ĐCM', 'đồ chó'])('review vừa: %s', s =>
    expect(verdict(s)).toBe('review')
  )

  it('light chỉ review khi nhắm người', () => {
    expect(verdict('mày ngu quá')).toBe('review')
    expect(verdict('bài này ngu ngốc quá')).toBe('pass')
  })

  it.each([
    'lon bia',
    'mua 2 lon bia',
    'lớn rồi',
    'cái này dài 5 dm',
    '5 đm',
    'gửi cc anh nhé',
    'cac ban oi cho minh hoi',
    'đủ mà',
    'đi mẹ ơi',
    'em đang ngủ',
    'buổi sáng tốt lành',
    'điên đảo vì deadline',
    'đeo khẩu trang',
    'ngốc nghếch dễ thương',
    'Địa điểm nộp bài ở đâu',
    'dit' // không dấu đứng riêng, không bị lách ⇒ mơ hồ, bỏ qua
  ])('không dương tính giả: %s', s => expect(verdict(s)).toBe('pass'))

  it('trả về match + targeted', () => {
    const r = checkVietnameseProfanity('thằng ngu')
    expect(r.matches[0]).toMatchObject({ term: 'ngu', severity: 'light', targeted: true })
  })
})

describe('buildProfanityChecker (từ do admin thêm)', () => {
  const check = buildProfanityChecker([
    { term: 'Thằng Hề', severity: 'heavy', category: 'curse' },
    { term: 'tào lao', severity: 'light', category: 'curse' }
  ])
  it('từ thêm vào được chuẩn hóa chữ hoa và khớp', () => {
    expect(check('mày đúng là thằng hề').verdict).toBe('block')
    expect(check('mày tào lao quá').verdict).toBe('review') // light + nhắm người
  })
  it('từ điển gốc vẫn áp dụng, câu sạch vẫn qua', () => {
    expect(check('địt mẹ mày').verdict).toBe('block')
    expect(check('hôm nay trời đẹp').verdict).toBe('pass')
  })
  it('không ảnh hưởng checker mặc định', () => {
    expect(verdict('mày đúng là thằng hề')).toBe('pass')
  })
})

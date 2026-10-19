import { CLOZE_PATTERN, hasCloze, type FlashcardContent } from '@pu/schemas'

// Thẻ điền chỗ trống: mặt trước "… {{đáp án}} …" hoặc "{{đáp án::gợi ý}}" ⇒ ôn thì ẩn, lật thì hiện đậm
// Cloze cards: all blanks of one card are hidden / revealed together

export const isClozeCard = (c: Pick<FlashcardContent, 'front'>) => hasCloze(c.front)

const split = (inner: string) => {
  const [answer, hint] = inner.split('::')
  return { answer: answer.trim(), hint: hint?.trim() }
}

// Các đáp án theo thứ tự xuất hiện
export const clozeAnswers = (front: string) => [...front.matchAll(CLOZE_PATTERN)].map((m) => split(m[1]).answer)

// Markdown hiển thị: ẩn ⇒ **[…]** / **[gợi ý]**, hiện ⇒ **đáp án**
export const clozeText = (front: string, reveal: boolean) =>
  front.replace(CLOZE_PATTERN, (_, inner: string) => {
    const { answer, hint } = split(inner)
    return reveal ? `**${answer}**` : `**[${hint || '…'}]**`
  })

// Đọc / tìm kiếm: bỏ dấu ngoặc, giữ đáp án
export const clozePlain = (front: string) => front.replace(CLOZE_PATTERN, (_, inner: string) => split(inner).answer)

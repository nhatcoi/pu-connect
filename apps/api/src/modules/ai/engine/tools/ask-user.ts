/**
 * N7AI Agent Engine — Ask User Tool & Draft Preview
 * Xử lý công cụ tương tác Socratic (ask_user) và tạm dừng lượt.
 */
import type { JsonRecord } from '../native/types'
import { record } from '../native/types'

const text = (value: unknown) =>
  value == null
    ? ''
    : String(value)
        .replace(/\\u([\da-f]{4})/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
        .trim()

function clip(value: unknown, limit: number, ellipsis = true): string | null {
  const chars = [...text(value)]
  return chars.length > limit ? chars.slice(0, limit).join('').trimEnd() + (ellipsis ? '…' : '') : chars.join('') || null
}

const key = (label: string) => label.replace(/\s/g, '').toLowerCase()

export interface AskUserQuestion {
  id: string
  prompt: string
  header?: string | null
  options: Array<{ label: string; description: string | null }>
  multi_select: boolean
  allow_free_text: boolean
  placeholder?: string | null
}

export function askPayload(args: JsonRecord): { questions: AskUserQuestion[] } {
  const raw = args.questions ?? (args.question == null ? [] : [{ prompt: args.question, options: args.options }])
  if (!Array.isArray(raw) || !raw.length) {
    throw new Error('ask_user requires an array of questions')
  }

  const ids = new Set<string>()
  const questions: AskUserQuestion[] = raw.slice(0, 4).map((item, index) => {
    const q = record(item)
    const prompt = clip(q.prompt ?? q.question, 800)
    if (!prompt) throw new Error('Each question requires a non-empty prompt')
    const original = text(q.id) || `q${index + 1}`
    let id = original
    let suffix = 2
    while (ids.has(id)) id = `${original}_${suffix++}`
    ids.add(id)

    const free = q.allow_free_text == null ? true : Boolean(q.allow_free_text)
    const labels = new Set<string>()
    const options: Array<{ label: string; description: string | null }> = []

    for (const rawOption of (q.options ?? []) as unknown[]) {
      if (!rawOption || (typeof rawOption !== 'string' && typeof rawOption !== 'object')) continue
      const option = typeof rawOption === 'string' ? { label: rawOption } : record(rawOption)
      const label = clip(option.label, 120)
      const description = clip(option.description, 200)
      if (!label || labels.has(key(label))) continue
      labels.add(key(label))
      options.push({ label, description })
      if (options.length >= 6) break
    }

    return {
      id,
      prompt,
      header: clip(q.header, 24, false),
      options,
      multi_select: Boolean(q.multi_select ?? q.multiSelect),
      allow_free_text: free,
      placeholder: clip(q.placeholder, 120)
    }
  })

  return { questions }
}

export const ASK_USER_SCHEMA = {
  type: 'function' as const,
  function: {
    name: 'ask_user',
    description:
      'Hỏi người học để làm rõ hoặc chọn hướng đi khi thiếu thông tin thật sự chặn việc làm tiếp. Hỏi gộp mọi câu trong MỘT lệnh (tối đa 4 câu, mỗi câu 2–6 lựa chọn). Lượt sẽ dừng chờ câu trả lời.',
    parameters: {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              prompt: { type: 'string', description: 'Câu hỏi hoặc lời dẫn' },
              header: { type: 'string', description: 'Tiêu đề ngắn (≤ 24 ký tự)' },
              options: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { label: { type: 'string' }, description: { type: 'string' } },
                  required: ['label']
                }
              },
              multi_select: { type: 'boolean' },
              allow_free_text: { type: 'boolean' },
              placeholder: { type: 'string' }
            },
            required: ['prompt', 'options']
          }
        }
      },
      required: ['questions']
    }
  }
}

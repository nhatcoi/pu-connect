import type { AiTemporaryEvent, AiTemporaryInput } from '@pu/schemas'
import { API_BASE_URL } from '@/lib/api-client'

// Chat tạm N7AI: POST + SSE (không dùng EventSource vì cần body); không lưu gì ở server
export async function streamTemporaryChat(input: AiTemporaryInput, onEvent: (e: AiTemporaryEvent) => void, signal: AbortSignal): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/ai/temporary/stream`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(input),
    signal
  })
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null
    throw new Error(body?.message || 'Không kết nối được N7AI')
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    // Mỗi sự kiện: dòng `data: {json}` kết thúc bằng dòng trống
    let at: number
    while ((at = buffer.indexOf('\n\n')) !== -1) {
      const line = buffer.slice(0, at).trim()
      buffer = buffer.slice(at + 2)
      if (line.startsWith('data:')) onEvent(JSON.parse(line.slice(5)) as AiTemporaryEvent)
    }
  }
}

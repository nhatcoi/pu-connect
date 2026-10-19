import type { AiConnectorId, AiStep, AiStepSource } from '@pu/schemas'

// Nhãn bước tìm nguồn lấy sẵn (prefetch) theo connector — chỉ connector chạy trước khi gọi model
const RETRIEVAL_LABELS: Partial<Record<AiConnectorId, string>> = {
  library: 'Tìm trong Thư viện PU',
  my_documents: 'Tìm trong tài liệu của tôi',
  my_groups: 'Xem nhóm học của tôi',
  web: 'Đọc trang web trong câu hỏi',
  web_search: 'Tìm trên web'
}
const DETAIL_CHARS = 60

const clip = (s: string) => (s.length > DETAIL_CHARS ? `${s.slice(0, DETAIL_CHARS - 1)}…` : s)

// Tiến trình 1 lượt trả lời N7AI: bước chuẩn bị (mục gắn @, tệp, bộ nhớ, tìm nguồn) + bước tool của agent
// Mỗi lần đổi ⇒ phát toàn bộ danh sách (message.progress thay thế, không cộng dồn); không chứa dữ liệu nguồn, chỉ nhãn + số lượng
export class AiProgress {
  private readonly prep: AiStep[] = []
  private tools: AiStep[] = []

  constructor(private readonly emit: (steps: AiStep[]) => void = () => undefined) {}

  get steps(): AiStep[] {
    return [...this.prep, ...this.tools].map((s) => ({ ...s }))
  }

  start(id: string, provider: AiStepSource, label: string, detail?: string) {
    this.prep.push({ id, provider, label, ...(detail ? { detail: clip(detail) } : {}), status: 'running' })
    this.publish()
  }

  done(id: string, detail?: string, status: AiStep['status'] = 'done') {
    const step = this.prep.find((s) => s.id === id)
    if (!step) return
    step.status = status
    if (detail !== undefined) step.detail = clip(detail)
    this.publish()
  }

  // Bước đã xong ngay (vd. đọc mục gắn @)
  note(id: string, provider: AiStepSource, label: string, detail?: string) {
    this.prep.push({ id, provider, label, ...(detail ? { detail: clip(detail) } : {}), status: 'done' })
    this.publish()
  }

  // Bước tìm nguồn: chạy ⇒ từ khóa; xong ⇒ số nguồn tìm được. "web" chỉ hiện khi câu hỏi có URL thật sự đọc được
  retrieval(connector: AiConnectorId, state: 'running' | 'done' | 'error', found = 0, query = '') {
    const label = RETRIEVAL_LABELS[connector]
    if (!label) return
    const id = `retrieve:${connector}`
    if (connector === 'web') {
      if (state === 'done' && found) this.note(id, connector, label, `${found} trang`)
      return
    }
    if (state === 'running') this.start(id, connector, label, query || undefined)
    else if (state === 'error') this.done(id, 'không truy cập được', 'error')
    else this.done(id, found ? `${found} nguồn` : 'không có nguồn phù hợp')
  }

  setTools(steps: AiStep[]) {
    this.tools = steps
    this.publish()
  }

  private publish() {
    this.emit(this.steps)
  }
}

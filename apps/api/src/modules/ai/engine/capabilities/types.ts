import type { LoopConfig } from '../core/contracts'
import type { JsonRecord, LoopPolicy, ToolSchema } from '../native/types'

/** Một công cụ do capability sở hữu: chạy tại chỗ, không đi qua nguồn tool ngoài */
export interface CapabilityTool {
  schema: ToolSchema
  run: (args: JsonRecord) => string
}

/** Phần mở rộng của vòng lặp theo chế độ học: chỉ dẫn riêng, công cụ riêng, chính sách kết thúc, ngân sách */
export interface LoopCapability {
  id: string
  block: string
  tools: CapabilityTool[]
  policy?: LoopPolicy
  budgets?: Partial<LoopConfig>
  /** Chạy trước khi một tool NGOÀI (không thuộc capability) được thực thi: trả chuỗi ⇒ từ chối lệnh với lỗi đó */
  guard?: (name: string, args: JsonRecord) => string | null
  /** Sau khi tool ngoài chạy xong: capability ghi nhận kết quả (vd. quiz đã được lưu) */
  observe?: (name: string, result: string) => void
}

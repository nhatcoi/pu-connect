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
}

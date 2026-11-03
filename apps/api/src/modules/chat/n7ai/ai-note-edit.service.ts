import { HttpException, HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common'
import type { AiNoteAskMode } from '@pu/schemas'
import { LlmService } from '../../ai/llm.service'

const ASK_MAX_TOKENS = 4096 // gồm cả token suy nghĩ; đoạn chọn tối đa ~8000 ký tự nên đủ dư

// Lệnh mặc định khi người dùng chỉ chọn chế độ, không gõ gì thêm
const DEFAULT_INSTRUCTION: Record<AiNoteAskMode, string> = {
  rewrite: 'Viết lại đoạn Markdown này cho mượt hơn, giữ nguyên ý, cấu trúc và giọng văn.',
  shorten: 'Rút gọn đoạn Markdown này, giữ lại thông tin chính, bớt câu chữ thừa.',
  expand: 'Viết thêm chi tiết hữu ích cho đoạn Markdown này, giữ đúng văn phong gốc.',
  none: 'Sửa đoạn Markdown này theo đúng yêu cầu của người dùng.'
}

const SYSTEM_PROMPT = `Bạn đang sửa một đoạn được chọn trong trình soạn ghi chú Markdown của N7AI.
Yêu cầu:
1. CHỈ trả về đoạn Markdown đã sửa, để thay thế trực tiếp đoạn đã chọn.
2. Không giải thích, không tiêu đề, không thêm tiền tố/hậu tố, không bọc \`\`\`.
3. Giữ cú pháp Markdown hợp lệ (danh sách, bảng, in đậm/nghiêng nếu có).
4. Không thêm thông tin bịa đặt; không nhắc tới việc bạn là AI hay đang dùng công cụ nào.`

// Bỏ \`\`\`markdown … \`\`\` nếu model lỡ bọc dù đã dặn không làm vậy
function stripFence(text: string): string {
  const m = /^```(?:markdown|md)?\n([\s\S]*)\n```$/.exec(text.trim())
  return (m ? m[1] : text).trim()
}

// Ask n7ai sửa ghi chú: đoạn đã chọn + lệnh ⇒ model trả đoạn Markdown đã sửa (không agent/tool, một lượt gọi thẳng)
@Injectable()
export class AiNoteEditService {
  constructor(private readonly llm: LlmService) {}

  async ask(userId: string, input: { selection: string; instruction?: string; mode?: AiNoteAskMode }): Promise<{ text: string }> {
    if (!this.llm.client) throw new ServiceUnavailableException('N7AI chưa sẵn sàng, bạn thử lại sau nhé')
    if (!(await this.llm.hasQuota(userId))) {
      await this.llm.logRejected(userId, 'note')
      throw new HttpException('Bạn đã dùng hết lượt N7AI hôm nay', HttpStatus.TOO_MANY_REQUESTS)
    }

    const mode = input.mode ?? 'none'
    const instruction = input.instruction?.trim() || DEFAULT_INSTRUCTION[mode]
    const started = Date.now()
    const runId = await this.llm.startRun({ requesterId: userId, trigger: 'note', task: 'note_edit' })
    try {
      const { text, usage, finishReason } = await this.llm.complete(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Chế độ: ${mode}\nYêu cầu: ${instruction}\n\nĐoạn đã chọn cần sửa:\n\`\`\`markdown\n${input.selection}\n\`\`\``
          }
        ],
        ASK_MAX_TOKENS
      )
      await this.llm.finishRun(runId, { usage, startedAt: started })
      const edited = stripFence(text)
      if (!edited) throw new Error(finishReason === 'length' ? 'truncated empty' : 'empty result')
      return { text: edited }
    } catch (err) {
      await this.llm.failRun(runId, err, started)
      throw new ServiceUnavailableException(this.llm.isBusyError(err) ? 'N7AI đang quá tải, bạn thử lại sau ít phút nhé' : 'N7AI chưa sửa được đoạn này, thử lại nhé')
    }
  }
}

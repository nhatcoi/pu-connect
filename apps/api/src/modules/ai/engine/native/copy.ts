import type { EngineCopy } from './types'

export const DEFAULT_COPY: EngineCopy = {
  settle: 'Đã hết lượt tìm kiếm. Không bắt đầu tra cứu mới; chỉ hoàn tất phần việc đã làm dở rồi trả lời người dùng ngay.',
  finish: 'Đã hết ngân sách gọi công cụ. Viết câu trả lời cuối cùng bằng dữ liệu hiện có, nêu ngắn gọn phần còn chưa chắc chắn, không gọi công cụ nữa.',
  continueTruncated: 'Câu trả lời trước dừng vì chạm giới hạn độ dài. Viết tiếp từ chỗ đã dừng, không lặp lại, và hoàn tất câu trả lời.',
  continueReasoning:
    'Vòng trước đã dùng hết ngân sách đầu ra cho phần suy nghĩ nội bộ nên chưa viết được gì. Không cân nhắc lại kế hoạch: hãy gọi công cụ cần thiết hoặc viết câu trả lời ngay.',
  emptyNudge: 'Vòng trước không có câu trả lời hay công cụ nào. Hãy gọi công cụ hoặc viết câu trả lời cho người dùng ngay bây giờ.',
  toolBatchTruncated: 'Câu trả lời của model bị cắt nên không công cụ nào trong lượt này được chạy. Gọi lại với đối số đầy đủ.',
  toolLimit: 'Công cụ này không được chạy vì vượt số lần gọi tối đa mỗi vòng. Nếu vẫn cần, gọi lại trong lô nhỏ hơn ở vòng sau.',
  toolsClosed: 'Đã hết lượt tra cứu nên không chạy thêm công cụ. Trả lời bằng dữ liệu đã có.',
  toolDuplicate: 'Lệnh gọi trùng với một lệnh khác trong cùng lô nên đã bỏ qua; dùng kết quả của lệnh đầu.',
  userSentWhileWorking: '[Người dùng gửi thêm tin này khi bạn đang làm việc. Tính đến nó từ giờ: trả lời luôn hoặc điều chỉnh việc đang làm.]',
  contextShortened: 'Đã rút gọn ngữ cảnh hội thoại để vừa giới hạn của model.'
}

export const MAX_TOOL_CALLS_PER_ROUND = 15
export const MAX_CALL_ARGS = 48_000

export function resolveCopy(copy?: Partial<EngineCopy>): EngineCopy {
  return { ...DEFAULT_COPY, ...Object.fromEntries(Object.entries(copy ?? {}).filter(([, v]) => typeof v === 'string' && v)) }
}

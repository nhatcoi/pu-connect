import { StateCreator } from 'zustand'
import type { ChatRef } from '@pu/schemas'

// Chuyển ngữ cảnh từ trang khác sang chat N7AI mới (vd. "Hỏi N7AI về bài viết"); ô soạn N7AI nhận rồi xóa
// One-shot handoff into a fresh N7AI chat: composer consumes it on mount
export interface AiHandoff {
  ref: ChatRef
  prompt: string
}

export interface AiHandoffSlice {
  aiHandoff: AiHandoff | null
  setAiHandoff: (handoff: AiHandoff | null) => void
}

export const createAiHandoffSlice: StateCreator<AiHandoffSlice, [], [], AiHandoffSlice> = (set) => ({
  aiHandoff: null,
  setAiHandoff: (aiHandoff) => set({ aiHandoff })
})

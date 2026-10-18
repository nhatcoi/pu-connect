import { HttpException, Injectable, Logger } from '@nestjs/common'
import type { ChatStudySetRef } from '@pu/schemas'
import type { AgentToolSession } from '../ai/agent-tools'
import { STUDY_KIND_LIST, aiParameters, kindByTool, studyFence, validateAiSet } from './kinds/study-kinds.registry'
import { StudyToolsService } from './study-tools.service'

const PROVIDER = 'my_study' // nhãn / icon bước "Học tập của tôi"
const PREFIX = `${PROVIDER}__`
const toolName = (tool: string) => `${PREFIX}${tool}`
const kindOf = (name: string) => (name.startsWith(PREFIX) ? kindByTool(name.slice(PREFIX.length)) : null)

// Bộ N7AI vừa tạo trong lượt trả lời ⇒ N7AiService ghi meta.studySet + chèn khối ```fence chuẩn vào tin
export interface CreatedStudySet {
  ref: ChatStudySetRef
  fence: string
}

export type StudyCreateSession = AgentToolSession & { created: () => CreatedStudySet | null }

const INSTRUCTIONS = [
  'Study-set tools (my_study__create_*) save a Flashcard deck or Quiz into the user\'s PU Connector Tools. The chat shows the saved set as an interactive card automatically.',
  'To produce flashcards or a quiz, ALWAYS call the matching create tool — never write ```flashcards / ```quiz blocks or list the cards/questions in your text. One set per reply.',
  'After the tool succeeds, reply with 1–2 short sentences (what the set covers, how many items) — do not repeat its content. If it fails, tell the user why.',
  ...STUDY_KIND_LIST.map((k) => `${toolName(k.ai.tool)}: ${k.ai.instructions}`)
]

const TOOLS: AgentToolSession['tools'] = STUDY_KIND_LIST.map((k) => ({
  type: 'function',
  function: { name: toolName(k.ai.tool), description: k.ai.description, parameters: aiParameters(k) }
}))

// Tool ghi cho N7AI: tạo bộ Flashcard / Quiz từ registry (chỉ thread N7AI riêng, chủ bộ = người hỏi, gắn với tin trả lời)
// Write tools for N7AI built from the kind registry; arguments are validated with the kind's zod schema
@Injectable()
export class StudyCreateToolsService {
  private readonly logger = new Logger(StudyCreateToolsService.name)

  constructor(private readonly tools: StudyToolsService) {}

  open(userId: string, messageId: string): StudyCreateSession {
    let created: CreatedStudySet | null = null
    return {
      tools: TOOLS,
      instructions: INSTRUCTIONS,
      created: () => created,
      describe: (name, args) => {
        const def = kindOf(name)
        if (!def) return null
        const title = typeof args.title === 'string' ? args.title.slice(0, 60) : undefined
        return { provider: PROVIDER, label: `Tạo bộ ${def.label}`, ...(title ? { detail: title } : {}) }
      },
      call: async (name, args) => {
        const def = kindOf(name)
        if (!def) return JSON.stringify({ error: 'Công cụ không được cấp quyền trong lượt hỏi này' })
        if (created) return JSON.stringify({ error: `Lượt này đã tạo bộ "${created.ref.title}". Mỗi câu trả lời chỉ tạo 1 bộ.` })

        const checked = validateAiSet(def, args)
        if ('issues' in checked) return JSON.stringify({ error: 'Tham số không hợp lệ, sửa rồi gọi lại', issues: checked.issues })
        const { set, skipped } = checked
        try {
          const ref = await this.tools.saveForMessage(userId, messageId, set)
          if (!ref) return JSON.stringify({ error: 'Tin này đã có bộ học tập' })
          created = { ref, fence: studyFence(def, set) }
          return JSON.stringify({
            saved: true,
            kind: def.kind,
            title: ref.title,
            items: set.items.length,
            ...(skipped.length ? { skipped } : {}),
            note: 'Saved to Tools and shown to the user as an interactive card. Reply with 1–2 sentences only.'
          })
        } catch (err) {
          if (err instanceof HttpException) return JSON.stringify({ error: err.message })
          this.logger.warn(`Không lưu được bộ N7AI (msg ${messageId}): ${(err as Error)?.message}`)
          return JSON.stringify({ error: 'Không lưu được bộ học tập, thử lại sau' })
        }
      },
      close: async () => undefined
    }
  }
}

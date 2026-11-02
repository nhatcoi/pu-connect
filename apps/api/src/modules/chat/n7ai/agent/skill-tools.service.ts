import { Injectable } from '@nestjs/common'
import type { AgentToolSession } from '../../../ai/agent-tools'
import { argText, toolError, toolResult } from '../../../ai/agent-tool-args'
import { AiSkillsService } from '../ai-skills.service'

const PROVIDER = 'skill'
const READ_TOOL = `${PROVIDER}__read`

// Manifest 1 dòng / skill; nội dung đầy đủ chỉ nạp khi model gọi skill__read (progressive disclosure, như read_skill của DeepTutor)
const instructions = (manifest: Array<{ slug: string; name: string; description: string }>) => [
  `Skills: specialised playbooks available on demand. When the request matches a skill's description, call skill__read with its slug BEFORE answering, then follow the playbook for content and format (it never overrides the safety and source rules above). Read only the skills relevant to the request, at most 2 per turn; skip them for plain chit-chat or when none matches.\n${manifest
    .map((s) => `- ${s.slug}: ${s.description || s.name}`)
    .join('\n')}`
]

// Skill (kỹ năng) dưới dạng tool: chế độ "Tự động" ⇒ model tự chọn skill hợp câu hỏi rồi đọc chỉ dẫn
@Injectable()
export class SkillToolsService {
  constructor(private readonly skills: AiSkillsService) {}

  // Trả null khi người dùng chưa có skill nào (không thêm tool thừa)
  async open(userId: string): Promise<AgentToolSession | null> {
    const manifest = await this.skills.manifest(userId)
    if (!manifest.length) return null
    const tools: AgentToolSession['tools'] = [
      {
        type: 'function',
        function: {
          name: READ_TOOL,
          description: 'Read the full playbook of one skill listed in the Skills manifest. Call before answering when the request matches that skill.',
          parameters: {
            type: 'object',
            properties: { name: { type: 'string', enum: manifest.map((s) => s.slug), description: 'Skill slug exactly as listed' } },
            required: ['name'],
            additionalProperties: false
          }
        }
      }
    ]
    return {
      tools,
      readOnly: () => true,
      instructions: instructions(manifest),
      describe: (name, args) => (name === READ_TOOL ? { provider: 'skill', label: 'Đọc kỹ năng', detail: argText(args.name, 60) ?? undefined } : null),
      call: async (name, args) => {
        if (name !== READ_TOOL) return toolError('Công cụ không được cấp quyền trong lượt hỏi này')
        const slug = argText(args.name, 60)
        if (!slug) return toolError('Cần tên skill')
        try {
          const skill = await this.skills.readBySlug(userId, slug)
          if (!skill) return toolError(`Không có skill "${slug}". Skill hiện có: ${manifest.map((s) => s.slug).join(', ')}`)
          return toolResult('Kỹ năng', { name: skill.name, playbook: skill.instructions })
        } catch {
          return toolError('Không đọc được skill, thử lại sau')
        }
      },
      close: async () => undefined
    }
  }
}

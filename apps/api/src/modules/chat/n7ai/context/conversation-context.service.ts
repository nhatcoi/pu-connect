import { Injectable } from '@nestjs/common'
import { DatabaseService } from '../../../../database/database.service'
import { attr, clip, dataText } from '../../../ai/context/context-budget'

const MEMBER_LIMIT = 30
const DESCRIPTION_CHARS = 400

// Khối <conversation> cho N7AI khi được @n7ai trong nhóm / chat cá nhân: biết đang ở đâu, nhóm học môn gì, có những ai
// Chỉ đọc từ hội thoại đang gọi; chỉ nạp khi có người gọi @n7ai (không đọc nền)
@Injectable()
export class ConversationContextService {
  constructor(private readonly db: DatabaseService) {}

  async block(conversationId: string): Promise<string> {
    const head = await this.db.query(
      `SELECT c.type, c.title, sg.name AS group_name, sg.description, sg.course_code, sg.course_name
       FROM conversations c LEFT JOIN study_groups sg ON sg.id = c.study_group_id
       WHERE c.id = $1`,
      [conversationId]
    )
    const c = head.rows[0]
    if (!c) return ''
    const members = await this.db.query(
      `SELECT u.display_name, m.role FROM conversation_members m JOIN users u ON u.id = m.user_id
       WHERE m.conversation_id = $1 AND m.left_at IS NULL
       ORDER BY (m.role = 'owner') DESC, m.joined_at LIMIT $2`,
      [conversationId, MEMBER_LIMIT + 1]
    )
    const names = members.rows.slice(0, MEMBER_LIMIT).map((m) => (m.role === 'owner' ? `${m.display_name} (trưởng nhóm)` : m.display_name))
    const more = members.rows.length > MEMBER_LIMIT ? ', …' : ''
    const title = c.group_name || c.title
    const course = c.course_code ? `${c.course_code}${c.course_name ? ` · ${c.course_name}` : ''}` : null
    const open = [
      `type="${c.type === 'group' ? 'group' : 'direct'}"`,
      title && `title="${attr(title)}"`,
      course && `course="${attr(course)}"`,
    ].filter(Boolean)
    const about = c.description ? `\nMô tả nhóm: ${dataText(clip(c.description, DESCRIPTION_CHARS))}` : ''
    return `<conversation ${open.join(' ')}>\nThành viên: ${dataText(names.join(', '))}${more}${about}\n</conversation>\n\n`
  }
}

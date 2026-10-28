import { Injectable } from '@nestjs/common'
import type { CommentItem } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { stripN7AiMention } from '../ai/ai.constants'
import { attr, clip, dataText, fitLines } from '../ai/context/context-budget'
import { blockExistsSql } from '../blocks/blocks.sql'

const POST_CHARS = 6000 // Nội dung bài
const THREAD_LIMIT = 12 // Bình luận trước đó trong cùng nhánh
const RELATED_LIMIT = 6 // Bình luận nổi bật ngoài nhánh
const COMMENT_CHARS = 700
const RELATED_CHARS = 320
const RELATED_BUDGET = 1800
const NO_USER = '00000000-0000-0000-0000-000000000000'

export interface PostContext {
  title: string
  content: string
  author: string
  kind: string
  tags: string[]
  course: string | null
  community: string | null
  resolved: boolean
  thread: { name: string; content: string }[]
  related: { name: string; content: string; likes: number; solution: boolean }[]
  question: string
  asker: string
}

// Ngữ cảnh N7AI khi được gọi trong bình luận: bài (kèm môn / cộng đồng / thẻ), nhánh đang hỏi, bình luận nổi bật ngoài nhánh
// Bài và bình luận ẩn danh vẫn che tác giả; người chặn nhau với người hỏi bị loại
@Injectable()
export class PostContextService {
  constructor(private readonly db: DatabaseService) {}

  async load(comment: CommentItem): Promise<PostContext | null> {
    // Không rõ người hỏi ⇒ UUID rỗng (không khớp quan hệ chặn nào)
    const asker = comment.author?.id ?? NO_USER
    const post = await this.db.query(
      `SELECT p.title, p.content, p.post_type, p.tags, p.is_resolved,
              CASE WHEN p.is_anonymous THEN 'Ẩn danh' ELSE u.display_name END AS author,
              CASE WHEN co.id IS NULL THEN NULL ELSE co.code || ' · ' || co.name END AS course, cm.name AS community
       FROM posts p JOIN users u ON u.id = p.author_id
       LEFT JOIN courses co ON co.id = p.course_id LEFT JOIN communities cm ON cm.id = p.community_id
       WHERE p.id = $1 AND p.hidden_at IS NULL`,
      [comment.postId]
    )
    const p = post.rows[0]
    if (!p) return null
    const blocked = `AND c.hidden_at IS NULL AND NOT ${blockExistsSql('$3::uuid', 'c.author_id')}`

    const thread = await this.db.query(
      `WITH RECURSIVE up AS (
         SELECT id, parent_id, created_at FROM comments WHERE id = $1
         UNION ALL
         SELECT c.id, c.parent_id, c.created_at FROM comments c JOIN up ON c.id = up.parent_id
       ), root AS (SELECT id FROM up WHERE parent_id IS NULL)
       SELECT c.id, CASE WHEN c.is_anonymous THEN 'Ẩn danh' ELSE u.display_name END AS name, c.content
       FROM comments c JOIN users u ON u.id = c.author_id
       WHERE (c.id = (SELECT id FROM root) OR c.parent_id = (SELECT id FROM root))
         AND c.id <> $1 AND c.created_at <= (SELECT created_at FROM comments WHERE id = $1) ${blocked}
       ORDER BY c.created_at DESC LIMIT $2`,
      [comment.id, THREAD_LIMIT, asker]
    )
    const inThread = thread.rows.map((r) => r.id)
    // Bình luận được chọn là lời giải / nhiều thích nhất, ngoài nhánh đang hỏi
    const related = await this.db.query(
      `SELECT CASE WHEN c.is_anonymous THEN 'Ẩn danh' ELSE u.display_name END AS name, c.content, c.likes_count, c.is_solution
       FROM comments c JOIN users u ON u.id = c.author_id
       WHERE c.post_id = $1 AND c.id <> $2 AND c.id <> ALL($4::uuid[]) AND c.parent_id IS NULL ${blocked}
         AND (c.is_solution OR c.likes_count > 0)
       ORDER BY c.is_solution DESC, c.likes_count DESC, c.created_at LIMIT ${RELATED_LIMIT}`,
      [comment.postId, comment.id, asker, inThread]
    )
    return {
      title: p.title || '',
      content: clip(p.content || '', POST_CHARS),
      author: p.author,
      kind: p.post_type,
      tags: p.tags ?? [],
      course: p.course,
      community: p.community,
      resolved: !!p.is_resolved,
      thread: thread.rows.reverse().map((r) => ({ name: r.name, content: clip(r.content, COMMENT_CHARS) })),
      related: related.rows.map((r) => ({ name: r.name, content: clip(r.content, RELATED_CHARS), likes: r.likes_count ?? 0, solution: !!r.is_solution })),
      question: stripN7AiMention(comment.content),
      asker: comment.author?.displayName || 'Người hỏi'
    }
  }
}

// Bài + nhánh + bình luận nổi bật: DỮ LIỆU, không phải chỉ dẫn (cùng quy ước khối <context>)
export function postBlock(ctx: Pick<PostContext, 'title' | 'content' | 'author'> & Partial<PostContext>): string {
  const meta = [
    ctx.author && `author="${attr(ctx.author)}"`,
    ctx.kind && ctx.kind !== 'general' && `type="${attr(ctx.kind)}"`,
    ctx.course && `course="${attr(ctx.course)}"`,
    ctx.community && `community="${attr(ctx.community)}"`,
    ctx.tags?.length && `tags="${attr(ctx.tags.join(', '))}"`,
    ctx.resolved && 'resolved="true"'
  ].filter(Boolean)
  const thread = ctx.thread?.length ? `\n<thread>\n${ctx.thread.map((c) => `${c.name}: ${dataText(c.content)}`).join('\n')}\n</thread>` : ''
  const lines = (ctx.related ?? []).map((c) => `${c.solution ? '[lời giải] ' : ''}${c.name} (${c.likes} thích): ${dataText(c.content)}`)
  const related = lines.length ? `\n<related>\n${fitLines(lines, RELATED_BUDGET).join('\n')}\n</related>` : ''
  return `<post title="${attr(ctx.title)}"${meta.length ? ` ${meta.join(' ')}` : ''}>\n${dataText(ctx.content)}\n</post>${thread}${related}\n\n`
}

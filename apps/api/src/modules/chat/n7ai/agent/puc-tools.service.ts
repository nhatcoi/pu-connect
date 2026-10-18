import { Injectable } from '@nestjs/common'
import type { SearchType } from '@pu/schemas'
import type { AgentStepInfo, AgentToolSession } from '../../../ai/agent-tools'
import { argEnum, argText, likeTerms, toolError, toolResult } from '../../../ai/agent-tool-args'
import { DatabaseService } from '../../../../database/database.service'
import { SearchService } from '../../../search/search.service'
import type { JoinableGroup } from './ai-actions'
import { APP_GUIDE } from './puc-app-guide'

const PROVIDER = 'puc'
const SEARCH_TOOL = `${PROVIDER}__search`
const HELP_TOOL = `${PROVIDER}__app_help`
const SEARCH_TYPES = ['all', 'courses', 'documents', 'posts', 'users', 'groups', 'communities'] as const
type PucSearchType = (typeof SEARCH_TYPES)[number]
const TYPE_LABELS: Record<PucSearchType, string> = {
  all: 'PU Connector',
  courses: 'học phần',
  documents: 'tài liệu',
  posts: 'bài viết',
  users: 'người dùng',
  groups: 'nhóm học',
  communities: 'cộng đồng'
}
// Giữ ≤ ngưỡng typeahead của SearchService ⇒ không ghi search_logs cho truy vấn của N7AI
const SEARCH_LIMIT = 5

const INSTRUCTIONS = [
  'PU Connector tools (puc__*) search this app (courses, documents & exams, posts, students, study groups, communities) and explain its features. Results only include what the user is allowed to see.',
  'Use them when the user looks for people, groups, materials or courses inside PU Connector, or asks how / where to do something in the app. Prefer the href from results when pointing to a page.',
  'Do not invent app features or pages that the tools do not return.'
]

const TOOLS: AgentToolSession['tools'] = [
  {
    type: 'function',
    function: {
      name: SEARCH_TOOL,
      description:
        'PU Connector: search courses, documents & exams, Q&A posts, students, study groups (with recruiting status) and communities. Each result has an app href.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Keywords, course code or #tag' },
          type: { type: 'string', enum: [...SEARCH_TYPES], description: 'Restrict to one kind; default all' }
        },
        required: ['query'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: HELP_TOOL,
      description: 'PU Connector: how / where to use app features (feed, search, courses & study groups, communities, tools, messages, N7AI, settings). Returns page href and short how-to.',
      parameters: {
        type: 'object',
        properties: { topic: { type: 'string', description: 'What the user wants to do; omit to list all features' } },
        additionalProperties: false
      }
    }
  }
]

const unaccent = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
const clip = (s: string | null | undefined, max = 160) => (s ? (s.length > max ? `${s.slice(0, max - 1)}…` : s) : undefined)

// Tool về chính PU Connector: tìm trong app (dùng SearchService ⇒ đúng quyền xem) + hướng dẫn tính năng
@Injectable()
export class PucToolsService {
  constructor(
    private readonly search: SearchService,
    private readonly db: DatabaseService
  ) {}

  open(userId: string): AgentToolSession {
    return {
      tools: TOOLS,
      instructions: INSTRUCTIONS,
      describe,
      call: async (name, args) => {
        try {
          if (name === SEARCH_TOOL) return toolResult('PU Connector', await this.find(userId, args))
          if (name === HELP_TOOL) return toolResult('PU Connector', appHelp(argText(args.topic, 120)))
          return toolError('Công cụ không được cấp quyền trong lượt hỏi này')
        } catch {
          return toolError('Không tìm được trong PU Connector, thử lại sau')
        }
      },
      close: async () => undefined
    }
  }

  // Nhóm học người dùng còn tham gia được (đang tuyển, chưa đủ, chưa là thành viên) ⇒ kiểm dòng [tham gia]
  async joinableGroups(userId: string, ids: string[]): Promise<Map<string, JoinableGroup>> {
    if (!ids.length) return new Map()
    const res = await this.db.query(
      `SELECT g.id, g.name, g.course_code FROM study_groups g
       WHERE g.id = ANY($1::uuid[]) AND g.status = 'recruiting' AND g.current_members < g.max_members
         AND NOT EXISTS (SELECT 1 FROM study_group_members m WHERE m.group_id = g.id AND m.user_id = $2)`,
      [ids, userId]
    )
    return new Map(res.rows.map((r) => [r.id, { id: r.id, name: r.name, courseCode: r.course_code }]))
  }

  private async find(userId: string, args: Record<string, unknown>) {
    const q = argText(args.query, 100)
    if (!q) return { error: 'Thiếu từ khóa' }
    const type = argEnum(args.type, SEARCH_TYPES) ?? 'all'
    const [found, communities] = await Promise.all([
      type === 'communities' ? null : this.search.search({ q, type: type as SearchType, limit: SEARCH_LIMIT, offset: 0 }, userId),
      type === 'all' || type === 'communities' ? this.communities(q) : []
    ])
    return {
      courses: found?.courses.map((c) => ({ code: c.code, name: c.name, href: `/courses/${c.code}` })),
      documents: found?.documents.map((d) => ({
        title: d.title,
        course: d.courseCode ?? undefined,
        description: clip(d.description),
        href: `/search?q=${encodeURIComponent(d.title)}&type=documents`
      })),
      posts: found?.posts.map((p) => ({ title: p.title || clip(p.content, 80), excerpt: clip(p.content), author: p.author.displayName, href: `/post/${p.id}` })),
      users: found?.users.map((u) => ({ name: u.displayName, username: u.username, faculty: u.faculty ?? undefined, href: `/${u.username}` })),
      groups: found?.groups.map((g) => ({
        id: g.id,
        name: g.name,
        course: g.courseCode ?? undefined,
        topic: g.topic,
        members: `${g.currentMembersCount}/${g.maxMembers}`,
        status: g.status,
        href: g.courseCode ? `/courses/${g.courseCode}` : '/courses'
      })),
      communities: communities.length ? communities : undefined
    }
  }

  private async communities(q: string) {
    const terms = likeTerms(q)
    if (!terms.length) return []
    const res = await this.db.query(
      `SELECT slug, name, left(description, 160) AS description, members_count FROM communities
       WHERE NOT EXISTS (SELECT 1 FROM unnest($1::text[]) w
                         WHERE NOT (immutable_unaccent(lower(name || ' ' || description)) LIKE '%' || immutable_unaccent(w) || '%'))
       ORDER BY members_count DESC LIMIT ${SEARCH_LIMIT}`,
      [terms]
    )
    return res.rows.map((r) => ({ name: r.name, description: r.description, members: r.members_count, href: `/c/${r.slug}` }))
  }
}

// Hướng dẫn: khớp từ khóa (bỏ dấu) với danh mục; không khớp / không có chủ đề ⇒ cả danh mục rút gọn
function appHelp(topic: string | null) {
  const words = topic ? unaccent(topic).split(/\s+/).filter((w) => w.length >= 2) : []
  const scored = APP_GUIDE.map((e) => ({ e, score: words.filter((w) => e.keywords.includes(w) || unaccent(e.name).includes(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  if (scored.length) return scored.slice(0, 3).map(({ e }) => ({ feature: e.name, href: e.href, how: e.how }))
  return APP_GUIDE.map((e) => ({ feature: e.name, href: e.href }))
}

// Nhãn bước — chỉ từ khóa người dùng / model đưa vào
function describe(name: string, args: Record<string, unknown>): AgentStepInfo | null {
  if (name === SEARCH_TOOL) {
    const type = argEnum(args.type, SEARCH_TYPES) ?? 'all'
    const query = argText(args.query, 60)
    return { provider: PROVIDER, label: `Tìm ${TYPE_LABELS[type]}`, ...(query ? { detail: query } : {}) }
  }
  if (name === HELP_TOOL) {
    const topic = argText(args.topic, 60)
    return { provider: PROVIDER, label: 'Xem hướng dẫn PU Connector', ...(topic ? { detail: topic } : {}) }
  }
  return null
}

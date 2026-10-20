import { Injectable } from '@nestjs/common'
import type { AiConnectorId, ChatRef, SearchType } from '@pu/schemas'
import type { AgentStepInfo, AgentToolSession } from '../../../ai/agent-tools'
import { argEnum, argText, likeTerms, toolError, toolResult } from '../../../ai/agent-tool-args'
import { AgentSources } from '../../../ai/agent-sources'
import { RagSearchService } from '../../../ai/rag/rag-search.service'
import { toTsQuery } from '../../../ai/ai.retrieval'
import { ChatRefsService } from '../../refs/chat-refs.service'
import { DatabaseService } from '../../../../database/database.service'
import { SearchService } from '../../../search/search.service'
import type { JoinableGroup } from './ai-actions'
import { APP_GUIDE } from './puc-app-guide'

const PROVIDER = 'puc'
const SEARCH_TOOL = `${PROVIDER}__search`
const READ_TOOL = `${PROVIDER}__read`
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
  'General knowledge and greetings need no search. Prefer this app for requests about its materials. Batch up to three distinct keyword variants in queries in ONE search call; do not repeat a successful search just to restate it.',
  'Search returns excerpts and numbered sources n. For requests to FIND, LIST or RECOMMEND materials, return the matching list immediately; do NOT call puc__read or search again merely to add descriptions or course context. Read deeper ONLY when the user asks to summarize, explain, compare or quote source CONTENT. Use source n values for citations; never invent them.',
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
          query: { type: 'string', description: 'Main keywords, course code or #tag' },
          queries: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 3,
            description: 'Optional alternative keywords/synonyms, searched together with query in this call (at most 3 distinct queries total)'
          },
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
      name: READ_TOOL,
      description:
        'Read source CONTENT for an explicit summarize/explain/compare/quote request. Never use for requests just to find/list/recommend materials; search previews already suffice.',
      parameters: {
        type: 'object',
        properties: { type: { type: 'string', enum: ['post', 'document'] }, id: { type: 'string' } },
        required: ['type', 'id'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: HELP_TOOL,
      description:
        'PU Connector: how / where to use app features (feed, search, courses & study groups, communities, tools, messages, N7AI, settings). Returns page href and short how-to.',
      parameters: {
        type: 'object',
        properties: { topic: { type: 'string', description: 'What the user wants to do; omit to list all features' } },
        additionalProperties: false
      }
    }
  }
]

const unaccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

// Tool về chính PU Connector: tìm trong app (dùng SearchService ⇒ đúng quyền xem) + hướng dẫn tính năng
@Injectable()
export class PucToolsService {
  constructor(
    private readonly search: SearchService,
    private readonly db: DatabaseService,
    private readonly rag: RagSearchService,
    private readonly refs: ChatRefsService
  ) {}

  open(userId: string, connectors: AiConnectorId[] = ['library'], catalog = new AgentSources([]), publicOnly = false): AgentToolSession {
    const readable = new Map<string, ChatRef>()
    const library = connectors.includes('library')
    return {
      tools: publicOnly ? TOOLS.filter((t) => t.type === 'function' && [SEARCH_TOOL, READ_TOOL].includes(t.function.name)) : TOOLS,
      readOnly: () => true,
      instructions: INSTRUCTIONS,
      describe,
      call: async (name, args) => {
        try {
          if (name === SEARCH_TOOL) {
            const type = argEnum(args.type, SEARCH_TYPES) ?? 'all'
            if (publicOnly && !['all', 'posts', 'documents'].includes(type)) return toolError('Nhóm chỉ dùng bài viết và tài liệu công khai')
            if (!library && (type === 'posts' || type === 'documents')) return toolError('Thư viện PU chưa được bật cho lượt hỏi này')
            const queries = [
              ...new Set([args.query, ...(Array.isArray(args.queries) ? args.queries : [])].map((q) => argText(q, 100)).filter((q): q is string => !!q))
            ].slice(0, 3)
            if (!queries.length) return toolError('Thiếu từ khóa')
            const results = await Promise.all(queries.map((q) => this.find(userId, { ...args, query: q }, library, catalog, readable, publicOnly)))
            const merged: Record<string, unknown[]> = {}
            for (const result of results)
              for (const [key, values] of Object.entries(result)) {
                if (!Array.isArray(values)) continue
                const all = [...(merged[key] ?? []), ...values]
                merged[key] = [...new Map(all.map((v) => [v.id ?? v.href ?? v.name, v])).values()].slice(0, SEARCH_LIMIT)
              }
            return toolResult('PU Connector', {
              ...merged,
              guidance:
                'If these matches satisfy a find/list/recommend request, answer now using titles, excerpts and hrefs. Do not read deeper or repeat search for cosmetic completeness.'
            })
          }
          if (name === READ_TOOL) {
            const key = `${args.type}:${args.id}`
            const ref = readable.get(key)
            if (!ref) return toolError('Chỉ đọc mục đã trả về từ tìm kiếm trong lượt này')
            const source = (await this.refs.sources(userId, [ref]))[0]
            if (!source || (publicOnly && !(await this.publicIds([ref])).has(ref.id))) return toolError('Nguồn không tồn tại hoặc bạn không còn quyền xem')
            return toolResult('PU Connector', { ...catalog.preview(source), content: source.body.slice(0, 8000) })
          }
          if (name === HELP_TOOL && !publicOnly) return toolResult('PU Connector', appHelp(argText(args.topic, 120)))
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

  private async find(
    userId: string,
    args: Record<string, unknown>,
    library: boolean,
    catalog: AgentSources,
    readable: Map<string, ChatRef>,
    publicOnly: boolean
  ) {
    const q = argText(args.query, 100)
    if (!q) return { error: 'Thiếu từ khóa' }
    const type = argEnum(args.type, SEARCH_TYPES) ?? 'all'
    const [found, communities, sources] = await Promise.all([
      this.appSearch(userId, q, type, publicOnly),
      !publicOnly && (type === 'all' || type === 'communities') ? this.communities(q) : [],
      library && ['all', 'posts', 'documents'].includes(type) ? this.findSources(userId, q, type) : []
    ])
    const visible = publicOnly
      ? await this.publicIds([
          ...(found?.documents ?? []).map((d) => ({ type: 'document' as const, id: d.id })),
          ...(found?.posts ?? []).map((p) => ({ type: 'post' as const, id: p.id })),
          ...sources.filter((s) => s.type === 'document' || s.type === 'post').map((s) => ({ type: s.type as 'document' | 'post', id: s.id }))
        ])
      : null
    const previews = (kind: 'post' | 'document') => {
      const byId = new Map(sources.filter((s) => s.type === kind).map((s) => [s.id, s]))
      return [...byId.values()]
        .filter((s) => !visible || visible.has(s.id))
        .slice(0, SEARCH_LIMIT)
        .map((source) => {
          readable.set(`${source.type}:${source.id}`, { type: kind, id: source.id, title: source.title })
          return catalog.preview(source)
        })
    }
    return {
      courses: publicOnly ? undefined : found?.courses.map((c) => ({ code: c.code, name: c.name, href: `/courses/${c.code}` })),
      documents: library ? previews('document') : undefined,
      posts: library ? previews('post') : undefined,
      users: publicOnly
        ? undefined
        : found?.users.map((u) => ({ name: u.displayName, username: u.username, faculty: u.faculty ?? undefined, href: `/${u.username}` })),
      groups: publicOnly
        ? undefined
        : found?.groups.map((g) => ({
            id: g.id,
            name: g.name,
            course: g.courseCode ?? undefined,
            topic: g.topic,
            members: `${g.currentMembersCount}/${g.maxMembers}`,
            status: g.status,
            href: g.courseCode ? `/courses/${g.courseCode}` : '/courses'
          })),
      communities: !publicOnly && communities.length ? communities : undefined
    }
  }

  private async appSearch(userId: string, q: string, type: PucSearchType, publicOnly: boolean) {
    const empty = { courses: [], documents: [], posts: [], users: [], groups: [] }
    if (type === 'communities' || type === 'documents' || type === 'posts' || publicOnly) return empty
    const types: SearchType[] = type === 'all' ? ['courses', 'users', 'groups'] : [type as SearchType]
    const results = await Promise.all(types.map((kind) => this.search.search({ q, type: kind, limit: SEARCH_LIMIT, offset: 0 }, userId)))
    return {
      courses: results.flatMap((r) => r.courses),
      documents: results.flatMap((r) => r.documents),
      posts: results.flatMap((r) => r.posts),
      users: results.flatMap((r) => r.users),
      groups: results.flatMap((r) => r.groups)
    }
  }

  private async publicIds(refs: Pick<ChatRef, 'type' | 'id'>[]) {
    const rows = await this.db.query(
      `SELECT id FROM documents WHERE id = ANY($1::uuid[]) AND visibility = 'public'
       UNION ALL SELECT id FROM posts WHERE id = ANY($2::uuid[]) AND visibility = 'public' AND hidden_at IS NULL`,
      [refs.filter((r) => r.type === 'document').map((r) => r.id), refs.filter((r) => r.type === 'post').map((r) => r.id)]
    )
    return new Set<string>(rows.rows.map((r) => r.id))
  }

  private async findSources(userId: string, query: string, type: PucSearchType) {
    const prepared = await this.rag.prepare(query, toTsQuery(query))
    const options = { limit: SEARCH_LIMIT, bodyChars: 1600 }
    const results = await Promise.all([
      type !== 'documents' ? this.rag.posts(prepared, userId, options) : [],
      type !== 'posts' ? this.rag.documents(prepared, userId, options) : []
    ])
    return results.flat()
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
  const words = topic
    ? unaccent(topic)
        .split(/\s+/)
        .filter((w) => w.length >= 2)
    : []
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
  if (name === READ_TOOL) return { provider: PROVIDER, label: 'Đọc chi tiết nguồn' }
  if (name === HELP_TOOL) {
    const topic = argText(args.topic, 60)
    return { provider: PROVIDER, label: 'Xem hướng dẫn PU Connector', ...(topic ? { detail: topic } : {}) }
  }
  return null
}

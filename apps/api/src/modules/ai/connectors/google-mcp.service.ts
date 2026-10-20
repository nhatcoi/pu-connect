import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { DatabaseService } from '../../../database/database.service'
import { GoogleOAuthService } from './google-oauth.service'
import type { AgentTool, AgentToolSession } from '../agent-tools'
import {
  DEFAULT_GOOGLE_WORKSPACE_MCP_URL,
  GOOGLE_MCP_PROVIDERS,
  describeToolCall,
  googleMcpError,
  isGoogleProvider,
  isGoogleWriteTool,
  type GoogleProvider
} from './google-mcp.providers'

const TIMEOUT = 15_000
const MAX_TOOLS = 32
const MAX_RESULT_CHARS = 12_000

// Chỉ dẫn cho model khi có connector Google (kể cả khi chỉ có lỗi kết nối cần báo)
const GOOGLE_INSTRUCTIONS = [
  'Google connectors provide access to the user Google Drive, Calendar, Gmail, Forms, Sheets and Tasks. Default timezone Asia/Ho_Chi_Minh.',
  'For questions about connected Google data, call the relevant tools; do not claim to have read data without a successful tool result.',
  'Choose calendar IDs, date ranges and search queries from the user request. Discover calendars and task lists when needed. Paginate or narrow searches when results are truncated.',
  'Never send mail or delete external data. Google Drive, Calendar and Gmail are strictly read-only.',
  'For Google Forms: when requested to create a form or survey, call create_form to initialize the form, then call batch_update_form to add questions, options, and items. Always provide the responder URI and edit URI returned in the response to the user so they can view and edit the form.',
  'For Google Sheets: use list_spreadsheets or search_drive_files to discover spreadsheets. Read structured data using read_sheet_values with A1 notation. When asked to create or append, use create_spreadsheet or append_table_rows and provide the spreadsheet URL.',
  'For Google Tasks: use list_tasks to check pending or completed tasks. When the user asks to add or remember a deadline, reminder, or todo, call manage_task with task_list_id (default "@default" if not specified), title, notes, and due date in RFC3339 format.',
  'Never invent citation numbers for Google results; they are separate from numbered PU context sources.',
  'Use only genuine source URLs present in tool data. Report connector errors or missing permissions honestly.'
]

// One session per reply/account; never share a bearer token or MCP client across users.
// Bearer tokens only go to the configured workspace-mcp endpoint (localhost by default).
@Injectable()
export class GoogleMcpService {
  private readonly endpoint: string
  // Schemas only, keyed by account/provider. Never cache tokens, results or live clients.
  private readonly catalogs = new Map<string, { expires: number; tools: AgentTool[]; grant: string }>()

  constructor(
    private readonly oauth: GoogleOAuthService,
    private readonly db: DatabaseService,
    config: ConfigService
  ) {
    this.endpoint = new URL(config.get<string>('GOOGLE_WORKSPACE_MCP_URL') || DEFAULT_GOOGLE_WORKSPACE_MCP_URL).href
  }

  async open(
    userId: string,
    selected: readonly string[],
    signal: AbortSignal,
    options: { lazy?: boolean } = {}
  ): Promise<AgentToolSession & { errors: string[] }> {
    if (options.lazy) return this.lazy(userId, selected, signal)
    const clients: Client[] = []
    const errors: string[] = []
    const tools: AgentToolSession['tools'] = []
    const allowed = new Map<string, { provider: GoogleProvider; client: Client; tool: Tool }>()
    const providers = [...new Set(selected)].filter(isGoogleProvider)
    const grants = new Map<GoogleProvider, string>()
    await Promise.all(
      providers.map(async (provider) => {
        const config = GOOGLE_MCP_PROVIDERS[provider]
        let client: Client | undefined
        try {
          const linked = await this.db.query('SELECT updated_at FROM user_connectors WHERE user_id = $1 AND provider = $2', [userId, provider])
          if (linked.rows.length) grants.set(provider, String(linked.rows[0].updated_at))
          let token = linked.rows.length ? await this.oauth.accessToken(userId, provider) : null
          if (!token) throw new Error('not_connected')
          client = new Client({ name: 'pu-connector-n7ai', version: '1.0.0' })
          clients.push(client)
          let refreshed = false
          const transport = new StreamableHTTPClientTransport(new URL(this.endpoint), {
            requestInit: { headers: { Authorization: `Bearer ${token}` }, redirect: 'error' },
            fetch: async (url, init) => {
              if (new URL(url instanceof Request ? url.url : String(url)).href !== this.endpoint) throw new Error('Unexpected MCP endpoint')
              const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT), ...(init?.signal ? [init.signal] : [])])
              const send = () => {
                const headers = new Headers(init?.headers)
                headers.set('Authorization', `Bearer ${token}`)
                return fetch(url, { ...init, headers, redirect: 'error', signal: requestSignal })
              }
              const response = await send()
              if (response.status !== 401 || refreshed) return response
              refreshed = true
              const fresh = await this.oauth.accessToken(userId, provider, true)
              if (!fresh) return response
              await response.body?.cancel()
              token = fresh
              return send()
            }
          })
          const initializing = AbortSignal.any([signal, AbortSignal.timeout(12_000)])
          await client.connect(transport, { signal: initializing, timeout: TIMEOUT })
          let cursor: string | undefined
          const seen = new Set<string>()
          do {
            const page = await client.listTools(cursor ? { cursor } : undefined, { signal: initializing, timeout: TIMEOUT })
            for (const tool of page.tools) {
              // Names are checked in code; write tools only permitted if explicitly allowed and recognized
              if (
                !(config.tools as readonly string[]).includes(tool.name) ||
                (tool.annotations?.readOnlyHint === false && !isGoogleWriteTool(tool.name)) ||
                tools.length >= MAX_TOOLS
              )
                continue
              const name = `${provider}__${tool.name}`
              if (allowed.has(name)) continue
              allowed.set(name, { provider, client, tool })
              tools.push({
                type: 'function',
                function: { name, description: `${config.name}: ${(tool.description ?? tool.name).slice(0, 1500)}`, parameters: tool.inputSchema }
              })
            }
            cursor = page.nextCursor
            if (cursor && seen.has(cursor)) break
            if (cursor) seen.add(cursor)
          } while (cursor && seen.size < 5 && tools.length < MAX_TOOLS)
          if (![...allowed.values()].some((entry) => entry.provider === provider)) throw new Error('no_tools')
        } catch (error) {
          for (const [name, entry] of allowed) if (entry.provider === provider) allowed.delete(name)
          for (let i = tools.length - 1; i >= 0; i--) {
            const tool = tools[i]
            if (tool.type === 'function' && tool.function.name.startsWith(`${provider}__`)) tools.splice(i, 1)
          }
          if (client) await client.close().catch(() => undefined)
          const message =
            error instanceof Error && error.message === 'not_connected' ? 'Chưa kết nối hoặc phiên hết hạn — hãy kết nối lại' : googleMcpError(error)
          errors.push(`${config.name}: ${message}`)
          await this.record(userId, provider, message)
        }
      })
    )
    for (const provider of providers) {
      const scoped = tools.filter((tool) => tool.type === 'function' && tool.function.name.startsWith(`${provider}__`))
      const key = `${userId}:${provider}`
      if (scoped.length) {
        this.catalogs.delete(key)
        this.catalogs.set(key, { expires: Date.now() + 300_000, tools: scoped, grant: grants.get(provider) ?? '' })
        while (this.catalogs.size > 100) this.catalogs.delete(this.catalogs.keys().next().value!)
      } else this.catalogs.delete(key)
    }
    return {
      tools,
      readOnly: (name) => !isGoogleWriteTool(name),
      errors,
      instructions: tools.length || errors.length ? [...GOOGLE_INSTRUCTIONS, ...errors] : [],
      describe: (name, args) => {
        const entry = allowed.get(name)
        return entry ? { provider: entry.provider, ...describeToolCall(entry.tool.name, args) } : null
      },
      call: async (name, args, callSignal = signal) => {
        const entry = allowed.get(name)
        if (!entry) return JSON.stringify({ error: 'Công cụ không được cấp quyền trong lượt hỏi này' })
        const { provider, client, tool } = entry
        try {
          const connected = await this.db.query('SELECT 1 FROM user_connectors WHERE user_id = $1 AND provider = $2', [userId, provider])
          if (!connected.rows.length) throw new Error('disconnected')
          const result = await client.callTool({ name: tool.name, arguments: args }, undefined, {
            signal: AbortSignal.any([signal, callSignal]),
            timeout: TIMEOUT
          })
          if (result.isError) {
            await this.record(userId, provider, 'MCP không thực hiện được truy vấn. Kiểm tra tham số hoặc kết nối lại')
          } else await this.record(userId, provider, null)
          // Only text/structured data enter model context. Never follow returned resource URLs.
          const content = Array.isArray(result.content)
            ? result.content.flatMap((block: unknown) =>
                block && typeof block === 'object' && 'type' in block && block.type === 'text' && 'text' in block && typeof block.text === 'string'
                  ? [{ type: 'text', text: block.text }]
                  : []
              )
            : []
          const text = JSON.stringify({ provider: GOOGLE_MCP_PROVIDERS[provider].name, isError: !!result.isError, data: result.structuredContent ?? content })
          return text.length <= MAX_RESULT_CHARS
            ? text
            : JSON.stringify({
                provider,
                truncated: true,
                data: text.slice(0, MAX_RESULT_CHARS / 2 - 512),
                note: 'Kết quả quá dài, dùng bộ lọc hoặc phân trang để đọc tiếp'
              })
        } catch (error) {
          const message = error instanceof Error && error.message === 'disconnected' ? 'Đã ngắt kết nối Google' : googleMcpError(error)
          await this.record(userId, provider, message)
          return JSON.stringify({ error: message, provider: GOOGLE_MCP_PROVIDERS[provider].name })
        }
      },
      close: async () => {
        await Promise.allSettled(clients.map((client) => client.close()))
      }
    }
  }

  private async lazy(userId: string, selected: readonly string[], signal: AbortSignal): Promise<AgentToolSession & { errors: string[] }> {
    const requested = [...new Set(selected)].filter(isGoogleProvider)
    let providers: GoogleProvider[] = []
    if (requested.length) {
      const linked = await this.db.query('SELECT provider, updated_at FROM user_connectors WHERE user_id = $1 AND provider = ANY($2::text[])', [
        userId,
        requested
      ])
      // Chỉ cấp tool cho dịch vụ đã kết nối: chưa kết nối thì model không thấy ⇒ không gọi nhầm rồi báo lỗi
      providers = requested.filter((p) => linked.rows.some((r) => r.provider === p))
      for (const provider of requested) {
        const grant = linked.rows.find((r) => r.provider === provider)
        const key = `${userId}:${provider}`
        if (!grant || this.catalogs.get(key)?.grant !== String(grant.updated_at)) this.catalogs.delete(key)
      }
    }
    let connectionMs = 0
    const opened = new Map<GoogleProvider, Promise<Awaited<ReturnType<GoogleMcpService['open']>>>>()
    let closed = false
    const ensure = (provider: GoogleProvider) => {
      if (closed || signal.aborted) throw new Error('MCP session closed')
      let pending = opened.get(provider)
      if (!pending) {
        const started = Date.now()
        pending = this.open(userId, [provider], signal).finally(() => {
          connectionMs += Date.now() - started
        })
        opened.set(provider, pending)
      }
      return pending
    }
    const catalog = (provider: GoogleProvider) => {
      const cached = this.catalogs.get(`${userId}:${provider}`)
      if (cached && cached.expires > Date.now()) return cached.tools
      return [
        {
          type: 'function' as const,
          function: {
            name: `${provider}__discover_tools`,
            description: `Discover the read-only ${GOOGLE_MCP_PROVIDERS[provider].name} tools and their schemas. Call only for questions requiring this Google account. The actual tools become available next round.`,
            parameters: { type: 'object', properties: {}, additionalProperties: false }
          }
        }
      ]
    }
    return {
      get tools() {
        return providers.flatMap(catalog)
      },
      connectionMs: () => connectionMs,
      errors: [],
      instructions: providers.length ? GOOGLE_INSTRUCTIONS : [],
      readOnly: (name) => !isGoogleWriteTool(name),
      describe: (name, args) => {
        const provider = providers.find((p) => name.startsWith(`${p}__`))
        if (!provider) return null
        return {
          provider,
          ...(name.endsWith('__discover_tools')
            ? { label: `Kết nối ${GOOGLE_MCP_PROVIDERS[provider].name}` }
            : describeToolCall(name.slice(provider.length + 2), args))
        }
      },
      call: async (name, args, callSignal = signal) => {
        const provider = providers.find((p) => catalog(p).some((t) => t.type === 'function' && t.function.name === name))
        if (!provider) return JSON.stringify({ error: 'Công cụ không được cấp quyền trong lượt hỏi này' })
        const session = await ensure(provider)
        if (session.errors.length) return JSON.stringify({ error: session.errors.join('; ') })
        if (name === `${provider}__discover_tools`)
          return JSON.stringify({
            availableTools: session.tools.flatMap((t) => (t.type === 'function' ? [t.function.name] : [])),
            note: 'Use these tools if needed; they are available next round.'
          })
        if (callSignal.aborted) return JSON.stringify({ error: 'Lượt gọi công cụ đã hết thời gian' })
        return session.call(name, args, callSignal)
      },
      close: async () => {
        closed = true
        await Promise.allSettled([...opened.values()].map(async (pending) => (await pending).close()))
      }
    }
  }

  private async record(userId: string, provider: GoogleProvider, error: string | null) {
    await this.db
      .query(
        `UPDATE user_connectors SET last_error = $3, last_used_at = CASE WHEN $3::text IS NULL THEN NOW() ELSE last_used_at END WHERE user_id = $1 AND provider = $2`,
        [userId, provider, error]
      )
      .catch(() => undefined)
  }
}

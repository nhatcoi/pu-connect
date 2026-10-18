import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type OpenAI from 'openai'
import { DatabaseService } from '../../../database/database.service'
import { GoogleOAuthService } from './google-oauth.service'
import { DEFAULT_GOOGLE_WORKSPACE_MCP_URL, GOOGLE_MCP_PROVIDERS, googleMcpError, isGoogleProvider, type GoogleProvider } from './google-mcp.providers'

const TIMEOUT = 15_000
const MAX_TOOLS = 32
const MAX_RESULT_CHARS = 12_000

export interface GoogleMcpSession {
  tools: OpenAI.Chat.Completions.ChatCompletionTool[]
  errors: string[]
  call: (name: string, args: Record<string, unknown>) => Promise<string>
  // Tool đã cấp trong lượt ⇒ provider + tên gốc (null nếu không được phép)
  resolve: (name: string) => { provider: GoogleProvider; tool: string } | null
  close: () => Promise<void>
}

// One session per reply/account; never share a bearer token or MCP client across users.
// Bearer tokens only go to the configured workspace-mcp endpoint (localhost by default).
@Injectable()
export class GoogleMcpService {
  private readonly endpoint: string

  constructor(
    private readonly oauth: GoogleOAuthService,
    private readonly db: DatabaseService,
    config: ConfigService
  ) {
    this.endpoint = new URL(config.get<string>('GOOGLE_WORKSPACE_MCP_URL') || DEFAULT_GOOGLE_WORKSPACE_MCP_URL).href
  }

  async open(userId: string, selected: readonly string[], signal: AbortSignal): Promise<GoogleMcpSession> {
    const clients: Client[] = []
    const errors: string[] = []
    const tools: GoogleMcpSession['tools'] = []
    const allowed = new Map<string, { provider: GoogleProvider; client: Client; tool: Tool }>()
    const providers = [...new Set(selected)].filter(isGoogleProvider)
    await Promise.all(
      providers.map(async (provider) => {
        const config = GOOGLE_MCP_PROVIDERS[provider]
        let client: Client | undefined
        try {
          const linked = await this.db.query('SELECT 1 FROM user_connectors WHERE user_id = $1 AND provider = $2', [userId, provider])
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
          await client.connect(transport, { signal, timeout: TIMEOUT })
          let cursor: string | undefined
          const seen = new Set<string>()
          do {
            const page = await client.listTools(cursor ? { cursor } : undefined, { signal, timeout: TIMEOUT })
            for (const tool of page.tools) {
              // Names are checked in code even if a provider accidentally advertises a write tool.
              if (!(config.tools as readonly string[]).includes(tool.name) || tool.annotations?.readOnlyHint === false || tools.length >= MAX_TOOLS) continue
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
          if (![...allowed.values()].some((entry) => entry.provider === provider)) throw new Error('no_read_tools')
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
    return {
      tools,
      errors,
      resolve: (name) => {
        const entry = allowed.get(name)
        return entry ? { provider: entry.provider, tool: entry.tool.name } : null
      },
      call: async (name, args) => {
        const entry = allowed.get(name)
        if (!entry) return JSON.stringify({ error: 'Công cụ không được cấp quyền trong lượt hỏi này' })
        const { provider, client, tool } = entry
        try {
          const connected = await this.db.query('SELECT 1 FROM user_connectors WHERE user_id = $1 AND provider = $2', [userId, provider])
          if (!connected.rows.length) throw new Error('disconnected')
          const result = await client.callTool({ name: tool.name, arguments: args }, undefined, { signal, timeout: TIMEOUT })
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

  private async record(userId: string, provider: GoogleProvider, error: string | null) {
    await this.db
      .query(
        `UPDATE user_connectors SET last_error = $3, last_used_at = CASE WHEN $3::text IS NULL THEN NOW() ELSE last_used_at END WHERE user_id = $1 AND provider = $2`,
        [userId, provider, error]
      )
      .catch(() => undefined)
  }
}

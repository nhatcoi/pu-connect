import { Injectable } from '@nestjs/common'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { AgentToolSession } from '../agent-tools'
import { toolError } from '../agent-tool-args'
import { PuConnectorService } from './pu-connector.service'

const PREFIX = 'pu_connector__'
const integer = (minimum: number, maximum: number) => ({ type: 'integer', minimum, maximum })
const METHODS = [
  ['profile', 'Hồ sơ sinh viên', {}],
  ['schedule', 'Lịch học và lịch thi', { fromDays: integer(-365, 365), toDays: integer(-365, 365) }],
  ['grades', 'Điểm và tín chỉ', {}],
  ['courses', 'Học phần Canvas', {}],
  ['deadlines', 'Hạn nộp bài', { pastDays: integer(0, 90), days: integer(1, 90) }],
  ['activity', 'Hoạt động Canvas', { limit: integer(1, 50) }],
  ['attendance', 'Chuyên cần', { fromDays: integer(-365, 0), toDays: integer(-365, 0) }],
  ['courseFiles', 'Tài liệu học phần', { courseId: integer(1, 2147483647) }]
] as const

@Injectable()
export class PuConnectorMcpService {
  constructor(private readonly connector: PuConnectorService) {}

  open(userId: string, signal: AbortSignal): AgentToolSession {
    let activeToken: string | undefined
    let client: Client | undefined
    let initializing: Promise<Client> | undefined
    let connectionMs = 0
    const labels = new Map<string, string>(METHODS.map(([name, label]) => [PREFIX + name, label]))
    const endpoint = `${this.connector.origin}/api/ai/pu-connector/mcp`
    const initialize = () =>
      (initializing ??= (async () => {
        const started = Date.now()
        try {
          const token = await this.connector.token(userId)
          if (!token) throw new Error('disconnected')
          activeToken = token
          client = new Client({ name: 'puc-n7ai', version: '1.0.0' }, { capabilities: {} })
          const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
            fetch: async (url, init) => {
              if (new URL(url instanceof Request ? url.url : String(url)).href !== endpoint) throw new Error('Unexpected MCP endpoint')
              const headers = new Headers(init?.headers)
              headers.set('Authorization', `Bearer ${token}`)
              return fetch(url, {
                ...init,
                headers,
                redirect: 'error',
                signal: AbortSignal.any([signal, AbortSignal.timeout(15_000), ...(init?.signal ? [init.signal] : [])])
              })
            }
          })
          await client.connect(transport, { signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]) })
          return client
        } finally {
          connectionMs += Date.now() - started
        }
      })())
    return {
      tools: METHODS.map(([name, description, properties]) => ({
        type: 'function',
        function: {
          name: PREFIX + name,
          description,
          parameters: { type: 'object', properties, additionalProperties: false, ...(name === 'courseFiles' ? { required: ['courseId'] } : {}) }
        }
      })),
      instructions: [
        'PU Connector reads the user’s own university profile, grades, timetable, attendance and Canvas courses/deadlines through the PKA MCP service.',
        'Use pu_connector__* for university account facts; puc__* searches the PU Connector social app. These are different data sources.',
        'Never invent personal academic facts. If disconnected or expired, ask the user to reconnect PU Connector in Settings using the extension. Only read operations are available.'
      ],
      describe: (name) => (labels.has(name) ? { provider: 'pu_connector', label: labels.get(name)! } : null),
      readOnly: (name) => labels.has(name),
      connectionMs: () => connectionMs,
      call: async (name, args, callSignal = signal) => {
        if (!labels.has(name)) return toolError('Công cụ không được cấp quyền')
        try {
          const current = await this.connector.token(userId)
          if (!current || (activeToken && current !== activeToken)) throw new Error('disconnected')
          const session = await initialize()
          const result = await session.callTool({ name: name.slice(PREFIX.length), arguments: args }, undefined, {
            signal: AbortSignal.any([signal, callSignal]),
            timeout: 15_000
          })
          const error = result.isError ? 'Chưa đọc được dữ liệu. Kiểm tra tham số hoặc kết nối lại PU Connector.' : null
          await this.connector.record(userId, error)
          const content = Array.isArray(result.content) ? result.content.filter((block) => block.type === 'text') : []
          const text = JSON.stringify({ provider: 'pu_connector', isError: !!result.isError, data: content })
          return text.length <= 16_000 ? text : toolError('Kết quả quá dài. Hãy thu hẹp truy vấn.')
        } catch {
          const error = 'Chưa đọc được dữ liệu. Kết nối lại PU Connector trong Cài đặt.'
          await this.connector.record(userId, error).catch(() => undefined)
          return toolError(error)
        }
      },
      close: async () => {
        await client?.close().catch(() => undefined)
      }
    }
  }
}

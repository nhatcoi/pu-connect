import { Injectable } from '@nestjs/common'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { MCP_TOOLS, type HttpCall } from './mcp.tools'

const MAX_TEXT = 24_000
const CALL_TIMEOUT_MS = 60_000

@Injectable()
export class McpService {
  // Mỗi request một server (stateless): tool lọc theo scope của key, gọi REST nội bộ bằng chính key đó
  createServer(opts: { token: string; scopes: string[]; baseUrl: string }): McpServer {
    const server = new McpServer({ name: 'pu-connect', version: '1.0.0' })
    const can = (scope: string) => scope === 'read' ? opts.scopes.length > 0 : opts.scopes.includes(scope)
    for (const tool of MCP_TOOLS) {
      if (!can(tool.scope)) continue
      ;(server as any).registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: tool.input,
          annotations: { readOnlyHint: !!tool.readOnly, destructiveHint: !!tool.destructive, openWorldHint: false }
        },
        async (args: any) => {
          try {
            let call: HttpCall = tool.call(args)
            let result = await this.send(opts, call)
            while (call.then && result.ok) {
              call = call.then(result.json)
              result = await this.send(opts, call)
            }
            return { content: [{ type: 'text' as const, text: clip(result.text) }], isError: !result.ok }
          } catch (err: any) {
            return { content: [{ type: 'text' as const, text: `Lỗi: ${err?.message ?? 'không gọi được PU Connect'}` }], isError: true }
          }
        }
      )
    }
    return server
  }

  private async send(opts: { token: string; baseUrl: string }, call: HttpCall): Promise<{ ok: boolean; text: string; json: any }> {
    const url = new URL(`/api${call.path}`, opts.baseUrl)
    for (const [k, v] of Object.entries(call.query ?? {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    const headers: Record<string, string> = { Authorization: `Bearer ${opts.token}`, Accept: 'application/json' }
    let body: BodyInit | undefined
    if (call.file) {
      const form = new FormData()
      form.set(call.file.field, new Blob([new Uint8Array(call.file.data)], { type: call.file.mime }), call.file.filename)
      body = form
    } else if (call.body !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(call.body)
    }
    const res = await fetch(url, { method: call.method, headers, body, redirect: 'error', signal: AbortSignal.timeout(CALL_TIMEOUT_MS) })
    const text = await res.text()
    let json: any
    try {
      json = JSON.parse(text)
    } catch {
      json = undefined
    }
    return { ok: res.ok, text: json ? (res.ok ? JSON.stringify(json.data ?? json) : String(json.message ?? text)) : text, json }
  }
}

function clip(s: string): string {
  return s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT)}\n…(đã cắt, dùng limit/offset hoặc lọc hẹp hơn)` : s
}

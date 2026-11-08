import { Controller, Delete, Get, HttpCode, Post, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { ApiKeyRequest } from '../api-keys/api-key.middleware'
import { McpService } from './mcp.service'

// MCP Streamable HTTP (stateless, trả JSON). Endpoint: POST /api/mcp, Authorization: Bearer puk_…
// Cấu hình client: { "url": "https://puc.vnhat.dev/api/mcp", "headers": { "Authorization": "Bearer puk_…" } }
@Controller('mcp')
export class McpController {
  constructor(private readonly mcp: McpService) {}

  @Post()
  @HttpCode(200)
  async handle(@Req() req: Request, @Res() res: Response) {
    const auth = (req as ApiKeyRequest).apiKey
    if (!auth) {
      res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Cần API key: Authorization: Bearer puk_…' }, id: null })
      return
    }
    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim()
    const server = this.mcp.createServer({ token, scopes: auth.scopes, baseUrl: `http://127.0.0.1:${process.env.PORT || 4000}` })
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    res.on('close', () => {
      void transport.close()
      void server.close()
    })
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  }

  @Get()
  @Delete()
  notAllowed(@Res() res: Response) {
    res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null })
  }
}

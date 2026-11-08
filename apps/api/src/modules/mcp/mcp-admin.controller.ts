import { Controller, Delete, Get, HttpCode, Post, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { ApiKeyRequest } from '../api-keys/api-key.middleware'
import { McpService } from './mcp.service'
import { MCP_ADMIN_TOOLS } from './mcp-admin.tools'

// MCP cho admin: POST /api/mcp/admin, Authorization: Bearer pka_… (key tạo trong admin console)
@Controller('mcp/admin')
export class McpAdminController {
  constructor(private readonly mcp: McpService) {}

  @Post()
  @HttpCode(200)
  async handle(@Req() req: Request, @Res() res: Response) {
    const auth = (req as ApiKeyRequest).apiKey
    if (!auth || auth.kind !== 'admin') {
      res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Cần key admin: Authorization: Bearer pka_…' }, id: null })
      return
    }
    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim()
    const server = this.mcp.createServer({
      token,
      scopes: auth.scopes,
      baseUrl: `http://127.0.0.1:${process.env.PORT || 4000}`,
      tools: MCP_ADMIN_TOOLS,
      name: 'pu-connect-admin',
      readScope: 'admin_read'
    })
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

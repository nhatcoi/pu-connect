import { Module } from '@nestjs/common'
import { McpAdminController } from './mcp-admin.controller'
import { McpController } from './mcp.controller'
import { McpService } from './mcp.service'

@Module({ controllers: [McpController, McpAdminController], providers: [McpService] })
export class McpModule {}

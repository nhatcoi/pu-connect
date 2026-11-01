export class McpModelError extends Error {
  constructor() {
    super('Model hoặc gateway hiện tại không thực hiện được tool calling cho MCP. Kiểm tra AI_MODEL và cấu hình gateway.')
    this.name = 'McpModelError'
  }
}

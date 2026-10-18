// Google connectors served by the self-hosted workspace-mcp (taylorwilsdon/google_workspace_mcp, read-only, localhost).
// One server for every provider; each provider keeps its own OAuth grant and bearer token, and only its read tools are exposed to N7AI.
// Google's hosted MCP servers (drivemcp/calendarmcp/gmailmcp.googleapis.com) require the Workspace Developer Preview Program ⇒ not used.
export const DEFAULT_GOOGLE_WORKSPACE_MCP_URL = 'http://127.0.0.1:8765/mcp'

export const GOOGLE_MCP_PROVIDERS = {
  google_drive: {
    name: 'Google Drive',
    slug: 'google-drive',
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    tools: ['search_drive_files', 'get_drive_file_content', 'list_drive_items']
  },
  google_calendar: {
    name: 'Google Calendar',
    slug: 'google-calendar',
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    tools: ['list_calendars', 'get_events', 'query_freebusy']
  },
  google_gmail: {
    name: 'Gmail',
    slug: 'google-gmail',
    scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    tools: ['search_gmail_messages', 'get_gmail_message_content', 'get_gmail_messages_content_batch', 'get_gmail_thread_content', 'list_gmail_labels']
  }
} as const

export type GoogleProvider = keyof typeof GOOGLE_MCP_PROVIDERS
export const isGoogleProvider = (id: string): id is GoogleProvider => Object.hasOwn(GOOGLE_MCP_PROVIDERS, id)

export function googleMcpError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
  const status = error && typeof error === 'object' && 'status' in error ? error.status : code
  if (status === 401 || (error instanceof Error && error.name === 'UnauthorizedError')) return 'Phiên Google hết hạn — hãy kết nối lại'
  if (status === 403) return 'Google từ chối truy cập — kiểm tra API đã bật trong Google Cloud và quyền đã cấp khi kết nối'
  if (status === 429) return 'Google đang giới hạn lượt gọi, vui lòng thử lại sau'
  if (error instanceof TypeError || (error instanceof Error && /ECONNREFUSED|fetch failed/i.test(error.message))) return 'Máy chủ kết nối Google tạm ngừng, thử lại sau'
  return 'Không truy cập được Google. Kiểm tra kết nối hoặc thử lại sau'
}

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
  },
  google_forms: {
    name: 'Google Forms',
    slug: 'google-forms',
    scopes: ['https://www.googleapis.com/auth/forms.body', 'https://www.googleapis.com/auth/forms.responses.readonly'],
    tools: ['create_form', 'batch_update_form', 'get_form', 'list_form_responses', 'get_form_response', 'set_publish_settings']
  },
  google_sheets: {
    name: 'Google Sheets',
    slug: 'google-sheets',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    tools: [
      'list_spreadsheets',
      'get_spreadsheet_info',
      'read_sheet_values',
      'modify_sheet_values',
      'create_spreadsheet',
      'create_sheet',
      'append_table_rows',
      'list_sheet_tables',
      'manage_sheet_tab'
    ]
  },
  google_tasks: {
    name: 'Google Tasks',
    slug: 'google-tasks',
    scopes: ['https://www.googleapis.com/auth/tasks'],
    tools: [
      'list_task_lists',
      'get_task_list',
      'list_tasks',
      'get_task',
      'manage_task',
      'manage_task_list'
    ]
  }
} as const

// Các tool ghi dữ liệu (không được chạy đồng thời, không cache kết quả)
export const GOOGLE_WRITE_TOOLS = new Set([
  'create_form',
  'batch_update_form',
  'set_publish_settings',
  'create_spreadsheet',
  'modify_sheet_values',
  'append_table_rows',
  'create_sheet',
  'manage_sheet_tab',
  'manage_task',
  'manage_task_list'
])

export function isGoogleWriteTool(name: string): boolean {
  const raw = name.includes('__') ? name.split('__')[1] : name
  return GOOGLE_WRITE_TOOLS.has(raw)
}

// Nhãn bước hiển thị khi N7AI gọi tool (message.progress) / Step labels shown while N7AI runs a tool
const TOOL_LABELS: Record<string, string> = {
  search_drive_files: 'Tìm tệp trong Drive',
  get_drive_file_content: 'Đọc tệp Drive',
  list_drive_items: 'Xem thư mục Drive',
  list_calendars: 'Xem danh sách lịch',
  get_events: 'Đọc sự kiện trong lịch',
  query_freebusy: 'Kiểm tra lịch bận',
  search_gmail_messages: 'Tìm thư trong Gmail',
  get_gmail_message_content: 'Đọc thư',
  get_gmail_messages_content_batch: 'Đọc thư',
  get_gmail_thread_content: 'Đọc chuỗi thư',
  list_gmail_labels: 'Xem nhãn Gmail',
  create_form: 'Tạo Google Form',
  batch_update_form: 'Cập nhật câu hỏi biểu mẫu',
  get_form: 'Đọc cấu trúc biểu mẫu',
  list_form_responses: 'Đọc câu trả lời biểu mẫu',
  get_form_response: 'Đọc phản hồi biểu mẫu',
  set_publish_settings: 'Cài đặt xuất bản biểu mẫu',
  list_spreadsheets: 'Tìm bảng tính Sheets',
  get_spreadsheet_info: 'Đọc cấu trúc bảng tính',
  read_sheet_values: 'Đọc dữ liệu bảng tính',
  modify_sheet_values: 'Cập nhật ô bảng tính',
  create_spreadsheet: 'Tạo bảng tính Google Sheets',
  create_sheet: 'Tạo trang tính mới',
  append_table_rows: 'Thêm hàng vào bảng tính',
  list_sheet_tables: 'Xem bảng dữ liệu',
  manage_sheet_tab: 'Quản lý trang tính',
  list_task_lists: 'Xem danh sách việc cần làm',
  get_task_list: 'Đọc danh mục việc',
  list_tasks: 'Xem các việc cần làm',
  get_task: 'Đọc chi tiết việc cần làm',
  manage_task: 'Tạo / Cập nhật việc cần làm',
  manage_task_list: 'Quản lý danh mục việc'
}

const clip = (v: unknown, max = 60) => (typeof v === 'string' && v.trim() ? (v.trim().length > max ? `${v.trim().slice(0, max - 1)}…` : v.trim()) : undefined)
const day = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : undefined)

// Nhãn + chi tiết ngắn (từ khóa, khoảng ngày, số thư, tiêu đề form/sheet/task) — không chứa dữ liệu Google trả về
export function describeToolCall(tool: string, args: Record<string, unknown>): { label: string; detail?: string } {
  const label = TOOL_LABELS[tool] ?? tool
  const ids = args.message_ids ?? args.messageIds
  const from = day(args.time_min ?? args.timeMin)
  const to = day(args.time_max ?? args.timeMax)
  const detail =
    clip(args.query) ??
    (Array.isArray(ids) ? `${ids.length} thư` : undefined) ??
    (from || to ? [from, to].filter(Boolean).join(' – ') : undefined) ??
    clip(args.spreadsheet_title ?? args.spreadsheetTitle) ??
    clip(args.range) ??
    clip(args.task_title ?? args.taskTitle ?? args.title) ??
    clip(args.form_id ?? args.formId) ??
    clip(args.file_name ?? args.fileName)
  return detail ? { label, detail } : { label }
}

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

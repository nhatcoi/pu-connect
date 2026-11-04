import { BookOpenText, Brain, CalendarClock, CircleHelp, Database, Globe, GraduationCap, Handshake, Plug, ShieldCheck, Wand2, type LucideIcon } from 'lucide-react'

// Các mục cài đặt N7AI (/n7ai/settings/[item]); href ⇒ mở trang khác thay vì trang con
export interface N7AiSettingsItem {
  id: string
  label: string
  description: string
  icon: LucideIcon
  group: 'capabilities' | 'support'
  href?: string
}

export const N7AI_SETTINGS_ITEMS: N7AiSettingsItem[] = [
  { id: 'profile', label: 'Hồ sơ học', description: 'Cá nhân hóa phản hồi học tập', icon: GraduationCap, group: 'capabilities' },
  { id: 'skills', label: 'Kỹ năng', description: 'Lệnh nhanh & công cụ chuyên biệt', icon: Wand2, group: 'capabilities' },
  { id: 'tasks', label: 'Tác vụ tự động', description: 'Lịch chạy tự động định kỳ', icon: CalendarClock, group: 'capabilities' },
  { id: 'sources', label: 'Nguồn', description: 'Thư viện, tài liệu & nhóm học', icon: Database, group: 'capabilities' },
  { id: 'connectors', label: 'Trình kết nối', description: 'Tích hợp tài khoản ngoài qua MCP', icon: Plug, group: 'capabilities' },
  { id: 'web', label: 'Duyệt web', description: 'Tra cứu & đọc nội dung web', icon: Globe, group: 'capabilities' },
  { id: 'memory', label: 'Bộ nhớ', description: 'Thông tin N7AI ghi nhớ về bạn', icon: Brain, group: 'capabilities' },
  { id: 'community', label: 'Tham gia cộng đồng', description: 'Cộng đồng N7AI & skill', icon: Handshake, group: 'support' },
  { id: 'support', label: 'Phản hồi & Hỗ trợ', description: 'Báo lỗi & đóng góp ý kiến', icon: CircleHelp, group: 'support' },
  { id: 'terms', label: 'Điều khoản dịch vụ', description: 'Quy định & điều khoản sử dụng', icon: BookOpenText, group: 'support', href: '/ai-terms' },
  { id: 'privacy', label: 'Quyền riêng tư', description: 'Bảo mật & quản lý dữ liệu', icon: ShieldCheck, group: 'support' }
]

export const findN7AiItem = (id: string) => N7AI_SETTINGS_ITEMS.find((i) => i.id === id && !i.href)

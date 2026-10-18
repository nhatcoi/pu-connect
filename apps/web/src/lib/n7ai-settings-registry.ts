import { BookOpenText, Brain, CalendarClock, CircleHelp, Globe, GraduationCap, Handshake, Plug, ShieldCheck, Wand2, type LucideIcon } from 'lucide-react'

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
  { id: 'profile', label: 'Hồ sơ học', description: 'Mục tiêu, giới thiệu, cách N7AI trả lời bạn', icon: GraduationCap, group: 'capabilities' },
  { id: 'skills', label: 'Kỹ năng', description: 'Skill tự tạo, thư viện, ghim & bật/tắt lệnh /', icon: Wand2, group: 'capabilities' },
  { id: 'tasks', label: 'Tác vụ tự động', description: 'N7AI tự chạy theo lịch hằng ngày / hằng tuần', icon: CalendarClock, group: 'capabilities' },
  { id: 'connectors', label: 'Trình kết nối', description: 'Nguồn N7AI được đọc: thư viện, tài liệu, Google', icon: Plug, group: 'capabilities' },
  { id: 'web', label: 'Duyệt web', description: 'Đọc link bạn gửi, tìm kiếm Internet', icon: Globe, group: 'capabilities' },
  { id: 'memory', label: 'Bộ nhớ', description: 'Điều N7AI ghi nhớ về bạn', icon: Brain, group: 'capabilities' },
  { id: 'community', label: 'Tham gia cộng đồng', description: 'Cộng đồng N7AI, skill nổi bật', icon: Handshake, group: 'support' },
  { id: 'support', label: 'Phản hồi & Hỗ trợ', description: 'Lượt dùng, báo lỗi, góp ý', icon: CircleHelp, group: 'support' },
  { id: 'terms', label: 'Điều khoản dịch vụ', description: 'Điều khoản sử dụng N7AI', icon: BookOpenText, group: 'support', href: '/ai-terms' },
  { id: 'privacy', label: 'Quyền riêng tư', description: 'Thời gian lưu, xuất & xóa dữ liệu N7AI', icon: ShieldCheck, group: 'support' }
]

export const findN7AiItem = (id: string) => N7AI_SETTINGS_ITEMS.find((i) => i.id === id && !i.href)

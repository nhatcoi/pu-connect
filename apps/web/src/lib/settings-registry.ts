import { Ban, Bell, Lock, Palette, Puzzle, Sparkles, UserRound, type LucideIcon } from 'lucide-react'
import type { FeaturePreferenceKey } from '@pu/schemas'

// Các mục của trang Cài đặt (/settings/[section]); href ⇒ mục nằm ở không gian khác (PU AI ⇒ /puai/settings)
export const SETTINGS_SECTIONS = [
  { id: 'account', label: 'Tài khoản', description: 'Xác thực sinh viên, email, mật khẩu', icon: UserRound },
  { id: 'privacy', label: 'Quyền riêng tư', description: 'Thông tin hiển thị, hồ sơ riêng tư, dữ liệu gợi ý', icon: Lock },
  { id: 'features', label: 'Tính năng', description: 'Bật/tắt tiện ích bảng tin và PU AI', icon: Puzzle },
  { id: 'puai', label: 'PU AI', description: 'Kỹ năng, tác vụ tự động, kết nối, bộ nhớ, dữ liệu', icon: Sparkles, href: '/puai/settings' },
  { id: 'notifications', label: 'Thông báo', description: 'Loại thông báo, trình duyệt, giờ yên tĩnh', icon: Bell },
  { id: 'appearance', label: 'Giao diện', description: 'Sáng, tối hoặc theo hệ thống', icon: Palette },
  { id: 'blocked', label: 'Chặn & An toàn', description: 'Tài khoản bạn đã chặn', icon: Ban }
] as const satisfies readonly { id: string; label: string; description: string; icon: LucideIcon; href?: string }[]

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id']
// Mục có trang con ở /settings/[section]
export type SettingsPageId = Exclude<SettingsSectionId, Extract<(typeof SETTINGS_SECTIONS)[number], { href: string }>['id']>
export const sectionHref = (s: { id: string; href?: string }) => s.href ?? `/settings/${s.id}`

export function findSettingsSection(id: string) {
  return SETTINGS_SECTIONS.find((s) => s.id === id)
}

// Mục render tại /settings/[section] (bỏ mục có href riêng)
export function findSettingsPage(id: string) {
  return SETTINGS_SECTIONS.find((s): s is Extract<(typeof SETTINGS_SECTIONS)[number], { id: SettingsPageId }> => s.id === id && !('href' in s))
}

// Feature plugs: thêm công tắc mới = thêm 1 dòng ở đây + 1 trường trong FeaturePreferencesSchema
export interface FeaturePlug {
  key: FeaturePreferenceKey
  label: string
  description: string
}

export const FEATURE_PLUG_GROUPS: { id: string; label: string; plugs: FeaturePlug[] }[] = [
  {
    id: 'feed',
    label: 'Bảng tin',
    plugs: [
      {
        key: 'featuredComment',
        label: 'Bình luận nổi bật',
        description: 'Hiện 1 bình luận đáng chú ý ngay dưới mỗi bài (lời giải, nhiều tương tác nhất…)'
      },
      {
        key: 'newPostsPill',
        label: 'Thông báo bài mới',
        description: 'Hiện nút "N bài mới" phía trên bảng tin khi có bài vừa đăng'
      }
    ]
  },
  {
    id: 'ai',
    label: 'PU AI',
    plugs: [
      {
        key: 'aiSummary',
        label: 'Tóm tắt bài dài',
        description: 'Hiện nút "✨ Tóm tắt" để PU AI rút gọn bài viết dài thành vài ý chính'
      }
    ]
  }
]

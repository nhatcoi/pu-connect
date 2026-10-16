import { Ban, Bell, Lock, Palette, Puzzle, UserRound, type LucideIcon } from 'lucide-react'
import type { FeaturePreferenceKey } from '@pu/schemas'

// Các mục của trang Cài đặt (/settings/[section])
export const SETTINGS_SECTIONS = [
  { id: 'account', label: 'Tài khoản', description: 'Xác thực sinh viên, email, mật khẩu', icon: UserRound },
  { id: 'privacy', label: 'Quyền riêng tư', description: 'Thông tin hiển thị, hồ sơ riêng tư, dữ liệu gợi ý', icon: Lock },
  { id: 'features', label: 'Tính năng', description: 'Bật/tắt tiện ích bảng tin và PU AI', icon: Puzzle },
  { id: 'notifications', label: 'Thông báo', description: 'Loại thông báo, trình duyệt, giờ yên tĩnh', icon: Bell },
  { id: 'appearance', label: 'Giao diện', description: 'Sáng, tối hoặc theo hệ thống', icon: Palette },
  { id: 'blocked', label: 'Chặn & An toàn', description: 'Tài khoản bạn đã chặn', icon: Ban }
] as const satisfies readonly { id: string; label: string; description: string; icon: LucideIcon }[]

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id']

export function findSettingsSection(id: string) {
  return SETTINGS_SECTIONS.find((s) => s.id === id)
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

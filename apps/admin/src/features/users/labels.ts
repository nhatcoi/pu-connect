import type { FilterKey } from './use-users'

// Nhãn hiển thị cho giá trị bộ lọc (dùng chung: popover, chip)
export const FILTER_OPTIONS: Partial<Record<FilterKey, { label: string; options: [string, string][] }>> = {
  status: {
    label: 'Trạng thái',
    options: [
      ['active', 'Đang hoạt động'],
      ['restricted', 'Bị hạn chế'],
      ['suspended', 'Bị khóa']
    ]
  },
  verified: {
    label: 'Xác thực',
    options: [
      ['yes', 'Có tích xanh'],
      ['no', 'Chưa xác thực']
    ]
  },
  activity: {
    label: 'Hoạt động',
    options: [
      ['online', 'Đang online'],
      ['24h', 'Trong 24 giờ'],
      ['7d', 'Trong 7 ngày'],
      ['30d', 'Trong 30 ngày'],
      ['dormant', 'Vắng > 30 ngày'],
      ['never', 'Chưa từng vào']
    ]
  },
  joined: {
    label: 'Tham gia',
    options: [
      ['24h', '24 giờ qua'],
      ['7d', '7 ngày qua'],
      ['30d', '30 ngày qua'],
      ['90d', '90 ngày qua']
    ]
  },
  auth: {
    label: 'Đăng nhập',
    options: [
      ['password', 'Mật khẩu'],
      ['google', 'Google']
    ]
  },
  reported: { label: 'Báo cáo', options: [['yes', 'Từng bị báo cáo']] },
  risk: {
    label: 'Rủi ro',
    options: [
      ['high', 'Cao (≥ 50)'],
      ['medium', 'Trung bình (25–49)']
    ]
  }
}

export function filterValueLabel(key: FilterKey, value: string): string {
  return FILTER_OPTIONS[key]?.options.find(([v]) => v === value)?.[1] ?? value
}

// Phân khúc nhanh đầu trang — mỗi phân khúc là 1 bộ lọc định sẵn
export const SEGMENT_KEYS = ['status', 'activity', 'joined', 'reported', 'risk'] as const
export const SEGMENTS = [
  { id: 'all', label: 'Tất cả', patch: {}, stat: 'total' },
  { id: 'online', label: 'Đang online', patch: { activity: 'online' }, stat: 'online', dot: true },
  { id: 'active', label: 'Hoạt động 24h', patch: { activity: '24h' }, stat: 'active24h' },
  { id: 'new', label: 'Mới 7 ngày', patch: { joined: '7d' }, stat: 'new7d' },
  { id: 'risk', label: 'Rủi ro cao', patch: { risk: 'high' }, stat: 'highRisk', tone: 'danger' },
  { id: 'reported', label: 'Bị báo cáo', patch: { reported: 'yes' }, stat: 'reported', tone: 'warning' },
  { id: 'restricted', label: 'Bị hạn chế', patch: { status: 'restricted' }, stat: 'restricted', tone: 'warning' },
  { id: 'suspended', label: 'Bị khóa', patch: { status: 'suspended' }, stat: 'suspended', tone: 'danger' },
  { id: 'dormant', label: 'Vắng > 30 ngày', patch: { activity: 'dormant' }, stat: 'dormant' }
] as const

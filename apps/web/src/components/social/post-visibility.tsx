import React from 'react'
import { Globe2, Users, Lock, Archive } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PostVisibility } from '@pu/schemas'

// Quyền xem bài: nhãn + mô tả dùng chung cho menu bài, form sửa bài
// Post visibility labels shared by the post menu and the edit dialog
export const POST_VISIBILITY: Record<PostVisibility, { label: string; description: string; icon: React.ElementType }> = {
  public: { label: 'Công khai', description: 'Mọi người trong trường đều xem được', icon: Globe2 },
  followers: { label: 'Người theo dõi', description: 'Chỉ những người đang theo dõi bạn', icon: Users },
  private: { label: 'Chỉ mình tôi', description: 'Chỉ bạn xem được', icon: Lock }
}

export const POST_VISIBILITY_ORDER: PostVisibility[] = ['public', 'followers', 'private']

// Huy hiệu cạnh thời gian đăng: chỉ hiện khi bài không công khai hoặc đang lưu trữ (người xem khác không thấy bài này nên chỉ tác giả thấy)
export function PostAccessBadge({ visibility, archived, className }: { visibility?: PostVisibility; archived?: boolean; className?: string }) {
  if (archived) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-[11px] text-muted-foreground', className)} title="Bài đã lưu trữ, chỉ bạn thấy">
        <Archive className="h-3 w-3 shrink-0" />
        <span>Đã lưu trữ</span>
      </span>
    )
  }
  if (!visibility || visibility === 'public') return null
  const { icon: Icon, label } = POST_VISIBILITY[visibility]
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] text-muted-foreground', className)} title={POST_VISIBILITY[visibility].description}>
      <Icon className="h-3 w-3 shrink-0" />
      <span>{label}</span>
    </span>
  )
}

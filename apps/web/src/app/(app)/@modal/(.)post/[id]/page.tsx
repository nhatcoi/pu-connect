import { PostExpandModal } from '@/components/social/post-expand-modal'

// Route chặn: bấm "Mở rộng" ở bảng tin ⇒ modal; vào thẳng /post/[id] (F5, link, thông báo) ⇒ trang đầy đủ
export default function PostModalPage() {
  return <PostExpandModal />
}

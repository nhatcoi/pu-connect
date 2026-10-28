---
name: web-state-tanstack
description: Chuẩn mực quản lý state phía web bằng TanStack Query, Zustand Slices, đồng bộ phiên làm việc và cập nhật lạc quan (Optimistic Cache Everywhere) cho PU Connect.
---

# Web State & TanStack Query Management Guidelines

Tài liệu hướng dẫn chuẩn cho AI Agents và kỹ sư khi xử lý dữ liệu và state phía Frontend (`apps/web`), bám sát kiến trúc ADR [`docs/core/08-web-state.md`](../../docs/core/08-web-state.md).

---

## 📌 1. Phân Loại State (Tuyệt Đối Không Dùng Nhầm Công Cụ)

| Loại State | Ví dụ Cụ Thể | Công Cụ Chuẩn | Quy Tắc Bắt Buộc |
|---|---|---|---|
| **Dữ liệu Server** | Bảng tin (Feed), Bài viết, Bình luận, Hồ sơ, Cộng đồng, Tìm kiếm, Thông báo, Chat threads | **TanStack Query** (`@tanstack/react-query`) | **CẤM** fetch trong `useEffect` + `useState`. Khóa query tập trung từ `queryKeys`. |
| **UI State toàn cục** | Hộp thoại Soạn bài, Tạo nhóm học, Xem trước tài liệu, Menu mở/đóng | **Zustand Slices** (`src/store/`) | Chỉ dùng **Atomic Selectors** (`s => s.isCreatePostOpen`). Không lưu dữ liệu server trong Zustand. |
| **Phiên làm việc** | `UserProfile`, `privacySettings`, `preferences` | **Đồng bộ kép (`useWriteSessionUser`)** | Ghi đồng thời vào cache `queryKeys.me` và Zustand `useAppStore`. |
| **Trạng thái URL** | Tab active, `q` tìm kiếm, bộ lọc khoa, `?comment=`, `?edit=1` | `useSearchParams` / `useRouter` | Không duplicate lên global state. |
| **Cục bộ Component** | Input gõ, toggle hover, popover con | `useState` | Giữ phạm vi nhỏ nhất có thể. |

---

## 🔑 2. Quản Lý Khóa Cache Tập Trung (`queryKeys`)

Mọi query phải dùng key từ [`apps/web/src/lib/query-keys.ts`](../../apps/web/src/lib/query-keys.ts):

```typescript
import { queryKeys } from '@/lib/query-keys'

// Lấy chi tiết bài viết
const { data: post, isLoading } = useQuery({
  queryKey: queryKeys.post(postId),
  queryFn: () => postsApi.getById(postId),
  staleTime: 30_000 // 30s
})

// Feed phân trang vô hạn
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: queryKeys.feed(feedType, tag),
  queryFn: ({ pageParam }) => postsApi.getFeed({ feedType, tag, ...pageParam }),
  initialPageParam: { offset: 0 },
  getNextPageParam: (lastPage) => lastPage.nextCursor
})
```

---

## 🚀 3. Cập Nhật Lạc Quan Mọi Nơi (`patchPostEverywhere`)

Một bài viết có thể xuất hiện đồng thời ở nhiều nơi: Tab Dành cho bạn, Tab Đang theo dõi, Trang cá nhân, Trang cộng đồng, Kết quả tìm kiếm. Khi tương tác (Thích, Lưu, Ghim, Tăng số bình luận):

```typescript
import { useQueryClient } from '@tanstack/react-query'
import { patchPostEverywhere } from '@/lib/post-cache'

const queryClient = useQueryClient()

// Optimistic Like Toggle:
const toggleLike = async (postId: string, currentLiked: boolean) => {
  // 1. Vá lạc quan ngay lập tức ở MỌI cache đang chứa bài viết
  patchPostEverywhere(queryClient, postId, (post) => ({
    ...post,
    isLiked: !currentLiked,
    likesCount: post.likesCount + (currentLiked ? -1 : 1)
  }))

  try {
    await apiClient(`/posts/${postId}/like`, { method: 'POST' })
  } catch (err) {
    // 2. Rollback lại trạng thái cũ nếu server lỗi
    patchPostEverywhere(queryClient, postId, (post) => ({
      ...post,
      isLiked: currentLiked,
      likesCount: post.likesCount + (currentLiked ? 1 : -1)
    }))
    toast.error('Không thể cập nhật lượt thích')
  }
}
```

---

## 🛡️ 4. Kiến Trúc Khung App Đơn Nhất (`AppLayout`)

- Toàn bộ các trang yêu cầu đăng nhập nằm trong route group `apps/web/src/app/(app)/`.
- `AppLayout` chỉ mount **MỘT LẦN DUY NHẤT** khi người dùng truy cập app:
  - Header, Sidebar, RightSidebar, MobileBottomNav và các Global Dialogs không bao giờ bị unmount khi đổi route.
  - Chuyển trang giữa `/home`, `/search`, `/courses`, `/[username]` chỉ re-render duy nhất nội dung cột giữa (`children`).
- **Cột phải tùy biến:** Sử dụng component `<PageAside>`:
  ```tsx
  import { PageAside } from '@/components/layout/page-aside'

  export default function CourseDetailPage() {
    return (
      <div>
        <CourseContent />
        <PageAside>
          <TopContributorsWidget />
        </PageAside>
      </div>
    )
  }
  ```

---

## 📦 5. Ảo Hóa Danh Sách (`VirtualPostList`)

- Danh sách bài viết dài (Bảng tin, Diễn đàn cộng đồng) bắt buộc dùng [`VirtualPostList`](../../apps/web/src/components/social/virtual-post-list.tsx).
- Cơ chế `@tanstack/react-virtual` duy trì chỉ ~8–15 node bài viết trong DOM thực tế, giảm thiểu áp lực render và giải phóng bộ nhớ giải mã ảnh.
- Khi điều hướng sang trang khác rồi bấm **Back**, vị trí cuộn pixel và thẻ bài viết đang đọc được khôi phục chính xác 100% nhờ `initialMeasurementsCache`.

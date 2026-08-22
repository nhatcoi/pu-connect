# 🎨 Hướng dẫn Phát triển Frontend — PU Connector Frontend Guide

Tài liệu này hướng dẫn cách cấu trúc, sử dụng và mở rộng hệ thống UI, Component, Renderers và State Management trong ứng dụng **Next.js (`apps/web`)**.

---

## 1. Hệ thống Design System & Theme Tokens

Hệ thống UI được xây dựng trên nền tảng **Radix UI Primitives + shadcn/ui + Tailwind CSS v4**.

* **Bộ quy chuẩn màu sắc (CSS Variables HSL):** Định nghĩa tại `@pu/ui` và `src/app/globals.css`.
* **Dark / Light Theme:** Quản lý tự động qua `next-themes`, không gây hiện tượng chớp nháy (Flash of Unstyled Content - FOUC).
* **Helper Hàm classnames:** Luôn sử dụng hàm `cn()` từ `@/lib/utils` để kết hợp Tailwind classes một cách an toàn:
  ```typescript
  import { cn } from '@/lib/utils';

  export function CustomBadge({ className, variant }) {
    return <div className={cn('px-2 py-1 rounded', className)} />;
  }
  ```

---

## 2. Thư viện Component Giao diện (`src/components/ui/`)

Tất cả các UI components đều là **Uncontrolled/Controlled Primitives** có tính độc lập cao:

| Component | Đường dẫn | Đặc tính |
| :--- | :--- | :--- |
| **`Button`** | `src/components/ui/button.tsx` | CVA variants (`default`, `destructive`, `outline`, `ghost`, `secondary`), hỗ trợ `asChild` (Radix Slot). |
| **`Card`** | `src/components/ui/card.tsx` | Thẻ hiển thị bài viết, tài liệu với cấu trúc CardHeader, CardContent, CardFooter. |
| **`Dialog`** | `src/components/ui/dialog.tsx` | Modal tương tác có hiệu ứng animate, backdrop blur và bẫy focus bàn phím (Focus Trap). |
| **`Tabs`** | `src/components/ui/tabs.tsx` | Điều hướng chuyển tab không cần reload trang. |
| **`DropdownMenu`** | `src/components/ui/dropdown-menu.tsx` | Menu thả xuống cho profile, actions, theme selector. |

---

## 3. Bộ Engine Soạn thảo & Render Kỹ thuật

### 3.1. Trình xem Markdown Kỹ thuật (`MarkdownPreview`)
* **Vị trí:** `src/components/renderer/markdown-preview.tsx`
* **Tính năng:**
  * Render bảng chuẩn GFM (GitHub Flavored Markdown).
  * Render công thức toán KaTeX: `$a^2 + b^2 = c^2$` hoặc khối `$$\sum_{i=1}^n i = \frac{n(n+1)}{2}$$`.
  * Highlight mã nguồn tự động theo ngôn ngữ kèm nút **Sao chép (Copy)**.
  * Tự động phát hiện và render sơ đồ Mermaid an toàn.

**Ví dụ sử dụng:**
```tsx
import { MarkdownPreview } from '@/components/renderer/markdown-preview';

export function PostDetail({ content }: { content: string }) {
  return <MarkdownPreview content={content} />;
}
```

### 3.2. Trình soạn thảo WYSIWYG (`TiptapEditor`)
* **Vị trí:** `src/components/editor/tiptap-editor.tsx`
* **Tính năng:** Toolbar trực quan cho Bold, Italic, Headings (H1/H2), Bullet/Numbered Lists, Blockquote, Code Block và chèn Bảng động.

---

## 4. Quản lý State với Zustand Slices Pattern

State toàn cục của ứng dụng được tổ chức thành các **Slices** độc lập để tránh re-render không cần thiết:

* `auth-slice.ts`: Quản lý thông tin đăng nhập, token, user profile.
* `feed-slice.ts`: Quản lý danh sách bài viết, lượt like, trạng thái mở modal tạo bài viết.
* `document-slice.ts`: Quản lý danh sách tài liệu, bộ lọc định dạng (`pdf`, `code`, `sheet`), tìm kiếm.

**Cách dùng trong Component:**
```typescript
import { useAppStore } from '@/store';

export function FeedComponent() {
  // Chỉ subscribe vào đúng field cần dùng để tối ưu hiệu năng
  const posts = useAppStore((state) => state.posts);
  const toggleLikePost = useAppStore((state) => state.toggleLikePost);

  return (
    <div>
      {posts.map((p) => (
        <button key={p.id} onClick={() => toggleLikePost(p.id)}>
          Like ({p.likesCount})
        </button>
      ))}
    </div>
  );
}
```

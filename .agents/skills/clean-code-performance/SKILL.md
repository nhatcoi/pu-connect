---
name: clean-code-performance
description: Clean code and performance-first engineering guidelines for PU Connector, inspired by Orca architecture and Claude-standard production codebase.
---

# Clean Code & Performance Guidelines (PU Connector)

Quy chuẩn viết code sạch, kiến trúc module rõ ràng và ưu tiên hiệu năng tối đa cho toàn bộ dự án PU Connector.

---

## 🚫 1. Nguyên Tắc Đặt Tên & Cấu Trúc Module (No Dumping Grounds)

1. **Tuyệt đối không dùng tên mơ hồ:**
   * **CẤM** đặt tên file/folder là `utils.ts`, `helpers.ts`, `common.ts`, `misc.ts`, `shared-stuff.ts`.
   * Luôn dùng khái niệm domain cụ thể: `document-preview-modal.tsx`, `post-cache.ts`, `mention-suggest.service.ts`, `course-catalog-filter.ts`.
2. **Trách nhiệm đơn nhất (Single Responsibility):**
   * Nếu một file có xu hướng chứa nhiều hàm không liên quan, hãy tách ra thành các module domain độc lập.
3. **Ưu tiên `.ts` / `.tsx` thay vì `.d.ts`:**
   * Khai báo types và schemas trong mã nguồn có thể thực thi hoặc export từ `packages/schemas`.

---

## ⚡ 2. Quản Lý Trạng Thái (TanStack Query + Zustand v5 Slice Pattern)

1. **Dữ liệu Server thuộc về TanStack Query:**
   * Tuyệt đối không lưu mảng `posts`, danh sách bình luận hay hồ sơ người dùng trong Zustand.
   * Dùng `useQuery` / `useInfiniteQuery` với cache key từ `queryKeys`.
2. **Zustand chỉ dành cho UI state toàn cục:**
   * Phân chia Slice theo từng tính năng (`composer-slice.ts`, `auth-slice.ts`, v.v.).
3. **Tối ưu Re-render với Atomic Selectors:**
   ```typescript
   // ✅ TỐT: Chỉ re-render khi `isCreatePostOpen` thay đổi
   const isCreatePostOpen = useAppStore((state) => state.isCreatePostOpen)

   // ❌ TRÁNH: Lấy toàn bộ state làm component re-render không cần thiết
   const state = useAppStore()
   ```

---

## 🎯 3. Tư Duy Tối Ưu Hiệu Năng (Performance-First)

### 3.1. Frontend & UI
1. **Zero Layout Shifts (CLS):** Luôn khai báo kích thước (`width`, `height`, `min-h`, `aspect-ratio`) cho hình ảnh, video, avatar và container động.
2. **Virtualization:** Sử dụng `@tanstack/react-virtual` (`VirtualPostList`) cho các danh sách dài (Feed, Diễn đàn) để giữ số lượng DOM node $<1500$.
3. **Code Splitting & Lazy Loading:**
   * Lazy load các component nặng như `PdfViewer`, `TiptapEditor`, `MermaidBlock` hoặc các Modal khi chưa mở.
4. **Tree-shaking & Icon Import:**
   * Import trực tiếp icon cụ thể từ `lucide-react` (VD: `import { Heart } from 'lucide-react'`).
5. **Zero Lint Warnings Policy:**
   * Xử lý lỗi không dùng `catch (err: any) {}` tùy tiện; sử dụng helper bóc tách thông điệp lỗi và kiểm tra kiểu an toàn.

### 3.2. Backend & Database
1. **Index Optimization:**
   * Đánh chỉ mục GIN cho các trường mảng (`tags`, `skills`, `interests`) và generated tsvector (`search_tsv`).
   * Đánh chỉ mục GIN Trigram cho tìm kiếm mờ (`pg_trgm`).
   * Đánh chỉ mục Composite B-Tree cho các điều kiện lọc thường đi kèm `created_at DESC`.
2. **Pagination & Query Bounds:**
   * Luôn giới hạn `LIMIT` và sử dụng Keyset / Cursor-based pagination cho feed và tin nhắn lớn.
3. **Connection Pooling & Query Bounds:**
   * Tránh connection leak; mọi client mượn từ pool trong transaction phải được giải phóng qua khối `try ... finally { client.release() }` (được bọc tự động bởi `DatabaseService.transaction`).

---

## 🎨 4. UI/UX & Styling Standards
1. **Không Icon In Text:** Không dùng emoji thô trong chuỗi text (dùng icon Lucide SVG).
2. **Theme Consistency:** Luôn sử dụng biến CSS semantic (`--background`, `--foreground`, `--card`, `--border`, `--primary`, `--muted`).
3. **Contrast Compliance:** Đảm bảo tỷ lệ tương phản tối thiểu 4.5:1 cho text trên mọi nền ở cả Light Mode và Dark Mode.
4. **Zero Layout Shift khi mở Menu/Modal:**
   * Luôn đặt `modal={false}` cho các `DropdownMenu` thông thường trên feed/card để tránh Radix khóa cuộn body gây giật layout.

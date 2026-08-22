---
name: clean-code-performance
description: Clean code and performance-first engineering guidelines for PU Connector, inspired by Orca architecture.
---

# Clean Code & Performance Guidelines (PU Connector)

Quy chuẩn viết code sạch, kiến trúc module rõ ràng và ưu tiên hiệu năng tối đa cho dự án PU Connector.

---

## 1. Nguyên Tắc Đặt Tên & Cấu Trúc Module (No Dumping Grounds)

1. **Tuyệt đối không dùng tên mơ hồ:**
   * CẤM đặt tên file/folder là `utils.ts`, `helpers.ts`, `common.ts`, `misc.ts`, `shared-stuff.ts`.
   * Luôn dùng khái niệm domain cụ thể: `document-preview-modal.tsx`, `active-tab-navigation.ts`, `course-catalog-filter.ts`.
2. **Trách nhiệm đơn nhất (Single Responsibility):**
   * Nếu một file có xu hướng chứa nhiều hàm không liên quan, hãy tách ra thành các module domain độc lập.
3. **Ưu tiên `.ts` / `.tsx` thay vì `.d.ts`:**
   * Khai báo types và schemas trong mã nguồn có thể thực thi hoặc export từ `@pu/schemas`.

---

## 2. Quản Lý Trạng Thái (Zustand v5 Slice Pattern)

1. **Phân chia Slice theo từng phân hệ:**
   * Không gộp tất cả state vào 1 file khổng lồ. Mỗi feature là 1 slice độc lập (`feed-slice.ts`, `course-slice.ts`, `document-slice.ts`...).
2. **Tối ưu Re-render với Atomic Selectors:**
   ```typescript
   // TỐT: Chỉ re-render khi `posts` thay đổi
   const posts = useAppStore((state) => state.posts)
   const addPost = useAppStore((state) => state.addPost)

   // TRÁNH: Lấy toàn bộ state làm component re-render không cần thiết
   const state = useAppStore()
   ```

---

## 3. Tư Duy Tối Ưu Hiệu Năng (Performance-First)

### 3.1. Frontend & UI
1. **Zero Layout Shifts (CLS):** Luôn khai báo kích thước (`width`, `height`, `min-h`, `aspect-ratio`) cho hình ảnh, video, avatar và container động.
2. **Code Splitting & Lazy Loading:**
   * Lazy load các component nặng như `PdfViewer`, `TiptapEditor`, `MermaidBlock` hoặc các Modal khi chưa mở.
3. **Tree-shaking & Icon Import:**
   * Import trực tiếp icon cụ thể từ `lucide-react` (VD: `import { Heart } from 'lucide-react'`).
4. **Font Optimization:**
   * Dùng `next/font/google` với `display: 'swap'` và `subsets: ['vietnamese', 'latin']` để tự động preload `woff2`.

### 3.2. Backend & Database
1. **Index Optimization:**
   * Đánh index trên các trường query thường xuyên (`course_id`, `created_at`, `tags`, `author_id`).
2. **Pagination & Query Bounds:**
   * Luôn giới hạn `LIMIT` và `OFFSET` hoặc dùng Cursor-based pagination cho feed và tài liệu.
3. **Vector Search Performance:**
   * Sử dụng chỉ mục `HNSW` hoặc `IVFFlat` cho cột `pgvector` khi khối lượng dữ liệu embeddings tăng.

---

## 4. UI/UX & Styling Standards
1. **Không Icon In Text:** Không dùng emoji trong chuỗi text (dùng Lucide SVG components).
2. **Theme Consistency:** Luôn sử dụng biến CSS semantic (`--background`, `--foreground`, `--card`, `--border`, `--primary`, `--muted`).
3. **Contrast Compliance:** Đảm bảo tỷ lệ tương phản tối thiểu 4.5:1 cho text trên mọi nền ở cả Light Mode và Dark Mode.

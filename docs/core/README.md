# 🏛️ Phân Hệ Core: Mạng Xã Hội Học Thuật (Social Network Core)

> **Tầm nhìn sản phẩm:** Định hình PU Connection thành **University Super App & Social Learning Platform** — kết hợp ưu điểm của **Facebook (cộng đồng/kết nối)** + **X (tốc độ/ngắn gọn/bảng tin realtime)** + **Reddit (chuyên sâu theo chủ đề/môn học/Q&A giải pháp)**, được tinh chỉnh hoàn hảo cho môi trường đại học (Phenikaa University).

---

## 📋 Mục Lục Tài Liệu Phân Hệ Core (`/docs/core`)

| Tài Liệu | Nội Dung Chi Tiết | Trạng Thái |
|---|---|:---:|
| [**`FEATURE.md`**](./FEATURE.md) | **Tổng hợp ngắn gọn các tính năng đã triển khai & Lộ trình phát triển Social Core.** | ✅ Hoàn chỉnh |
| [**`01-social-feed-and-posts.md`**](./01-social-feed-and-posts.md) | Bảng tin cá nhân hóa, Đa định dạng Post (Text, LaTeX, Code, Ảnh, File, Poll), Like, Share, Bookmark & Thuật toán đề xuất. | ✅ Hoàn chỉnh |
| [**`02-threaded-comments-and-qa.md`**](./02-threaded-comments-and-qa.md) | Bình luận phân cấp lồng nhau (Nested Replies), Duyệt lời giải Q&A (Accepted Solution), Điểm danh vọng (Gamification). | ✅ Hoàn chỉnh |
| [**`03-profile-and-social-graph.md`**](./03-profile-and-social-graph.md) | Hồ sơ sinh viên, Cây phân cấp học thuật (Khoa/Viện/Khóa), Mạng lưới theo dõi (`user_follows`), Mention `@username`. | ✅ Hoàn chỉnh |
| [**`04-search-and-trending-topics.md`**](./04-search-and-trending-topics.md) | Hashtag `#tag`, Khám phá xu hướng (Trending / Explore), Full-Text Search đa thực thể với Zero Layout Shift. | ✅ Hoàn chỉnh |
| [**`05-notifications-and-realtime.md`**](./05-notifications-and-realtime.md) | Trung tâm thông báo đa kênh, WebSocket / Event Bus, Cơ chế gộp thông báo (Notification Aggregation). | ✅ Hoàn chỉnh |
| [**`07-search.md`**](./07-search.md) | Search chuẩn: full-text bỏ dấu tiếng Việt + gõ sai (trigram), xếp hạng, quy tắc quyền xem, `search_logs`, hiệu năng. | ✅ Đã triển khai |
| [**`08-web-state.md`**](./08-web-state.md) | Quản lý state phía web (ADR): TanStack Query cho dữ liệu server, zustand cho UI, layout chung, cache/prefetch/cập nhật lạc quan. | ✅ Đã triển khai |
| [**`06-messaging-and-ai.md`**](./06-messaging-and-ai.md) | Nhắn tin 1-1/nhóm, N7AI (`@n7ai` là bot user), AI drawer theo ngữ cảnh, tác vụ nhanh, RAG pgvector, lộ trình P0–P5. | 📐 Thiết kế |
| [**`14-google-mcp-connectors.md`**](./14-google-mcp-connectors.md) | Google MCP client + server tự host `workspace-mcp`: Drive, Calendar, Gmail; vòng lặp tool calling, OAuth, quyền chỉ đọc và cấu hình. | ✅ Đã triển khai |
| [**`16-n7ai-agent-tools.md`**](./16-n7ai-agent-tools.md) | N7AI agent: tool hội thoại cũ (`my_chats`), tool PU Connector (tìm kiếm + hướng dẫn app), nút dẫn đường / tham gia nhóm có xác nhận, hồ sơ học, ghim bộ nhớ; nguyên tắc chọn prompt / prefetch / tool. | ✅ Đã triển khai |
| [**`13-admin-console.md`**](./13-admin-console.md) | Cổng quản trị (chỉ admin): xem gì ở đâu, xử phạt theo bậc, điểm rủi ro, nhật ký bảo mật, lượt xem hồ sơ, quyền riêng tư & vận hành. | ✅ Đã triển khai |

---

## 🧩 Bản Đồ 13 Trụ Cột Tính Năng Core (Core Pillars)

```text
                                  PU CONNECTION — SOCIAL CORE
                                               │
      ┌────────────────────────┬───────────────┴───────────────┬────────────────────────┐
      │                        │                               │                        │
  [NỘI DUNG & FEED]     [TƯƠNG TÁC & THẢO LUẬN]        [MẠNG LƯỚI & DANH TÍNH]   [TÌM KIẾM & THÔNG BÁO]
      │                        │                               │                        │
  1. Home Feed cá nhân hóa 4. Like / Reaction             8. Student Profile       11. Unified Search
  2. Multi-format Post     5. Comment / Nested Reply      9. Follow / Social Graph 12. Hashtag & Trending
  3. Bookmark & Save       6. Share / Repost             10. Mention @user         13. Realtime Notification
                           7. Q&A Accepted Solution
```

---

## 🛠️ Nguyên Tắc Kỹ Thuật Bắt Buộc (Engineering Standards)

1. **PostgreSQL Native Client & ACID Transactions:**
   - Mọi thao tác thay đổi dữ liệu liên hoàn (Tạo bài viết + Thưởng điểm danh vọng + Tăng bộ đếm; Duyệt lời giải + Đánh dấu resolved) đều phải bọc trong `this.db.transaction(async (client) => { ... })`.
2. **Zero Layout Shift (CLS = 0):**
   - Lưới hiển thị đa phương tiện (Mosaic Gallery), Card bài viết, và Popover tìm kiếm phải tính toán kích thước dự đoán trước từ Backend metadata.
3. **Cursor-Based Pagination & GIN Indexing:**
   - Sử dụng Cursor Pagination trên `created_at DESC` cho Feed và Comments.
   - Đánh chỉ mục **GIN Index** cho các trường mảng (`tags`, `skills`, `interests`) và **B-Tree Index** cho các khóa ngoại (`author_id`, `course_id`, `post_id`).
4. **Monorepo Contracts (`@pu/schemas` & `@pu/ui`):**
   - Mọi payload trao đổi giữa Backend (NestJS) và Frontend (Next.js 15) bắt buộc tuân thủ hợp đồng dữ liệu **Zod Schema** tại `packages/schemas`.

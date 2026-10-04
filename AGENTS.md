# Quy Tắc Phát Triển & Chuẩn Mực Dự Án PU Connector

Tài liệu này định nghĩa các quy tắc bắt buộc mà toàn bộ AI Agents và lập trình viên phải tuân thủ khi phát triển và bảo trì codebase **PU Connector**.

---

## 🚨 1. NGUYÊN TẮC BẮT BUỘC: LUÔN CẬP NHẬT TÀI LIỆU (MANDATORY DOCS UPDATE)

> [!IMPORTANT]
> **BẤT KỂ CÓ FEAT MỚI, BUG FIX HOẶC THAY ĐỔI KIẾN TRÚC/HIỆU NĂNG NÀO, BẮT BUỘC PHẢI CẬP NHẬT TÀI LIỆU NGAY LẬP TỨC TRƯỚC KHI KẾT THÚC TASK.**

1. **Khi hoàn thành một tính năng mới (`feat`):**
   - Cập nhật [`docs/FEAT.md`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/docs/FEAT.md): Chuyển tính năng từ mục **"Dự định làm (Backlog)"** sang mục **"Đã hoàn thành (Completed)"** với checklist `[x]`, ghi rõ component, endpoint và cơ chế hoạt động.
   - Cập nhật `README.md` nếu có lệnh chạy mới hoặc biến môi trường mới (`.env.example`).
2. **Khi sửa lỗi (`fix`) hoặc tối ưu hiệu năng (`perf`):**
   - Cập nhật tài liệu kỹ thuật liên quan trong `docs/` hoặc walkthrough để ghi lại giải pháp và lý do thay đổi.
3. **Khi thay đổi kiến trúc / module / endpoint / migration / luồng nghiệp vụ — cập nhật sơ đồ [`docs/diagrams/`](docs/diagrams/README.md):**
   - Có migration SQL mới ⇒ chạy migration lên DB local rồi `pnpm docs:erd` (sinh lại `04-erd.md`, không sửa tay).
   - Thêm/xóa module, endpoint, dịch vụ ngoài, trang, luồng ⇒ sửa sơ đồ Mermaid tương ứng theo bảng "Cập nhật khi" trong `docs/diagrams/README.md` và thêm dòng Changelog.

---

## 🛠️ 2. Quy Trình Git & Commit Chuẩn (Git Workflow)

- **Tham khảo Skill:** [`.agents/skills/git-workflow/SKILL.md`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/.agents/skills/git-workflow/SKILL.md)
- **Quy tắc:**
  - **Atomic Commits:** Chia nhỏ commit theo từng phạm vi (`feat`, `fix`, `perf`, `chore`, `docs`, `refactor`), tuyệt đối không gộp chung toàn bộ thay đổi vào 1 commit khổng lồ.
  - **Format chuẩn:** `<type>(<scope>): <mô tả ngắn gọn>` (ví dụ: `feat(comments): add Q&A accepted solution logic`).
  - **Kiểm tra trước khi push:** Luôn chạy `pnpm typecheck` và `pnpm build` đạt 100% trước khi `git push`.

---

## 💻 3. Chuẩn Viết Comment Trong Mã Nguồn (In-Code Comments)

- **Ngắn gọn, ít chữ, dễ hiểu:** Không viết đoạn văn dài lê thê trong code.
- **Song ngữ tinh gọn (Anh + Việt):**
  - `// ACID Transaction: Create post & reward rep points`
  - `// Phân trang & Xếp hạng bài viết (Recommendation Engine)`
  - `// Đổi trạng thái lời giải Q&A (Accept Solution)`
  - `// Format thời gian tương đối chuẩn tiếng Việt`

---

## ⚡ 4. Hiệu Năng & Cơ Sở Dữ Liệu (Database & Performance)

- **Tham khảo Skill:** [`.agents/skills/clean-code-performance/SKILL.md`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/.agents/skills/clean-code-performance/SKILL.md)
- **Kiến trúc Database:**
  - Sử dụng **Native PostgreSQL Client (`pg` / `node-postgres`)** với Connection Pool (`pg.Pool`).
  - **ACID Transactions:** Mọi luồng thay đổi dữ liệu liên hoàn (Post + User Rep + Stats, Comment + Like) phải bọc trong `this.db.transaction(async (client) => { ... })`.
  - **Zero Layout Shift (CLS):** Toàn bộ phân trang bảng tin và bình luận phải có kích thước dự đoán trước, mượt mà khi cuộn vô hạn.
  - **Đánh chỉ mục:** Sử dụng **GIN Index** cho các trường mảng (`tags`, `interests`, `skills`) và B-Tree Index cho `created_at DESC`.

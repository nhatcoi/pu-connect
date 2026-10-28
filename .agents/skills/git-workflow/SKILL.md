---
name: git-workflow
description: Chuẩn quy trình Git commit, chia nhỏ commit theo Conventional Commits (feat, fix, chore, perf, refactor, docs) và push an toàn cho dự án PU Connect.
---

# Git Workflow & Commit Convention (PU Connect)

Quy chuẩn quản lý phiên bản mã nguồn, quy tắc đặt tên commit và quy trình đẩy code (push) cho dự án monorepo PU Connect.

---

## 📌 1. Nguyên Tắc Commit Cơ Bản

1. **Atomic Commits (Chia nhỏ theo phạm vi):** Không gộp tất cả thay đổi vào một commit duy nhất. Mỗi commit chỉ đại diện cho một tính năng, một lỗi sửa, hoặc một đợt tối ưu nhất định.
2. **Conventional Commits chuẩn hóa:**
   - `feat(...)`: Thêm tính năng mới (ví dụ: `feat(comments): add Q&A accepted solution logic`).
   - `fix(...)`: Sửa lỗi (ví dụ: `fix(post-card): resolve raw UUID display and format relative time`).
   - `perf(...)`: Tối ưu hiệu năng, giảm độ trễ, tối ưu render (ví dụ: `perf(feed): add infinite scroll and personalized recommendation score`).
   - `chore(...)`: Cấu hình môi trường, dependencies, database script (ví dụ: `chore(database): add ACID transaction helper & GIN indexes`).
   - `docs(...)`: Cập nhật tài liệu, skills, README (ví dụ: `docs(skills): add git-workflow skill`).
   - `refactor(...)`: Tái cấu trúc code mà không đổi logic nghiệp vụ.

---

## ⚡ 2. Cấu Trúc Đặt Tên Commit

```
<type>(<scope>): <mô tả ngắn gọn tiếng Anh hoặc song ngữ EN-VI>

[Tùy chọn: Mô tả chi tiết các thay đổi chính]
- Bullet point 1
- Bullet point 2
```

### 🎯 Bảng Phạm Vi (Scopes Thường Dùng):
- `storage`: Cloudflare R2, upload endpoints, file processing.
- `posts`: Đăng bài viết, composer, media gallery.
- `comments`: Bình luận, trả lời phân cấp, duyệt lời giải Q&A.
- `feed`: Bảng tin, recommendation algorithm, sorting.
- `database`: PostgreSQL connection, ACID transactions, indexes, seeds.
- `auth`: Đăng nhập, session, passport, guards.
- `ui`: Giao diện chung, theme, icons, modal.
- `skills`: Thư mục `.agents/skills`.

---

## 🛠️ 3. Quy Trình Commit & Push Từng Bước

```bash
# 1. Kiểm tra trạng thái thay đổi
git status

# 2. Stage các file theo từng nhóm tính năng (Selective Staging)
git add apps/api/src/modules/storage/...
git commit -m "feat(storage): integrate Cloudflare R2 object storage"

git add apps/web/src/components/social/comments/...
git commit -m "feat(comments): add academic comments system with solution badge"

# 3. Kiểm tra typecheck và build trước khi push
pnpm typecheck
pnpm build

# 4. Push lên remote repository an toàn
git push origin <current-branch>
```

---

## 💡 4. Quy Chuẩn Comment Code (In-Code Comments)

- **Ngắn gọn, ít chữ, dễ hiểu:** Tránh viết đoạn văn dài lê thê trong code.
- **Song ngữ tinh gọn (EN + VI):**
  - `// ACID Transaction: Create post & reward rep points`
  - `// Phân trang & Xếp hạng bài viết (Recommendation Engine)`
  - `// Đổi trạng thái lời giải Q&A (Accept Solution)`
  - `// Format thời gian tương đối chuẩn tiếng Việt`

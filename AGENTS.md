# Quy Tắc Phát Triển & Chuẩn Mực Dự Án PU Connect

Tài liệu này định nghĩa các quy tắc cốt lõi bắt buộc mà toàn bộ AI Agents (Antigravity, Claude, v.v.) và lập trình viên phải tuân thủ nghiêm ngặt khi phát triển và bảo trì codebase **PU Connect**.

---

## 🚨 1. NGUYÊN TẮC BẮT BUỘC: LUÔN CẬP NHẬT TÀI LIỆU (MANDATORY DOCS UPDATE)

> [!IMPORTANT]
> **BẤT KỂ CÓ TÍNH NĂNG MỚI (`feat`), SỬA LỖI (`fix`) HOẶC TỐI ƯU KIẾN TRÚC/HIỆU NĂNG (`perf`), BẮT BUỘC PHẢI CẬP NHẬT TÀI LIỆU TRƯỚC KHI KẾT THÚC TASK.**

1. **Khi hoàn thành tính năng mới (`feat`):**
   - Cập nhật [`docs/FEAT.md`](docs/FEAT.md): Chuyển tính năng từ **"Kế Hoạch (Roadmap)"** sang **"Đã Hoàn Thành (Completed)"** với checklist `[x]`, ghi rõ component, endpoint, migration và cơ chế vận hành.
   - Cập nhật [`README.md`](README.md) nếu có biến môi trường mới (`.env.example`), scripts hoặc lệnh chạy mới.
2. **Khi sửa lỗi (`fix`) hoặc tối ưu (`perf`):**
   - Cập nhật tài liệu kỹ thuật liên quan trong `docs/core/` hoặc docs module để ghi lại nguyên nhân, giải pháp và kết quả đo đạc.
3. **Khi thay đổi kiến trúc / DB / Endpoint / Luồng nghiệp vụ:**
   - Khi có migration SQL mới ⇒ chạy migration lên DB local rồi chạy `pnpm docs:erd` (sinh lại [`docs/diagrams/04-erd.md`](docs/diagrams/04-erd.md), không sửa tay).
   - Thêm/xóa module, endpoint, dịch vụ, trang ⇒ sửa sơ đồ Mermaid tương ứng trong [`docs/diagrams/`](docs/diagrams/README.md) và ghi nhận Changelog.

---

## ⚡ 2. Quản Lý State & Dữ Liệu Web (Web State & TanStack Query)

- **Tham khảo Skill:** [`.agents/skills/web-state-tanstack/SKILL.md`](.agents/skills/web-state-tanstack/SKILL.md) & [ADR `docs/core/08-web-state.md`](docs/core/08-web-state.md).
- **Phân định rõ ràng các loại state:**
  1. **Dữ liệu Server (Feed, Post, Profile, Comments, Search, Notifications, Chats):**
     - **BẮT BUỘC dùng `@tanstack/react-query`** (`useQuery`, `useInfiniteQuery`) với key tập trung từ [`apps/web/src/lib/query-keys.ts`](apps/web/src/lib/query-keys.ts).
     - **TUYỆT ĐỐI CẤM** tự fetch API bằng `useEffect` + `useState` cục bộ trong component/hook.
     - **Cập nhật đồng bộ đa vị trí (Optimistic Everywhere):** Khi like/save/pin/edit bài viết, luôn dùng `patchPostEverywhere(qc, id, updater)` từ [`apps/web/src/lib/post-cache.ts`](apps/web/src/lib/post-cache.ts) để giữ nguyên tham chiếu và đồng bộ ngay trên Feed, Profile, Community và Search.
  2. **UI State dùng chung (Modal, Drawer, Global Toggles):**
     - Dùng **Zustand** theo Slice Pattern ([`apps/web/src/store/`](apps/web/src/store/)).
     - Luôn dùng **Atomic Selector** (`useAppStore((s) => s.isCreatePostOpen)`), **CẤM** gọi `const state = useAppStore()`.
  3. **Phiên Đăng Nhập (`useSession`):**
     - Đồng bộ kép giữa cache TanStack `['me']` và Zustand store qua `useWriteSessionUser()` ([`apps/web/src/hooks/use-settings.ts`](apps/web/src/hooks/use-settings.ts)).
  4. **Khung App Đơn Nhất (`AppLayout`):**
     - Tuyệt đối không tự mount lại Header, Sidebar, BottomNav ở các trang con thuộc route group `app/(app)`.
     - Cột phải chuyên biệt của từng trang dùng `<PageAside>` để portal vào slot layout.

---

## 🎨 3. UI/UX, Design Tokens & Mobile Responsive Standards

- **Tham khảo Skill:** [`.agents/skills/ui-ux-mobile-responsive/SKILL.md`](.agents/skills/ui-ux-mobile-responsive/SKILL.md).
- **Semantic CSS Tokens (100% Theme Adaptive):**
  - **CẤM** hardcode mã màu hex (`#fff`, `#000`) hay class màu tĩnh như `text-black`, `bg-gray-100`, `bg-blue-600`.
  - Luôn dùng semantic tokens: `bg-background`, `bg-surface`, `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `bg-brand-orange`.
- **Animate UI & Motion Design:**
  - Tích hợp chuẩn hóa `motion/react` + Radix UI Primitives, áp dụng Spring Physics vật lý mượt mà.
  - **Chuyển trang & chuyển cảnh mượt mà:** Mọi thao tác UI/UX chuyển trang, chuyển cảnh, co giãn layout (Sidebar, Drawer, Panel, Tabs), mở/đóng modal hay thay đổi trạng thái UI đều phải có animate / animation UI mượt mà (`transition-all`, Spring Physics hoặc motion), tuyệt đối không đổi đột ngột gây khựng hoặc giật hình.
- **Zero Layout Shift (CLS):**
  - Mọi ảnh, video, avatar, container động phải có kích thước dự đoán trước (`aspect-ratio`, `w-* h-*`, `min-h-*`).
  - Dùng **Skeleton Loaders** ([`components/ui/skeleton.tsx`](apps/web/src/components/ui/skeleton.tsx)) cho lần tải đầu tiên; chỉ dùng Spinner cho hành động click/submit.
  - Dropdown menu trên feed/card phải đặt `modal={false}` để tránh Radix khóa cuộn body gây giật màn hình (`scrollbar-gutter: stable`).
- **Chuẩn Responsive Mobile (< 768px):**
  - Không để tràn ngang màn hình (`w-full min-w-0 overflow-x-hidden`).
  - Tap target tối thiểu 36px – 44px cho ngón tay.
  - Sử dụng Mobile Bottom Nav ([`MobileBottomNav`](apps/web/src/components/navigation/mobile-bottom-nav.tsx)) và thanh Header Mobile chuẩn 3 slot: Anchor trái, Slot giữa (Search/Logo), Action phải.
- **Quy ước Toast vs Notification:**
  - **Toast:** Chỉ dùng để xác nhận thao tác chủ động của chính người dùng khi kết quả không tự hiển thị ngay trên UI (sao chép link, lưu, xóa, lỗi mạng). Thao tác đã đổi trạng thái tại chỗ (nút Follow, Like) **không toast thành công**.
  - **Notification:** Dành cho tương tác của người khác với mình (like, reply, mention, follow).

---

### Dữ liệu "có đề xuất" (trường, lĩnh vực, môn học…) — quy tắc bắt buộc
Mọi ô chọn mà danh mục do admin quản lý và người dùng có thể thiếu mục phải theo cùng một cách (chi tiết: [`docs/core/03-profile-and-academic-graph.md`](docs/core/03-profile-and-academic-graph.md#dữ-liệu-có-đề-xuất-quy-tắc-chung)):
1. **UI**: dùng `SuggestPickerDialog` (`components/common/suggest-picker.tsx`), không dùng `<select>` / popover riêng. Hộp luôn có ô tìm (bỏ dấu), danh sách **A–Z** nhóm theo chữ cái, dòng **"Khác — đề xuất …"** ghim trên cùng ⇒ form đề xuất.
2. **Dữ liệu người dùng**: "Khác" ⇒ giá trị của người dùng hiển thị là **"Khác"** (kèm tên đã gửi cho chính họ). **Duyệt** ⇒ cập nhật đúng theo đề xuất + thông báo. **Từ chối** ⇒ giữ yêu cầu `rejected`, giá trị người dùng **vẫn là "Khác"** cho tới khi họ chọn lại; lưu lại đúng tên đã bị từ chối không gửi lại.
3. **Admin**: mọi đề xuất duyệt ở một nơi — trang **Đề xuất** (`features/suggestions/suggestions-page.tsx`), không rải trong từng tab. Loại đề xuất mới ⇒ thêm vào trang này + cộng vào badge menu (`AdminStats`).

## 🗄️ 4. Backend, Database & Native PostgreSQL

- **Tham khảo Skill:** [`.agents/skills/backend-db-architecture/SKILL.md`](.agents/skills/backend-db-architecture/SKILL.md).
- **Native PostgreSQL Client (`pg.Pool`):**
  - **TUYỆT ĐỐI CẤM** đưa Prisma, TypeORM hoặc các ORM nặng nề vào dự án. Toàn bộ truy vấn viết bằng SQL thuần tối ưu hiệu năng qua `DatabaseService.query()`.
- **ACID Transactions với Row Locking:**
  - Mọi luồng ghi dữ liệu từ 2 bước trở lên (Tạo bài + Mentions, Nhóm học + Chat, Khảo sát + Vote, v.v.) phải bọc trong `await this.db.transaction(async (client) => { ... })`.
  - Sử dụng `SELECT ... FOR UPDATE` khi cập nhật các tài nguyên có tranh chấp (sĩ số nhóm học, quota PU AI, số dư/điểm).
- **Migrations Idempotent:**
  - Mọi file SQL trong `apps/api/src/database/*.sql` phải có tính chất idempotent: `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING/UPDATE`.
- **Chỉ mục hiệu năng cao:**
  - GIN Index cho các cột mảng (`tags`, `skills`, `interests`) và generated tsvector (`search_tsv`).
  - GIN Trigram index (`pg_trgm`) cho tìm kiếm mờ không dấu.
  - Composite B-Tree cho các điều kiện lọc kết hợp `created_at DESC`.
- **Bảo mật & Không Mock Fallback:**
  - CẤM fallback sang mock user ID (`req.user?.id || 'mock-id'`). Sử dụng `requireUserId(req)` từ `apps/api/src/common/http/current-user.ts` và bảo vệ bằng `AuthenticatedGuard`.
  - Phân quyền theo vai trò rõ ràng (`RolesGuard`).
  - Session lưu trữ tập trung tại PostgreSQL (`user_sessions`).

---

## 🧹 5. Clean Code & Chuẩn Mực Kỹ Thuật (Technical Hygiene)

- **Tham khảo Skill:** [`.agents/skills/clean-code-performance/SKILL.md`](.agents/skills/clean-code-performance/SKILL.md).
- **No Dumping Grounds:**
  - **CẤM** tạo file rác không rõ domain như `utils.ts`, `helpers.ts`, `common.ts`, `misc.ts`.
  - Luôn đặt tên theo domain nghiệp vụ cụ thể: `mention-suggest.service.ts`, `post-cache.ts`, `academic-unit-selector.tsx`.
- **Shared Schemas (`packages/schemas`):**
  - Mọi DTO, validation Zod schema và Type dùng chung giữa Web và API phải định nghĩa tại `packages/schemas/src/`.
- **In-Code Comments Song Ngữ Tinh Gọn (EN + VI):**
  - Viết ngắn gọn, súc tích, mô tả mục đích kiến trúc thay vì dịch code:
  - `// ACID Transaction: Create post & record mentions`
  - `// Optimistic toggle with rollback`
  - `// Format thời gian tương đối tiếng Việt`
- **Zero Lint & Zero Typecheck Errors:**
  - Luôn đảm bảo `pnpm typecheck` và `pnpm lint` đạt **100% không lỗi, không cảnh báo** trước khi kết thúc task.

---

## 🛠️ 6. Quy Trình Git & Commit Chuẩn (Conventional Commits)

- **Tham khảo Skill:** [`.agents/skills/git-workflow/SKILL.md`](.agents/skills/git-workflow/SKILL.md).
- **Atomic Commits:** Chia nhỏ commit theo đúng phạm vi:
  - `feat(<scope>): <mô tả>`: Tính năng mới.
  - `fix(<scope>): <mô tả>`: Sửa lỗi.
  - `perf(<scope>): <mô tả>`: Tối ưu hiệu năng.
  - `refactor(<scope>): <mô tả>`: Tái cấu trúc không đổi logic.
  - `chore(<scope>): <mô tả>`: Cấu hình, dependencies, DB migration.
  - `docs(<scope>): <mô tả>`: Cập nhật tài liệu, diagram, skills.
- **Quy trình kiểm tra trước khi push:**
  ```bash
  pnpm typecheck
  pnpm build
  git status
  ```

---

## 🚦 7. Deploy

> [!IMPORTANT]
> **Không còn cổng gác `DevOpsVPS-CICD`.** Session nào làm xong thì tự deploy (skill `deploy` / `scripts/deploy.sh`), không gửi qua session khác.

1. **Trước khi deploy:** `pnpm typecheck`, `pnpm lint`, build các app đã sửa, docs đã cập nhật (mục 1), migration idempotent và có trong `scripts/deploy.sh`, commit Conventional Commits đã push (chỉ stage hunk của mình).
2. **Chạy deploy một lần, một session:** kiểm tra VPS rảnh trước (`ssh root@103.195.237.112 'pgrep -af "next build|rsync|turbo"'`); hai deploy đồng thời làm hỏng slot web.
3. **Verify sau deploy:** web 200, admin 200, `/api/auth/me` 401, `pu-api`/`pu-web` active, `nginx -t`, log không lỗi SQL.
4. **Dừng và hỏi user** khi build/typecheck/lint fail, migration phá hủy (DROP/DELETE/TRUNCATE), hoặc có secret trong diff.
5. **`scripts/deploy.sh` rsync `--delete` cả working tree** (kể cả WIP chưa commit và file untracked của session khác), KHÔNG deploy theo commit. Người deploy phải: (a) đọc `git status` và báo những WIP của session khác sẽ bị kéo theo; (b) nếu chỉ muốn deploy commit thì tạo bản copy sạch từ `HEAD` (`git worktree` / `git archive`) rồi rsync từ đó. Không stash/revert đồ của người khác.

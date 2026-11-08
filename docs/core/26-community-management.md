# 26 — Tạo & quản lý cộng đồng

Cộng đồng (`/communities`, `/c/[slug]`) trước đây chỉ do dev thêm bằng SQL. Từ 2026-10-28 người dùng tự tạo, cộng đồng có chủ và điều hành viên, admin duyệt.

## Vòng đời

```
người dùng đủ điều kiện ──POST /communities──▶ pending (chỉ chủ thấy)
        pending ──admin duyệt──▶ active (công khai, nhận bài)
        pending ──admin từ chối + lý do──▶ rejected (chủ vẫn thấy, đọc được lý do)
        mọi trạng thái ──admin gỡ──▶ xóa (bài viết giữ, community_id = NULL)
admin tạo thẳng ────────────────────────▶ active (không qua duyệt)
```

Cộng đồng có sẵn (seed) mặc định `status = 'active'`, chưa có chủ ⇒ admin đặt chủ khi cần.

## Điều kiện tạo

- Tài khoản người thật đang hoạt động, và **một trong hai**: có **tích xanh** (`users.is_verified`), hoặc **email đã xác thực** (`email_verified`) + tài khoản **≥ 14 ngày** (`COMMUNITY_MIN_ACCOUNT_DAYS`) + **≥ 5 bài viết** chưa bị ẩn (`COMMUNITY_MIN_POSTS`). Không dùng `reputation_points` vì điểm này đã ngừng cộng (xem FEAT: loại bỏ Gamification).
- Mỗi người tối đa **3** cộng đồng đang hoạt động + chờ duyệt (`COMMUNITY_MAX_OWNED`), khóa dòng `users` để hai yêu cầu song song không vượt hạn mức.
- Người dùng thường chọn loại `academic | life | club`; `campus` / `faculty` chỉ admin.
- Slug `a-z 0-9 -`, 3–50 ký tự, trùng ⇒ 409.

## Vai trò

| Vai trò | Quyền |
| --- | --- |
| `owner` (đúng 1 người, ràng buộc `uq_community_one_owner`) | Mọi quyền của điều hành viên + đặt / gỡ điều hành viên + xóa điều hành viên. Không rời được cộng đồng. |
| `moderator` | Sửa mô tả, nội quy, ảnh đại diện / bìa; xem danh sách thành viên; xóa thành viên **thường**; ẩn / khôi phục bài. |
| `member` | Đăng bài, rời cộng đồng. |

Tên, slug, loại do admin giữ. Vai trò `admin` cũ trong `community_members` được đổi thành `owner` khi chạy migration.

## API người dùng

| Method | Đường dẫn | Ai |
| --- | --- | --- |
| `POST` | `/communities` | người đủ điều kiện |
| `PATCH` | `/communities/:slug` | owner, moderator — `description`, `rules`, `avatarUrl`, `bannerUrl` |
| `GET` | `/communities/:slug/members?q&limit&offset` | owner, moderator |
| `PUT` | `/communities/:slug/members/:userId/role` `{role: moderator\|member}` | owner |
| `DELETE` | `/communities/:slug/members/:userId` | owner (mọi người trừ chủ), moderator (chỉ member) |
| `POST` / `DELETE` | `/communities/:slug/posts/:postId/hide` | owner, moderator — ẩn có `reason`, thông báo tác giả |
| `GET` | `/communities/:slug/hidden-posts` | owner, moderator |

Danh sách / chi tiết chỉ trả cộng đồng `active`, riêng người tạo còn thấy cộng đồng chờ duyệt / bị từ chối của mình. Tham gia hoặc đăng bài vào cộng đồng chưa duyệt ⇒ 404 / bài không gắn cộng đồng.

**Ẩn bài** dùng `posts.hidden_at / hidden_by / hidden_reason` như admin. Điều hành viên chỉ khôi phục được bài do **chủ hoặc điều hành viên cộng đồng** ẩn (`hidden_by` thuộc danh sách quản lý); bài admin hệ thống ẩn thì chỉ admin gỡ.

## API admin (`academic:manage`)

`GET /admin/communities?status&type&q` (danh sách + facet trạng thái), `POST /admin/communities` (tạo thẳng, `ownerUsername` tùy chọn), `POST :id/approve`, `POST :id/reject {note}`, `PUT :id/owner {username}` (chủ cũ xuống điều hành viên), `DELETE :id`. Mọi thao tác ghi `admin_audit_logs` (`community.*`) và duyệt / từ chối / gỡ gửi thông báo `account_notice` cho chủ.

## Giao diện

- Web: nút *Tạo cộng đồng* + thẻ trạng thái ở `/communities`; ở `/c/[slug]` chủ / điều hành viên có nút *Quản lý* (hộp 3 tab: Giới thiệu · Thành viên · Bài đã ẩn) và nút ẩn trên từng bài; banner nhắc khi cộng đồng chờ duyệt / bị từ chối.
- Admin: Học thuật → Cộng đồng — lọc trạng thái, Duyệt / Từ chối, đổi chủ, gỡ, tạo mới.

## Bộ đếm bài

`communities.posts_count` do trigger `trg_community_posts_count` (migration `community-posts-count-upgrade.sql`) tính lại khi bài vào / rời cộng đồng, bị ẩn hoặc lưu trữ; đếm khớp bảng tin (chưa ẩn, chưa lưu trữ). Code không còn tự cộng / trừ.

Test: `apps/api/test/community-management.e2e-spec.ts`.

## Tính năng riêng của cộng đồng (2026-11-07)

Trước đây cộng đồng chỉ là bảng tin có lọc. Bốn phần dưới đây chỉ thành viên cộng đồng mới có, mã ở `CommunityExtrasService` (`apps/api/src/modules/communities/community-extras.service.ts`) và `CommunityChatService` (`apps/api/src/modules/chat/conversations/`). Migration `community-features-upgrade.sql` (chạy trong cả hai script deploy).

### 1. Bài ghim

Chủ / điều hành viên ghim **tối đa 3 bài** (`COMMUNITY_PIN_MAX`) của chính cộng đồng, hiện ở dải *Đã ghim* đầu trang. Bảng `community_pins (community_id, post_id, pinned_by, pinned_at)`; ghim bài không thuộc cộng đồng ⇒ 404, quá 3 ⇒ 400 (khóa dòng `communities` nên 2 yêu cầu song song không vượt hạn mức). Nút ghim nằm cạnh nút ẩn bài trên từng bài.

### 2. Tài liệu của cộng đồng

Tab **Tài liệu**: thành viên chia sẻ **tài liệu công khai, đã đăng, của chính mình** từ thư viện vào cộng đồng. Bảng `community_documents (community_id, document_id, added_by, added_at)` chỉ **trỏ** tới `documents` nên không nhân đôi file; xóa tài liệu gốc thì tự biến khỏi cộng đồng (CASCADE). Người thêm hoặc chủ / điều hành viên được gỡ. Tài liệu riêng tư hoặc của người khác bị từ chối.

### 3. Hỏi N7AI theo nội dung cộng đồng

Tab **Hỏi N7AI** (`POST /communities/:slug/ask {question}`, thành viên). Không phải agent: một lượt `llm.complete`, tính **1 lượt** vào hạn mức N7AI hằng ngày (`ai_runs.trigger = 'community'`, hết lượt ⇒ 429). Ngữ cảnh gom từ chính cộng đồng:

- bài **ghim** + bài **khớp từ khóa** câu hỏi (full-text `posts.search_tsv`, `toTsQuery`) + 5 bài mới nhất (bỏ bài ẩn danh / bị ẩn);
- **đoạn tài liệu** khớp câu hỏi (`document_chunks.search_tsv`, chỉ tài liệu của cộng đồng) + tiêu đề / mô tả các tài liệu đã chia sẻ.

Model được dặn chỉ dùng nguồn này, gắn `[n]` cho từng ý, thiếu nguồn thì nói chưa có thông tin; kết quả trả `{ answer, sources }` và **chỉ giữ nguồn thật sự được trích dẫn**. Khác DeepTutor / chat N7AI: chưa dùng vector (chỉ full-text), chưa nhớ hội thoại giữa các câu hỏi.

### 4. Nhóm chat

Nút **Chat nhóm** (`POST /communities/:slug/chat`): mỗi cộng đồng một nhóm chat (`conversations.community_id`, duy nhất), tạo lười khi thành viên đầu tiên mở — mô hình y hệt nhóm học ([`study-group-chat.service.ts`](../../apps/api/src/modules/chat/conversations/study-group-chat.service.ts)). Khác nhóm học: **không tự đưa mọi thành viên vào** (cộng đồng có thể hàng nghìn người); ai bấm mới vào. Rời cộng đồng hoặc bị xóa khỏi cộng đồng ⇒ rời nhóm chat trong cùng transaction, mở lại bị 403.

### 5. Thông báo bài mới

Loại thông báo `community_post` (`ALTER TYPE notification_type_enum`): bài mới (không ẩn danh) ⇒ báo cho thành viên có `community_members.notify = TRUE` (mặc định bật), tối đa 1000 người, **gộp** thành "A và N người khác đã đăng bài trong X" (`groupKey community:<id>`), mặc định **không push**. Biểu tượng chuông ở đầu trang cộng đồng bật / tắt (`GET|PUT /communities/:slug/notify`); người dùng cũng tắt cả loại này ở Cài đặt thông báo.

### API thêm

| Method | Đường dẫn | Ai |
| --- | --- | --- |
| `GET` | `/communities/:slug/pins` | khách |
| `PUT` / `DELETE` | `/communities/:slug/pins/:postId` | owner, moderator |
| `GET` | `/communities/:slug/documents` | khách |
| `GET` | `/communities/:slug/documents/candidates` | thành viên (tài liệu của mình chưa chia sẻ) |
| `POST` | `/communities/:slug/documents` `{documentId}` | thành viên (409 nếu đã có) |
| `DELETE` | `/communities/:slug/documents/:documentId` | người thêm, owner, moderator |
| `GET` / `PUT` | `/communities/:slug/notify` `{enabled}` | thành viên |
| `POST` | `/communities/:slug/ask` `{question ≤ 500}` | thành viên |
| `POST` | `/communities/:slug/chat` | thành viên |

### Seed cộng đồng

`add-communities.sql` **không còn seed** 5 nhóm mẫu: file này chạy mỗi lần deploy nên nhóm đã xóa tự sinh lại. Cộng đồng `n7ai` (kênh chia sẻ skill, link ở Cài đặt N7AI) vẫn do `puai-settings-upgrade.sql` tạo.

Test: `apps/api/test/community-features.e2e-spec.ts`.

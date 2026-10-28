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

- Tài khoản người thật đang hoạt động, **đã xác thực** (`users.is_verified`) **hoặc** `reputation_points ≥ 300` (`COMMUNITY_MIN_REPUTATION`).
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

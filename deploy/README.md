# Deploy PU Connect

Mọi lệnh deploy nằm ở đây. Chạy từ thư mục gốc repo. Máy dev gọi `deploy/*.sh`; phần chạy trên VPS nằm ở `deploy/remote/`.

| Lệnh | Việc | Đụng tới |
|---|---|---|
| `pnpm run deploy:vps` | Cả chuỗi: db → api → admin → docs → nginx → web → verify. `--skip db,docs` để bỏ bớt | Tất cả |
| `pnpm run deploy:db` | Postgres/Redis, migration, bot và dữ liệu mẫu lần đầu | Chỉ DB |
| `pnpm run deploy:api` | Build API, smoke check nạp module, restart `pu-api` | Chỉ API |
| `pnpm run deploy:web` | Build Web vào slot rảnh, chuyển slot, restart `pu-web` (lỗi thì tự về slot cũ) | Chỉ Web |
| `pnpm run deploy:admin` | Build `apps/admin/dist` (nginx phục vụ ngay) | Chỉ Admin |
| `pnpm run deploy:docs` | Build `apps/docs/dist` | Chỉ Docs |
| `pnpm run deploy:nginx` | Cấu hình Admin, Docs, IP thật Cloudflare; `nginx -t`; reload | Chỉ Nginx |
| `pnpm run deploy:verify` | Web 200, Admin 200, Docs 200, API 401, dịch vụ active, `nginx -t` | Chỉ đọc |
| `pnpm run deploy:status` | Dịch vụ, slot web, tài nguyên, deploy đang chạy, health | Chỉ đọc |
| `pnpm run deploy:rollback` | Web về slot trước | Chỉ Web |

Chọn lệnh theo thay đổi:

| Bạn sửa | Chạy |
|---|---|
| `apps/web` | `deploy:web` |
| `apps/api` (không migration) | `deploy:api` |
| `apps/api` có file `*.sql` mới | `deploy:db` rồi `deploy:api` |
| `apps/admin` | `deploy:admin` |
| `apps/docs` hoặc `docs/` | `deploy:docs` |
| `packages/schemas` | `deploy:api`, `deploy:web`, `deploy:admin` |
| Nhiều chỗ, hoặc không chắc | `deploy:vps` |

Sau mỗi lệnh nên chạy `deploy:verify` (`deploy:vps` đã tự chạy).

## Quy tắc an toàn

- **Một deploy một lúc.** Mỗi lệnh lấy khóa `flock` trên VPS (`/var/lock/pu-deploy.lock`). Lệnh thứ hai báo "VPS đang có deploy khác (ai, lúc nào, lệnh gì)" thay vì đè slot build. Khóa gắn với phiên SSH nên máy dev chết thì tự nhả.
- **Deploy lấy working tree, không lấy commit.** `rsync --delete` đưa cả file chưa commit và untracked (kể cả của session khác). Mỗi lệnh in số thay đổi chưa commit trước khi sync. Muốn chỉ deploy commit thì rsync từ bản copy sạch của `HEAD`.
- **Migration dừng khi lỗi.** `migrate.sh` chạy từng file với `ON_ERROR_STOP`; file lỗi thì dừng, API và Web đang chạy giữ nguyên. `MIGRATIONS_STRICT=0 pnpm run deploy:db` để chạy tiếp qua lỗi (chỉ dùng khi biết rõ lỗi vô hại).
- **API:** smoke check nạp toàn bộ module trước khi restart; sau restart chờ `/api/auth/me` trả 401.
- **Web blue/green:** build vào slot rảnh (`.next-a`/`.next-b`), ghi slot cũ vào `.web-slot.env.prev`, chuyển slot, chờ web trả 200/3xx; không phản hồi thì tự về slot cũ. `deploy:rollback` dùng đúng slot đã ghi, không đoán.
- **Build tuần tự** (VPS 2 GB RAM), ưu tiên CPU/IO thấp.

## Thêm migration

1. Viết file idempotent trong `apps/api/src/database/`.
2. Thêm tên file vào **cuối** `deploy/migrations.list` và vào `apps/api/test/global-setup.ts`.
3. `deploy:db`, rồi `deploy:api` nếu code API dùng cột mới.

Không thêm lệnh `psql` vào `scripts/deploy.sh` (chỉ còn là vỏ gọi `deploy/all.sh`).

## Cấu trúc

```
deploy/
  lib.sh            cấu hình, SSH, khóa, rsync, kiểm tra HTTP (source, không chạy trực tiếp)
  all.sh db.sh api.sh web.sh admin.sh docs.sh nginx.sh   các loại deploy
  verify.sh status.sh rollback.sh                        kiểm tra / xem / hoàn tác
  migrations.list   danh sách migration theo thứ tự (nguồn duy nhất)
  remote/           script chạy trên VPS: db, migrate, build, api, web, static, nginx, rollback, status
```

Biến môi trường: `VPS_HOST` (mặc định `root@103.195.237.112`), `VPS_DIR` (`/var/www/pu-connector`), `DOMAIN` (`puc.vnhat.dev`).

`pnpm run deploy:mac` (`deploy/mac-vps.sh`: build trên Mac rồi đẩy artifact) là đường riêng, chưa dùng khóa; dùng chung `deploy/migrations.list`.

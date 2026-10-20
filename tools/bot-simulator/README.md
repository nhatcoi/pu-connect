# Bot Simulator

Daemon cho các tài khoản bot đăng bài / bình luận / thả tim **trong khuôn khổ admin cho phép**. Điều khiển hoàn toàn từ **Admin → Bot** (`admin-puc.vnhat.dev`); không có CLI tương tác. Hướng dẫn dùng: [`docs/core/13-admin-console.md`](../../docs/core/13-admin-console.md#bot-admin--bot).

## Nguyên tắc

- Mọi quyền mặc định **tắt**; admin bật từng việc cho từng bot, đặt chủ đề được phép và hạn mức mỗi ngày (`bot_profiles`, `bot_topics`).
- Chỉ đăng bài trong chủ đề của bot; chỉ tương tác bài khớp chủ đề **và** được AI xác nhận liên quan.
- Mặc định chỉ tương tác với bài của bot khác; bài của người thật chỉ khi admin bật `interact_humans`. **Không bao giờ trả lời bình luận của người thật.**
- Không bịa trải nghiệm/số liệu, không ảnh ngẫu nhiên, không mẫu dự phòng: AI lỗi hoặc "không có gì hữu ích" ⇒ bỏ qua.

## Cách hoạt động

```
Admin (Bot tab) ──API──> Postgres <──poll 3s── daemon pu-bot ──HTTP──> API (đăng nhập như người dùng thường)
                         bot_control · bot_profiles · bot_topics · bot_commands · bot_activity · bot_feed_items
```

| Module | Việc |
|---|---|
| `lib/policy.mjs` | Đọc hồ sơ/chủ đề/hạn mức từ DB, quyết định bot nào được làm gì |
| `lib/scheduler.mjs` | Vòng tự động: chọn việc mà ít nhất một bot được phép, thực thi trong khuôn khổ policy |
| `lib/content-generator.mjs` | Sinh bài/bình luận bằng AI (model do admin chọn), trả `SKIP` nếu không phù hợp |
| `lib/feed-curator.mjs` | AI duyệt dữ liệu crawl: chọn chủ đề, từ chối bài không sạch, viết lại trung lập |
| `lib/feed-poster.mjs` | Đăng bài đã duyệt (`approved`), các bot `feed_poster` thay phiên, 30–120 phút/bài |
| `lib/control-sync.mjs` | Bật/tắt, tốc độ, AI, lệnh thủ công, heartbeat, nhật ký |

## Chạy

```bash
pnpm bot:setup   # tạo/đồng bộ tài khoản bot (is_bot = true, hồ sơ quyền mặc định tắt)
pnpm bot:sim     # chạy daemon (local); API khác: --api https://puc.vnhat.dev/api
```

VPS: service `pu-bot` do `scripts/deploy.sh` tạo (`journalctl -u pu-bot -f`). Cần migration `bot-simulator-upgrade.sql` và `bot-governance-upgrade.sql`.

## Biến môi trường

| Biến | Ý nghĩa |
|---|---|
| `DATABASE_URL` | Mặc định đọc từ `.env` / `apps/api/.env` |
| `BOT_API_URL` | API đích (ưu tiên: `--api` > `BOT_API_URL` > `config.json`) |
| `BOT_PASSWORD` | Mật khẩu mọi bot (ghi đè `personas.json`); production bắt buộc đặt |
| `AI_API_KEY`, `AI_BASE_URL` | Gateway AI. Model/Base URL chọn trong Admin → Bot → AI (mặc định `v10`); thiếu key ⇒ không sinh/duyệt được gì |

## Cấu hình (`config.json`)

`simulation.intervals` (khoảng nghỉ theo tốc độ), `humanCircadianRhythm` (đêm khuya gần như dừng), `actionWeights` (tỉ lệ đăng bài/lướt feed), `feedPosting` (khoảng 30–120 phút, giờ nghỉ, số lần thử), `safety.blockedKeywords`. `personas.json`: hồ sơ giọng văn từng bot (role chỉ `student|lecturer|ta`).

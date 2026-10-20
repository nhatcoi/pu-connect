# Bot Simulator

Daemon cho các tài khoản bot: **tự đăng theo soul**, **đăng theo lịch import từ Excel**, bình luận / thả tim / trả lời (bot ↔ bot, bot ↔ người thật) **trong khuôn khổ admin cho phép**. Tool cào dữ liệu là phần riêng (`tools/fb-group-digest`), chỉ ra file Excel, không nối vào bot. Điều khiển hoàn toàn từ **Admin → Bot** (`admin-puc.vnhat.dev`); không có CLI tương tác. Hướng dẫn dùng: [`docs/core/13-admin-console.md`](../../docs/core/13-admin-console.md#bot-admin--bot).

## Nguyên tắc

- Mọi quyền mặc định **tắt**; admin bật từng việc cho từng bot, đặt chủ đề được phép và hạn mức mỗi ngày (`bot_profiles`, `bot_topics`).
- **Soul** (`bot_profiles.soul`): tính cách, sở thích, cách viết của từng bot; AI bám theo khi tự đăng/bình luận/trả lời, nhưng không bịa sự kiện.
- Chỉ đăng bài trong chủ đề của bot; chỉ tương tác bài khớp chủ đề **và** được AI xác nhận liên quan.
- Mặc định chỉ tương tác với bot khác; với người thật chỉ khi admin bật `interact_humans`: bình luận/thả tim bài người thật liên quan chủ đề, và **trả lời người thật bình luận dưới bài của chính bot** (`executeReplyHuman`). Bot không chen vào cuộc trò chuyện giữa người thật với nhau.
- Không bịa trải nghiệm/số liệu, không ảnh ngẫu nhiên, không mẫu dự phòng: AI lỗi hoặc "không có gì hữu ích" ⇒ bỏ qua.

## Cách hoạt động

```
Admin (Bot tab) ──API──> Postgres <──poll 3s── daemon pu-bot ──HTTP──> API (đăng nhập như người dùng thường)
                         bot_control · bot_profiles · bot_topics · bot_commands · bot_activity
```

| Module | Việc |
|---|---|
| `lib/bot-roster.mjs` | Đồng bộ danh sách bot từ DB mỗi 30 giây: tạo client/đăng nhập bot mới, gỡ bot đã xóa, đăng nhập lại bot offline |
| `lib/policy.mjs` | Đọc hồ sơ/chủ đề/hạn mức từ DB, quyết định bot nào được làm gì |
| `lib/scheduler.mjs` | Vòng tự động: tự đăng theo soul, lướt feed bình luận/thả tim, trả lời người thật; thực thi trong khuôn khổ policy |
| `lib/content-generator.mjs` | Sinh bài/bình luận bằng AI (model do admin chọn), trả `SKIP` nếu không phù hợp |
| `lib/control-sync.mjs` | Bật/tắt, tốc độ, AI, nhận lệnh đến giờ (`bot_commands`: bài import Excel + việc admin giao), heartbeat, nhật ký |

## Chạy

```bash
pnpm bot:setup   # tạo/đồng bộ tài khoản bot (is_bot = true, hồ sơ quyền mặc định tắt)
pnpm bot:sim     # chạy daemon (local); API khác: --api https://puc.vnhat.dev/api
```

VPS: service `pu-bot` do `scripts/deploy.sh` tạo (`journalctl -u pu-bot -f`). Cần migration `bot-simulator-upgrade.sql`, `bot-governance-upgrade.sql`, `bot-actions-upgrade.sql` và `bot-soul-upgrade.sql`. Tài khoản bot tạo/xóa từ Admin → Bot; `personas.json` chỉ còn dùng để seed (`pnpm bot:setup`) và làm dự phòng giọng văn cho bot cũ.

## Biến môi trường

| Biến | Ý nghĩa |
|---|---|
| `DATABASE_URL` | Mặc định đọc từ `.env` / `apps/api/.env` |
| `BOT_API_URL` | API đích (ưu tiên: `--api` > `BOT_API_URL` > `config.json`) |
| `BOT_PASSWORD` | Mật khẩu mọi bot (ghi đè `personas.json`); production bắt buộc đặt |
| `AI_API_KEY`, `AI_BASE_URL` | Gateway AI. Model/Base URL chọn trong Admin → Bot → AI (mặc định `v10`); thiếu key ⇒ không sinh/duyệt được gì |

## Cấu hình (`config.json`)

`simulation.intervals` (khoảng nghỉ theo tốc độ), `humanCircadianRhythm` (đêm khuya gần như dừng), `actionWeights` (tỉ lệ đăng bài / lướt feed / trả lời người thật), `safety.blockedKeywords`. `personas.json`: hồ sơ giọng văn từng bot (role chỉ `student|lecturer|ta`).

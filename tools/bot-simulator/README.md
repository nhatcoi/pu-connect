# Bot Simulator

Daemon giả lập các tài khoản bot sinh viên Phenikaa (đăng bài, thả tim, bình luận, chat 1-1, chat nhóm) để demo và thử tải. **Điều khiển từ Admin → Bot** (`admin-puc.vnhat.dev`); không có CLI tương tác.

## Cách hoạt động

```
Admin (Bot tab) ──API──> Postgres: bot_control · bot_commands · bot_activity <──poll 3s── daemon (pu-bot)
                                                                                    └──HTTP──> API (đăng nhập như người dùng thường)
```

- Daemon đăng nhập từng bot qua API công khai, nên mọi quy tắc (quota, kiểm duyệt, thông báo) áp dụng như người thật.
- `bot_control`: bật/tắt, tốc độ, heartbeat 10s, số liệu phiên. Mặc định **tắt**.
- `bot_commands`: lệnh thủ công (đăng bài / chat / nhóm / bình luận), nhận tuần tự, kết quả ghi lại.
- `bot_activity`: nhật ký (giữ 7 ngày).

## Chạy

```bash
pnpm bot:setup   # tạo/đồng bộ tài khoản bot (users.is_bot = true, không bao giờ admin)
pnpm bot:sim     # chạy daemon (local); trỏ API khác: --api https://puc.vnhat.dev/api
```

Sau đó vào Admin → Bot → **Bật mô phỏng**. Cần migration `bot-simulator-upgrade.sql`.

VPS: service `pu-bot` do `scripts/deploy.sh` tạo (`journalctl -u pu-bot -f`).

## Biến môi trường

| Biến | Ý nghĩa |
|---|---|
| `DATABASE_URL` | Mặc định đọc từ `.env` / `apps/api/.env` |
| `BOT_API_URL` | API đích (ưu tiên: `--api` > `BOT_API_URL` > `config.json`) |
| `BOT_PASSWORD` | Mật khẩu mọi bot (ghi đè `personas.json`); production bắt buộc đặt |
| `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | Gateway sinh nội dung; thiếu key ⇒ dùng kịch bản mẫu |

## Cấu hình (`config.json`)

- `simulation.intervals` — khoảng nghỉ giữa các hành động theo tốc độ (`slow|normal|fast`, đổi trong Admin).
- `simulation.humanCircadianRhythm` — nhịp thức/ngủ giờ Việt Nam (đêm khuya gần như dừng, tối cao điểm).
- `simulation.mode` — `hybrid` (LLM, lỗi thì dùng mẫu), `template_only`, `llm_only`.
- `simulation.actionWeights` — tỉ lệ hành động tự động.
- `chatSettings`, `postSettings`, `safety.blockedKeywords` — độ dài chat, khảo sát, từ khóa bị chặn.

`personas.json` — hồ sơ và giọng văn từng bot (role chỉ `student|lecturer|ta`).

## Lưu ý

Bot làm méo số liệu hoạt động thật; lọc theo `users.is_bot` khi thống kê.

## Đăng bài từ dữ liệu crawl (`FeedPoster`)

`@tranngocbot` và `@tranminhbot` thay phiên đăng bài lấy từ hàng đợi `bot_feed_items` (do `tools/fb-group-digest` đẩy lên `POST /api/bots/ingest`).

- Mỗi 30–120 phút ngẫu nhiên đăng 1 bài (cũ nhất trước), kèm ảnh nếu có, là bài riêng, nội dung đã bỏ link Facebook và che SĐT/biển số/email.
- Không đăng trùng: UNIQUE theo id bài gốc và theo hash nội dung chuẩn hóa. Nghỉ 00:00–06:00 giờ VN. Lỗi 3 lần thì bỏ qua bài đó.
- Bật/tắt bằng công tắc *Đăng bài từ dữ liệu crawl* ở Admin → Bot (mặc định tắt, độc lập với mô phỏng chung).
- Cấu hình: `config.json` → `feedPosting` (`bots`, `minMinutes`, `maxMinutes`, `quietHoursVN`, `maxAttempts`).

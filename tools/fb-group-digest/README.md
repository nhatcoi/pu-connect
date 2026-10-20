# fb-group-digest (tool cá nhân)

Lấy bài mới của group Facebook (mặc định Góc Thông Tin Phenikaa), lưu `out/YYYY-MM-DD.md` và (tùy chọn) đẩy lên hàng đợi bot để `@tranngocbot`/`@tranminhbot` đăng lại.
Dùng trình duyệt đăng nhập bằng tài khoản của bạn (profile lưu ở `.profile/`, không lưu mật khẩu).

```bash
cd tools/fb-group-digest
npm install && npx playwright install chromium
npm run login      # đăng nhập FB 1 lần trong cửa sổ hiện ra, rồi đóng cửa sổ
npm run digest     # chạy ẩn; thêm --headed để xem
```

## Xuất Excel để import vào bot

```bash
npm run export     # như digest nhưng KHÔNG đẩy lên bot; ghi out/YYYY-MM-DD.xlsx
```

File đúng cột chuẩn (`content, key, title, images, topic, bot, scheduled_at, enhance` + `source_url, author` chỉ để tham khảo). Có `BOT_INGEST_TOKEN` thì ảnh được đưa lên R2 và cột `images` chứa URL bền (URL ảnh Facebook hết hạn). Mở file, điền cột `bot` / `scheduled_at` / `enhance` cho từng bài nếu muốn, rồi vào **Admin → Bot → Nội dung & hành động → Import Excel**. Dùng tool crawl khác cũng được, miễn ra đúng cột (nút *Tải file mẫu* trong hộp thoại import).

## Đẩy lên bot

Copy `.env.example` thành `.env`, điền `BOT_INGEST_TOKEN` (lấy: `ssh root@103.195.237.112 'grep BOT_INGEST_TOKEN /var/www/pu-connector/.env'`).
Mỗi bài: lấy id ổn định, tải ảnh trong thân bài ngay lúc crawl (URL Facebook hết hạn), gửi `POST /api/bots/ingest`. Server lọc, chống trùng, lưu ảnh R2. Bài lỗi mạng không bị đánh dấu đã thấy nên lần sau thử lại. Bật đăng bài ở Admin → Bot.

Biến tùy chọn: `FB_GROUP_ID`, `MAX_POSTS` (30), `MAX_SCROLLS` (12), `MAX_AGE_HOURS` (36).
Chạy hằng ngày (cron, 7h): `0 7 * * * cd /đường/dẫn/tools/fb-group-digest && npm run digest`

Lưu ý: vi phạm điều khoản Facebook; chỉ chạy 1 lần/ngày, dùng tài khoản phụ nếu ngại bị khóa. Bài đăng lại không kèm tên người viết, nhưng vẫn là nội dung của người khác: bộ lọc loại các bài tố cáo/bóc phốt, bạn nên xem lại hàng đợi định kỳ.

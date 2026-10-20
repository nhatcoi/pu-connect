# fb-group-digest (tool cá nhân, tách khỏi hệ bot)

Lấy bài mới của group Facebook (mặc định Góc Thông Tin Phenikaa) ra `out/YYYY-MM-DD.md`, `.json` và **`.xlsx`**. Tool không nói chuyện với bot: bạn mở file Excel, chỉnh nếu muốn, rồi import ở **Admin → Bot → Import Excel** (bot đăng theo giờ trong file).
Dùng trình duyệt đăng nhập bằng tài khoản của bạn (profile lưu ở `.profile/`, không lưu mật khẩu).

```bash
cd tools/fb-group-digest
npm install && npx playwright install chromium
npm run login      # đăng nhập FB 1 lần trong cửa sổ hiện ra, rồi đóng cửa sổ
npm run digest     # chạy ẩn; thêm --headed để xem
```

## File Excel

Đúng cột chuẩn (`content, key, title, images, topic, bot, scheduled_at, enhance` + `source_url, author` chỉ để tham khảo). Điền `bot` / `scheduled_at` / `enhance` cho từng bài nếu muốn: bỏ trống `bot` ⇒ hệ thống chia đều cho bot được phép đăng, bỏ trống `scheduled_at` ⇒ giãn cách. Dùng tool crawl khác cũng được, miễn ra đúng cột (nút *Tải file mẫu* trong hộp thoại import).

Ảnh: copy `.env.example` thành `.env`, điền `BOT_INGEST_URL` + `BOT_INGEST_TOKEN` (lấy: `ssh root@103.195.237.112 'grep BOT_INGEST_TOKEN /var/www/pu-connector/.env'`) thì ảnh được đưa lên R2 và cột `images` chứa URL bền (URL ảnh Facebook hết hạn). Không có token ⇒ cột `images` để trống.

Biến tùy chọn: `FB_GROUP_ID`, `MAX_POSTS` (30), `MAX_SCROLLS` (12), `MAX_AGE_HOURS` (36).
Chạy hằng ngày (cron, 7h): `0 7 * * * cd /đường/dẫn/tools/fb-group-digest && npm run digest`

Lưu ý: vi phạm điều khoản Facebook; chỉ chạy 1 lần/ngày, dùng tài khoản phụ nếu ngại bị khóa. Bài đăng lại không kèm tên người viết, nhưng vẫn là nội dung của người khác: bộ lọc loại các bài tố cáo/bóc phốt, bạn nên xem lại file Excel trước khi import.

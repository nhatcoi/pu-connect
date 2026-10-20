# 13 — Admin Console (`admin-puc.vnhat.dev`)

Cổng quản trị Static SPA (`apps/admin`, Vite + React) — **chỉ role `admin`** truy cập được (`AdminGuard`, lecturer / ta = 0 quyền). API dưới `/api/admin/*` (`apps/api/src/modules/admin`).

## Xem gì ở đâu

| Cần xem / làm | Ở đâu |
|---|---|
| Số liệu tổng quan, việc cần xử lý | **Tổng quan** |
| Báo cáo vi phạm, bài viết, bình luận (ẩn / ghim / xóa hàng loạt) | **Kiểm duyệt** |
| Danh sách người dùng: lọc, sắp xếp (gồm *Rủi ro*), thao tác hàng loạt, xuất CSV | **Người dùng** |
| Toàn bộ dữ liệu 1 người | **Người dùng** › bấm người đó › nút ⤢ phóng to |
| — bài viết, bình luận, cảm xúc, đã lưu, theo dõi, cộng đồng, nhóm học, tài liệu, hội thoại, báo cáo, xem & tìm kiếm | tab **Hoạt động** |
| — ai đã xem hồ sơ này / người này đã xem ai | tab **Lượt xem hồ sơ** |
| — thiết bị đang đăng nhập, ép đăng xuất từng phiên / tất cả, IP, tài khoản chung IP, nhật ký đăng nhập | tab **Phiên & Bảo mật** |
| — lịch sử xử phạt, bậc đề xuất, hủy chế tài nhầm | tab **Xử phạt** |
| — thao tác admin trên người này | tab **Kiểm duyệt** |
| — ghi chú nội bộ (người dùng không thấy) | tab **Ghi chú** |
| Khóa nhanh | nút **Khóa** đầu hồ sơ (hộp Xử phạt chọn sẵn *Khóa*, chọn thời hạn) |
| Học phần, tài liệu (đã / chưa vào N7AI), cộng đồng | **Học thuật** |
| Telemetry, phản hồi, ticket, skill N7AI | **N7AI** |
| Từ khóa tìm nhiều / không có kết quả | **Tìm kiếm** |
| Gửi thông báo hệ thống | **Thông báo** |
| Bật/tắt bot mô phỏng, tốc độ, lệnh thủ công, nhật ký bot | **Bot** |
| Admin đã làm gì (không sửa được) | **Nhật ký › Thao tác quản trị** |
| Đăng nhập / sai mật khẩu / bị chặn của mọi tài khoản (lọc theo IP, @username) | **Nhật ký › Đăng nhập** |
| Bộ lọc hay dùng | nút **View** trên mỗi trang (có sẵn + lưu riêng / chia sẻ) |

Mọi bộ lọc, trang, tab, hồ sơ đang mở đều nằm trên URL (`#/users?risk=high&user=<id>`) ⇒ gửi link là mở đúng màn hình.

## Xử phạt

Thang (đếm vi phạm 180 ngày, bỏ bản đã hủy): **Cảnh cáo → Hạn chế 1 ngày → Hạn chế 7 ngày → Khóa 7 ngày → Khóa 30 ngày → Khóa vĩnh viễn**.

- **Hạn chế** = chỉ xem: không đăng / sửa bài, bình luận, nhắn tin, tạo hội thoại, tải tài liệu, tạo nhóm học (`NotRestrictedGuard`). Vẫn thả cảm xúc, theo dõi, báo cáo, hỏi N7AI. Web hiện banner vàng.
- **Khóa** = không đăng nhập được, bị đăng xuất mọi thiết bị. Hết hạn ⇒ đăng nhập lại được ngay; job mỗi phút dọn dữ liệu.
- Không khóa / hạn chế được tài khoản admin và chính mình.

## Đăng nhập từ nơi lạ

Đăng nhập thành công từ **quốc gia / vùng chưa từng thấy trong 90 ngày** (không tính lần đầu) ⇒ cột `unusual`:
người dùng nhận thông báo "Có đăng nhập mới từ … — nếu không phải bạn, đổi mật khẩu…", nhật ký gắn nhãn *Nơi lạ*
(**Nhật ký › Đăng nhập › Nơi lạ**, view *Đăng nhập từ nơi lạ*), điểm rủi ro +10 / lần (30 ngày, tối đa 20).
IP 4G ở VN hay định vị về Hà Nội / TP.HCM ⇒ chỉ để tham khảo, không làm bằng chứng.

## Điểm rủi ro (0–100, tính lại mỗi 10 phút)

Bị báo cáo 30 ngày · bài bị ẩn 90 ngày · bị xử phạt 180 ngày · tài khoản mới đăng dồn dập · đăng nhập chung mạng với tài khoản khác · đăng nhập sai liên tục. **Mạng có > 10 tài khoản bị bỏ qua** (wifi trường / NAT), tránh coi cả trường là clone.

**"Cùng mạng"** = hàm SQL `ip_net()`: IPv4 so nguyên địa chỉ, **IPv6 so theo /64** (máy cá nhân tự đổi 64 bit cuối để bảo vệ riêng tư ⇒ so nguyên địa chỉ gần như không bao giờ khớp). Người dùng mạng hỗ trợ IPv6 (phần lớn nhà mạng VN) sẽ chỉ có IPv6 — server không biết IPv4 của họ, đó là bình thường.

## Dữ liệu & quyền riêng tư

| Dữ liệu | Lưu | Ghi chú |
|---|---|---|
| Nhật ký bảo mật (`user_security_events`) | 90 ngày | đăng nhập, sai MK, đăng xuất, đặt lại MK… + IP, thiết bị, **vị trí gần đúng** (thành phố / vùng / quốc gia từ header Cloudflare *Add visitor location headers* — không GPS). Người dùng xem được của mình (Cài đặt › Đăng nhập & Bảo mật) |
| Lượt xem hồ sơ (`profile_views`) | 90 ngày | gộp theo giờ, bỏ qua tự xem. **Người bị xem không thấy**, chỉ admin |
| Hội thoại | — | admin chỉ thấy **siêu dữ liệu** (với ai, bao nhiêu tin) — **không đọc nội dung** |
| Hành vi xem & tìm kiếm (`user_events`) | — | chỉ có khi người dùng bật cá nhân hóa |

- Mỗi lần admin mở dữ liệu nhạy cảm (insight, bảo mật, lượt xem hồ sơ, hội thoại, hành vi) đều ghi vào **Nhật ký** (`user.insight_view`, `user.security_view`, `user.data_view`).
- Đã công bố trong Chính sách bảo mật (Nghị định 13/2023).
- IP thật lấy qua Nginx snippet `pu-cloudflare-realip.conf` (chỉ tin `CF-Connecting-IP` từ dải IP Cloudflare).

## Bot mô phỏng (Admin → Bot)

- Bot = tài khoản `users.is_bot = true`, tự đăng bài / chat / bình luận để demo và thử tải. Logic ở `tools/bot-simulator` (daemon `pu-bot`), **không chạy trong API**.
- Admin ↔ daemon giao tiếp qua DB, không mở cổng: `bot_control` (bật/tắt, tốc độ, heartbeat, số liệu), `bot_commands` (hàng đợi lệnh thủ công, nhận bằng `FOR UPDATE SKIP LOCKED`), `bot_activity` (nhật ký, giữ 7 ngày). Daemon hiện **Offline** nếu heartbeat quá 30 giây.
- Endpoint `GET admin/bots`, `GET admin/bots/activity`, `PATCH admin/bots/control`, `POST admin/bots/commands`; quyền `bots:manage`; mọi thao tác ghi audit (`bot.control`, `bot.command`).
- Mặc định **TẮT**: deploy không tự phát sinh nội dung, admin bấm *Bật mô phỏng*. Tài khoản bot luôn là `student/lecturer/ta`, không bao giờ `admin`; mật khẩu lấy từ `BOT_PASSWORD` trong `.env` trên VPS (tự sinh lần deploy đầu).
- Lưu ý: bot làm méo số liệu hoạt động thật (like, người dùng hoạt động) — lọc theo `is_bot` khi thống kê.
- Daemon: `journalctl -u pu-bot -f` · `systemctl restart pu-bot`. Local: `pnpm bot:setup` rồi `pnpm bot:sim`.

## Vận hành

- Migration: `admin-users`, `admin-lists`, `admin-sanctions`, `admin-security`, `profile-views-upgrade.sql`, `bot-simulator-upgrade.sql` (đều trong `scripts/deploy.sh`).
- Job nền trong API: gỡ chế tài hết hạn (1 phút, `AdminUsersService`), điểm rủi ro + xóa nhật ký / lượt xem quá 90 ngày (10 phút, `AdminRiskService`).
- **Chỉ một deploy tại một thời điểm**: `deploy.sh` build web vào slot rảnh `.next-a/.next-b`, hai deploy song song ghi đè slot của nhau. Kiểm tra trước: `ssh root@103.195.237.112 'pgrep -af "next build|rsync"'`.
- `deploy.sh` rsync **thư mục làm việc** (cả file chưa commit). File ghi chú local `*.local.md` bị loại trừ.

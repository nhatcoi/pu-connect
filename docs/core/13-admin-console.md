# 13 — Admin Console (`admin-puc.vnhat.dev`)

Cổng quản trị Static SPA (`apps/admin`, Vite + React) — **chỉ role `admin`** truy cập được (`AdminGuard`, lecturer / ta = 0 quyền). API dưới `/api/admin/*` (`apps/api/src/modules/admin`).

## Xem gì ở đâu

| Cần xem / làm | Ở đâu |
|---|---|
| Số liệu tổng quan, việc cần xử lý | **Tổng quan** |
| Báo cáo vi phạm bài viết và bình luận (hàng chờ chung, lọc theo lý do, ẩn / xóa / bỏ qua hàng loạt), bài viết, bình luận | **Kiểm duyệt** |
| Danh sách người dùng: lọc, sắp xếp (gồm *Rủi ro*), thao tác hàng loạt, xuất CSV | **Người dùng** |
| Toàn bộ dữ liệu 1 người | **Người dùng** › bấm người đó › nút ⤢ phóng to |
| — bài viết, bình luận, cảm xúc, đã lưu, theo dõi, cộng đồng, nhóm học, tài liệu, hội thoại, báo cáo, xem & tìm kiếm | tab **Hoạt động** |
| — ai đã xem hồ sơ này / người này đã xem ai | tab **Lượt xem hồ sơ** |
| — thiết bị đang đăng nhập, ép đăng xuất từng phiên / tất cả, IP, tài khoản chung IP, nhật ký đăng nhập | tab **Phiên & Bảo mật** |
| — lịch sử xử phạt, bậc đề xuất, hủy chế tài nhầm | tab **Xử phạt** |
| — thao tác admin trên người này | tab **Kiểm duyệt** |
| — ghi chú nội bộ (người dùng không thấy) | tab **Ghi chú** |
| Đặt lại mật khẩu cho người dùng | menu **⋯** của hồ sơ / thanh thao tác hàng loạt (biểu tượng chìa khóa) › *Gửi link đặt lại mật khẩu* hoặc *Bắt đổi mật khẩu* |
| Cây đơn vị (trường / khoa / ngành, viện, trung tâm): thêm, sửa, sắp xếp, gộp | **Học thuật** › tab **Đơn vị** |
| Khóa nhanh | nút **Khóa** đầu hồ sơ (hộp Xử phạt chọn sẵn *Khóa*, chọn thời hạn) |
| Học phần, tài liệu (đã / chưa vào N7AI), cộng đồng | **Học thuật** |
| Telemetry, phản hồi, ticket, skill, danh mục model N7AI | **N7AI** |
| Từ khóa tìm nhiều / không có kết quả | **Tìm kiếm** |
| Thông báo hệ thống: nhắm theo vai trò / đơn vị / khóa, hẹn giờ, banner đầu trang web, lịch sử và hủy | **Thông báo** |
| Nhập bài sưu tầm (Excel/JSON), job đăng bài của bot, bot tự trả lời/thả tim | **Bot** |
| Admin đã làm gì (không sửa được) | **Nhật ký › Thao tác quản trị** |
| Đăng nhập / sai mật khẩu / bị chặn của mọi tài khoản (lọc theo IP, @username) | **Nhật ký › Đăng nhập** |
| Bộ lọc hay dùng | nút **View** trên mỗi trang (có sẵn + lưu riêng / chia sẻ) |

Mọi bộ lọc, trang, tab, hồ sơ đang mở đều nằm trên URL (`#/users?risk=high&user=<id>`) ⇒ gửi link là mở đúng màn hình.

## Đơn vị học thuật (trường → khoa → ngành)

- Bảng `academic_units` (không còn hằng số trong code). Người dùng chọn đơn vị ở form sửa hồ sơ; `users.unit_id` lưu đơn vị cụ thể nhất, cột chữ `school` / `faculty` / `major` suy ra từ cây. **Khoa hiển thị bằng tên viết tắt** (CNTT, KHMT, QTKD…) thay các mã cũ FIT / FCS / FBA.
- **Học thuật › Đơn vị**: thêm / sửa tên và tên viết tắt / sắp xếp (lên, xuống) / tắt (không còn trong danh sách chọn) / **gộp** (chuyển người dùng + đơn vị con sang đơn vị đích) / xóa (chỉ khi trống). Đổi tên hay tên viết tắt tự cập nhật hồ sơ mọi người trong nhánh. Mỗi thao tác ghi nhật ký (`academic_unit.*`).
- Danh sách người dùng có bộ lọc **Đơn vị** (chọn khoa ⇒ gồm cả các ngành).
- Migration `academic-units-upgrade.sql` chạy mỗi lần deploy: seed (không ghi đè), gán `unit_id` cho người dùng chưa có (khớp ngành > khoa > mã cũ > trường) và đồng bộ lại cột chữ. Người dùng ghi trường khác / nhập tay giữ nguyên, `unit_id` rỗng.
- Chưa đổi: `courses.faculty_code`, `posts.faculty_code` vẫn là mã khoa riêng của học phần / bài viết.

## Xử phạt

Thang (đếm vi phạm 180 ngày, bỏ bản đã hủy): **Cảnh cáo → Hạn chế 1 ngày → Hạn chế 7 ngày → Khóa 7 ngày → Khóa 30 ngày → Khóa vĩnh viễn**.

- **Hạn chế** = chỉ xem: không đăng / sửa bài, bình luận, nhắn tin, tạo hội thoại, tải tài liệu, tạo nhóm học (`NotRestrictedGuard`). Vẫn thả cảm xúc, theo dõi, báo cáo, hỏi N7AI. Web hiện banner vàng.
- **Khóa** = không đăng nhập được, bị đăng xuất mọi thiết bị. Hết hạn ⇒ đăng nhập lại được ngay; job mỗi phút dọn dữ liệu.
- Không khóa / hạn chế được tài khoản admin và chính mình.

## Đặt lại mật khẩu (admin không đặt, không xem mật khẩu)

- **Gửi link đặt lại mật khẩu** (`send_reset`): gửi email có link (30 phút, dùng một lần) tới email của chính người dùng. Mật khẩu cũ vẫn dùng được tới khi họ đổi. Dùng khi người dùng báo không đăng nhập được.
- **Bắt đổi mật khẩu** (`force_reset`): đặt cờ `users.must_reset_password`, đăng xuất mọi thiết bị, gửi link như trên. Đăng nhập bằng mật khẩu bị chặn tới khi người dùng đặt mật khẩu mới (`resetPassword` xóa cờ). Đăng nhập Google không bị chặn. Dùng khi nghi lộ tài khoản.
- Bỏ qua admin, tài khoản không có mật khẩu (chỉ Google) và chính mình. Ghi `admin_audit_logs` (`user.reset_link`, `user.force_reset`) và nhật ký bảo mật của người dùng (`password_reset_requested`, method `admin`, hiển thị "bởi quản trị viên").

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

## Thùng rác (xóa mềm)

- Xóa **bài viết, bình luận, tài liệu, bộ học (Flashcard/Quiz), đơn vị học thuật** không mất hẳn: trigger `trash_row` (migration `trash-upgrade.sql`) lưu bản sao dòng bị xóa (cả dòng bị cascade, vd bình luận của bài) vào `deleted_records`, nhóm theo `batch` (một giao dịch xóa). Truy vấn đọc hiện có không đổi.
- `GET admin/trash?table=` liệt kê các lần xóa; `POST admin/trash/:batch/restore` khôi phục cả batch (cha trước con) và tính lại `comments_count`; ghi audit `trash.restore`. Quyền `moderation:read` / `moderation:write`.
- Giữ 30 ngày, job rủi ro (10 phút) dọn hẳn bản ghi quá hạn. Người xóa lấy từ `app.user_id` (service gọi `setTrashActor`).
- Không khôi phục: reaction, lượt lưu và dữ liệu cascade ở bảng khác (chỉ 5 bảng trên); nếu tác giả hoặc bài gốc đã bị xóa thì báo lỗi, không khôi phục dở.
- Không dùng cho dữ liệu cá nhân người dùng chủ động xóa (bộ nhớ AI, token connector…): các mục này vẫn xóa thật.

## Bot (Admin → Bot)

Bot = tài khoản `users.is_bot = true`. Mô hình rất đơn giản: **admin nhập bài đã sưu tầm → tạo job → bot đăng theo lịch → bot tự trả lời/thả tim bình luận ở bài của job**. Không có daemon riêng: vòng chạy (`BotJobRunner`, 15 giây/lần) nằm trong API và đăng bài qua `PostsService.create` / `CommentsService.create`, nên bài của bot đủ thông báo, @mention, tìm kiếm như bài người thật.

Trang gồm hai thẻ: **Job đăng bài** và **Bot**.

**Bot** (CRUD tài khoản, `POST/PATCH/DELETE admin/bots/accounts[/:username]`): username, tên hiển thị, vai trò `student/lecturer/ta`, khoa, ngành, bio, giọng văn (tone) và **soul** (tính cách, cách viết; AI bám theo khi trả lời bình luận). Mật khẩu hệ thống cấp từ `BOT_PASSWORD`. Xóa bot xóa luôn job, bài, bình luận, tim của bot (tính lại bộ đếm).

**Job** (`POST admin/bots/jobs`): một lô bài giao cho **một bot**. Nút *Tạo job*: đặt tên → chọn bot → bật/tắt *Tự trả lời bình luận* và *Tự thả tim bình luận* → chọn file `.xlsx` / `.csv` / `.json` (có nút tải mẫu Excel và JSON). Trình duyệt đọc file, **tự ghép cột** theo tên thường gặp (VI/EN; mở “Ghép cột” để chỉnh tay), rồi API **kiểm tra từng dòng** (dry-run) trước khi tạo.

Cột của file (chỉ `content` bắt buộc; JSON dùng cùng tên khóa, giá trị mảng được giữ nguyên):

| Cột | Ý nghĩa |
|---|---|
| `content` | Nội dung bài (≤ 20.000 ký tự) |
| `title` | Tiêu đề (≤ 200) |
| `images` | URL ảnh https, tối đa 8, cách nhau bằng `\|` hoặc xuống dòng. URL R2 giữ nguyên; URL ngoài được server tải về R2 (chặn IP nội bộ, không theo redirect, ≤ 8MB); ảnh lỗi bị bỏ kèm cảnh báo, bài vẫn nhập |
| `tags` | Thẻ, cách nhau bằng dấu phẩy (tối đa 10) |
| `postType` | `general` (mặc định) · `qa` · `document` · `group_recruit` · `review` |
| `visibility` | `public` (mặc định) · `followers` · `private` |
| `course` | Mã môn hoặc id; phải tồn tại |
| `community` | Slug cộng đồng; phải tồn tại |
| `pollQuestion` + `pollOptions` | Khảo sát (2–6 lựa chọn, cách nhau bằng `\|`); phải có đủ cả hai |
| `scheduledAt` | Giờ đăng (`2026-10-21 08:30` hoặc `21/10/2026 08:30`). Bỏ trống ⇒ giãn cách đều (mặc định 30 phút/bài, chỉnh được); giờ quá khứ ⇒ đăng ngay; tối đa 1 năm |

Mỗi dòng hợp lệ thành một bản ghi `bot_job_posts` (`pending`); cả lô và job ghi trong **một transaction**, tối đa 500 dòng/job. Dòng lỗi không làm hỏng cả file. **Chống trùng** theo hash nội dung đã chuẩn hóa (trong file và với mọi job khác, trừ bài đã lỗi). Bài đến giờ ⇒ runner nhận (`FOR UPDATE SKIP LOCKED`) và đăng; lỗi ⇒ `failed` kèm lý do, bấm *Thử lại* hoặc *Bỏ bài*; *Đăng ngay* đưa bài chờ lên đầu hàng. API tắt giữa lúc đăng ⇒ bài kẹt `posting` được đánh `failed` khi khởi động lại (không đăng lại để tránh trùng).

**Tự động tương tác** (theo cờ của job, chỉ ở bài job đã đăng): bình luận của **người thật** trong 7 ngày gần đây, sau ≥ 20 giây, chưa xử lý (`bot_job_handled`, mỗi bình luận một lần) ⇒ *thả tim* (nếu bật) và/hoặc *trả lời* (nếu bật): AI viết 1–2 câu theo bio/tone/soul của bot, bám nội dung bài, trả `SKIP` khi là spam/không cần đáp. Trần 20 bình luận bot mỗi bài; lỗi AI chỉ ghi vào `bot_job_handled.error`, không đăng gì. Bot không trả lời bot khác, không chen vào bài của người khác. Job *Tạm dừng* ⇒ không đăng, không tương tác.

**AI**: dùng model mặc định trong tab *N7AI → LLM* (key ở DB mã hóa hoặc env).

**Tool crawl (phần riêng)** `tools/fb-group-digest`: chạy trên máy cá nhân, ra file `out/YYYY-MM-DD.xlsx` rồi admin nhập vào job. Chỉ nối vào API để xin URL ảnh bền qua `POST /api/bots/ingest/images` (header `x-bot-ingest-token` = `BOT_INGEST_TOKEN`; ảnh Facebook hết hạn nên cần đưa lên R2). Lấy token: `ssh root@103.195.237.112 'grep BOT_INGEST_TOKEN /var/www/pu-connector/.env'`. Cột file crawl cũ (`key`, `topic`, `bot`, `enhance`) bị bỏ qua.

**Kỹ thuật**: bảng `bot_jobs`, `bot_job_posts`, `bot_job_handled` (migration `bot-jobs-upgrade.sql`) + `bot_profiles` (chỉ còn `tone`/`major`/`soul`). Endpoint `admin/bots*` (quyền `bots:manage`, mọi thao tác ghi audit `bot.*`). Các bảng của hệ cũ (`bot_control`, `bot_commands`, `bot_topics`, `bot_activity`, `bot_feed_items`, cột quyền/hạn mức trong `bot_profiles`) còn trong DB nhưng không dùng; lệnh đang chờ bị hủy khi migrate; daemon `pu-bot` đã bị bỏ (deploy tự tắt và xóa unit). Bot làm méo số liệu hoạt động thật ⇒ lọc theo `is_bot`. Local: `pnpm bot:setup` tạo bot mẫu.

## Vận hành

- Migration: `admin-users`, `admin-lists`, `admin-sanctions`, `admin-security`, `profile-views-upgrade.sql`, `bot-simulator-upgrade.sql`, `bot-governance-upgrade.sql`, `bot-actions-upgrade.sql`, `bot-soul-upgrade.sql`, `bot-jobs-upgrade.sql` (đều trong `scripts/deploy.sh`).
- Job nền trong API: gỡ chế tài hết hạn (1 phút, `AdminUsersService`), điểm rủi ro + xóa nhật ký / lượt xem quá 90 ngày (10 phút, `AdminRiskService`).
- **Chỉ một deploy tại một thời điểm**: `deploy.sh` build web vào slot rảnh `.next-a/.next-b`, hai deploy song song ghi đè slot của nhau. Kiểm tra trước: `ssh root@103.195.237.112 'pgrep -af "next build|rsync"'`.
- `deploy.sh` rsync **thư mục làm việc** (cả file chưa commit). File ghi chú local `*.local.md` bị loại trừ.

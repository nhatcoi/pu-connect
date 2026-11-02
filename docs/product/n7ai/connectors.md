# Kết nối ngoài

## Mục đích

Cho N7AI truy cập nguồn dữ liệu ngoài với sự đồng ý của người dùng: Google Workspace, tài khoản đại học qua PU Connect, và kho bài báo khoa học.

## Danh sách kết nối

| Kết nối | Mã | Xác thực | Quyền | Việc N7AI làm được |
|---|---|---|---|---|
| Thư viện PU | mặc định | Không | Đọc | Tìm tài liệu và bài trong PU Connect |
| Tài liệu của tôi | mặc định | Không | Đọc | Tài liệu riêng đã lập chỉ mục |
| Nhóm học của tôi | mặc định | Không | Đọc | Nhóm học mình tham gia |
| Google Drive | `google_drive` | OAuth | `drive.readonly` | Tìm, đọc, liệt kê tệp |
| Google Calendar | `google_calendar` | OAuth | `calendar.readonly` | Xem lịch, giờ rảnh |
| Gmail | `google_gmail` | OAuth | `gmail.readonly` | Tìm và đọc thư, nhãn |
| Google Forms | `google_forms` | OAuth | `forms.body`, `forms.responses.readonly` | Tạo form, xem phản hồi |
| Google Sheets | `google_sheets` | OAuth | `spreadsheets` | Đọc, tạo bảng, thêm hàng |
| Google Tasks | `google_tasks` | OAuth | `tasks` | Xem, tạo công việc |
| PU Connect (tài khoản đại học) | `pu_connector` | PKCE qua tiện ích trình duyệt | 8 công cụ chỉ đọc | Hồ sơ, lịch học và thi, điểm, môn trên Canvas, hạn nộp bài, hoạt động, điểm danh, tệp môn học |
| Semantic Scholar và arXiv | `semantic_scholar` | Không | Đọc | Tìm bài báo khoa học |

Drive, Calendar, Gmail chỉ đọc. Với Forms, Sheets, Tasks, chỉ cho phép thao tác tạo và cập nhật an toàn.

## Bật kết nối

Cài đặt N7AI, mục Trình kết nối (`/n7ai/settings/connectors`), hoặc menu `+` trong ô soạn. Có thể đặt kết nối mặc định cho mọi hội thoại. Kết quả OAuth trả về đúng trang cài đặt này.

## Google Workspace

N7AI là máy khách MCP. Máy chủ MCP là `workspace-mcp` tự host trên VPS (gắn cổng cục bộ, chỉ nhận yêu cầu từ API).

1. Người dùng cấp quyền Google (OAuth). Mã truy cập mã hóa lưu trong `user_connectors`.
2. Khi cần, engine mở phiên MCP theo từng lượt trả lời với mã truy cập của người dùng; máy chủ MCP kiểm tra mã với Google rồi gọi API.
3. Mỗi kết nối giữ cấp quyền riêng và chỉ lộ công cụ của chính nó.
4. Danh mục công cụ được lưu đệm 5 phút.

## PU Connect (tài khoản đại học)

Đọc dữ liệu Canvas và cổng đào tạo của sinh viên, tách khỏi các công cụ mạng xã hội luôn có sẵn.

1. Người dùng chọn Kết nối, cài tiện ích trình duyệt Phenikaa Student Hub, đăng nhập Canvas và cổng đào tạo, rồi đồng ý trên trang xác nhận của PKA.
2. PUC tạo trạng thái và mã xác thực PKCE; chỉ giá trị băm S256 đi sang PKA. PKA cấp mã dùng một lần hiệu lực 5 phút gắn với PKCE.
3. PUC đổi mã lấy khoản cấp quyền có phạm vi, mã hóa lưu trong `user_connectors`, hiệu lực 30 ngày. PUC không bao giờ nhận thông tin đăng nhập SSO của trường.
4. Ngắt kết nối thu hồi khoản cấp quyền trên PKA trước khi xóa cục bộ; nếu PKA không phản hồi thì báo lỗi để thử lại.
5. Tám công cụ chỉ đọc: `pu_connector__profile`, `schedule`, `grades`, `courses`, `deadlines`, `activity`, `attendance`, `courseFiles`. Không có công cụ ghi, đăng ký hoặc hủy môn.

Điểm kết nối: `GET /ai/connectors/pu-connector/connect`, `GET .../callback`, `DELETE /ai/connectors/pu-connector`.

## Semantic Scholar và arXiv

Kết nối công cộng, không cần đăng nhập, bật theo mặc định tài khoản. Công cụ `semantic_scholar__search` trả tên bài, tác giả, năm, tóm tắt, số trích dẫn, liên kết PDF.

- Engine 1: Semantic Scholar Graph API (có thể đặt `SEMANTIC_SCHOLAR_API_KEY` để tăng hạn mức).
- Engine 2: arXiv, tự dùng thay khi Semantic Scholar trả 429, lỗi 5xx, hết 8 giây hoặc không có kết quả.
- Nguồn trả về kiểu `paper`, trích dẫn đánh số và bấm mở thẳng bài hoặc PDF; hỗ trợ cả trong thread chia sẻ công khai.

## Quy tắc chung

- Chỉ nhóm chat không có kết nối riêng; chỉ thread riêng mới dùng kết nối.
- Xóa toàn bộ dữ liệu N7AI cũng thu hồi các khoản cấp quyền.
- Mọi kết nối riêng tư được khai báo rõ phạm vi, không đòi quyền ghi trừ Forms, Sheets, Tasks.

## API

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| GET | `/ai/connectors` | Trạng thái các kết nối |
| GET | `/ai/connectors/:provider/connect` | Bắt đầu OAuth |
| GET | `/ai/connectors/google/callback` | Callback OAuth |
| DELETE | `/ai/connectors/:provider` | Ngắt kết nối |

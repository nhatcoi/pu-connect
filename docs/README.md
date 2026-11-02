# PU Connect — Tài liệu sản phẩm

PU Connect là nền tảng mạng xã hội học thuật của Trường Đại học Phenikaa: sinh viên, giảng viên và trợ giảng cùng đăng bài, hỏi đáp, chia sẻ tài liệu, lập nhóm học và học cùng trợ lý AI N7AI. Tài liệu này mô tả sản phẩm theo từng hệ thống và từng module: mục đích, người dùng, tính năng, luồng sử dụng, quy tắc nghiệp vụ, dữ liệu và API.

## Ba hệ thống

| Hệ thống | Địa chỉ | Dành cho | Nội dung |
|---|---|---|---|
| PUC Web | puc.vnhat.dev | Mọi người dùng | Bảng tin, hỏi đáp, cộng đồng, nhóm học, kho tài liệu, nhắn tin, công cụ học tập |
| N7AI | puc.vnhat.dev/n7ai | Mọi người dùng | Trợ lý học tập: chat, chế độ học, nguồn tài liệu, ghi chú, bộ nhớ, kết nối ngoài |
| Admin Console | admin-puc.vnhat.dev | Quản trị viên và nhóm quyền | Người dùng, kiểm duyệt, danh mục học thuật, vận hành AI, bot, thông báo hệ thống |

## Đọc theo mục tiêu

| Bạn muốn | Đọc |
|---|---|
| Hiểu sản phẩm làm gì và cho ai | [Tổng quan sản phẩm](product/overview) |
| Biết vai trò nào được làm gì | [Vai trò và phân quyền](product/roles-permissions) |
| Tra cứu từ chuyên dùng | [Thuật ngữ](product/glossary) |
| Dùng hoặc vận hành một module của PUC Web | Mục PUC Web: Bảng tin và bài viết, Bình luận và hỏi đáp, Hồ sơ và theo dõi, Tìm kiếm, Thông báo, Nhắn tin, Cộng đồng, Nhóm học, Môn học, Kho tài liệu, Công cụ học tập, Tài khoản và quyền riêng tư, An toàn nội dung |
| Dùng hoặc vận hành N7AI | Mục N7AI, bắt đầu từ [Tổng quan N7AI](product/n7ai/overview) |
| Quản trị hệ thống | Mục Admin Console, bắt đầu từ [Tổng quan Admin](product/admin/overview) |
| Phát triển, cài đặt, triển khai | Mục Kỹ thuật và vận hành, bắt đầu từ [Bắt đầu nhanh](get-started) |

## Cấu trúc tài liệu

Mỗi trang module theo cùng một khung để dễ tra cứu:

1. Mục đích và người dùng
2. Tính năng
3. Luồng sử dụng
4. Quy tắc nghiệp vụ và giới hạn
5. Phân quyền
6. Dữ liệu
7. API
8. Giới hạn đã biết

## Quy ước

- Đường dẫn API tính từ gốc `/api`.
- Mã vai trò: `student`, `lecturer`, `ta`, `club_lead`, `admin`.
- Thời gian hiển thị theo múi giờ Việt Nam (UTC+7).
- Các trang trong mục Kỹ thuật và Lưu trữ quyết định kiến trúc (ADR) là tài liệu cho lập trình viên; phần còn lại là tài liệu sản phẩm.

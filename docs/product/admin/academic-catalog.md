# Danh mục học thuật

## Mục đích

Duy trì ba danh mục nền của sản phẩm (trường đại học, lĩnh vực quan tâm, môn học) cùng tài liệu và cộng đồng. Người dùng không tự tạo danh mục: họ đề xuất, admin duyệt tập trung.

## Đề xuất (menu riêng)

Mọi đề xuất chờ duyệt nằm một nơi: trường đại học, lĩnh vực quan tâm, môn học.

| Hành động | Hiệu lực |
|---|---|
| Duyệt | Tạo mục mới (sửa chính tả được) hoặc gộp vào mục có sẵn; hồ sơ mọi người gửi cùng tên được cập nhật và họ nhận thông báo. Với môn học thì tạo môn thật |
| Từ chối | Kèm lý do; yêu cầu thành `rejected`, hồ sơ người dùng vẫn là "Khác" cho tới khi họ chọn lại |

API: `GET /admin/unit-requests`, `POST /admin/unit-requests/:id/approve|reject`; môn học `GET /admin/courses/suggestions`, `POST .../:id/approve|reject`.

Thêm loại đề xuất mới: dùng lại hộp chọn chung, thêm một loại vào trang Đề xuất và cộng vào badge menu.

## Đơn vị: trường và lĩnh vực

Học thuật, tab Đơn vị. Chỉ hai danh mục: `universities` (có sẵn Phenikaa) và `interest_fields`.

| Thao tác | Hiệu lực |
|---|---|
| Thêm, đổi tên | Đổi tên hiện ngay trên hồ sơ |
| Tắt | Không còn trong danh sách chọn |
| Gộp | Chuyển người dùng và môn học sang mục đích; người có cả hai lĩnh vực chỉ giữ một |
| Xóa | Chỉ khi mục trống |

Nhật ký ghi `unit.*`, `unit_request.*`. API: `GET, POST /admin/units`, `PATCH, DELETE /admin/units/:kind/:id`, `POST /admin/units/:kind/:id/merge`.

## Môn học

| Tính năng | Mô tả |
|---|---|
| Thêm, sửa | Mã, tên, mô tả, lĩnh vực; bấm hàng để sửa |
| Giảng viên | Gán giảng viên cho môn (`GET, PUT /admin/courses/:id/lecturers`) |
| Gộp | Gộp môn trùng, chuyển bài và tài liệu sang môn đích |
| Xóa | Chỉ môn trống |
| Nhập hàng loạt | Excel, CSV, JSON; cột `field` là tên lĩnh vực |

## Tài liệu

Danh sách tài liệu, lọc theo đã hoặc chưa vào N7AI (lập chỉ mục), xóa tài liệu vi phạm (`GET /admin/documents`, `DELETE /admin/documents/:id`).

## Cộng đồng

Danh sách theo trạng thái (chờ duyệt, hoạt động, từ chối) và loại; duyệt, từ chối kèm lý do, đổi chủ (chủ cũ xuống điều hành viên), gỡ, tạo trực tiếp. Chi tiết nghiệp vụ ở [Cộng đồng](../web/communities).

## Quyền

Tất cả thao tác ghi cần `academic:manage`; xem cần `academic:read`.

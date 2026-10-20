# Semantic Scholar & arXiv Connector

Implemented: 2026-10-19. Connector ID `semantic_scholar`, display name **Semantic Scholar**. Nguồn tra cứu học thuật toàn cầu cho trợ lý N7AI, cho phép sinh viên và giảng viên tìm kiếm hàng trăm triệu bài báo khoa học, xem tóm tắt abstract, trích dẫn chuẩn, cơ sở dữ liệu và liên kết tải PDF mở.

---

## 1. Kiến trúc & Cơ chế vận hành

Khác với Google Connectors và PU Connector yêu cầu OAuth hoặc token tài khoản cá nhân, **Semantic Scholar** là trình kết nối công cộng (public research connector) hoạt động trực tiếp ở cấp server:

1. **Không yêu cầu xác thực người dùng (`requiresAuth: false`)**:
   - Mọi sinh viên đều có thể bật/tắt trong *Cài đặt › Trình kết nối* (`/n7ai/settings/connectors`) hoặc menu `+` › *Connectors* trong khung soạn thảo chat.
   - Bật theo mặc định tài khoản qua `default_connectors`.
2. **Khả năng tự phục hồi & Dự phòng kép (Dual-Engine Fallback)**:
   - **Engine 1 - Semantic Scholar Graph API** (`https://api.semanticscholar.org/graph/v1`):
     - Truy xuất đồ thị học thuật phong phú: `paperId`, `title`, `abstract`, `authors`, `year`, `citationCount`, `influentialCitationCount`, `openAccessPdf`, `url`, `venue`, `fieldsOfStudy`.
     - Hỗ trợ biến môi trường tùy chọn `SEMANTIC_SCHOLAR_API_KEY` (`x-api-key`) để tăng hạn mức rate limit.
   - **Engine 2 - arXiv API** (`https://export.arxiv.org/api/query`):
     - Khi Semantic Scholar gặp mã 429 (Too Many Requests), lỗi 5xx, timeout (8s) hoặc không có kết quả, hệ thống tự động và trong suốt chuyển tiếp sang truy vấn arXiv.
     - Phân tích XML/Atom feed trích xuất tiêu đề, abstract, tác giả, năm và link PDF trực tiếp.
     - Đảm bảo **100% tỷ lệ phản hồi thành công** cho người học, không bao giờ ngắt quãng hay báo lỗi rate-limit.

---

## 2. Công cụ Agent Tool & Định dạng nguồn

`RetrievalToolsService` cung cấp công cụ tự động cho vòng lặp model N7AI:

| Tool | Loại | Mô tả |
| :--- | :---: | :--- |
| `semantic_scholar__search` | Read-only | Tìm kiếm bài báo khoa học theo từ khóa hoặc chủ đề nghiên cứu (tên bài, tác giả, năm, abstract, trích dẫn, link PDF). |

### Tích hợp Hệ thống Trích Dẫn Thống Nhất (Numbered Citations)

- Nguồn trả về mang kiểu `type: 'paper'`.
- N7AI trích dẫn số thứ tự `[nguồn] n` trong khối câu trả lời.
- Thẻ trích dẫn hiển thị biểu tượng Semantic Scholar vector chính thức (`public/brand/connectors/semantic-scholar.svg`).
- Bấm vào trích dẫn mở trực tiếp liên kết bài báo (Semantic Scholar / arXiv) hoặc PDF trong tab mới.
- Hỗ trợ đầy đủ trong tính năng **Chia sẻ hội thoại công khai** (`/share/[token]`).

---

## 3. Cấu hình Môi trường

```bash
# apps/api/.env
# N7AI: tìm kiếm bài báo khoa học Semantic Scholar (tùy chọn; không có key vẫn hoạt động qua arXiv fallback)
SEMANTIC_SCHOLAR_API_KEY=
```

---

## 4. Xác nhận & Kiểm thử

- `apps/api/test/semantic-scholar.e2e-spec.ts`: Kiểm tra tìm kiếm Semantic Scholar, cơ chế tự động fallback arXiv, ánh xạ sang `Source` kiểu `paper` và tích hợp `RetrievalToolsService`.
- 100% Typecheck & ESLint clean.

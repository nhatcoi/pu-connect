# 🗺️ Sơ Đồ Hệ Thống PU Connector (Diagrams-as-Code)

> Mọi sơ đồ viết bằng **Mermaid** ngay trong Markdown: GitHub, VS Code (extension *Markdown Preview Mermaid*) và Obsidian tự hiển thị. Sơ đồ nằm cạnh code, đi qua review và có lịch sử git như code.
> Sơ đồ ở đây mô tả **hệ thống đang chạy thật** (không phải kế hoạch). Thiết kế tương lai nằm ở `docs/core/*`.

## Mục lục

| # | Sơ đồ | Loại | Trả lời câu hỏi | Cập nhật khi |
|---|---|---|---|---|
| 01 | [System Context](./01-system-context.md) | C4 · Level 1 | Ai dùng hệ thống, hệ thống nói chuyện với dịch vụ ngoài nào? | Thêm/bớt dịch vụ ngoài (OAuth, mail, storage, LLM…) hoặc nhóm người dùng |
| 02 | [Containers](./02-containers.md) | C4 · Level 2 | Gồm những ứng dụng/tiến trình nào, giao tiếp bằng giao thức gì? | Thêm app/service/DB/queue, đổi giao thức |
| 03 | [API Components](./03-api-components.md) | C4 · Level 3 | Bên trong NestJS có module nào, phụ thuộc nhau ra sao, endpoint nào? | Thêm/xóa module, controller, endpoint, resolver |
| 04 | [ERD](./04-erd.md) | ER diagram (**tự sinh**) | Bảng, cột, khóa ngoại | **Mỗi migration** → `pnpm docs:erd` |
| 05 | [Luồng chính](./05-flows.md) | Sequence diagram | Một nghiệp vụ chạy qua các thành phần theo thứ tự nào? | Đổi logic auth, đăng bài, mention/thông báo, feed |
| 06 | [Deployment](./06-deployment.md) | Deployment diagram | Chạy ở đâu, cổng nào, proxy ra sao, deploy thế nào? | Đổi VPS, nginx, systemd, Docker, domain, script deploy |
| 07 | [Web App](./07-web-app.md) | Component / route map | Route nào, component chính, state, gọi API nào? | Thêm/xóa trang, store slice, feature flag |

## Vì sao chọn bộ sơ đồ này

Một sơ đồ duy nhất "vẽ hết mọi thứ" sẽ hoặc quá rối, hoặc quá sơ sài. Bộ tiêu chuẩn được dùng rộng rãi là **C4 model** (zoom dần từng mức), cộng thêm 3 loại bổ trợ:

1. **C4 Level 1–3 (Context → Container → Component):** zoom từ ngoài vào trong. Người mới đọc 01 + 02 trong 2 phút là hiểu hệ thống; dev cần chi tiết mới mở 03. (C4 Level 4 là sơ đồ class/code; không cần vẽ tay vì đọc code nhanh hơn.)
2. **ERD:** cấu trúc dữ liệu thay đổi thường xuyên nhất, nên **sinh tự động từ DB** để không bao giờ lệch thực tế.
3. **Sequence diagram:** kiến trúc tĩnh không cho thấy *thứ tự* và *transaction*; luồng auth, đăng bài + mention + realtime cần sơ đồ tuần tự.
4. **Deployment diagram:** trả lời câu hỏi vận hành (cổng, proxy, service, nơi lưu secret).

Không dùng: UML class diagram (lỗi thời nhanh, trùng code), sơ đồ vẽ tay bằng draw.io/Figma (file nhị phân, không review được, ai sửa code cũng quên cập nhật).

## Quy ước

- **Màu** (trong `flowchart`): xanh navy = thành phần của mình, xám = hệ thống ngoài, cam = kho dữ liệu, nét đứt = dự kiến/chưa triển khai.
- Mũi tên ghi **giao thức + mục đích**: `REST /api`, `GraphQL`, `WebSocket`, `SQL`, `SMTP`…
- Thứ chưa triển khai vẫn có thể xuất hiện nhưng phải **nét đứt** và ghi `(planned)`, kèm link thiết kế.
- Mỗi file có dòng `Cập nhật lần cuối` + thay đổi gần nhất ở cuối (changelog ngắn).

## Quy trình cập nhật (bắt buộc — xem AGENTS.md mục 1)

```bash
# 1. Sau khi thêm/sửa migration SQL và chạy lên DB local
pnpm docs:erd                 # sinh lại docs/diagrams/04-erd.md

# 2. Sửa tay sơ đồ bị ảnh hưởng theo bảng "Cập nhật khi" ở trên
# 3. Commit chung với thay đổi code (docs(diagrams): …)
```

Checklist nhanh khi mở PR:
- [ ] Thêm/xóa **module NestJS / endpoint** → `03-api-components.md`
- [ ] Thêm **dịch vụ ngoài / biến môi trường mới** → `01`, `02`, `06`
- [ ] **Migration** → `pnpm docs:erd`
- [ ] Đổi **luồng nghiệp vụ** → `05-flows.md`
- [ ] Thêm/xóa **trang, store slice, feature flag** → `07-web-app.md`

# 01 · System Context (C4 Level 1)

> Hệ thống nhìn từ bên ngoài: ai dùng, phụ thuộc dịch vụ ngoài nào. Cập nhật lần cuối: **2026-10-13**.

```mermaid
flowchart TB
  student(["👩‍🎓 Sinh viên<br/>đăng bài, hỏi đáp, theo dõi"])
  lecturer(["👨‍🏫 Giảng viên / Trợ giảng<br/>thông báo, duyệt lời giải"])
  admin(["🛡️ Quản trị<br/>/admin: xử lý báo cáo, khóa tài khoản"])

  puc["<b>PU Connector</b><br/>Mạng xã hội học thuật Phenikaa<br/>https://puc.vnhat.dev"]

  google["Google OAuth 2.0<br/>đăng nhập Google"]
  gmail["Gmail SMTP<br/>email xác thực tài khoản"]
  r2["Cloudflare R2<br/>lưu ảnh, tài liệu, avatar"]
  dicebear["DiceBear API<br/>avatar mặc định"]
  pushsvc["Push service trình duyệt<br/>FCM · Mozilla · Apple"]
  llm["LLM gateway (OpenAI-compatible)<br/>api-ai.vnhat.dev · PU AI (@puai)"]

  student -->|HTTPS| puc
  lecturer -->|HTTPS| puc
  admin -->|HTTPS| puc

  puc -->|OAuth redirect + userinfo| google
  puc -->|SMTP 465 TLS| gmail
  puc -->|S3 API upload / public URL| r2
  puc -->|Web Push + VAPID| pushsvc
  pushsvc -->|thông báo hệ điều hành| student
  puc -.->|avatar URL| dicebear
  puc -->|HTTPS · chat/completions stream| llm

  classDef system fill:#1e3a8a,stroke:#1e3a8a,color:#fff
  classDef external fill:#f1f5f9,stroke:#94a3b8,color:#334155
  classDef person fill:#fff7ed,stroke:#f97316,color:#7c2d12
  classDef planned fill:#fff,stroke:#94a3b8,color:#64748b,stroke-dasharray:5 5
  class puc system
  class google,gmail,r2,dicebear,pushsvc,llm external
  class student,lecturer,admin person
```

| Phụ thuộc ngoài | Dùng cho | Cấu hình | Khi lỗi |
|---|---|---|---|
| Google OAuth | Đăng nhập Google | `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL` | Nút Google tự ẩn nếu chưa cấu hình |
| Gmail SMTP | Email xác thực | `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM` | Không có `SMTP_HOST` ⇒ chỉ log link |
| Cloudflare R2 | Upload file | `R2_*` | Upload lỗi, phần còn lại vẫn chạy |
| Push service (FCM/Mozilla/Apple) | Web Push khi đã đóng tab | `VAPID_*` | Thiếu khóa ⇒ chỉ in-app |
| DiceBear | Avatar mặc định | — | Ảnh không hiện, fallback chữ cái |
| LLM gateway OpenAI-compatible | PU AI trả lời trong hội thoại `/messages` | `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` (mặc định `v5`), `AI_DAILY_QUOTA` | Thiếu key ⇒ bot trả lời "chưa bật"; 429/5xx ⇒ tin lỗi "quá tải" · xem [06-messaging-and-ai](../core/06-messaging-and-ai.md) |

**Changelog:**
- 2026-10-13 — PU AI chuyển từ Anthropic SDK sang gateway OpenAI-compatible (`AI_BASE_URL`).
- 2026-10-13 — LLM (Anthropic Claude) chuyển từ planned sang đang chạy: PU AI trong nhắn tin.
- 2026-10-04 — thêm push service trình duyệt (Web Push).
- 2026-10-04 — tạo mới (Google OAuth, Gmail SMTP, R2; LLM planned).

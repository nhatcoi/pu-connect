# 01 · System Context (C4 Level 1)

> Hệ thống nhìn từ bên ngoài: ai dùng, phụ thuộc dịch vụ ngoài nào. Cập nhật lần cuối: **2026-10-04**.

```mermaid
flowchart TB
  student(["👩‍🎓 Sinh viên<br/>đăng bài, hỏi đáp, theo dõi"])
  lecturer(["👨‍🏫 Giảng viên / Trợ giảng<br/>thông báo, duyệt lời giải"])
  admin(["🛡️ Quản trị<br/>kiểm duyệt, cộng đồng"])

  puc["<b>PU Connector</b><br/>Mạng xã hội học thuật Phenikaa<br/>https://puc.vnhat.dev"]

  google["Google OAuth 2.0<br/>đăng nhập Google"]
  gmail["Gmail SMTP<br/>email xác thực tài khoản"]
  r2["Cloudflare R2<br/>lưu ảnh, tài liệu, avatar"]
  dicebear["DiceBear API<br/>avatar mặc định"]
  llm["LLM provider<br/>PU AI (planned)"]

  student -->|HTTPS| puc
  lecturer -->|HTTPS| puc
  admin -->|HTTPS| puc

  puc -->|OAuth redirect + userinfo| google
  puc -->|SMTP 465 TLS| gmail
  puc -->|S3 API upload / public URL| r2
  puc -.->|avatar URL| dicebear
  puc -.->|API · planned P2| llm

  classDef system fill:#1e3a8a,stroke:#1e3a8a,color:#fff
  classDef external fill:#f1f5f9,stroke:#94a3b8,color:#334155
  classDef person fill:#fff7ed,stroke:#f97316,color:#7c2d12
  classDef planned fill:#fff,stroke:#94a3b8,color:#64748b,stroke-dasharray:5 5
  class puc system
  class google,gmail,r2,dicebear external
  class student,lecturer,admin person
  class llm planned
```

| Phụ thuộc ngoài | Dùng cho | Cấu hình | Khi lỗi |
|---|---|---|---|
| Google OAuth | Đăng nhập Google | `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL` | Nút Google tự ẩn nếu chưa cấu hình |
| Gmail SMTP | Email xác thực | `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM` | Không có `SMTP_HOST` ⇒ chỉ log link |
| Cloudflare R2 | Upload file | `R2_*` | Upload lỗi, phần còn lại vẫn chạy |
| DiceBear | Avatar mặc định | — | Ảnh không hiện, fallback chữ cái |
| LLM (planned) | PU AI | `AI_PROVIDER`, `ANTHROPIC_API_KEY` | — · xem [06-messaging-and-ai](../core/06-messaging-and-ai.md) |

**Changelog:** 2026-10-04 — tạo mới (Google OAuth, Gmail SMTP, R2; LLM planned).

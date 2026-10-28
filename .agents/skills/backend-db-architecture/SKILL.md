---
name: backend-db-architecture
description: Quy chuẩn kiến trúc Backend NestJS, Native PostgreSQL (pg.Pool), ACID Transactions, Idempotent Migrations, BullMQ và Bảo mật danh tính cho PU Connect.
---

# Backend & Database Architecture Guidelines (PU Connect)

Tài liệu quy chuẩn cho AI Agents (Antigravity) khi triển khai API, cơ sở dữ liệu, hàng đợi và bảo mật trên backend NestJS (`apps/api`).

---

## 🗄️ 1. Native PostgreSQL (`DatabaseService` & `pg.Pool`)

> [!CAUTION]
> **TUYỆT ĐỐI CẤM** cài đặt hoặc sử dụng Prisma, TypeORM, Drizzle hoặc các ORM nặng nề khác. Dự án sử dụng Native Node-Postgres Client (`pg`) với Connection Pool để đạt độ trễ $<10\text{ms}$ và toàn quyền kiểm soát SQL.

### 1.1. Truy Vấn Thông Thường
```typescript
import { Injectable } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'

@Injectable()
export class CoursesService {
  constructor(private readonly db: DatabaseService) {}

  async findByCode(code: string) {
    const res = await this.db.query(
      `SELECT id, code, name, credits, faculty, created_at
       FROM courses
       WHERE code = $1 LIMIT 1`,
      [code.toUpperCase().trim()]
    )
    return res.rows[0] || null
  }
}
```

---

## 🔒 2. ACID Transactions & Row-Level Locking (`FOR UPDATE`)

Bất kỳ thao tác ghi dữ liệu nào liên quan đến từ 2 bước trở lên hoặc có khả năng xảy ra race condition (giới hạn sĩ số, trừ quota, chuyển quyền sở hữu) **BẮT BUỘC** phải bọc trong `transaction`:

```typescript
async joinStudyGroup(groupId: string, userId: string) {
  return this.db.transaction(async (client) => {
    // 1. Khóa hàng bằng FOR UPDATE để chống race condition sĩ số
    const groupRes = await client.query(
      `SELECT id, name, max_members, current_members
       FROM study_groups
       WHERE id = $1 FOR UPDATE`,
      [groupId]
    )

    const group = groupRes.rows[0]
    if (!group) throw new NotFoundException('Nhóm học không tồn tại')
    if (group.current_members >= group.max_members) {
      throw new BadRequestException('Nhóm đã đủ sĩ số')
    }

    // 2. Thêm thành viên
    await client.query(
      `INSERT INTO study_group_members (group_id, user_id, role, joined_at)
       VALUES ($1, $2, 'member', NOW())`,
      [groupId, userId]
    )

    // 3. Cập nhật số lượng
    await client.query(
      `UPDATE study_groups
       SET current_members = current_members + 1, updated_at = NOW()
       WHERE id = $1`,
      [groupId]
    )

    return { success: true }
  })
}
```

---

## 📄 3. Quy Chuẩn Viết Migration SQL (Idempotent Migrations)

Mọi file script nâng cấp DB trong `apps/api/src/database/*.sql` phải có khả năng chạy lại nhiều lần mà không sinh lỗi:

```sql
-- ==========================================================
-- Migration: Bổ sung cờ cài đặt người dùng (Idempotent)
-- ==========================================================

-- 1. Thêm cột nếu chưa có
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

-- 2. Thêm chỉ mục nếu chưa có
CREATE INDEX IF NOT EXISTS idx_users_preferences_gin ON users USING GIN (preferences);

-- 3. Tạo bảng mới nếu chưa có
CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);
```

Sau khi viết migration, thêm lệnh thực thi vào [`scripts/deploy.sh`](../../scripts/deploy.sh) và chạy `pnpm docs:erd` để đồng bộ Mermaid ERD.

---

## 🛡️ 4. Xác Thực & Bảo Mật Danh Tính (Zero Mock Fallback)

1. **Không Mock User ID:**
   - **CẤM:** `const userId = req.user?.id || 'mock-id'` hoặc fallback sang user đầu tiên trong DB.
   - **ĐÚNG:** Sử dụng helper `requireUserId(req)` từ `apps/api/src/common/http/current-user.ts` kết hợp `@UseGuards(AuthenticatedGuard)`:
     ```typescript
     @Post('create')
     @UseGuards(AuthenticatedGuard)
     async createPost(@Req() req: Request, @Body() dto: CreatePostDto) {
       const userId = requireUserId(req)
       return this.postsService.create(userId, dto)
     }
     ```
2. **Session Cookie HttpOnly:**
   - Phiên đăng nhập quản lý bởi Passport.js + `connect-pg-simple`, lưu trong bảng `user_sessions`.
   - Cookie `pu_session` mang cờ `HttpOnly`, `SameSite=Lax`, `Secure` trên môi trường Production.
3. **WebSocket Security:**
   - Gateway `/api/socket.io` xác thực session cookie ngay tại handshake (`allowRequest`).
   - Phòng socket chỉ được cấp theo định dạng server quản lý: `user:{userId}`, không cho phép client tự ý emit lệnh join phòng tùy tiện.

---

## ⚡ 5. Xử Lý Tác Vụ Nền & Hàng Đợi (BullMQ / Redis)

- Các tác vụ nặng hoặc có độ trễ cao (Gửi Web Push, tính toán gợi ý cá nhân hóa `user_interests`, tóm tắt AI) phải đẩy vào hàng đợi BullMQ:
  - `notification-push`: Hàng đợi gửi push browser (có delay 15-30s và retry với exponential backoff).
  - `personalization-refresh`: Worker làm mới hồ sơ sở thích định kỳ.
- Không để các tác vụ này làm nghẽn luồng xử lý HTTP request chính.

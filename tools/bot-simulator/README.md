# Bot — tạo tài khoản mẫu

Bot không còn daemon riêng: việc đăng bài và tương tác chạy **trong API** (`BotJobRunner`), điều khiển từ **Admin → Bot** (xem [`docs/core/13-admin-console.md`](../../docs/core/13-admin-console.md#bot-admin--bot)).

Thư mục này chỉ còn script tạo sẵn vài tài khoản bot (`is_bot = true`, vai trò `student/lecturer/ta`) từ `personas.json`:

```bash
pnpm bot:setup   # mật khẩu: BOT_PASSWORD (env) nếu có, ngược lại theo personas.json
```

`deploy.sh` tự chạy khi DB chưa có bot nào. Muốn thêm bot về sau, tạo ngay trong Admin → Bot.

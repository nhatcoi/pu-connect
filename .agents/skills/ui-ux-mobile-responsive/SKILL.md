---
name: ui-ux-mobile-responsive
description: Quy chuẩn thiết kế giao diện Web & Mobile Responsive, Animate UI motion, Semantic CSS tokens và chống giật layout (Zero CLS) cho PU Connect.
---

# UI/UX & Mobile Responsive Guidelines (PU Connect)

Tài liệu quy chuẩn giao diện cho AI Agents (Antigravity) nhằm đảm bảo mọi trang, component và modal đều đạt độ hoàn thiện cao nhất trên cả Desktop, Tablet và Mobile.

---

## 🎨 1. Quy Chuẩn Màu Sắc Semantic (100% Theme Adaptive)

> [!WARNING]
> **TUYỆT ĐỐI CẤM** viết cứng mã màu Hex (như `#000`, `#fff`, `#3b82f6`) hoặc class màu tĩnh như `text-black`, `bg-gray-100`, `bg-white`, `border-gray-200`.

Toàn bộ giao diện phải dùng CSS Semantic Variables từ Tailwind CSS:

```tsx
// ✅ ĐÚNG: Tự động tương thích hoàn hảo Light Mode và Dark Mode
<div className="bg-card text-foreground border border-border rounded-xl p-4">
  <h3 className="text-sm font-semibold">Tiêu đề học phần</h3>
  <p className="text-xs text-muted-foreground">Mô tả chi tiết nội dung môn học</p>
  <div className="bg-surface rounded-lg p-2.5 mt-2 text-muted-foreground text-[11px]">
    Môn học tiên quyết: Giải tích 1
  </div>
</div>

// ❌ SAI: Vỡ giao diện khi người dùng chuyển sang Dark Mode
<div className="bg-white text-black border border-gray-200">
```

### Bảng Tokens Chủ Đạo:
- `bg-background`: Nền chính của toàn app.
- `bg-surface`: Nền trung gian của stream/feed (`#f8fafc` light / `#0c1017` dark).
- `bg-card`: Nền thẻ bài viết, widget, hộp thoại.
- `bg-muted` & `text-muted-foreground`: Nền phụ, icon mờ, nhãn chú thích nhỏ.
- `bg-primary` & `text-primary`: Màu xanh Navy Phenikaa (`#0b3d91`).
- `bg-brand-orange` & `text-brand-orange`: Màu cam Phenikaa (`#f7941d`).
- `border-border`: Đường kẻ viền phân cách thích ứng theme.

---

## 📱 2. Thiết Kế Responsive Mobile Chuẩn Mực (< 768px)

### 2.1. Cấu Trúc Header Mobile 3 Slot
Thanh header mobile trên [`apps/web/src/components/social/header.tsx`](../../apps/web/src/components/social/header.tsx) chia làm 3 slot cố định kích thước và vị trí:
1. **Slot Trái (w-8 h-8):** Nút quay lại (nếu đang ở search active) hoặc Avatar tròn bấm mở Profile Menu / Đăng nhập.
2. **Slot Giữa (Dynamic flex-1):** Thanh Search Pill (trên trang tìm kiếm) hoặc Logo PU Mark căn giữa tuyệt đối (`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`).
3. **Slot Phải (Shrink-0):** Nút hành động chính (Đăng bài, Cài đặt tìm kiếm, hoặc Đăng nhập).

### 2.2. Thanh Điều Hướng Đáy Mobile ([`MobileBottomNav`](../../apps/web/src/components/navigation/mobile-bottom-nav.tsx))
- Cố định ở đáy (`fixed bottom-0 left-0 right-0 z-40 h-14`).
- Hiển thị 5 phân hệ cốt lõi: **Bảng tin**, **Khám phá**, **Học phần**, **Tin nhắn** (kèm badge số chưa đọc), **Cộng đồng**.
- Không đặt thêm nút nổi (FAB) gây che khuất nội dung cuộn.
- Mọi nội dung trang trên mobile phải có padding dưới an toàn: `pb-20 md:pb-12`.

### 2.3. Tránh Tràn Ngang (No Horizontal Overflow)
- Luôn kiểm tra các container cha có `w-full min-w-0 max-w-full`.
- Văn bản dài hoặc tiêu đề bài viết phải có `truncate` hoặc `break-words`.
- Bảng, code block, sơ đồ Mermaid phải bọc trong container `overflow-x-auto no-scrollbar`.

---

## ⚡ 3. Chống Rung Giật Giao Diện (Zero Layout Shift - CLS)

1. **Kích Thước Cố Định Cho Media:**
   - Avatar: Bắt buộc chỉ định `h-8 w-8`, `h-9 w-9`, `h-10 w-10`.
   - Ảnh bài viết: Sử dụng tỉ lệ khung hình `aspect-video` hoặc `aspect-[4/3]`, kèm `object-cover`.
2. **Skeleton Loaders Cho Trạng Thái Đang Tải:**
   - Khi `isLoading` (chưa có dữ liệu), render [`components/ui/skeleton.tsx`](../../apps/web/src/components/ui/skeleton.tsx) có kích thước, padding và số dòng tương đương 100% với dữ liệu thật.
   - Tuyệt đối không dùng spinner toàn trang gây nháy trắng màn hình.
3. **Radix Dropdown & Popover Trong Thẻ Bài Viết:**
   - Radix Dialog/DropdownMenu mặc định kích hoạt khóa cuộn body (`modal={true}`) $\rightarrow$ tự chèn `padding-right` vào `<body>` gây giật layout sang bên phải.
   - **Bắt buộc:** Đặt `modal={false}` cho các dropdown menu trên PostCard/CommentCard.
   - File `globals.css` đã duy trì cấu hình phòng hộ:
     ```css
     html { scrollbar-gutter: stable; }
     body[data-scroll-locked] { padding-right: 0px !important; }
     ```

---

## 🎭 4. Motion Design & Animate UI

- Sử dụng thư viện Animate UI (`motion/react` + Radix).
- Áp dụng các hiệu ứng vật lý lò xo (Spring Physics) nhẹ nhàng:
  - Transition duration thông thường: `duration-200` đến `duration-300`.
  - Active state khi nhấn nút: `active:scale-95` hoặc `active:scale-98`.
  - Hover state: `hover:opacity-80 transition-opacity` hoặc `hover:bg-muted/70 transition-colors`.
- Tap target trên màn hình cảm ứng điện thoại phải đạt tối thiểu **36px × 36px** (lý tưởng: 44px).

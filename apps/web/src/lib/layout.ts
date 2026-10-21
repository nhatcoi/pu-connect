// Độ rộng khung app dùng chung cho Header, AppLayout, skeleton (luôn thẳng hàng)
// Chuỗi class đầy đủ để Tailwind quét được
export const SHELL_WIDTH = 'max-w-[1440px]'

// Cột nội dung giữa: trang chuẩn (Bảng tin, Khám phá, Thông báo, Profile)
// Cân bằng toán học tuyệt đối: Sidebar (224px) + gap-6 (24px) + Main (760px) + gap-6 (24px) + Aside (288px) = 1320px
export const MAIN_WIDTH = 'max-w-[760px]'

// Trang làm việc toàn cột (Công cụ /tools): ẩn cột phải, mở rộng cột giữa
// Cân bằng toán học tuyệt đối: Sidebar (224px) + gap-6 (24px) + Main (1072px) = 1320px
export const WIDE_MAIN_WIDTH = 'max-w-[1072px]'

// Không gian làm việc 2 cột chuẩn X (Tin nhắn /messages): thanh bên thu gọn (64px), không cột phải
// Cân bằng toán học tuyệt đối: Sidebar (64px) + gap-6 (24px) + Workspace (1232px) = 1320px
export const MESSAGES_WORKSPACE_WIDTH = 'max-w-[1232px]'

// Ẩn cột phải: Công cụ (/tools) và Tin nhắn (/messages)
export const isFullWidthPath = (pathname: string) =>
  pathname === '/tools' ||
  pathname.startsWith('/tools/') ||
  pathname === '/messages' ||
  pathname.startsWith('/messages/')

// Trang cần không gian rộng (tin nhắn, chat) ⇒ thu gọn thanh bên thành icon-only giống X (Twitter)
// Sau này trang nào cần không gian rộng chỉ cần thêm route prefix vào danh sách này
export const COMPACT_SIDEBAR_ROUTES = ['/messages']
export const isCompactSidebarPath = (pathname: string) =>
  COMPACT_SIDEBAR_ROUTES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))


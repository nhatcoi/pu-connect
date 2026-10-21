// Độ rộng khung app dùng chung cho Header, AppLayout, skeleton (luôn thẳng hàng)
// Chuỗi class đầy đủ để Tailwind quét được
export const SHELL_WIDTH = 'max-w-[1440px]'
// Cột nội dung giữa: đủ rộng cho màn lớn, vẫn giữ độ dài dòng dễ đọc
export const MAIN_WIDTH = 'max-w-[760px]'
// Cột nội dung khi thanh bên thu gọn (nhắn tin, hội thoại): rộng hơn, bù trừ đúng 160px của thanh bên thu hẹp
export const COMPACT_MAIN_WIDTH = 'max-w-[920px]'
// Trang làm việc toàn cột (Công cụ): ẩn cột phải, cột giữa rộng hơn
export const WIDE_MAIN_WIDTH = 'max-w-[1040px]'

export const isFullWidthPath = (pathname: string) => pathname === '/tools' || pathname.startsWith('/tools/')

// Trang cần không gian rộng (tin nhắn, chat) ⇒ thu gọn thanh bên thành icon-only giống X (Twitter)
// Sau này trang nào cần không gian rộng chỉ cần thêm route prefix vào danh sách này
export const COMPACT_SIDEBAR_ROUTES = ['/messages']
export const isCompactSidebarPath = (pathname: string) =>
  COMPACT_SIDEBAR_ROUTES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))


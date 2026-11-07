import { AppLayout } from '@/components/layout/app-layout'

// Route group (app): mọi trang cần đăng nhập dùng chung một khung, không mount lại khi chuyển trang
// `modal`: slot song song — /post/[id] mở từ bảng tin hiện dạng modal (route chặn), vào thẳng link thì ra trang đầy đủ
export default function AuthenticatedLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  return (
    <AppLayout>
      {children}
      {modal}
    </AppLayout>
  )
}

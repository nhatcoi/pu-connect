import { AppLayout } from '@/components/layout/app-layout'

// Route group (app): mọi trang cần đăng nhập dùng chung một khung, không mount lại khi chuyển trang
export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>
}

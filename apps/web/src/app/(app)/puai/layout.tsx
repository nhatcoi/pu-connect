import { PuaiShell } from '@/components/puai/puai-shell'

// /puai: không gian PU AI riêng (thanh bên lịch sử, thư viện, cài đặt) — tách khỏi Tin nhắn
export default function PuaiLayout({ children }: { children: React.ReactNode }) {
  return <PuaiShell>{children}</PuaiShell>
}

import { N7AiShell } from '@/components/n7ai/n7ai-shell'

// /n7ai: không gian N7AI riêng (thanh bên lịch sử, thư viện, cài đặt) — tách khỏi Tin nhắn
export default function N7AiLayout({ children }: { children: React.ReactNode }) {
  return <N7AiShell>{children}</N7AiShell>
}

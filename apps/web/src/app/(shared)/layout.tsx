import Link from 'next/link'
import { PuLogo } from '@/components/brand/pu-logo'
import { N7AI_HOME } from '@/lib/n7ai-routes'

// Route group (shared): nội dung chia sẻ công khai, không cần đăng nhập, không dùng AppLayout
export default function SharedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
          <Link href="/" aria-label="PU Connect">
            <PuLogo markClassName="h-8 w-8" />
          </Link>
          <Link
            href={N7AI_HOME}
            className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
          >
            Hỏi N7AI
          </Link>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="border-t border-border py-6 text-center text-[12px] text-muted-foreground">
        © 2026 PU Connect ·{' '}
        <Link href="/ai-terms" className="hover:text-foreground">
          Điều khoản N7AI
        </Link>
      </footer>
    </div>
  )
}

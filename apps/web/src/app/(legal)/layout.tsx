import Link from 'next/link'
import { PuLogo } from '@/components/brand/pu-logo'
import { LEGAL_LINKS } from '@/lib/legal'

// Route group (legal): trang công khai, không cần đăng nhập, không dùng AppLayout
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
          <Link href="/" aria-label="PU Connect">
            <PuLogo markClassName="h-8 w-8" />
          </Link>
          <nav className="hidden gap-4 text-[13px] sm:flex text-muted-foreground">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-foreground">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="border-t border-border py-6 text-center text-[12px] text-muted-foreground">© 2026 PU Connect · Phenikaa University</footer>
    </div>
  )
}

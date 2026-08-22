import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import { Header } from '@/components/social/header'
import { CreatePostDialog } from '@/components/social/create-post-dialog'

export const metadata: Metadata = {
  title: 'PU Connector — Mạng xã hội & Chia sẻ tài liệu kỹ thuật',
  description: 'Nền tảng mạng xã hội, chia sẻ tri thức và tài liệu kỹ thuật thế hệ mới được xây dựng với Next.js, shadcn/ui và NestJS.'
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css"
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <CreatePostDialog />
          </div>
        </Providers>
      </body>
    </html>
  )
}

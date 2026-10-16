import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({
  variable: '--font-sans',
  subsets: ['vietnamese', 'latin'],
  display: 'swap'
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['vietnamese', 'latin'],
  display: 'swap'
})

export const metadata: Metadata = {
  title: 'PU Connector — Mạng xã hội & Trao đổi học thuật sinh viên',
  description: 'Nền tảng mạng xã hội kết nối sinh viên, chia sẻ tài liệu học phần, công thức toán học, và ghép nhóm đồ án Phenikaa.'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css" />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary selection:text-primary-foreground"
      >
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            <main className="flex-1">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  )
}

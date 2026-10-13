import type { ReactNode } from 'react'
import { LEGAL_UPDATED_AT } from '@/lib/legal'

export interface LegalSection {
  id: string
  title: string
  body: ReactNode
}

// Khung văn bản pháp lý: tiêu đề + mục lục + các mục có anchor (Server Component)
export function LegalDocument({ title, intro, sections }: { title: string; intro: ReactNode; sections: LegalSection[] }) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <header className="space-y-3 border-b border-border pb-8">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
        <p className="text-[13px] text-muted-foreground">Cập nhật lần cuối: {LEGAL_UPDATED_AT}</p>
        <div className="text-[15px] leading-relaxed text-muted-foreground">{intro}</div>
      </header>

      <nav aria-label="Mục lục" className="my-8 rounded-2xl bg-muted/50 p-5">
        <p className="mb-3 text-[13px] font-semibold">Mục lục</p>
        <ol className="list-decimal space-y-1.5 pl-5 text-[14px] marker:text-muted-foreground">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-primary hover:underline">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-10">
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="scroll-mt-20 space-y-3">
            <h2 className="text-xl font-bold tracking-tight">
              {i + 1}. {s.title}
            </h2>
            <div className="space-y-3 text-[15px] leading-relaxed text-foreground/90 [&_a]:text-primary [&_a]:underline [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">{s.body}</div>
          </section>
        ))}
      </div>
    </article>
  )
}

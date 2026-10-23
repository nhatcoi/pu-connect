import { Marked } from 'marked'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function escapeHtml(html: string): string {
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function preprocessAlerts(md: string): string {
  return md.replace(
    />\s*\[!(NOTE|IMPORTANT|TIP|WARNING|CAUTION)\]\s*([^\n]*(?:\n>[^\n]*)*)/gi,
    (_match, type, content) => {
      const t = type.toLowerCase()
      const cleanContent = content.replace(/^>\s?/gm, '').trim()
      const titles: Record<string, string> = {
        note: 'GHI CHÚ (NOTE)',
        important: 'QUAN TRỌNG (IMPORTANT)',
        tip: 'MẸO & GỢI Ý (TIP)',
        warning: 'CẢNH BÁO (WARNING)',
        caution: 'LƯU Ý RỦI RO (CAUTION)'
      }
      return `\n<div class="doc-alert doc-alert-${t}">
  <div class="font-bold text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5 opacity-90">${titles[t] || type}</div>
  <div class="text-sm leading-relaxed">${cleanContent}</div>
</div>\n`
    }
  )
}

const markedInstance = new Marked({
  gfm: true,
  breaks: false
})

markedInstance.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      if (lang === 'mermaid') {
        return `<div class="mermaid-diagram-placeholder" data-code="${encodeURIComponent(text)}"></div>`
      }
      const safeCode = encodeURIComponent(text)
      const language = lang || 'text'
      return `
        <div class="code-wrapper relative group my-4 rounded-xl overflow-hidden border border-border bg-[#090d16]">
          <div class="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-muted/40 text-xs text-muted-foreground font-mono">
            <span class="font-semibold uppercase tracking-wider text-[11px]">${language}</span>
            <button
              class="copy-btn px-2.5 py-1 rounded-md bg-card/60 hover:bg-card border border-border/40 text-xs transition-all flex items-center gap-1.5 cursor-pointer text-foreground hover:text-primary active:scale-95"
              data-code="${safeCode}"
            >
              Sao chép
            </button>
          </div>
          <pre class="p-4 overflow-x-auto text-[13px] leading-relaxed font-mono text-slate-100 bg-[#090d16] selection:bg-primary"><code>${escapeHtml(text)}</code></pre>
        </div>
      `
    },
    heading({ text, depth }: { text: string; depth: number }) {
      const plainText = text.replace(/<[^>]+>/g, '').trim()
      const id = slugify(plainText)
      return `<h${depth} id="${id}" class="group relative flex items-center scroll-mt-24">
        <a href="#${id}" aria-label="Liên kết tới mục ${plainText}" class="absolute -left-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary pr-2 font-mono text-sm">#</a>
        <span>${text}</span>
      </h${depth}>`
    }
  }
})

export function renderMarkdown(markdown: string): string {
  if (!markdown) return ''
  const withAlerts = preprocessAlerts(markdown)
  return markedInstance.parse(withAlerts) as string
}

import { Marked } from 'marked'

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Đếm tiêu đề trùng trong một tài liệu để id luôn duy nhất, khớp với build script
const headingCounts = new Map<string, number>()
let headingSeq = 0

export function resetHeadingIds() {
  headingCounts.clear()
  headingSeq = 0
}

function uniqueHeadingId(base: string): string {
  const id = base || `muc-${headingSeq}`
  const n = headingCounts.get(id) ?? 0
  headingCounts.set(id, n + 1)
  return n > 0 ? `${id}-${n}` : id
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
        note: 'Ghi chú',
        important: 'Quan trọng',
        tip: 'Gợi ý',
        warning: 'Cảnh báo',
        caution: 'Lưu ý'
      }
      return `\n<div class="doc-alert doc-alert-${t}">
  <div class="font-semibold text-xs uppercase tracking-wider mb-1 opacity-80">${titles[t] || type}</div>
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
        <div class="code-wrapper relative group my-4 rounded-md overflow-hidden border border-border bg-[#0b1020]">
          <div class="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-muted/40 text-xs text-muted-foreground font-mono">
            <span class="font-semibold uppercase tracking-wider text-[11px]">${language}</span>
            <button
              class="copy-btn px-2.5 py-1 rounded border border-border/60 text-xs cursor-pointer text-foreground hover:text-primary"
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
      const id = uniqueHeadingId(slugify(plainText))
      return `<h${depth} id="${id}" class="scroll-mt-20"><span>${text}</span></h${depth}>`
    }
  }
})

export function renderMarkdown(markdown: string): string {
  if (!markdown) return ''
  const withAlerts = preprocessAlerts(markdown)
  return markedInstance.parse(withAlerts) as string
}

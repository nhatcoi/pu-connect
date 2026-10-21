'use client'

import React, { useMemo, useState } from 'react'
import Markdown, { type Components, type Options } from 'react-markdown'
import Link from 'next/link'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkBreaks from 'remark-breaks'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { Check, Copy } from 'lucide-react'
import { MermaidBlock } from './mermaid-block'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MarkdownPreviewProps {
  content: string
  className?: string
  isDark?: boolean
  /** Chế độ rút gọn (thông báo, trích dẫn bình luận): hiển thị inline bold/code/KaTeX, không sinh thẻ <a>/<button> lồng nhau */
  inline?: boolean
}

// Sanitize raw HTML (XSS): giữ class của code/math để KaTeX + highlight hoạt động; Katex/highlight/slug chạy SAU sanitize
const SANITIZE_SCHEMA = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), ['className', /^language-./, 'math-inline', 'math-display']],
    span: [...(defaultSchema.attributes?.span ?? []), ['className', 'math', 'math-inline', 'math-display']],
    div: [...(defaultSchema.attributes?.div ?? []), ['className', 'math', 'math-display']]
  }
}

const INLINE_FENCE_LABELS: Record<string, string> = { quiz: '📝 Quiz', flashcards: '🗂️ Flashcard' }

function normalizeInlineMarkdown(text: string): string {
  let out = text
    .replace(/```(\w+)?[^\n]*\n?[\s\S]*?(```|$)/g, (_, lang?: string) => ` ${(lang && INLINE_FENCE_LABELS[lang]) || '[code]'} `)
    .replace(/^\s{0,3}(#{1,6}|>+)\s+/gm, '')
    .replace(/\n+/g, ' ')
    .trim()
  // Cân bằng ký hiệu bị cắt cụt ở cuối snippet (vd "**AVL..." hoặc "$H_2O...")
  const boldCount = (out.match(/\*\*/g) || []).length
  if (boldCount % 2 === 1) out = out.replace(/\*\*(?=[^*]*$)/, '')
  const codeCount = (out.match(/`/g) || []).length
  if (codeCount % 2 === 1) out = out.replace(/`(?=[^`]*$)/, '')
  return out
}

function CodeBlock({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const match = /language-(\w+)/.exec(className || '')
  const language = match ? match[1] : ''
  const codeContent = String(children).replace(/\n$/, '')

  if (language === 'mermaid') {
    return <MermaidBlock content={codeContent} />
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codeContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative my-3 rounded-lg border bg-muted/40 font-mono text-sm overflow-hidden">
      <div className="flex items-center justify-between border-b bg-muted/70 px-3 py-1.5 text-xs text-muted-foreground">
        <span>{language || 'text'}</span>
        <Button variant="ghost" size="sm" onClick={handleCopy} className="h-6 px-2 text-xs hover:bg-background cursor-pointer">
          {copied ? (
            <>
              <Check className="mr-1 h-3 w-3 text-green-500" />
              Đã chép
            </>
          ) : (
            <>
              <Copy className="mr-1 h-3 w-3" />
              Sao chép
            </>
          )}
        </Button>
      </div>
      <pre className="overflow-x-auto p-3">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  )
}

/**
 * Pre-processes markdown to turn @mentions and #hashtags into markdown links
 */
function enhanceMentionsAndTags(text: string): string {
  if (!text) return ''
  // Don't modify code blocks (``` ... ```)
  const parts = text.split(/(```[\s\S]*?```)/g)
  return parts
    .map((part) => {
      if (part.startsWith('```')) return part
      return (
        part
          // @username -> [@username](/username)
          .replace(/(^|[\s(])@([a-zA-Z0-9_]{3,30})/g, '$1[@$2](/$2)')
          // #tag -> [#tag](/search?q=tag) (exclude Markdown # Headings with space)
          .replace(/(^|[\s(])#([a-zA-Z0-9_]{2,40})/g, '$1[#$2](/search?q=$2)')
      )
    })
    .join('')
}

// Bộ component của react-markdown tạo MỘT LẦN cho mỗi chế độ. Tạo lại mỗi lần render thì React coi `code` / `pre` / `a`… là kiểu
// component mới và gỡ-dựng lại cả cây (sơ đồ Mermaid vẽ lại, hộp code mất trạng thái) mỗi khi trang cha render lại
const createComponents = (inline: boolean): Components => ({
  ...(inline
    ? {
        p: ({ children }) => <span>{children} </span>,
        h1: ({ children }) => <strong className="font-semibold">{children} </strong>,
        h2: ({ children }) => <strong className="font-semibold">{children} </strong>,
        h3: ({ children }) => <strong className="font-semibold">{children} </strong>,
        h4: ({ children }) => <strong className="font-semibold">{children} </strong>,
        ul: ({ children }) => <span>{children}</span>,
        ol: ({ children }) => <span>{children}</span>,
        li: ({ children }) => <span>• {children} </span>,
        blockquote: ({ children }) => <span className="italic">{children}</span>,
        strong: ({ children }) => <strong className="font-semibold text-foreground/90">{children}</strong>
      }
    : {}),
  pre({ children }) {
    return <>{children}</>
  },
  code({ node: _node, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '')
    const isInline = inline || (!match && !String(children).includes('\n'))

    if (isInline) {
      return (
        <code className={cn('rounded bg-muted font-mono text-foreground', inline ? 'px-1 py-0.5 text-[0.92em]' : 'px-1.5 py-0.5 text-xs')} {...props}>
          {children}
        </code>
      )
    }

    return (
      <CodeBlock className={className} {...props}>
        {children}
      </CodeBlock>
    )
  },
  table({ children }) {
    if (inline) return <span>{children}</span>
    return (
      <div className="my-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    )
  },
  th({ children }) {
    if (inline) return <strong className="font-semibold">{children} </strong>
    return <th className="border bg-muted px-3 py-2 text-left font-semibold text-foreground">{children}</th>
  },
  td({ children }) {
    if (inline) return <span>{children} </span>
    return <td className="border px-3 py-2 text-foreground/90">{children}</td>
  },
  a({ href, children }) {
    if (inline) {
      return <span className="font-medium text-primary">{children}</span>
    }
    const isInternal = href?.startsWith('/') || href?.startsWith('#')
    if (isInternal && href) {
      return (
        <Link href={href} className="font-semibold text-primary hover:underline hover:text-primary/90 transition-colors">
          {children}
        </Link>
      )
    }

    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-4 hover:opacity-80">
        {children}
      </a>
    )
  }
})

const COMPONENTS = { inline: createComponents(true), full: createComponents(false) }
const REMARK_PLUGINS: Record<'inline' | 'full', Options['remarkPlugins']> = { inline: [remarkGfm, remarkMath], full: [remarkGfm, remarkMath, remarkBreaks] }
const REHYPE_PLUGINS: Record<'inline' | 'full', Options['rehypePlugins']> = {
  inline: [rehypeRaw, [rehypeSanitize, SANITIZE_SCHEMA], rehypeKatex],
  full: [rehypeRaw, [rehypeSanitize, SANITIZE_SCHEMA], rehypeKatex, rehypeHighlight, rehypeSlug]
}

// memo: nội dung không đổi thì không render lại (nhiều khối Markdown trong một danh sách tin nhắn)
export const MarkdownPreview = React.memo(function MarkdownPreview({ content, className, inline = false }: MarkdownPreviewProps) {
  const processedContent = useMemo(() => (inline ? normalizeInlineMarkdown(content || '') : enhanceMentionsAndTags(content || '')), [content, inline])
  const mode = inline ? 'inline' : 'full'

  return (
    <div className={cn('markdown-body', inline ? 'leading-snug' : 'space-y-3 leading-relaxed text-sm', className)}>
      <Markdown
        remarkPlugins={REMARK_PLUGINS[mode]}
        rehypePlugins={REHYPE_PLUGINS[mode]}
        components={COMPONENTS[mode]}
      >
        {processedContent}
      </Markdown>
    </div>
  )
})

'use client'

import React, { useState } from 'react'
import Markdown, { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkBreaks from 'remark-breaks'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import { Check, Copy } from 'lucide-react'
import { MermaidBlock } from './mermaid-block'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MarkdownPreviewProps {
  content: string
  className?: string
  isDark?: boolean
}

function CodeBlock({
  inline,
  className,
  children,
  ...props
}: {
  inline?: boolean
  className?: string
  children?: React.ReactNode
}) {
  const [copied, setCopied] = useState(false)
  const match = /language-(\w+)/.exec(className || '')
  const language = match ? match[1] : ''
  const codeContent = String(children).replace(/\n$/, '')

  if (!inline && language === 'mermaid') {
    return <MermaidBlock content={codeContent} />
  }

  if (inline) {
    return (
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground" {...props}>
        {children}
      </code>
    )
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
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-6 px-2 text-xs hover:bg-background"
        >
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

export function MarkdownPreview({ content, className, isDark = false }: MarkdownPreviewProps) {
  const components: Components = {
    code({ node, inline, className, children, ...props }: any) {
      return (
        <CodeBlock inline={inline} className={className} {...props}>
          {children}
        </CodeBlock>
      )
    },
    table({ children }) {
      return (
        <div className="my-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">{children}</table>
        </div>
      )
    },
    th({ children }) {
      return (
        <th className="border bg-muted px-3 py-2 text-left font-semibold text-foreground">
          {children}
        </th>
      )
    },
    td({ children }) {
      return <td className="border px-3 py-2 text-foreground/90">{children}</td>
    },
    a({ href, children }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline underline-offset-4 hover:opacity-80"
        >
          {children}
        </a>
      )
    }
  }

  return (
    <div className={cn('markdown-body space-y-3 leading-relaxed text-sm', className)}>
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
        rehypePlugins={[rehypeKatex, rehypeHighlight, rehypeSlug]}
        components={components}
      >
        {content}
      </Markdown>
    </div>
  )
}

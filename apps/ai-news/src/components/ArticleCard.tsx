import React, { useState } from 'react'
import { Check, Copy, ExternalLink, Image as ImageIcon, Send } from 'lucide-react'
import { toast } from 'sonner'
import type { ArticleItem } from '../lib/excel'

export function ArticleCard({
  article,
  onSendTelegram,
  sendingTelegram
}: {
  article: ArticleItem
  onSendTelegram: (article: ArticleItem) => void
  sendingTelegram: boolean
}) {
  const [copied, setCopied] = useState(false)

  const handleCopyMarkdown = () => {
    const md = `### ${article.title}

${article.summary}

${article.impact ? `💡 **Tác động:** ${article.impact}\n\n` : ''}📌 **Nguồn:** [${article.sourceName}](${article.link})`

    navigator.clipboard.writeText(md)
    setCopied(true)
    toast.success('Đã sao chép nội dung bài viết dưới dạng Markdown!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <article className="group flex flex-col sm:flex-row gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs transition-all hover:border-primary/40 hover:shadow-md">
      {/* Hình ảnh đại diện (nếu có) */}
      {article.imageUrl ? (
        <div className="relative aspect-video w-full sm:w-48 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted/30">
          <img
            src={article.imageUrl}
            alt={article.title}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              // Ẩn ảnh nếu link lỗi
              ;(e.target as HTMLElement).style.display = 'none'
            }}
          />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col justify-between space-y-3 min-w-0">
        <div className="space-y-2">
          {/* Metadata tags */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md bg-primary/10 px-2.5 py-0.5 font-semibold text-primary">
              {article.category || 'Tin tức'}
            </span>
            <span className="font-medium text-foreground">{article.sourceName}</span>
            {article.pubDate && (
              <span className="text-muted-foreground">· {new Date(article.pubDate).toLocaleDateString('vi-VN')}</span>
            )}
          </div>

          {/* Tiêu đề tiếng Việt */}
          <h3 className="text-base font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
            {article.title}
          </h3>

          {/* Tóm tắt nội dung */}
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
            {article.summary}
          </p>

          {/* Khối tác động */}
          {article.impact && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-2.5 text-xs text-foreground leading-relaxed">
              <span className="font-semibold text-primary">💡 Tác động:</span> {article.impact}
            </div>
          )}
        </div>

        {/* Nút hành động */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs">
          <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            <ExternalLink className="size-3.5" />
            <span>Nguồn gốc bài viết</span>
          </a>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Sao chép dạng Markdown"
            >
              {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
              <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
            </button>

            <button
              type="button"
              disabled={sendingTelegram}
              onClick={() => onSendTelegram(article)}
              className="inline-flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-1 font-medium text-primary hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer shadow-2xs"
            >
              <Send className="size-3" />
              <span>Bắn Tele</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

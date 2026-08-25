'use client'

import React, { useState } from 'react'
import type { PostItem } from '@pu/schemas'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Code2, Copy, Check, ExternalLink, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { formatRelativeTime } from '@/lib/utils'

interface EmbedPostDialogProps {
  post: PostItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EmbedPostDialog({ post, open, onOpenChange }: EmbedPostDialogProps) {
  const [includeMedia, setIncludeMedia] = useState(true)
  const [theme, setTheme] = useState<'auto' | 'light' | 'dark'>('auto')
  const [isCopied, setIsCopied] = useState(false)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://puconnector.edu.vn'
  const postUrl = `${baseUrl}/home#post-${post.id}`

  const embedHtml = `<blockquote class="pu-post-embed" data-post-id="${post.id}" data-theme="${theme}" data-media="${includeMedia ? 'true' : 'false'}">
  <p lang="vi" dir="ltr">${post.title ? `<strong>${post.title}</strong><br/>` : ''}${post.content.slice(0, 160)}${post.content.length > 160 ? '...' : ''}</p>
  &mdash; ${post.author?.displayName || 'Sinh viên'} (@${post.author?.username || 'user'}) <a href="${postUrl}">${formatRelativeTime(post.createdAt)}</a>
</blockquote>
<script async src="${baseUrl}/widgets.js" charset="utf-8"></script>`

  const handleCopyCode = () => {
    navigator.clipboard.writeText(embedHtml)
    setIsCopied(true)
    toast.success('Đã sao chép mã nhúng vào clipboard')
    setTimeout(() => setIsCopied(false), 2500)
  }

  const authorInitials = (post.author?.displayName || post.author?.username || 'PU')
    .slice(0, 2)
    .toUpperCase()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden border border-border/80 bg-card rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-border/60 bg-muted/20">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
              <Code2 className="h-5 w-5" />
              <DialogTitle className="text-base font-bold text-foreground">
                Nhúng bài viết (Embed Post)
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Sao chép mã HTML để nhúng bài viết này vào website cá nhân, Notion, hoặc bài tập lớn.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Customization Options */}
          <div className="space-y-3 p-3.5 rounded-xl bg-muted/30 border border-border/60 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-foreground">Kèm theo tệp đính kèm / Ảnh</div>
                <div className="text-muted-foreground text-[11px]">
                  Hiển thị hình ảnh hoặc tài liệu đi kèm bài viết
                </div>
              </div>
              <Switch checked={includeMedia} onCheckedChange={setIncludeMedia} />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <span className="font-semibold text-foreground">Giao diện (Theme)</span>
              <div className="flex items-center gap-1 bg-background p-0.5 rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setTheme('auto')}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    theme === 'auto' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                  }`}
                >
                  Tự động
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    theme === 'light' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                  }`}
                >
                  Sáng
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    theme === 'dark' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                  }`}
                >
                  Tối
                </button>
              </div>
            </div>
          </div>

          {/* Live Preview Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>Xem trước giao diện nhúng</span>
              <span className="flex items-center gap-1 text-primary text-[11px]">
                <Sparkles className="h-3 w-3" />
                PU Connector Widget
              </span>
            </div>

            <div className="p-4 rounded-xl border border-border bg-background shadow-xs space-y-2.5">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8 border border-border/50">
                  <AvatarImage src={post.author?.avatarUrl || ''} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px]">
                    {authorInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="leading-tight min-w-0">
                  <div className="font-bold text-xs text-foreground truncate">
                    {post.author?.displayName || 'Sinh viên Phenikaa'}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    @{post.author?.username || 'user'} · {formatRelativeTime(post.createdAt)}
                  </div>
                </div>
              </div>

              {post.title && (
                <div className="text-xs font-bold text-foreground line-clamp-1">{post.title}</div>
              )}
              <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                {post.content}
              </p>

              <div className="pt-2 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40">
                <span className="font-semibold text-primary">Phenikaa University Connector</span>
                <span className="flex items-center gap-1">
                  Xem trên PU Connector <ExternalLink className="h-2.5 w-2.5" />
                </span>
              </div>
            </div>
          </div>

          {/* HTML Code Snippet */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-muted-foreground">Mã HTML để dán vào website</div>
            <div className="relative">
              <pre className="p-3 rounded-xl bg-muted/60 border border-border text-[11px] font-mono text-foreground overflow-x-auto max-h-24 whitespace-pre-wrap break-all select-all">
                {embedHtml}
              </pre>
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 border-t border-border/60 bg-muted/10 flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-full text-xs"
          >
            Đóng
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleCopyCode}
            className="rounded-full font-bold text-xs gap-1.5 bg-foreground text-background hover:bg-foreground/90 cursor-pointer"
          >
            {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{isCopied ? 'Đã sao chép mã' : 'Sao chép mã nhúng'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

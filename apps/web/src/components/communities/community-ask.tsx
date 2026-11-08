'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { FileText, Loader2, MessageSquare, Send, Sparkles } from 'lucide-react'
import type { CommunityAskResult } from '@pu/schemas'
import { COMMUNITY_ASK_MAX } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MarkdownPreview } from '@/components/renderer/markdown-preview'
import { useCommunityAsk } from '@/hooks/use-community-extras'
import { errorMessage } from '@/lib/api-client'

const SUGGESTIONS = ['Cộng đồng đang thảo luận chủ đề gì?', 'Tóm tắt các bài ghim', 'Có tài liệu nào hữu ích không?']

// Tab "Hỏi N7AI": trả lời dựa trên bài viết + tài liệu của chính cộng đồng, kèm nguồn [n]
export function CommunityAsk({ slug, isMember }: { slug: string; isMember: boolean }) {
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<(CommunityAskResult & { q: string }) | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ask = useCommunityAsk(slug)

  const submit = (q: string) => {
    const text = q.trim()
    if (text.length < 3 || ask.isPending) return
    setError(null)
    ask.mutate(text, {
      onSuccess: (res) => setResult({ ...res, q: text }),
      onError: (err) => setError(errorMessage(err, 'N7AI chưa trả lời được, thử lại nhé'))
    })
  }

  return (
    <div className="mx-2 sm:mx-0 mb-2.5 rounded-xl bg-card p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2 text-primary font-semibold text-[15px]">
        <Sparkles className="h-5 w-5" />
        Hỏi N7AI về cộng đồng này
      </div>
      {!isMember ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Gia nhập cộng đồng để hỏi N7AI dựa trên bài viết và tài liệu của nhóm.</p>
      ) : (
        <>
          <div className="relative">
            <Textarea
              value={question}
              maxLength={COMMUNITY_ASK_MAX}
              rows={2}
              placeholder="Hỏi gì đó…"
              className="resize-none pr-12 text-sm"
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit(question)
                }
              }}
            />
            <Button size="icon" className="absolute bottom-2 right-2 h-8 w-8 rounded-full" disabled={ask.isPending || question.trim().length < 3} onClick={() => submit(question)} aria-label="Gửi">
              {ask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          {!result && !ask.isPending && (
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  className="rounded-full bg-muted/60 px-3 py-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={() => {
                    setQuestion(s)
                    submit(s)
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          {result && (
            <div className="space-y-3 rounded-lg bg-muted/40 p-3.5">
              <p className="text-xs text-muted-foreground">Bạn hỏi: {result.q}</p>
              <MarkdownPreview content={result.answer} />
              {result.sources.length > 0 && (
                <div className="space-y-1 border-t border-border/50 pt-2">
                  <p className="text-[11px] font-semibold text-muted-foreground">Nguồn</p>
                  {result.sources.map((s) => (
                    <Link
                      key={`${s.type}:${s.id}`}
                      href={s.type === 'post' ? `/post/${s.id}` : `/documents/${s.id}`}
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      {s.type === 'post' ? <MessageSquare className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                      <span className="font-mono">[{s.index}]</span>
                      <span className="truncate">{s.title}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

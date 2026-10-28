'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { StudyToolKind } from '@pu/schemas'
import { BookOpenCheck, FileText, Layers, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { MarkdownPreview } from '@/components/renderer/markdown-preview'
import { useStudySetActions } from '@/hooks/use-study-tools'
import { draftStudySetFromDocument, summarizeDocument } from '@/lib/document-api'
import { errorMessage } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { useAppStore } from '@/store'

const KIND_LABEL: Record<StudyToolKind, string> = { flashcards: 'bộ flashcard', quiz: 'bài quiz' }

// "Học với N7AI" trên trang tài liệu: tóm tắt, tạo flashcard / quiz từ nội dung tệp (mỗi lần 1 lượt N7AI; bộ tạo xong lưu vào Công cụ của tôi)
export function StudyWithAi({ documentId }: { documentId: string }) {
  const user = useAppStore((s) => s.user)
  const queryClient = useQueryClient()
  const { create } = useStudySetActions()
  const [created, setCreated] = useState<{ kind: StudyToolKind; id: string; title: string; count: number } | null>(null)

  // Mỗi lần gọi tốn lượt N7AI ⇒ cập nhật quota
  const refreshQuota = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.aiQuota })
    void queryClient.invalidateQueries({ queryKey: queryKeys.aiUsage })
  }

  const summary = useMutation({
    mutationFn: () => summarizeDocument(documentId),
    onSuccess: refreshQuota,
    onError: (err) => toast.error(errorMessage(err, 'N7AI chưa tóm tắt được tài liệu này'))
  })

  const study = useMutation({
    mutationFn: async (kind: StudyToolKind) => {
      const draft = await draftStudySetFromDocument(documentId, kind)
      const saved = await create.mutateAsync({ ...draft, items: draft.items.map((i) => ({ content: i.content })) })
      return { kind, id: saved.id, title: saved.title, count: saved.items.length }
    },
    onSuccess: (set) => {
      refreshQuota()
      setCreated(set)
      toast.success(`Đã tạo ${KIND_LABEL[set.kind]} ${set.count} mục`)
    },
    onError: (err) => toast.error(errorMessage(err, 'N7AI chưa tạo được, thử lại nhé'))
  })

  const busy = summary.isPending || study.isPending
  const run = (fn: () => void) => () => (user ? fn() : toast.info('Đăng nhập để học cùng N7AI'))

  return (
    <section className="mx-2 sm:mx-0 rounded-xl bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-[13px] font-semibold">Học với N7AI</h3>
        <span className="text-[11px] text-muted-foreground">N7AI đọc tài liệu rồi giúp bạn ôn · mỗi lần dùng 1 lượt</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full text-xs" disabled={busy} onClick={run(() => summary.mutate())}>
          {summary.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />} Tóm tắt
        </Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full text-xs" disabled={busy} onClick={run(() => study.mutate('flashcards'))}>
          {study.isPending && study.variables === 'flashcards' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />} Tạo flashcard
        </Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full text-xs" disabled={busy} onClick={run(() => study.mutate('quiz'))}>
          {study.isPending && study.variables === 'quiz' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpenCheck className="h-3.5 w-3.5" />} Tạo quiz
        </Button>
      </div>

      {summary.data && (
        <div className="rounded-lg bg-muted/40 p-3 text-sm">
          <MarkdownPreview content={summary.data.summary} />
        </div>
      )}

      {created && (
        <p className="flex flex-wrap items-center gap-x-2 rounded-lg bg-primary/5 px-3 py-2 text-xs">
          <span>
            Đã lưu {KIND_LABEL[created.kind]} <b>{created.title}</b> ({created.count} mục) vào Công cụ của bạn.
          </span>
          <Link href={`/tools/${created.kind}/${created.id}`} className="font-semibold text-primary hover:underline">
            Học ngay →
          </Link>
        </p>
      )}
    </section>
  )
}

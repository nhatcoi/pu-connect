'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { notFound, useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ChevronDown, Loader2, MoreHorizontal, PenLine, Trash2 } from 'lucide-react'
import { correctAnswers, type StudySetDetail } from '@pu/schemas'
import { N7AiMark } from '@/components/brand/pu-logo'
import { MarkdownPreview } from '@/components/renderer/markdown-preview'
import { clozeText } from '@/components/tools/card-cloze'
import { FlashcardReview } from '@/components/tools/flashcard-review'
import { QuizRunner } from '@/components/tools/quiz-runner'
import { StudySetEditor } from '@/components/tools/study-set-editor'
import { TOOL_META, asCard, asQuestion, isToolKind, toolHref } from '@/components/tools/tool-catalog'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useStudySet, useStudySetActions } from '@/hooks/use-study-tools'
import { cn } from '@/lib/utils'

// Học 1 bộ: ôn flashcard (lặp lại ngắt quãng) hoặc làm quiz; sửa / xóa; xem toàn bộ mục
export default function StudySetPage() {
  const { kind, id } = useParams<{ kind: string; id: string }>()
  const { data: set, isPending, error } = useStudySet(isToolKind(kind) ? id : null)
  if (!isToolKind(kind)) notFound()

  if (isPending) return <Loader2 className="mx-auto my-16 h-5 w-5 animate-spin text-muted-foreground" />
  if (error || !set) return <p className="py-16 text-center text-sm text-muted-foreground">Không tìm thấy bộ này hoặc bạn không có quyền xem.</p>
  return <StudySetView set={set} />
}

function StudySetView({ set }: { set: StudySetDetail }) {
  const meta = TOOL_META[set.kind]
  const router = useRouter()
  const { remove } = useStudySetActions()
  const [editing, setEditing] = useState(false)
  const [showItems, setShowItems] = useState(false)

  const onDelete = () => {
    if (!window.confirm(`Xóa bộ "${set.title}"? Không khôi phục được.`)) return
    remove.mutate(set.id, { onSuccess: () => router.replace(toolHref(set.kind)) })
  }

  return (
    <>
      <div className="sticky top-0 md:top-14 z-30 bg-surface/90 backdrop-blur-md px-4 py-3">
        <div className="flex items-center gap-2">
          <Link href={toolHref(set.kind)} className="h-8 w-8 -ml-2 rounded-full flex items-center justify-center hover:bg-muted" aria-label={`Về ${meta.label}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-semibold tracking-tight truncate flex items-center gap-1.5">
              {set.title}
              {set.source === 'n7ai' && <N7AiMark className="h-3.5 w-3.5 shrink-0" />}
            </h1>
            <p className="text-[11px] text-muted-foreground truncate">
              {set.itemCount} {meta.itemLabel}
              {set.kind === 'flashcards' ? ` · ${set.dueCount} cần ôn` : set.bestScore != null ? ` · cao nhất ${set.bestScore}%` : ''}
              {set.description ? ` · ${set.description}` : ''}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" aria-label="Tùy chọn bộ">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <PenLine /> Sửa bộ
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" disabled={remove.isPending} onSelect={onDelete}>
                <Trash2 /> Xóa bộ
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="px-2 sm:px-0 space-y-4 pb-8">
        {/* Sửa bộ ⇒ updatedAt đổi ⇒ dựng lại phiên học */}
        {set.kind === 'flashcards' ? <FlashcardReview key={set.updatedAt} set={set} /> : <QuizRunner key={set.updatedAt} set={set} />}

        <section className="rounded-2xl bg-card">
          <button
            type="button"
            onClick={() => setShowItems((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold"
            aria-expanded={showItems}
          >
            Tất cả {meta.itemLabel} ({set.items.length})
            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', showItems && 'rotate-180')} />
          </button>
          {showItems && (
            <ol className="divide-y border-t">
              {set.items.map((it, i) => (
                <li key={it.id} className="px-4 py-2.5 text-sm">
                  {set.kind === 'flashcards' ? (
                    <div className="grid grid-cols-[auto_1fr_1fr] gap-3">
                      <span className="text-[11px] text-muted-foreground pt-0.5">{i + 1}</span>
                      <div className="min-w-0 flex items-start gap-2">
                        {asCard(it.content).image && (
                          // eslint-disable-next-line @next/next/no-img-element -- ảnh R2 người dùng tải lên
                          <img src={asCard(it.content).image} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-md border object-cover" />
                        )}
                        <div className="min-w-0">
                          <MarkdownPreview content={clozeText(asCard(it.content).front, true)} className="font-medium [&>p]:m-0" />
                          {asCard(it.content).phonetic && <span className="text-[11px] font-mono text-muted-foreground">{asCard(it.content).phonetic}</span>}
                        </div>
                      </div>
                      <MarkdownPreview content={asCard(it.content).back} className="text-muted-foreground [&>p]:m-0" />
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <MarkdownPreview content={`${i + 1}. ${asQuestion(it.content).q}`} className="font-medium [&>p]:m-0" />
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        ✓ {correctAnswers(asQuestion(it.content)).map((a) => asQuestion(it.content).options[a]).join(' · ')}
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <StudySetEditor open={editing} onOpenChange={setEditing} kind={set.kind} initial={set} />
    </>
  )
}

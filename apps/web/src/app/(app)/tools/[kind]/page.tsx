'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { notFound, useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, PenLine, Plus, Search } from 'lucide-react'
import { N7AiMark } from '@/components/brand/pu-logo'
import { StudySetEditor } from '@/components/tools/study-set-editor'
import { StudySetRow } from '@/components/tools/study-set-row'
import { TOOL_META, isToolKind, toolHref } from '@/components/tools/tool-catalog'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useStudySets } from '@/hooks/use-study-tools'

// Danh sách bộ của 1 công cụ (Flashcard / Quiz) + tạo mới
export default function ToolKindPage() {
  const { kind } = useParams<{ kind: string }>()
  if (!isToolKind(kind)) notFound()
  return <ToolKindView kind={kind} />
}

function ToolKindView({ kind }: { kind: keyof typeof TOOL_META }) {
  const meta = TOOL_META[kind]
  const router = useRouter()
  const [q, setQ] = useState('')
  const [editor, setEditor] = useState<{ ai: boolean } | null>(null)
  const { data, isPending } = useStudySets(kind, q)
  const Icon = meta.icon

  return (
    <>
      <div className="sticky top-0 md:top-14 z-30 bg-surface/90 backdrop-blur-md px-4 py-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <Link href="/tools" className="h-8 w-8 -ml-2 rounded-full flex items-center justify-center hover:bg-muted" aria-label="Về Công cụ">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-[15px] font-semibold tracking-tight flex items-center gap-2 flex-1">
            <Icon className="h-4 w-4 text-primary" /> {meta.label}
          </h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-8 rounded-full gap-1">
                <Plus className="h-4 w-4" /> Tạo bộ
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => setEditor({ ai: true })}>
                <N7AiMark className="h-4 w-4" /> Tạo bằng N7AI
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setEditor({ ai: false })}>
                <PenLine /> Tự soạn
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Tìm bộ ${meta.label.toLowerCase()}…`} className="pl-9 rounded-full h-9 text-sm" />
        </div>
      </div>

      <div className="px-2 sm:px-0 space-y-2 pb-6">
        {isPending ? (
          <Loader2 className="mx-auto my-10 h-4 w-4 animate-spin text-muted-foreground" />
        ) : data?.length ? (
          data.map((s) => <StudySetRow key={s.id} set={s} />)
        ) : (
          <div className="rounded-2xl bg-card px-4 py-10 text-center space-y-2">
            <Icon className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="text-sm">{q ? 'Không tìm thấy bộ phù hợp.' : `Chưa có bộ ${meta.label} nào.`}</p>
            {!q && (
              <Button size="sm" variant="outline" className="rounded-full gap-1" onClick={() => setEditor({ ai: true })}>
                <N7AiMark className="h-3.5 w-3.5" /> Tạo bằng N7AI
              </Button>
            )}
          </div>
        )}
      </div>

      <StudySetEditor
        open={!!editor}
        onOpenChange={(o) => !o && setEditor(null)}
        kind={kind}
        startWithAi={!!editor?.ai}
        onSaved={(set) => router.push(toolHref(kind, set.id))}
      />
    </>
  )
}

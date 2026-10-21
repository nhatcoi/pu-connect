'use client'

import React from 'react'
import { Telescope, TextQuote, Wand2, X } from 'lucide-react'
import type { AiMode, AiSkill, ChatQuote, ChatRef } from '@pu/schemas'
import { AI_MODE_META } from '../ai/ai-modes'
import { REF_META } from '../refs'

interface Props {
  refs: ChatRef[]
  onRemoveRef: (ref: ChatRef) => void
  quotes: ChatQuote[]
  onRemoveQuote: (index: number) => void
  skill: AiSkill | null
  onClearSkill: () => void
  mode: AiMode | null // nhóm: chế độ chọn qua "/" (gửi 1 lần)
  onClearMode: () => void
  research: boolean
  onClearResearch: () => void
}

// Chip phía trên ô soạn: ngữ cảnh đã gắn, đoạn trích bôi đen, skill / chế độ N7AI, Research
export function ContextChips({ refs, onRemoveRef, quotes, onRemoveQuote, skill, onClearSkill, mode, onClearMode, research, onClearResearch }: Props) {
  if (!refs.length && !quotes.length && !skill && !mode && !research) return null
  return (
    <div className="flex flex-wrap gap-1.5 mx-1 mt-0.5 mb-1.5">
      {mode && <Chip icon={AI_MODE_META[mode].icon} label={`N7AI · ${AI_MODE_META[mode].label}`} accent onRemove={onClearMode} />}
      {skill && <Chip icon={Wand2} label={`/${skill.slug}`} title={skill.name} accent onRemove={onClearSkill} />}
      {research && <Chip icon={Telescope} label="Research · 2 lượt" accent onRemove={onClearResearch} />}
      {quotes.map((q, i) => (
        <Chip
          key={`quote:${i}`}
          icon={TextQuote}
          label={q.locator ? `${q.title} · ${q.locator}` : q.title}
          title={q.text.length > 300 ? `${q.text.slice(0, 300)}…` : q.text}
          accent
          onRemove={() => onRemoveQuote(i)}
        />
      ))}
      {refs.map((r) => (
        <Chip
          key={`${r.type}:${r.id}`}
          icon={REF_META[r.type].icon}
          label={r.title}
          title={`${REF_META[r.type].label}: ${r.title}`}
          onRemove={() => onRemoveRef(r)}
        />
      ))}
    </div>
  )
}

function Chip({
  icon: Icon,
  label,
  title,
  accent,
  onRemove
}: {
  icon: React.ElementType
  label: string
  title?: string
  accent?: boolean
  onRemove: () => void
}) {
  return (
    <span
      title={title ?? label}
      className={
        'inline-flex max-w-56 items-center gap-1 rounded-full pl-2 pr-1 h-6 text-[11px] font-medium ' +
        (accent ? 'bg-primary/10 text-primary' : 'bg-muted text-foreground')
      }
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Bỏ ${label}`}
        className="rounded-full p-0.5 opacity-70 hover:opacity-100 hover:bg-background/60 cursor-pointer"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

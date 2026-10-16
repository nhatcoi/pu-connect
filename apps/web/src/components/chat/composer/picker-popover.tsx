'use client'

import React, { useEffect, useRef } from 'react'
import { Loader2, MessageSquarePlus, RotateCcw, Users, Wand2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { N7AiMark } from '@/components/brand/pu-logo'
import { PUAI_USERNAME } from '@/lib/mention'
import { cn } from '@/lib/utils'
import { AI_MODE_META } from '../ai/ai-modes'
import { REF_META } from '../refs'
import { ALL_CANDIDATE, COMMAND_LABEL, type PickerCommand, type PickerItem, type PickerSection } from './use-composer-picker'

export const pickerOptionId = (listId: string, i: number) => `${listId}-opt-${i}`

const COMMAND_ICON: Record<PickerCommand, React.ElementType> = { new: MessageSquarePlus, reset: RotateCcw, 'create-skill': Wand2 }

interface Props {
  id: string
  sections: PickerSection[]
  index: number
  isLoading?: boolean
  onHover: (i: number) => void
  onSelect: (item: PickerItem) => void
}

// Danh sách gợi ý chia nhóm (listbox; bàn phím do textarea điều khiển qua aria-activedescendant)
export function PickerPopover({ id, sections, index, isLoading, onHover, onSelect }: Props) {
  const listRef = useRef<HTMLDivElement>(null)

  // Giữ mục đang chọn trong tầm nhìn khi dùng phím mũi tên
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(pickerOptionId(id, index))}`)?.scrollIntoView({ block: 'nearest' })
  }, [id, index])

  let n = -1
  return (
    <div
      ref={listRef}
      id={id}
      role="listbox"
      aria-label="Gợi ý"
      className="absolute bottom-full left-0 mb-2 z-30 max-h-80 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95 duration-100"
    >
      {isLoading && !sections.length ? (
        <div className="flex items-center gap-2 px-2.5 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tìm…
        </div>
      ) : (
        sections.map((section) => (
          <div key={section.title} role="group" aria-label={section.title}>
            <p className="px-2 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{section.title}</p>
            {section.items.map((item) => {
              const i = ++n
              return (
                <div
                  key={item.key}
                  id={pickerOptionId(id, i)}
                  role="option"
                  aria-selected={i === index}
                  onMouseDown={(e) => e.preventDefault()} // giữ focus ở textarea
                  onMouseEnter={() => onHover(i)}
                  onClick={() => onSelect(item)}
                  className={cn('flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors', i === index ? 'bg-muted' : 'hover:bg-muted/60')}
                >
                  <ItemRow item={item} />
                </div>
              )
            })}
          </div>
        ))
      )}
    </div>
  )
}

function ItemRow({ item }: { item: PickerItem }) {
  switch (item.kind) {
    case 'user': {
      const u = item.user
      const icon =
        u.username === PUAI_USERNAME ? (
          <IconBox>
            <N7AiMark className="h-[68%] w-[68%]" />
          </IconBox>
        ) : u.username === ALL_CANDIDATE.username ? (
          <IconBox>
            <Users className="h-3.5 w-3.5" />
          </IconBox>
        ) : (
          <Avatar className="h-7 w-7 shrink-0 border border-border">
            <AvatarImage src={u.avatarUrl || ''} alt="" />
            <AvatarFallback className="bg-muted text-[10px] font-bold">{u.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        )
      const hint = u.username === PUAI_USERNAME ? 'Hỏi PU AI cùng cả nhóm' : u.username === ALL_CANDIDATE.username ? 'Thông báo cho mọi thành viên' : null
      return <Row icon={icon} title={u.displayName} sub={`@${u.username}${hint ? ` · ${hint}` : ''}`} />
    }
    case 'ref': {
      const meta = REF_META[item.ref.type]
      return <Row icon={<IconBox>{React.createElement(meta.icon, { className: 'h-3.5 w-3.5' })}</IconBox>} title={item.ref.title} sub={[meta.label, item.ref.subtitle].filter(Boolean).join(' · ')} />
    }
    case 'mode': {
      const meta = AI_MODE_META[item.mode]
      return <Row icon={<IconBox>{React.createElement(meta.icon, { className: 'h-3.5 w-3.5 text-primary' })}</IconBox>} title={meta.label} sub={`/${item.mode} · ${meta.hint}`} />
    }
    case 'skill':
      return (
        <Row
          icon={
            <IconBox>
              <Wand2 className="h-3.5 w-3.5 text-primary" />
            </IconBox>
          }
          title={item.skill.name}
          sub={`/${item.skill.slug}${item.skill.description ? ` · ${item.skill.description}` : ''}`}
        />
      )
    case 'command': {
      const meta = COMMAND_LABEL[item.command]
      return <Row icon={<IconBox>{React.createElement(COMMAND_ICON[item.command], { className: 'h-3.5 w-3.5' })}</IconBox>} title={meta.label} sub={meta.hint} />
    }
  }
}

function IconBox({ children }: { children: React.ReactNode }) {
  return <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">{children}</span>
}

function Row({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">{title}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{sub}</span>
      </span>
    </>
  )
}

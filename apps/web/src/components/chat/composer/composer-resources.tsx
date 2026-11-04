'use client'

import React, { useState } from 'react'
import {
  Brain,
  Database,
  FileUp,
  NotebookPen,
  Plus,
  Search,
  Wand2,
  type LucideIcon
} from 'lucide-react'
import type { AiSkill } from '@pu/schemas'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface ResourceOption {
  id: string
  label: string
  icon: LucideIcon
  action: () => void
  badge?: string
  badgeActive?: boolean
  shortcut?: string
}

interface ComposerResourcesProps {
  disabled?: boolean
  onUploadFile: () => void
  onAddContext: () => void
  onOpenNotebooks?: () => void
  onToggleMemory?: () => void
  memoryActive?: boolean
  selectedCount?: number
  onPickSkill?: (skill: AiSkill) => void
  onManageSkills?: () => void
  research?: boolean
  onToggleResearch?: () => void
}

export function ComposerResources({
  disabled,
  onUploadFile,
  onAddContext,
  onOpenNotebooks,
  onToggleMemory,
  memoryActive = true,
  selectedCount = 0,
  onPickSkill: _onPickSkill,
  onManageSkills,
  research,
  onToggleResearch
}: ComposerResourcesProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const options: ResourceOption[] = [
    {
      id: 'upload',
      label: 'Tải tệp & tài liệu',
      icon: FileUp,
      action: () => {
        setOpen(false)
        onUploadFile()
      }
    },
    {
      id: 'kb',
      label: 'Cơ sở tri thức',
      shortcut: '@',
      icon: Database,
      action: () => {
        setOpen(false)
        onAddContext()
      }
    },
    {
      id: 'notebook',
      label: 'Sổ tay & Ghi chú',
      icon: NotebookPen,
      action: () => {
        setOpen(false)
        onOpenNotebooks?.()
      }
    },
    {
      id: 'memory',
      label: 'Bộ nhớ học tập',
      icon: Brain,
      badge: memoryActive ? 'Bật' : 'Tắt',
      badgeActive: memoryActive,
      action: () => {
        onToggleMemory?.()
      }
    },
    {
      id: 'research',
      label: 'Nghiên cứu sâu (Deep Research)',
      icon: Search,
      badge: research ? 'Bật' : undefined,
      badgeActive: Boolean(research),
      action: () => {
        onToggleResearch?.()
        setOpen(false)
      }
    },
    ...(onManageSkills
      ? [
          {
            id: 'skills',
            label: 'Kho kỹ năng (Skills)',
            icon: Wand2,
            action: () => {
              setOpen(false)
              onManageSkills()
            }
          }
        ]
      : [])
  ]

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="Tài liệu & Tùy chọn"
          title="Tài liệu & Tùy chọn (+)"
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors cursor-pointer',
            'hover:bg-muted/70 hover:text-foreground',
            open && 'bg-muted text-foreground',
            selectedCount > 0 && 'text-primary'
          )}
        >
          <Plus size={16} strokeWidth={2} />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="w-[260px] p-1.5 rounded-xl shadow-xl border border-border bg-popover text-foreground select-none"
      >
        <div className="px-2 py-1.5 border-b border-border/40">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm kiếm…"
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground text-foreground"
          />
        </div>

        <div className="max-h-[320px] overflow-y-auto space-y-0.5 p-1 text-xs">
          {filtered.length > 0 ? (
            filtered.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.action}
                  className="w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors hover:bg-muted/70 cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      size={15}
                      strokeWidth={1.8}
                      className="shrink-0 text-muted-foreground group-hover:text-foreground transition-colors"
                    />
                    <span className="font-medium text-foreground text-xs truncate">
                      {item.label}
                    </span>
                  </div>
                  {item.badge ? (
                    <span
                      className={cn(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0',
                        item.badgeActive
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {item.badge}
                    </span>
                  ) : item.shortcut ? (
                    <kbd className="text-[10px] font-mono text-muted-foreground/70 bg-muted/60 px-1.5 py-0.5 rounded shrink-0">
                      {item.shortcut}
                    </kbd>
                  ) : null}
                </button>
              )
            })
          ) : (
            <div className="py-4 text-center text-xs text-muted-foreground">
              Không tìm thấy tùy chọn
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

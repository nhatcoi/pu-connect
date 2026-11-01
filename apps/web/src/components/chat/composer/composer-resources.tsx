'use client'

import React, { useState } from 'react'
import {
  Brain,
  Database,
  FileUp,
  Globe,
  NotebookPen,
  Plus,
  Search,
  UserCheck,
  Wand2,
  type LucideIcon
} from 'lucide-react'
import type { AiSkill } from '@pu/schemas'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface ResourceOption {
  id: string
  label: string
  description?: string
  icon: LucideIcon
  group: 'materials' | 'preferences'
  action: () => void
  count?: number
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
      description: 'PDF, Word, tệp văn bản hoặc ảnh chụp đề bài',
      icon: FileUp,
      group: 'materials',
      action: () => {
        setOpen(false)
        onUploadFile()
      }
    },
    {
      id: 'kb',
      label: 'Cơ sở tri thức (@)',
      description: 'Gắn ngữ cảnh môn học, tài liệu khoa hoặc bài viết',
      icon: Database,
      group: 'materials',
      action: () => {
        setOpen(false)
        onAddContext()
      }
    },
    {
      id: 'notebook',
      label: 'Sổ tay & Ghi chú',
      description: 'Liên kết flashcards và ghi chú cá nhân từ Thư viện',
      icon: NotebookPen,
      group: 'materials',
      action: () => {
        setOpen(false)
        onOpenNotebooks?.()
      }
    },
    {
      id: 'memory',
      label: 'Bộ nhớ học tập',
      description: memoryActive ? 'Đang kích hoạt ngữ cảnh sở thích & trình độ' : 'Tạm tắt bộ nhớ cá nhân',
      icon: Brain,
      group: 'materials',
      count: memoryActive ? 1 : 0,
      action: () => {
        onToggleMemory?.()
      }
    },
    {
      id: 'research',
      label: 'Nghiên cứu sâu (Deep Research)',
      description: research ? 'Đang kích hoạt chế độ nghiên cứu sâu' : 'Tìm kiếm và đối chiếu đa nguồn học thuật',
      icon: Search,
      group: 'materials',
      count: research ? 1 : 0,
      action: () => {
        onToggleResearch?.()
        setOpen(false)
      }
    },
    ...(onManageSkills
      ? [
          {
            id: 'skills',
            label: 'Kho Kỹ năng (Skills)',
            description: 'Tạo sơ đồ tư duy, LaTeX, tóm tắt tài liệu...',
            icon: Wand2,
            group: 'materials' as const,
            action: () => {
              setOpen(false)
              onManageSkills()
            }
          }
        ]
      : []),
    {
      id: 'persona',
      label: 'Phong cách trợ lý',
      description: 'Gia sư Socratic, Người giải đề hoặc Chuyên gia',
      icon: UserCheck,
      group: 'preferences',
      action: () => {
        setOpen(false)
      }
    },
    {
      id: 'language',
      label: 'Ngôn ngữ phản hồi',
      description: 'Tự động theo câu hỏi / Tiếng Việt / English',
      icon: Globe,
      group: 'preferences',
      action: () => {
        setOpen(false)
      }
    }
  ]

  const filtered = options.filter(
    (o) =>
      o.label.toLowerCase().includes(query.toLowerCase()) ||
      (o.description && o.description.toLowerCase().includes(query.toLowerCase()))
  )

  const materials = filtered.filter((o) => o.group === 'materials')
  const preferences = filtered.filter((o) => o.group === 'preferences')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="Thêm tài liệu & tùy chọn câu trả lời"
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
        className="w-[320px] p-2 rounded-xl shadow-xl border border-border bg-popover text-foreground select-none"
      >
        <div className="px-2 py-1.5 border-b border-border/40">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm tài liệu hoặc tùy chọn…"
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground text-foreground"
          />
        </div>

        <div className="max-h-[340px] overflow-y-auto space-y-3 p-1 mt-1 text-xs">
          {materials.length > 0 && (
            <div className="space-y-0.5">
              <div className="px-2 py-1 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">
                Tài liệu tham khảo
              </div>
              {materials.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.action}
                    className="w-full flex items-start gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors hover:bg-muted/70 cursor-pointer group"
                  >
                    <Icon size={15} strokeWidth={1.8} className="shrink-0 mt-0.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground text-xs leading-none">{item.label}</span>
                        {item.count ? (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                            Bật
                          </span>
                        ) : null}
                      </div>
                      {item.description && (
                        <p className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-1">{item.description}</p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {preferences.length > 0 && (
            <div className="space-y-0.5 pt-1 border-t border-border/40">
              <div className="px-2 py-1 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">
                Tùy chọn câu trả lời
              </div>
              {preferences.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.action}
                    className="w-full flex items-start gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors hover:bg-muted/70 cursor-pointer group"
                  >
                    <Icon size={15} strokeWidth={1.8} className="shrink-0 mt-0.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground text-xs leading-none">{item.label}</div>
                      {item.description && (
                        <p className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-1">{item.description}</p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {!filtered.length && (
            <div className="py-4 text-center text-xs text-muted-foreground">Không tìm thấy tùy chọn phù hợp</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

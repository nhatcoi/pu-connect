'use client'

import React from 'react'
import { Check, ChevronDown, Zap } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAiModelOptions, useAiSettings } from '@/hooks/chat'
import { cn } from '@/lib/utils'

// Chọn mức model N7AI ngay trong ô soạn tin (cạnh nút gửi, như "Instant" của ChatGPT); lưu ở cài đặt, đồng bộ mọi thiết bị
// Danh mục lấy từ server (admin quản lý); model ẩn khỏi menu vẫn dùng được nếu đã chọn trước đó
export function AiModelPicker({ className }: { className?: string }) {
  const { settings, update } = useAiSettings()
  const { data: options = [] } = useAiModelOptions()
  const current = options.find((m) => m.id === settings?.aiModel) ?? { id: settings?.aiModel ?? '', label: settings?.aiModel ?? 'Model', hint: '', cost: 1 }
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={!settings || options.length === 0}
          aria-label={`Mức model N7AI: ${current.label}`}
          className={cn(
            'flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-muted px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/70 disabled:opacity-60',
            className
          )}
        >
          <Zap className="h-3.5 w-3.5 text-primary" aria-hidden />
          {current.label}
          <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" className="w-60">
        {options.map((m) => (
          <DropdownMenuItem key={m.id} onSelect={() => m.id !== current.id && update.mutate({ aiModel: m.id })} className="items-start">
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium">{m.label}</span>
              <span className="block text-[11px] leading-snug text-muted-foreground">{m.hint}</span>
            </span>
            {m.id === current.id && <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

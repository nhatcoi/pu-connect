'use client'

import React from 'react'
import { AtSign, Check, ExternalLink, Paperclip, Plug, Plus, Settings2, Telescope, Unplug, Wand2 } from 'lucide-react'
import type { AiConnectorId, AiSkill } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { chatApi, useAiConnectors, useAiSkills, useDisconnectConnector } from '@/hooks/chat'

interface Props {
  disabled?: boolean
  aiTools: boolean // hỏi được PU AI (thread AI / nhóm) ⇒ Skills, Research
  connectorsEnabled: boolean // chỉ thread AI riêng (nhóm không đọc dữ liệu riêng của người hỏi)
  onUpload: () => void
  onAddContext: () => void
  onPickSkill: (skill: AiSkill) => void
  onManageSkills: () => void
  connectors: AiConnectorId[]
  onToggleConnector: (id: AiConnectorId) => void
  research: boolean
  onToggleResearch: () => void
}

// Nút "+": tải tệp · ngữ cảnh · skill · connector · Research (dữ liệu menu con chỉ tải khi mở)
export function PlusMenu(props: Props) {
  const [open, setOpen] = React.useState(false)
  const { data: skills } = useAiSkills(open && props.aiTools)
  const { data: connectors } = useAiConnectors(open && props.connectorsEnabled)
  const disconnect = useDisconnectConnector()

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 rounded-full shrink-0 text-muted-foreground"
          disabled={props.disabled}
          aria-label="Thêm tệp, ngữ cảnh, skill"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <DropdownMenuItem onSelect={props.onUpload}>
          <Paperclip /> Tải ảnh hoặc tệp
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={props.onAddContext}>
          <AtSign /> Gắn ngữ cảnh (môn, tài liệu, bài…)
        </DropdownMenuItem>

        {props.aiTools && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Wand2 /> Skills
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-60">
              {skills?.length ? (
                skills.map((s) => (
                  <DropdownMenuItem key={s.id} onSelect={() => props.onPickSkill(s)}>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium">{s.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">/{s.slug}</span>
                    </span>
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Chưa có skill nào</DropdownMenuLabel>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={props.onManageSkills}>
                <Settings2 /> Quản lý skill
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {props.connectorsEnabled && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Plug /> Connectors
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64">
              {connectors?.map((c) => {
                // Cần kết nối tài khoản ngoài mà chưa kết nối ⇒ mục "Kết nối" (chuyển sang Google)
                if (c.requiresAuth && !c.connected) {
                  return (
                    <DropdownMenuItem key={c.id} disabled={!c.available} onSelect={() => window.location.assign(chatApi.connectorConnectUrl(c.id))}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">{c.name}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {c.available ? `Kết nối để PU AI đọc ${c.name} (chỉ đọc)` : 'Máy chủ chưa cấu hình'}
                        </span>
                      </span>
                      {c.available && <ExternalLink />}
                    </DropdownMenuItem>
                  )
                }
                const on = props.connectors.includes(c.id)
                return (
                  <DropdownMenuItem
                    key={c.id}
                    // Giữ menu mở để bật/tắt nhiều nguồn
                    onSelect={(e) => {
                      e.preventDefault()
                      props.onToggleConnector(c.id)
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{c.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{c.account ?? c.description}</span>
                    </span>
                    {on && <Check className="text-primary" />}
                  </DropdownMenuItem>
                )
              })}
              {connectors?.some((c) => c.requiresAuth && c.connected) && <DropdownMenuSeparator />}
              {connectors
                ?.filter((c) => c.requiresAuth && c.connected)
                .map((c) => (
                  <DropdownMenuItem key={`off-${c.id}`} variant="destructive" disabled={disconnect.isPending} onSelect={() => disconnect.mutate(c)}>
                    <Unplug /> Ngắt {c.name}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {props.aiTools && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={props.onToggleResearch}>
              <Telescope /> Research <span className="ml-auto text-[10px] text-muted-foreground">{props.research ? 'Đang bật' : '2 lượt'}</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

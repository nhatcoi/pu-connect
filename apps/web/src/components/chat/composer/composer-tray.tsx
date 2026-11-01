'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  Bot,
  Check,
  ChevronDown,
  Plug,
  Plus,
  Shapes,
  UserRound,
  UsersRound,
  Wand2
} from 'lucide-react'
import type { AiConnectorId, AiMode, AiSkill } from '@pu/schemas'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { AI_MODE_META, N7AI_CAPABILITIES } from '../ai/ai-modes'
import { ConnectorHubIcon, SkillDeckIcon } from '../ai/mode-icons'
import { useAiConnectors, useAiSkills } from '@/hooks/chat'

interface ComposerTrayProps {
  placement?: 'bottom' | 'top'
  mode: AiMode
  onModeChange: (mode: AiMode) => void
  onOpenSkills?: () => void
  onOpenConnectors?: () => void
  connectors?: AiConnectorId[]
  onToggleConnector?: (id: AiConnectorId) => void
  onSelectConnectors?: (ids: AiConnectorId[]) => void
  selectedSkill?: AiSkill | null
  onSelectSkill?: (skill: AiSkill | null) => void
  everyTurn?: boolean
  onToggleEveryTurn?: (val: boolean) => void
  disabled?: boolean
}

interface BuiltinSkill {
  id: string
  name: string
  description: string
  instructions?: string
  inputHint?: string | null
}

const DEFAULT_N7AI_SKILLS: readonly BuiltinSkill[] = [
  {
    id: 'docx',
    name: 'docx',
    description: 'Read, create, or edit Microsoft Word .docx files'
  },
  {
    id: 'pdf',
    name: 'pdf',
    description: 'Read, extract (text/tables), create, merge/split PDF files'
  },
  {
    id: 'pptx',
    name: 'pptx',
    description: 'Read, create, or edit PowerPoint .pptx decks'
  },
  {
    id: 'skill-creator',
    name: 'skill-creator',
    description: 'Design and author N7AI skills (SKILL.md)'
  },
  {
    id: 'xlsx',
    name: 'xlsx',
    description: 'Read, create, or edit Excel spreadsheets (.xlsx)'
  },
  {
    id: 'mindmap',
    name: 'mindmap',
    description: 'Tạo sơ đồ tư duy phân nhánh trực quan'
  },
  {
    id: 'latex',
    name: 'latex',
    description: 'Soạn công thức Toán và chứng minh định lý'
  },
  {
    id: 'code-tutor',
    name: 'code-tutor',
    description: 'Phân tích giải thuật và tối ưu mã nguồn'
  }
]

interface ConnectorItem {
  id: AiConnectorId
  name: string
  tools: number
  status: 'connected' | 'needs_auth'
}

const CONNECTORS_LIST: readonly ConnectorItem[] = [
  { id: 'library', name: 'Thư viện số PU (PU Library)', tools: 4, status: 'connected' },
  { id: 'my_documents', name: 'Tài liệu của tôi (My Documents)', tools: 3, status: 'connected' },
  { id: 'my_study', name: 'Học tập cá nhân (My Study)', tools: 2, status: 'connected' },
  { id: 'my_chats', name: 'Lịch sử chat cũ (My Chats)', tools: 2, status: 'connected' },
  { id: 'web_search', name: 'Tìm kiếm Web (Web Search)', tools: 1, status: 'connected' },
  { id: 'google_drive', name: 'Google Drive', tools: 2, status: 'needs_auth' },
  { id: 'google_calendar', name: 'Google Calendar', tools: 1, status: 'needs_auth' }
]

/**
 * Words a folding tray button can put away:
 * Rests as an icon mark only, smoothly unfolding while hovered, focused, or open.
 */
function TrayReveal({ children }: { children: React.ReactNode }) {
  return (
    <span className="dt-tray-reveal">
      <span>
        <span className="dt-tray-reveal-run">{children}</span>
      </span>
    </span>
  )
}

export function ComposerTray({
  placement = 'bottom',
  mode,
  onModeChange,
  onOpenSkills,
  onOpenConnectors,
  connectors = [],
  onToggleConnector,
  onSelectConnectors,
  selectedSkill,
  onSelectSkill,
  everyTurn = false,
  onToggleEveryTurn,
  disabled = false
}: ComposerTrayProps) {
  const [openModeMenu, setOpenModeMenu] = useState(false)
  const [openSkillsMenu, setOpenSkillsMenu] = useState(false)
  const [openConnectorsMenu, setOpenConnectorsMenu] = useState(false)
  const [openPartnersMenu, setOpenPartnersMenu] = useState(false)
  const [openPreferencesMenu, setOpenPreferencesMenu] = useState(false)

  const isModeActive = mode && mode !== 'ask'
  const currentMeta = AI_MODE_META[mode] ?? AI_MODE_META.ask
  const ActiveIcon = currentMeta.icon

  const selectedConnectors = connectors
  const isAutoConnectors = selectedConnectors.length === 0
  const activeConnectorsCount = selectedConnectors.length

  // Tải danh sách connector & skill từ server
  const { data: serverConnectors } = useAiConnectors()
  const { data: userSkills = [] } = useAiSkills()

  const allConnectors: readonly ConnectorItem[] = React.useMemo(() => {
    if (serverConnectors && serverConnectors.length > 0) {
      const list: ConnectorItem[] = []
      for (const sc of serverConnectors) {
        if (sc.id === 'web') continue
        list.push({
          id: sc.id,
          name: sc.name,
          tools: sc.id === 'library' ? 4 : sc.id === 'my_documents' ? 3 : sc.id === 'web_search' ? 1 : 2,
          status: (sc.connected || !sc.requiresAuth ? 'connected' : 'needs_auth') as 'connected' | 'needs_auth'
        })
      }
      return list
    }
    return CONNECTORS_LIST
  }, [serverConnectors])

  const allSkills: BuiltinSkill[] = React.useMemo(() => {
    const list: BuiltinSkill[] = [...DEFAULT_N7AI_SKILLS]
    for (const sk of userSkills) {
      if (!list.some((x) => x.id === sk.id || x.name === sk.name)) {
        list.push({
          id: sk.id,
          name: sk.slug || sk.name,
          description: sk.description,
          inputHint: sk.inputHint
        })
      }
    }
    return list
  }, [userSkills])

  return (
    <div className="flex items-center justify-between gap-2 pt-2 px-1 text-xs select-none relative">
      {/* Left controls: Mode ▾, Skills (Wand2), Connectors (Plug) */}
      <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
        {/* 1. N7AI Mode ⌃ Menu */}
        <Popover open={openModeMenu} onOpenChange={setOpenModeMenu}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              data-fold={isModeActive ? 'true' : undefined}
              data-state={openModeMenu ? 'open' : 'closed'}
              className={cn(
                'dt-tray-button inline-flex items-center gap-0 px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-xs font-medium',
                isModeActive
                  ? 'text-[#e05d38] dark:text-[#ff7a59] font-semibold hover:bg-[#e05d38]/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
            >
              <Shapes
                size={14}
                strokeWidth={1.8}
                className={cn('shrink-0', isModeActive ? 'text-[#e05d38] dark:text-[#ff7a59]' : 'text-muted-foreground')}
              />
              {isModeActive && (
                <span className="pl-1 text-[#e05d38] dark:text-[#ff7a59] shrink-0">
                  <ActiveIcon size={14} />
                </span>
              )}
              <TrayReveal>
                <span className={cn('font-semibold', isModeActive ? 'text-[#e05d38] dark:text-[#ff7a59]' : 'text-foreground')}>
                  {isModeActive ? currentMeta.label : 'Chế độ'}
                </span>
                <ChevronDown
                  size={12}
                  strokeWidth={2}
                  className={cn(
                    'transition-transform duration-150',
                    isModeActive ? 'text-[#e05d38] dark:text-[#ff7a59]' : 'text-muted-foreground',
                    openModeMenu && 'rotate-180'
                  )}
                />
              </TrayReveal>
            </button>
          </PopoverTrigger>

          <PopoverContent
            align="start"
            side={placement}
            sideOffset={6}
            className="w-[324px] max-h-[440px] overflow-y-auto p-1.5 rounded-2xl shadow-2xl border border-border/80 bg-popover text-popover-foreground"
          >
            <div className="space-y-0.5">
              {N7AI_CAPABILITIES.map((item) => {
                const isSelected =
                  mode === item.id ||
                  (item.id === 'deep_solve' && mode === 'solve') ||
                  (item.id === 'deep_question' && mode === 'quiz') ||
                  (item.id === 'deep_research' && mode === 'research')

                const ItemIcon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      // Clicking an already selected mode toggles back to plain conversation (ask)
                      onModeChange(isSelected ? 'ask' : item.id)
                      setOpenModeMenu(false)
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer group',
                      isSelected
                        ? 'bg-accent/80 text-foreground font-medium'
                        : 'hover:bg-accent/60 text-foreground'
                    )}
                  >
                    <span className="w-7 h-7 flex items-center justify-center shrink-0 rounded-lg text-foreground/80 group-hover:text-primary transition-colors">
                      <ItemIcon size={20} className={cn(isSelected && 'text-primary')} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-foreground leading-tight">
                        {item.label}
                      </div>
                      <div className="text-[11.5px] text-muted-foreground truncate leading-tight mt-0.5 max-w-[220px]">
                        {item.desc}
                      </div>
                    </div>
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 ml-1">
                        <Check size={10} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* 2. N7AI Skills ⌃ Menu */}
        <Popover open={openSkillsMenu} onOpenChange={setOpenSkillsMenu}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              data-fold={!selectedSkill ? 'true' : undefined}
              data-state={openSkillsMenu ? 'open' : 'closed'}
              title={selectedSkill ? `Kỹ năng: ${selectedSkill.name}` : 'Kỹ năng'}
              aria-label="Kỹ năng"
              className={cn(
                'dt-tray-button inline-flex items-center gap-0 px-2 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                selectedSkill
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
            >
              <Wand2 size={13} strokeWidth={1.8} className="shrink-0" />
              <TrayReveal>
                <span className="font-semibold text-foreground">Kỹ năng</span>
                <span className={cn('text-[11px]', selectedSkill ? 'text-primary font-semibold' : 'text-muted-foreground')}>
                  {selectedSkill ? selectedSkill.name : 'Tự động'}
                </span>
                <ChevronDown
                  size={12}
                  strokeWidth={2}
                  className={cn(
                    'text-muted-foreground transition-transform duration-150',
                    openSkillsMenu && 'rotate-180'
                  )}
                />
              </TrayReveal>
            </button>
          </PopoverTrigger>

          <PopoverContent
            align="start"
            side={placement}
            sideOffset={6}
            className="w-[324px] max-h-[440px] overflow-y-auto p-1.5 rounded-2xl shadow-2xl border border-border/80 bg-popover text-popover-foreground"
          >
            <div className="space-y-0.5">
              {/* Option 1: Auto (Default) */}
              <button
                type="button"
                onClick={() => {
                  onSelectSkill?.(null)
                  setOpenSkillsMenu(false)
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer group',
                  !selectedSkill ? 'bg-accent/80 text-foreground font-medium' : 'hover:bg-accent/60 text-foreground'
                )}
              >
                <span className="w-7 h-7 flex items-center justify-center shrink-0 rounded-lg bg-orange-500/10 text-orange-500 dark:text-orange-400">
                  <SkillDeckIcon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-foreground leading-tight">Tự động</div>
                  <div className="text-[11.5px] text-muted-foreground truncate leading-tight mt-0.5 max-w-[215px]">
                    N7AI tự chọn kỹ năng phù hợp theo câu hỏi...
                  </div>
                </div>
                {!selectedSkill && (
                  <span className="w-4 h-4 rounded-full bg-[#e05d38] text-white flex items-center justify-center shrink-0 ml-1">
                    <Check size={10} strokeWidth={3} />
                  </span>
                )}
              </button>

              {/* Skill Options */}
              {allSkills.map((sk) => {
                const isSelected = selectedSkill?.id === sk.id || selectedSkill?.name === sk.name
                return (
                  <button
                    key={sk.id}
                    type="button"
                    onClick={() => {
                      onSelectSkill?.(
                        isSelected
                          ? null
                          : {
                              id: sk.id,
                              slug: sk.name,
                              name: sk.name,
                              description: sk.description,
                              inputHint: sk.inputHint ?? null,
                              useCount: 0,
                              isPublic: false,
                              installCount: 0,
                              enabled: true,
                              pinned: false
                            }
                      )
                      setOpenSkillsMenu(false)
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer group',
                      isSelected ? 'bg-accent/80 text-foreground font-medium' : 'hover:bg-accent/60 text-foreground'
                    )}
                  >
                    <span className="w-7 h-7 flex items-center justify-center shrink-0 rounded-lg bg-accent/50 text-foreground/80 group-hover:text-primary transition-colors">
                      <Wand2 size={13} strokeWidth={1.8} className={cn(isSelected && 'text-primary')} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-foreground leading-tight">{sk.name}</div>
                      <div className="text-[11.5px] text-muted-foreground truncate leading-tight mt-0.5 max-w-[215px]">
                        {sk.description}
                      </div>
                    </div>
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-[#e05d38] text-white flex items-center justify-center shrink-0 ml-1">
                        <Check size={10} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Footer row: Every turn switch & Manage skills link */}
            <div className="pt-2 mt-1 border-t border-border/40 px-2 flex justify-between items-center text-xs">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <Switch
                  checked={everyTurn}
                  onCheckedChange={onToggleEveryTurn}
                  className="scale-75 origin-left data-[state=checked]:bg-[#e05d38]"
                />
                <span className="text-[11.5px] text-muted-foreground hover:text-foreground transition-colors">
                  Mỗi lượt
                </span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setOpenSkillsMenu(false)
                  onOpenSkills?.()
                }}
                className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <span>Quản lý kỹ năng</span>
                <ArrowUpRight size={11} strokeWidth={2} />
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {/* 3. Connectors Menu (Plug) */}
        <Popover open={openConnectorsMenu} onOpenChange={setOpenConnectorsMenu}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              data-fold={isAutoConnectors ? 'true' : undefined}
              data-state={openConnectorsMenu ? 'open' : 'closed'}
              title={`Kết nối (${isAutoConnectors ? 'Tự động' : activeConnectorsCount})`}
              aria-label="Kết nối"
              className={cn(
                'dt-tray-button inline-flex items-center gap-0 px-2 py-1 rounded-lg transition-colors cursor-pointer text-xs font-medium',
                activeConnectorsCount > 0
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
            >
              <Plug size={13} strokeWidth={1.8} className="shrink-0" />
              <TrayReveal>
                <span className="font-semibold text-foreground">Kết nối</span>
                <span className="text-muted-foreground text-[11px]">
                  {activeConnectorsCount > 0
                    ? activeConnectorsCount === 1
                      ? (allConnectors.find((c) => c.id === selectedConnectors[0])?.name.split(' ')[0] ?? '1')
                      : `${activeConnectorsCount}`
                    : 'Tự động'}
                </span>
                <ChevronDown
                  size={12}
                  strokeWidth={2}
                  className={cn(
                    'text-muted-foreground transition-transform duration-150',
                    openConnectorsMenu && 'rotate-180'
                  )}
                />
              </TrayReveal>
            </button>
          </PopoverTrigger>

          <PopoverContent
            align="start"
            side={placement}
            sideOffset={6}
            className="w-[324px] p-1.5 rounded-2xl shadow-2xl border border-border bg-popover text-popover-foreground"
          >
            {allConnectors.length > 0 ? (
              <div className="space-y-0.5 max-h-[300px] overflow-y-auto pr-0.5">
                {/* 1. First Item: Auto */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectConnectors?.([])
                    setOpenConnectorsMenu(false)
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer group',
                    isAutoConnectors ? 'bg-accent/80 text-foreground font-medium' : 'hover:bg-accent/60 text-foreground'
                  )}
                >
                  <span className="w-7 h-7 flex items-center justify-center shrink-0 rounded-lg bg-emerald-500/10 text-emerald-500">
                    <ConnectorHubIcon size={16} strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-foreground leading-tight">Tự động</div>
                    <div className="text-[11.5px] text-muted-foreground truncate leading-tight mt-0.5 max-w-[215px]">
                      N7AI tự chọn kết nối phù hợp...
                    </div>
                  </div>
                  {isAutoConnectors && (
                    <span className="w-4 h-4 rounded-full bg-[#e05d38] text-white flex items-center justify-center shrink-0 ml-1">
                      <Check size={10} strokeWidth={3} />
                    </span>
                  )}
                </button>

                {/* Connector rows */}
                {allConnectors.map((c) => {
                  const isSelected = selectedConnectors.includes(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        onToggleConnector?.(c.id)
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer group',
                        isSelected ? 'bg-accent/80 text-foreground font-medium' : 'hover:bg-accent/60 text-foreground'
                      )}
                    >
                      <span className="w-7 h-7 flex items-center justify-center shrink-0 rounded-lg bg-accent/50 text-foreground/80 group-hover:text-primary transition-colors relative">
                        <Plug size={13} strokeWidth={1.8} className={cn(isSelected && 'text-primary')} />
                        <span
                          className={cn(
                            'absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full',
                            c.status === 'connected' ? 'bg-emerald-500' : 'bg-amber-400'
                          )}
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-foreground leading-tight truncate">{c.name}</div>
                        <div className="text-[11.5px] text-muted-foreground truncate leading-tight mt-0.5 max-w-[215px]">
                          {c.status === 'connected' ? `${c.tools} công cụ` : 'Cần cấp quyền'}
                        </div>
                      </div>
                      {isSelected && (
                        <span className="w-4 h-4 rounded-full bg-[#e05d38] text-white flex items-center justify-center shrink-0 ml-1">
                          <Check size={10} strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Chưa có kết nối nào
              </div>
            )}

            {/* Footer row: Every turn switch & Add connector link */}
            <div className="pt-2 mt-1 border-t border-border/40 px-2 flex justify-between items-center text-xs">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <Switch
                  checked={everyTurn}
                  onCheckedChange={onToggleEveryTurn}
                  className="scale-75 origin-left data-[state=checked]:bg-[#e05d38]"
                />
                <span className="text-[11.5px] text-muted-foreground hover:text-foreground transition-colors">
                  Mỗi lượt
                </span>
              </label>

              <Link
                href="/n7ai/settings/connectors"
                onClick={() => {
                  setOpenConnectorsMenu(false)
                  onOpenConnectors?.()
                }}
                className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <Plus size={12} strokeWidth={2} />
                <span>Thêm kết nối</span>
              </Link>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Right controls: Partners ▾ & Preferences Default ▾ */}
      <div className="flex items-center gap-2">
        {/* Partners ▾ Menu */}
        <Popover open={openPartnersMenu} onOpenChange={setOpenPartnersMenu}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
            >
              <UsersRound size={13} strokeWidth={1.8} className="shrink-0" />
              <span>Bạn học</span>
              <ChevronDown
                size={11}
                className={cn('opacity-70 -ml-0.5 transition-transform duration-150', openPartnersMenu && 'rotate-180')}
              />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" side={placement} sideOffset={6} className="w-[240px] p-2 text-xs">
            <div className="px-2 py-1 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">
              Bạn học & Trợ lý phối hợp
            </div>
            <div className="space-y-1 mt-1">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <Bot size={15} className="text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-xs leading-none">N7AI Solo</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Trợ lý học tập mặc định</p>
                </div>
                <Check size={13} className="text-primary" />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Preferences Default ▾ Menu */}
        <Popover open={openPreferencesMenu} onOpenChange={setOpenPreferencesMenu}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
            >
              <UserRound size={13} strokeWidth={1.8} className="shrink-0" />
              <span>Tùy chọn</span>
              <span className="text-muted-foreground/60 font-normal">Mặc định</span>
              <ChevronDown
                size={11}
                className={cn('opacity-70 -ml-0.5 transition-transform duration-150', openPreferencesMenu && 'rotate-180')}
              />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" side={placement} sideOffset={6} className="w-[250px] p-2.5 text-xs space-y-2">
            <p className="font-semibold text-foreground text-xs">Tùy chọn học tập</p>
            <div className="space-y-1 text-[11px] text-muted-foreground">
              <div className="flex justify-between py-1 border-b border-border/30">
                <span>Phong cách câu trả lời</span>
                <span className="font-medium text-foreground">Trực quan & sâu sắc</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/30">
                <span>Ngôn ngữ trả lời</span>
                <span className="font-medium text-foreground">Tự động (Tiếng Việt)</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Bộ nhớ học tập</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">Đang bật</span>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

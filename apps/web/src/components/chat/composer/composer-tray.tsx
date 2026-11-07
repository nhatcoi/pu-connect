'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  Bot,
  Check,
  ChevronDown,
  Database,
  GraduationCap,
  Lightbulb,
  Plug,
  Plus,
  Shapes,
  Sparkles,
  UserRound,
  UsersRound,
  Wand2,
  Zap
} from 'lucide-react'
import { toast } from 'sonner'
import type { AiConnectorId, AiConnectorInfo, AiMode, AiSkill } from '@pu/schemas'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { AI_MODE_META, N7AI_CAPABILITIES } from '../ai/ai-modes'
import { ConnectorHubIcon, SkillDeckIcon } from '../ai/mode-icons'
import { ConnectorIcon } from '@/components/n7ai/connector-icon'
import { useAiConnectors, useAiSettings, useAiSkills, useConnectorPrefs } from '@/hooks/chat'

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

interface ConnectorItem {
  id: AiConnectorId
  name: string
  tools: number
  status: 'connected' | 'needs_auth'
}

// Menu "Kết nối" (icon Plug) chỉ liệt kê connector chạy qua MCP thật (google_*, pu_connector).
// Nguồn native (library, my_documents, my_study...) đã bật mặc định theo Cài đặt › Trình kết nối, không cần bật/tắt ở đây.
const CONNECTORS_LIST: readonly ConnectorItem[] = []

export interface ResponseStylePreset {
  id: string
  name: string
  description: string
  prompt: string | null
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
}

export const RESPONSE_STYLES: readonly ResponseStylePreset[] = [
  {
    id: 'default',
    name: 'Mặc định',
    description: 'Chuẩn mực',
    prompt: null,
    icon: Sparkles
  },
  {
    id: 'peer',
    name: 'Bạn học',
    description: 'Đồng hành & gợi mở',
    prompt: 'Bạn học (Peer): Đóng vai người bạn cùng học tò mò, tư duy đồng hành, chia sẻ góc nhìn và thảo luận mở một cách gần gũi, tích cực.',
    icon: UsersRound
  },
  {
    id: 'research_assistant',
    name: 'Trợ lý nghiên cứu',
    description: 'Học thuật & trích dẫn',
    prompt: 'Trợ lý nghiên cứu: Phong cách học thuật chuẩn mực, tư duy phản biện khắt khe, lập luận dựa trên dữ liệu, bằng chứng và trích dẫn rõ ràng.',
    icon: GraduationCap
  },
  {
    id: 'teacher',
    name: 'Gia sư Socratic',
    description: 'Gợi mở từng bước',
    prompt: 'Gia sư Socratic: Kiên nhẫn dẫn dắt người học xây dựng kiến thức từ bản chất. Đặt câu hỏi gợi mở theo từng bước nhỏ thay vì đưa ra đáp án ngay, phản hồi ngắn gọn dưới 200 từ.',
    icon: Lightbulb
  },
  {
    id: 'concise',
    name: 'Ngắn gọn',
    description: 'Trực diện & cô đọng',
    prompt: 'Ngắn gọn & Súc tích: Trả lời trực diện, cô đọng, ưu tiên bullet points, không giải thích rườm rà.',
    icon: Zap
  }
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

  const [openSourcesMenu, setOpenSourcesMenu] = useState(false)

  // Tải danh sách connector & skill từ server
  const { data: serverConnectors } = useAiConnectors()
  const { data: userSkills = [] } = useAiSkills()
  const { settings: aiSettings, update: updateAiSettings } = useAiSettings()
  // Nguồn native (library, my_documents...) bật/tắt mặc định ở ai_settings, đồng bộ mọi thiết bị
  const { connectors: activeSources, toggle: toggleSource } = useConnectorPrefs()

  const currentStylePrompt = aiSettings?.profile?.style?.trim() || null

  const activeStyle = React.useMemo(() => {
    if (!currentStylePrompt) return RESPONSE_STYLES[0]
    const matched = RESPONSE_STYLES.find((s) => s.prompt && currentStylePrompt === s.prompt)
    if (matched) return matched
    return {
      id: 'custom',
      name: 'Tùy chỉnh',
      description: currentStylePrompt,
      prompt: currentStylePrompt,
      icon: UserRound
    }
  }, [currentStylePrompt])

  const nativeSources: readonly AiConnectorInfo[] = React.useMemo(
    () => (serverConnectors ?? []).filter((c) => c.protocol === 'native' && c.id !== 'web'),
    [serverConnectors]
  )

  // Chỉ connector chạy qua MCP thật (google_*, pu_connector) đã bật/kết nối; nguồn native xem useConnectorPrefs / Cài đặt › Trình kết nối
  const allConnectors: readonly ConnectorItem[] = React.useMemo(() => {
    if (serverConnectors && serverConnectors.length > 0) {
      const list: ConnectorItem[] = []
      for (const sc of serverConnectors) {
        if (sc.protocol !== 'mcp') continue
        // Nếu bật mới hiện: chỉ hiện connector đã kết nối (hoặc không cần auth)
        if (sc.requiresAuth && !sc.connected) continue
        list.push({
          id: sc.id,
          name: sc.name,
          tools: 2,
          status: 'connected'
        })
      }
      return list
    }
    return CONNECTORS_LIST
  }, [serverConnectors])

  const allSkills: BuiltinSkill[] = React.useMemo(() => {
    // Skill thật từ server (của mình + skill chính thức); bỏ skill đã tắt
    return userSkills
      .filter((sk) => sk.enabled)
      .map((sk) => ({ id: sk.id, name: sk.slug || sk.name, description: sk.description, inputHint: sk.inputHint }))
  }, [userSkills])

  return (
    <div className="dt-tray-root flex flex-nowrap items-center justify-between gap-2 pt-2 px-1 text-xs select-none relative">
      {/* Left controls: Mode ▾, Skills (Wand2), Connectors (Plug) */}
      <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
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
              {activeConnectorsCount === 1 ? (
                <ConnectorIcon
                  id={selectedConnectors[0]}
                  className="h-3.5 w-3.5 shrink-0 object-contain"
                  fallback={<Plug size={13} strokeWidth={1.8} className="shrink-0" />}
                />
              ) : (
                <Plug size={13} strokeWidth={1.8} className="shrink-0" />
              )}
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
                      N7AI tự chọn dịch vụ MCP phù hợp...
                    </div>
                  </div>
                  {isAutoConnectors && (
                    <span className="w-4 h-4 rounded-full bg-[#e05d38] text-white flex items-center justify-center shrink-0 ml-1">
                      <Check size={10} strokeWidth={3} />
                    </span>
                  )}
                </button>

                <div className="px-2.5 pt-1.5 pb-0.5 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Dịch vụ ngoài qua MCP
                </div>

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
                        <ConnectorIcon
                          id={c.id}
                          className="h-4 w-4 object-contain"
                          fallback={<Plug size={13} strokeWidth={1.8} className={cn(isSelected && 'text-primary')} />}
                        />
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

        {/* 4. Nguồn trong PU Connect (Database) — tool native, không qua MCP */}
        <Popover open={openSourcesMenu} onOpenChange={setOpenSourcesMenu}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              data-fold="true"
              data-state={openSourcesMenu ? 'open' : 'closed'}
              title="Nguồn trong PU Connect"
              aria-label="Nguồn"
              className="dt-tray-button inline-flex items-center gap-0 px-2 py-1 rounded-lg transition-colors cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60"
            >
              <Database size={13} strokeWidth={1.8} className="shrink-0" />
              <TrayReveal>
                <span className="font-semibold text-foreground">Nguồn</span>
                <ChevronDown
                  size={12}
                  strokeWidth={2}
                  className={cn('text-muted-foreground transition-transform duration-150', openSourcesMenu && 'rotate-180')}
                />
              </TrayReveal>
            </button>
          </PopoverTrigger>

          <PopoverContent
            align="start"
            side={placement}
            sideOffset={6}
            className="w-[300px] p-1.5 rounded-2xl shadow-2xl border border-border bg-popover text-popover-foreground"
          >
            <div className="px-2.5 pt-1 pb-1.5 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">
              Nguồn trong PU Connect
            </div>
            <div className="space-y-0.5 max-h-[280px] overflow-y-auto pr-0.5">
              {nativeSources.map((s) => {
                const on = activeSources.includes(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSource(s.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer group',
                      on ? 'bg-accent/80 text-foreground font-medium' : 'hover:bg-accent/60 text-foreground'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-foreground leading-tight truncate">{s.name}</div>
                      <div className="text-[11.5px] text-muted-foreground truncate leading-tight mt-0.5 max-w-[220px]">{s.description}</div>
                    </div>
                    {on && (
                      <span className="w-4 h-4 rounded-full bg-[#e05d38] text-white flex items-center justify-center shrink-0 ml-1">
                        <Check size={10} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Right controls: Partners ▾ & Preferences Default ▾ */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {/* Partners ▾ Menu */}
        <Popover open={openPartnersMenu} onOpenChange={setOpenPartnersMenu}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
            >
              <UsersRound size={13} strokeWidth={1.8} className="shrink-0" />
              <span className="dt-narrow-hide">Bạn học</span>
              <ChevronDown
                size={11}
                className={cn('dt-narrow-hide opacity-70 -ml-0.5 transition-transform duration-150', openPartnersMenu && 'rotate-180')}
              />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" side={placement} sideOffset={6} className="w-[240px] p-2 text-xs">
            <div className="px-2 py-1 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">
              Phối hợp
            </div>
            <div className="space-y-1 mt-1">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <Bot size={15} className="text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-xs leading-none">N7AI Solo</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Trợ lý mặc định</p>
                </div>
                <Check size={13} className="text-primary" />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Preferences / Tùy chọn phản hồi (Response style & Who answers) */}
        <Popover open={openPreferencesMenu} onOpenChange={setOpenPreferencesMenu}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                activeStyle.id !== 'default'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
            >
              <UserRound size={13} strokeWidth={1.8} className="shrink-0" />
              <span className="dt-narrow-hide">Tùy chọn</span>
              <span className={cn('dt-narrow-hide text-[11px]', activeStyle.id !== 'default' ? 'text-primary font-semibold' : 'text-muted-foreground/80')}>
                {activeStyle.name.split(' ')[0]}
              </span>
              <ChevronDown
                size={11}
                className={cn('dt-narrow-hide opacity-70 -ml-0.5 transition-transform duration-150', openPreferencesMenu && 'rotate-180')}
              />
            </button>
          </PopoverTrigger>

          <PopoverContent
            align="end"
            side={placement}
            sideOffset={6}
            className="w-[310px] max-h-[460px] overflow-y-auto p-2 rounded-2xl shadow-2xl border border-border bg-popover text-popover-foreground space-y-2.5 text-xs"
          >
            {/* 1. Response style section */}
            <div>
              <div className="px-2 pt-1 pb-1.5 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">
                Phong cách phản hồi
              </div>
              <div className="space-y-0.5">
                {RESPONSE_STYLES.map((style) => {
                  const isSelected = activeStyle.id === style.id
                  const StyleIcon = style.icon
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => {
                        updateAiSettings.mutate(
                          { profile: { style: style.prompt } },
                          {
                            onSuccess: () => {
                              toast.success(`Đã đổi phong cách: ${style.name}`)
                            }
                          }
                        )
                        setOpenPreferencesMenu(false)
                      }}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer group',
                        isSelected ? 'bg-accent/80 text-foreground font-medium' : 'hover:bg-accent/60 text-foreground'
                      )}
                    >
                      <span
                        className={cn(
                          'w-7 h-7 flex items-center justify-center shrink-0 rounded-lg transition-colors',
                          isSelected
                            ? 'bg-primary/10 text-primary'
                            : 'bg-accent/50 text-foreground/80 group-hover:text-primary'
                        )}
                      >
                        <StyleIcon size={14} strokeWidth={1.8} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-semibold text-foreground leading-tight truncate">
                          {style.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5 max-w-[200px]">
                          {style.description}
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

                {/* Custom style option if user defined custom prompt in Profile settings */}
                {activeStyle.id === 'custom' && (
                  <div className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-accent/80 text-foreground font-medium">
                    <span className="w-7 h-7 flex items-center justify-center shrink-0 rounded-lg bg-primary/10 text-primary">
                      <UserRound size={14} strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-semibold text-foreground leading-tight">
                        Tùy chỉnh riêng
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5 max-w-[200px]">
                        {activeStyle.description}
                      </div>
                    </div>
                    <span className="w-4 h-4 rounded-full bg-[#e05d38] text-white flex items-center justify-center shrink-0 ml-1">
                      <Check size={10} strokeWidth={3} />
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Who answers section */}
            <div className="pt-2 border-t border-border/40">
              <div className="px-2 pt-0.5 pb-1.5 flex items-baseline justify-between">
                <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Chế độ phản hồi
                </span>
              </div>
              <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-accent/60">
                <span className="w-7 h-7 flex items-center justify-center shrink-0 rounded-lg bg-primary/10 text-primary">
                  <Bot size={15} strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold text-foreground leading-tight">N7AI Solo</div>
                  <div className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                    Trả lời tiêu chuẩn
                  </div>
                </div>
                <span className="w-4 h-4 rounded-full bg-[#e05d38] text-white flex items-center justify-center shrink-0 ml-1">
                  <Check size={10} strokeWidth={3} />
                </span>
              </div>
              <p className="px-2 pt-1 text-[10.5px] text-muted-foreground/70 italic">
                Chưa có bạn học hay subagent chuyển giao
              </p>
            </div>

            {/* 3. Footer row: Every turn & Personalization link */}
            <div className="pt-2 border-t border-border/40 px-1 flex justify-between items-center text-xs">
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
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
                href="/n7ai/settings/profile"
                onClick={() => setOpenPreferencesMenu(false)}
                className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <span>Cá nhân hóa</span>
                <ArrowUpRight size={11} strokeWidth={2} />
              </Link>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

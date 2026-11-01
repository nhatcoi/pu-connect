'use client'

import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, Loader2, Mic, Pencil, Plug, Reply, Shapes, Wand2, X } from 'lucide-react'
import { toast } from 'sonner'
import { CHAT_MAX_REFS, type AiConnectorId, type AiMode, type AiSkill, type AiSuggestion, type ChatRef, type ConversationSummary } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import { trackSuggestionClick, useConnectorPrefs, useTypingEmitter, type Draft, type UiMessage } from '@/hooks/chat'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { useQuoteStore } from '../quotes/quote-store'
import { AiModelPicker } from '../ai/ai-model-picker'
import { AI_MODE_META } from '../ai/ai-modes'
import { useQueryClient } from '@tanstack/react-query'
import { SourceChips } from '@/components/n7ai/sources/source-chips'
import { attachSuggestionCollection } from '@/components/n7ai/sources/ask-n7ai'
import { AiSuggestionPanel } from '../ai/ai-suggestion-panel'
import { messagePreview } from '../utils'
import { ComposerTray } from './composer-tray'
import { ComposerLead, type LeadToken } from './composer-lead'
import { ComposerResources } from './composer-resources'
import { AttachmentTray } from './attachment-tray'
import { ContextChips } from './context-chips'
import { DropHint } from './drop-hint'
import { PickerPopover, pickerOptionId } from './picker-popover'
import { PlusMenu } from './plus-menu'
import { SkillsDialog } from './skills-dialog'
import { ATTACHMENT_ACCEPT } from './attachment-files'
import { useAttachmentUpload } from './use-attachment-upload'
import { useChatFileDrop } from './use-file-drop'
import { useComposerPicker, type PickerItem } from './use-composer-picker'

const CONNECTOR_DISPLAY_NAMES: Record<string, string> = {
  library: 'Thư viện PU',
  my_documents: 'Tài liệu của tôi',
  my_study: 'Góc học tập',
  my_chats: 'Đoạn chat của tôi',
  web_search: 'Tìm kiếm web',
  web: 'Tìm kiếm web',
  google_drive: 'Google Drive',
  google_calendar: 'Google Calendar'
}

export type ComposerHandle = { prefill: (text: string) => void }

export type ComposerCommand = 'new' | 'reset'

interface ComposerProps {
  conversationId: string
  conversation: ConversationSummary | undefined
  disabled?: boolean
  placeholder: string
  replyTo: UiMessage | null
  editing: UiMessage | null
  onCancelContext: () => void
  onSend: (draft: Draft) => void
  onEdit: (id: string, content: string) => void
  handleRef?: React.Ref<ComposerHandle>
  // N7AI: chế độ học do trang giữ (màn trống cũng đổi gợi ý theo chế độ)
  aiMode?: AiMode
  onAiModeChange?: (mode: AiMode) => void
  suggestOnModeChange?: boolean // đã có tin ⇒ chọn chế độ mở bảng gợi ý trên ô soạn
  onCommand?: (command: ComposerCommand) => void // "/new", "/reset" (thread N7AI)
}

// Ô soạn tin: văn bản + đính kèm (chọn / dán / kéo thả), trả lời, sửa tin
// "@" nhắc tên / gắn ngữ cảnh · "/" chế độ học, skill, lệnh · "+" tệp, skill, connector, Research
export function Composer({
  conversationId,
  conversation,
  disabled,
  placeholder,
  replyTo,
  editing,
  onCancelContext,
  onSend,
  onEdit,
  handleRef,
  aiMode = 'ask',
  onAiModeChange,
  suggestOnModeChange,
  onCommand
}: ComposerProps) {
  const isAi = conversation?.type === 'ai'
  const aiTools = isAi || conversation?.type === 'group' // hỏi được N7AI
  const myId = useAppStore((s) => s.user?.id)
  const [text, setText] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const [refs, setRefs] = useState<ChatRef[]>([])
  const quotes = useQuoteStore((s) => s.quotes)
  const focusTick = useQuoteStore((s) => s.focusTick)
  const [skill, setSkill] = useState<AiSkill | null>(null)
  const [selectedConnectors, setSelectedConnectors] = useState<AiConnectorId[]>([])
  const [everyTurn, setEveryTurn] = useState(false)
  const [groupMode, setGroupMode] = useState<AiMode | null>(null) // nhóm: chế độ qua "/" (1 lần)
  const [research, setResearch] = useState(false)
  const [skillsDialog, setSkillsDialog] = useState<{ open: boolean; create: boolean }>({ open: false, create: false })
  const { connectors, toggle: toggleConnector } = useConnectorPrefs()

  const toggleSelectedConnector = useCallback((id: AiConnectorId) => {
    setSelectedConnectors((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }, [])
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const listId = useId()
  const typing = useTypingEmitter(conversationId)
  const uploads = useAttachmentUpload()
  const dragging = useChatFileDrop(!editing && !disabled, uploads.add, uploads.attach)

  const addRef = useCallback(
    (r: ChatRef) => {
      if (refs.some((x) => x.type === r.type && x.id === r.id)) return
      if (refs.length >= CHAT_MAX_REFS) return void toast.error(`Tối đa ${CHAT_MAX_REFS} ngữ cảnh mỗi tin`)
      setRefs([...refs, r])
    },
    [refs]
  )

  const changeMode = useCallback(
    (m: AiMode) => {
      onAiModeChange?.(m)
      setPanelOpen(!!suggestOnModeChange && m !== 'ask')
    },
    [onAiModeChange, suggestOnModeChange]
  )

  const [leadWidth, setLeadWidth] = useState(0)

  const leadTokens = useMemo<LeadToken[]>(() => {
    if (!isAi || editing) return []
    const tokens: LeadToken[] = []
    if (aiMode !== 'ask') {
      tokens.push({
        key: `mode:${aiMode}`,
        icon: AI_MODE_META[aiMode]?.icon ?? Shapes,
        label: AI_MODE_META[aiMode]?.label ?? aiMode,
        kind: 'Mode',
        onRemove: () => changeMode('ask')
      })
    }
    if (skill) {
      tokens.push({
        key: `skill:${skill.id}`,
        icon: Wand2,
        label: skill.name,
        kind: 'Skill',
        onRemove: () => setSkill(null)
      })
    }
    for (const cId of selectedConnectors) {
      tokens.push({
        key: `connector:${cId}`,
        icon: Plug,
        label: CONNECTOR_DISPLAY_NAMES[cId] ?? cId,
        kind: 'Connector',
        onRemove: () => setSelectedConnectors((prev) => prev.filter((x) => x !== cId))
      })
    }
    return tokens
  }, [isAi, editing, aiMode, skill, selectedConnectors, changeMode, setSkill, setSelectedConnectors])

  // Mục chọn từ menu "@" / "/" (trừ nhắc tên — đã chèn vào chữ)
  const onPick = useCallback(
    (item: Exclude<PickerItem, { kind: 'user' }>) => {
      switch (item.kind) {
        case 'ref':
          return addRef({ type: item.ref.type, id: item.ref.id, title: item.ref.title, ...(item.ref.code ? { code: item.ref.code } : {}) })
        case 'mode':
          return isAi ? changeMode(item.mode) : setGroupMode(item.mode === 'ask' ? null : item.mode)
        case 'skill':
          return setSkill(item.skill)
        case 'command':
          return item.command === 'create-skill' ? setSkillsDialog({ open: true, create: true }) : onCommand?.(item.command)
      }
    },
    [addRef, isAi, changeMode, onCommand]
  )

  const picker = useComposerPicker({ textareaRef: ref, text, setText, conversation, myId, chosenRefs: refs, onPick })

  // "+ Gắn ngữ cảnh": chèn "@" tại con trỏ ⇒ mở menu gợi ý
  const startContextPick = () => {
    const el = ref.current
    const caret = el?.selectionStart ?? text.length
    const before = text.slice(0, caret)
    const token = before && !/\s$/.test(before) ? ' @' : '@'
    setText(before + token + text.slice(caret))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(caret + token.length, caret + token.length)
      picker.sync()
    })
  }

  React.useImperativeHandle(handleRef, () => ({
    prefill: (value) => {
      setText(value)
      ref.current?.focus()
    }
  }))

  // Vào chế độ sửa ⇒ nạp nội dung cũ; trả lời ⇒ focus
  useEffect(() => {
    if (editing) setText(editing.content)
    if (editing || replyTo) ref.current?.focus()
  }, [editing, replyTo])

  // Nhận ngữ cảnh chuyển sang từ trang khác ("Hỏi N7AI về bài viết"): gắn chip + điền sẵn câu hỏi (chưa gửi)
  const aiHandoff = useAppStore((s) => s.aiHandoff)
  const setAiHandoff = useAppStore((s) => s.setAiHandoff)
  useEffect(() => {
    if (!isAi || !aiHandoff) return
    setRefs([aiHandoff.ref])
    setText(aiHandoff.prompt)
    setAiHandoff(null)
    requestAnimationFrame(() => {
      const el = ref.current
      el?.focus()
      el?.setSelectionRange(el.value.length, el.value.length)
    })
  }, [isAi, aiHandoff, setAiHandoff])

  // Thread N7AI: đăng ký ô soạn để trình xem tài liệu hiện nút "Hỏi N7AI"; đổi / rời thread ⇒ bỏ đoạn trích đang chờ
  useEffect(() => (isAi ? useQuoteStore.getState().mountComposer() : undefined), [isAi, conversationId])
  // Vừa thêm đoạn trích từ panel tài liệu ⇒ đưa con trỏ vào ô soạn để gõ câu hỏi
  const seenFocus = useRef(focusTick)
  useEffect(() => {
    if (focusTick === seenFocus.current) return
    seenFocus.current = focusTick
    if (isAi) ref.current?.focus()
  }, [focusTick, isAi])

  // Tự giãn chiều cao theo nội dung (tối đa ~6 dòng)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [text])

  const canSend = !disabled && !uploads.uploading && (text.trim().length > 0 || (!editing && uploads.ready.length > 0))

  const submit = () => {
    if (!canSend) return
    const content = text.trim()
    if (editing) {
      if (content !== editing.content) onEdit(editing.id, content)
    } else {
      onSend({
        content,
        attachments: uploads.ready,
        replyTo,
        aiMode: isAi ? aiMode : (groupMode ?? undefined),
        refs,
        quotes: isAi && quotes.length ? quotes : undefined,
        skill: skill && { id: skill.id, slug: skill.slug, name: skill.name },
        research: aiTools && research,
        connectors: selectedConnectors.length > 0 ? selectedConnectors : undefined
      })
      uploads.clear()
      setPanelOpen(false)
      // Ngữ cảnh dùng 1 lần; Skill & Connectors giữ lại nếu bật Every turn; Research giữ trong thread AI
      setRefs([])
      useQuoteStore.getState().clear()
      if (!everyTurn) {
        setSkill(null)
        setSelectedConnectors([])
      }
      setGroupMode(null)
      if (!isAi) setResearch(false)
    }
    setText('')
    onCancelContext()
    typing.stop()
  }

  const queryClient = useQueryClient()
  // Bấm gợi ý trong bảng ⇒ gửi ngay theo chế độ của gợi ý
  const pickSuggestion = async (s: AiSuggestion) => {
    trackSuggestionClick('panel', s)
    await attachSuggestionCollection(queryClient, conversationId, s.collection)
    onSend({ content: s.text, aiMode: s.mode })
    setPanelOpen(false)
  }

  const onPaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files)
    if (files.length && !editing) {
      e.preventDefault()
      uploads.add(files)
    }
  }

  const contextBar = editing ? (
    <ContextBar
      icon={<Pencil className="h-3.5 w-3.5" />}
      title="Đang sửa tin nhắn"
      body={messagePreview(editing)}
      onClose={() => {
        setText('')
        onCancelContext()
      }}
    />
  ) : replyTo ? (
    <ContextBar
      icon={<Reply className="h-3.5 w-3.5" />}
      title={`Trả lời ${replyTo.sender?.displayName ?? ''}`}
      body={messagePreview(replyTo)}
      onClose={onCancelContext}
    />
  ) : null

  return (
    <div
      className="sticky bottom-14 md:bottom-0 z-20 bg-surface/95 backdrop-blur-md px-3 sm:px-1 pt-2 pb-2.5"
    >
      {dragging && <DropHint />}
      {isAi && !editing && panelOpen && <AiSuggestionPanel mode={aiMode} onPick={pickSuggestion} onClose={() => setPanelOpen(false)} />}
      <div className={cn('relative rounded-2xl sm:rounded-[24px] border border-border/80 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-4px_rgba(0,0,0,0.06)] px-3 py-2.5 sm:px-4 sm:py-3 transition-shadow', dragging && 'ring-2 ring-primary ring-offset-2 ring-offset-surface')}>
        {picker.open && (
          <PickerPopover
            id={listId}
            sections={picker.sections}
            index={picker.index}
            isLoading={picker.isLoading}
            onHover={picker.setIndex}
            onSelect={picker.select}
          />
        )}
        {contextBar}
        {!editing && (
          <ContextChips
            refs={refs}
            onRemoveRef={(r) => setRefs((prev) => prev.filter((x) => !(x.type === r.type && x.id === r.id)))}
            quotes={isAi ? quotes : []}
            onRemoveQuote={useQuoteStore.getState().remove}
            skill={isAi ? null : skill}
            onClearSkill={() => setSkill(null)}
            mode={isAi ? null : groupMode}
            onClearMode={() => setGroupMode(null)}
            research={!isAi && research}
            onClearResearch={() => setResearch(false)}
          />
        )}
        {isAi && !editing && <SourceChips threadId={conversationId} />}
        <AttachmentTray files={uploads.files} onRemove={uploads.remove} />
        
        {/* Input area */}
        <div className="relative w-full">
          {leadTokens.length > 0 && (
            <ComposerLead tokens={leadTokens} onWidth={setLeadWidth} />
          )}
          <textarea
            ref={ref}
            rows={1}
            value={text}
            maxLength={4000}
            placeholder={
              editing
                ? placeholder
                : (skill?.inputHint ?? (isAi ? (aiMode === 'ask' ? 'How can I help you today?' : (AI_MODE_META[aiMode]?.placeholder ?? 'How can I help you today?')) : placeholder))
            }
            onPaste={onPaste}
            onChange={(e) => {
              setText(e.target.value)
              if (!isAi) typing.onInput()
            }}
            onSelect={picker.sync}
            onBlur={picker.close}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={picker.open}
            aria-controls={picker.open ? listId : undefined}
            aria-activedescendant={picker.open && picker.sections.length ? pickerOptionId(listId, picker.index) : undefined}
            onKeyDown={(e) => {
              if (picker.onKeyDown(e)) return
              // Backspace khi ô nhập rỗng xóa lead token cuối cùng
              if (e.key === 'Backspace' && !text.length && leadTokens.length > 0) {
                e.preventDefault()
                leadTokens[leadTokens.length - 1].onRemove()
                return
              }
              // Enter gửi, Shift+Enter xuống dòng (bỏ qua khi đang gõ dấu IME); Esc hủy trả lời/sửa
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                submit()
              } else if (e.key === 'Escape' && (editing || replyTo)) {
                if (editing) setText('')
                onCancelContext()
              }
            }}
            style={{
              textIndent: leadWidth > 0 ? `${leadWidth + 8}px` : undefined,
              transition: 'text-indent 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            className="w-full resize-none bg-transparent text-sm sm:text-[15px] outline-none py-1.5 min-h-[44px] max-h-40 leading-relaxed text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* DeepTutor Internal Actions Row */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5">
            {!editing && (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  hidden
                  accept={ATTACHMENT_ACCEPT}
                  onChange={(e) => {
                    if (e.target.files) uploads.add(e.target.files)
                    e.target.value = ''
                  }}
                />
                {isAi ? (
                  <ComposerResources
                    disabled={disabled}
                    onUploadFile={() => fileInput.current?.click()}
                    onAddContext={startContextPick}
                    selectedCount={refs.length + uploads.files.length + (skill ? 1 : 0)}
                    onPickSkill={setSkill}
                    onManageSkills={() => setSkillsDialog({ open: true, create: false })}
                    research={research}
                    onToggleResearch={() => setResearch((v) => !v)}
                  />
                ) : (
                  <PlusMenu
                    disabled={disabled}
                    aiTools={aiTools}
                    connectorsEnabled={isAi}
                    onUpload={() => fileInput.current?.click()}
                    onAddContext={startContextPick}
                    onPickSkill={setSkill}
                    onManageSkills={() => setSkillsDialog({ open: true, create: false })}
                    connectors={connectors}
                    onToggleConnector={toggleConnector}
                    research={research}
                    onToggleResearch={() => setResearch((v) => !v)}
                  />
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {isAi && !editing && <AiModelPicker />}
            {isAi && (
              <button
                type="button"
                title="Ghi âm giọng nói"
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/60 transition-colors cursor-pointer"
              >
                <Mic size={16} strokeWidth={1.9} />
              </button>
            )}
            <Button
              size="icon"
              className={cn(
                'h-8 w-8 rounded-full shrink-0 shadow-xs cursor-pointer transition-all duration-200',
                canSend
                  ? 'bg-[#e05d38] hover:bg-[#d0532f] text-white dark:bg-[#e05d38] dark:hover:bg-[#d0532f]'
                  : 'bg-muted/40 text-muted-foreground/40 hover:bg-muted/40 cursor-not-allowed'
              )}
              disabled={!canSend}
              onClick={submit}
              aria-label="Gửi"
            >
              {uploads.uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4 stroke-[2.5]" />
              )}
            </Button>
          </div>
        </div>

        {/* DeepTutor-style Bottom Tray */}
        {isAi && !editing && (
          <ComposerTray
            mode={aiMode}
            onModeChange={changeMode}
            onOpenSkills={() => setSkillsDialog({ open: true, create: false })}
            connectors={selectedConnectors}
            onToggleConnector={toggleSelectedConnector}
            onSelectConnectors={setSelectedConnectors}
            selectedSkill={skill}
            onSelectSkill={setSkill}
            everyTurn={everyTurn}
            onToggleEveryTurn={setEveryTurn}
            disabled={disabled}
          />
        )}
      </div>
      <SkillsDialog open={skillsDialog.open} startWithCreate={skillsDialog.create} onOpenChange={(open) => setSkillsDialog((s) => ({ ...s, open }))} />
    </div>
  )
}

function ContextBar({ icon, title, body, onClose }: { icon: React.ReactNode; title: string; body: string; onClose: () => void }) {
  return (
    <div className="flex items-center gap-2 mx-1 mt-0.5 mb-1.5 pl-2.5 border-l-2 border-primary">
      <span className="text-primary shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-primary">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{body}</p>
      </div>
      <button type="button" onClick={onClose} aria-label="Hủy" className="p-1 text-muted-foreground hover:text-foreground cursor-pointer">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

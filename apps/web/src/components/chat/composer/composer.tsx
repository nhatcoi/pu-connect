'use client'

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Loader2, Pencil, Reply, SendHorizontal, X } from 'lucide-react'
import { toast } from 'sonner'
import { CHAT_MAX_REFS, type AiMode, type AiSkill, type AiSuggestion, type ChatRef, type ConversationSummary } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import { trackSuggestionClick, useConnectorPrefs, useTypingEmitter, type Draft, type UiMessage } from '@/hooks/chat'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { AiModelPicker } from '../ai/ai-model-picker'
import { AI_MODE_META } from '../ai/ai-modes'
import { AiSuggestionPanel } from '../ai/ai-suggestion-panel'
import { messagePreview } from '../utils'
import { AiModeBar } from './ai-mode-bar'
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
  const [skill, setSkill] = useState<AiSkill | null>(null)
  const [groupMode, setGroupMode] = useState<AiMode | null>(null) // nhóm: chế độ qua "/" (1 lần)
  const [research, setResearch] = useState(false)
  const [skillsDialog, setSkillsDialog] = useState<{ open: boolean; create: boolean }>({ open: false, create: false })
  const { connectors, toggle: toggleConnector } = useConnectorPrefs()
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
        skill: skill && { id: skill.id, slug: skill.slug, name: skill.name },
        research: aiTools && research
      })
      uploads.clear()
      setPanelOpen(false)
      // Ngữ cảnh / skill dùng 1 lần; Research giữ trong thread AI (giống Claude), nhóm thì tắt
      setRefs([])
      setSkill(null)
      setGroupMode(null)
      if (!isAi) setResearch(false)
    }
    setText('')
    onCancelContext()
    typing.stop()
  }

  // Bấm gợi ý trong bảng ⇒ gửi ngay theo chế độ của gợi ý
  const pickSuggestion = (s: AiSuggestion) => {
    trackSuggestionClick('panel', s)
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
      {isAi && !editing && <AiModeBar value={aiMode} onChange={changeMode} />}
      <div className={cn('relative rounded-2xl bg-card px-2.5 py-1.5 transition-shadow', dragging && 'ring-2 ring-primary ring-offset-2 ring-offset-surface')}>
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
            skill={skill}
            onClearSkill={() => setSkill(null)}
            mode={groupMode}
            onClearMode={() => setGroupMode(null)}
            research={aiTools && research}
            onClearResearch={() => setResearch(false)}
          />
        )}
        <AttachmentTray files={uploads.files} onRemove={uploads.remove} />
        <div className="flex items-end gap-1.5">
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
            </>
          )}
          <textarea
            ref={ref}
            rows={1}
            value={text}
            maxLength={4000}
            placeholder={editing ? placeholder : (skill?.inputHint ?? (isAi ? AI_MODE_META[aiMode].placeholder : placeholder))}
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
              // Enter gửi, Shift+Enter xuống dòng (bỏ qua khi đang gõ dấu IME); Esc hủy trả lời/sửa
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                submit()
              } else if (e.key === 'Escape' && (editing || replyTo)) {
                if (editing) setText('')
                onCancelContext()
              }
            }}
            className="flex-1 resize-none bg-transparent text-sm outline-none py-1.5 max-h-40"
          />
          {isAi && !editing && <AiModelPicker />}
          <Button size="icon" className="h-8 w-8 rounded-full shrink-0" disabled={!canSend} onClick={submit} aria-label="Gửi">
            {uploads.uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
          </Button>
        </div>
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

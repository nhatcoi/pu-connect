'use client'

import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react'
import type { AiMode, AiSkill, ChatRef, ChatRefSuggestion, ChatRefType, ConversationSummary, MentionCandidate } from '@pu/schemas'
import { useAiSkills, useMembers, useRefSuggestions } from '@/hooks/chat'
import { N7AI_CANDIDATE, getActiveMention, insertMention, matchesCandidate } from '@/lib/mention'
import { AI_MODE_META, AI_MODE_ORDER } from '../ai/ai-modes'

// Menu gợi ý của ô soạn: "@" (người + ngữ cảnh) và "/" (chế độ học, skill, lệnh)
export type PickerCommand = 'new' | 'reset' | 'create-skill'
export type PickerItem =
  | { kind: 'user'; key: string; user: MentionCandidate }
  | { kind: 'ref'; key: string; ref: ChatRefSuggestion }
  | { kind: 'mode'; key: string; mode: AiMode }
  | { kind: 'skill'; key: string; skill: AiSkill }
  | { kind: 'command'; key: string; command: PickerCommand }
export type PickerSection = { title: string; items: PickerItem[] }

type Trigger = { char: '@' | '/'; start: number; end: number; query: string }

export const ALL_CANDIDATE: MentionCandidate = { id: 'all', username: 'all', displayName: 'Cả nhóm', avatarUrl: null, reason: 'other' }
const MAX_PER_SECTION = 6
const SLASH_RE = /^\/([\p{L}\p{N}_-]{0,40})$/u

// "/" chỉ có nghĩa ở đầu tin (giống Slack / Claude)
function detectTrigger(text: string, caret: number): Trigger | null {
  const mention = getActiveMention(text, caret)
  if (mention) return { char: '@', ...mention }
  const slash = SLASH_RE.exec(text.slice(0, caret))
  return slash ? { char: '/', start: 0, end: caret, query: slash[1] } : null
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
const hit = (q: string, ...fields: string[]) => !q || fields.some((f) => fold(f).includes(fold(q)))

interface Options {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  text: string
  setText: (v: string) => void
  conversation: Pick<ConversationSummary, 'id' | 'type' | 'myRole'> | undefined
  myId?: string
  chosenRefs: ChatRef[]
  onPick: (item: Exclude<PickerItem, { kind: 'user' }>) => void
}

export function useComposerPicker({ textareaRef, text, setText, conversation, myId, chosenRefs, onPick }: Options) {
  const [trigger, setTrigger] = useState<Trigger | null>(null)
  const [index, setIndex] = useState(0)
  const [dismissedAt, setDismissedAt] = useState<number | null>(null)
  const kind = conversation?.type
  const open = !!trigger && dismissedAt !== trigger.start && !(trigger.char === '/' && kind === 'direct')

  // Đọc lại token đang gõ mỗi khi nội dung / con trỏ đổi
  const sync = useCallback(() => {
    const el = textareaRef.current
    if (!el || el.selectionStart !== el.selectionEnd) return setTrigger(null)
    setTrigger(detectTrigger(el.value, el.selectionStart))
  }, [textareaRef])
  useEffect(sync, [text, sync])

  const at = open && trigger.char === '@'
  const slash = open && trigger.char === '/'
  const q = trigger?.query ?? ''

  // Nguồn dữ liệu: thành viên (đã cache, lọc tại client), ngữ cảnh (server), skill (cache 10 phút)
  const { data: members } = useMembers(conversation?.id ?? '', at && kind === 'group')
  // Thread N7AI riêng: thêm hội thoại & bộ Flashcard / Quiz của mình (dữ liệu riêng)
  const refTypes: ChatRefType[] = kind === 'ai' ? ['thread', 'study_set', 'course', 'document', 'post'] : ['course', 'document', 'post']
  const refs = useRefSuggestions(at ? q : null, refTypes)
  const { data: skills } = useAiSkills(slash)

  const sections = useMemo<PickerSection[]>(() => {
    if (!open) return []
    const out: PickerSection[] = []
    if (at) {
      // Nhóm: N7AI + thành viên; chat cá nhân: chỉ @n7ai (hỏi N7AI cho cả hai người)
      if (kind === 'group' || kind === 'direct') {
        const people: MentionCandidate[] = [N7AI_CANDIDATE]
        if (kind === 'group' && conversation?.myRole === 'owner') people.push(ALL_CANDIDATE)
        for (const m of kind === 'group' ? (members ?? []) : []) {
          if (m.id !== myId && !m.isBot) people.push({ id: m.id, username: m.username, displayName: m.displayName, avatarUrl: m.avatarUrl, reason: 'other' })
        }
        const items = people.filter((c) => matchesCandidate(c, q)).slice(0, MAX_PER_SECTION)
        if (items.length) out.push({ title: 'Nhắc tên', items: items.map((user) => ({ kind: 'user', key: `u:${user.username}`, user })) })
      }
      const chosen = new Set(chosenRefs.map((r) => `${r.type}:${r.id}`))
      // Kết quả cũ (keepPreviousData) vẫn lọc theo từ khóa hiện tại ⇒ không nhảy lung tung
      const items = (refs.data ?? []).filter((r) => !chosen.has(`${r.type}:${r.id}`) && r.id !== conversation?.id && hit(q, r.title, r.code ?? ''))
      if (items.length) out.push({ title: 'Gắn ngữ cảnh', items: items.map((ref) => ({ kind: 'ref', key: `r:${ref.type}:${ref.id}`, ref })) })
    }
    if (slash) {
      const modes = AI_MODE_ORDER.filter((m) => hit(q, m, AI_MODE_META[m].label))
      if (modes.length) out.push({ title: 'Chế độ học N7AI', items: modes.map((mode) => ({ kind: 'mode', key: `m:${mode}`, mode })) })
      const own = (skills ?? []).filter((s) => s.enabled && hit(q, s.slug, s.name)).slice(0, MAX_PER_SECTION)
      out.push({ title: 'Skill của bạn', items: own.map((skill) => ({ kind: 'skill', key: `s:${skill.id}`, skill })) })
      const commands: PickerCommand[] = kind === 'ai' ? ['new', 'reset', 'create-skill'] : ['create-skill']
      const cmdItems = commands.filter((c) => hit(q, c, COMMAND_LABEL[c].label))
      out.push({ title: 'Lệnh', items: cmdItems.map((command) => ({ kind: 'command', key: `c:${command}`, command })) })
    }
    return out.filter((s) => s.items.length)
  }, [open, at, slash, kind, q, members, refs.data, skills, chosenRefs, conversation, myId])

  const items = useMemo(() => sections.flatMap((s) => s.items), [sections])
  useEffect(() => setIndex(0), [q, trigger?.char])

  // Thay token đang gõ bằng chuỗi mới, đặt con trỏ sau đó
  const replaceToken = useCallback(
    (replacement: string) => {
      if (!trigger) return
      const next = text.slice(0, trigger.start) + replacement + text.slice(trigger.end)
      const caret = trigger.start + replacement.length
      setText(next)
      setTrigger(null)
      requestAnimationFrame(() => {
        textareaRef.current?.focus()
        textareaRef.current?.setSelectionRange(caret, caret)
      })
    },
    [trigger, text, setText, textareaRef]
  )

  const select = useCallback(
    (item: PickerItem) => {
      if (!trigger) return
      if (item.kind === 'user') {
        const next = insertMention(text, trigger, item.user.username)
        setText(next.text)
        setTrigger(null)
        requestAnimationFrame(() => {
          textareaRef.current?.focus()
          textareaRef.current?.setSelectionRange(next.caret, next.caret)
        })
        return
      }
      replaceToken('') // ngữ cảnh / chế độ / skill thành chip, không để lại chữ
      onPick(item)
    },
    [trigger, text, setText, textareaRef, replaceToken, onPick]
  )

  // true = phím đã được menu xử lý
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!open || !items.length || e.ctrlKey || e.metaKey || e.nativeEvent.isComposing) return false
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const step = e.key === 'ArrowDown' ? 1 : -1
        setIndex((i) => (i + step + items.length) % items.length)
        return true
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        select(items[Math.min(index, items.length - 1)])
        return true
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setDismissedAt(trigger!.start)
        return true
      }
      return false
    },
    [open, items, index, select, trigger]
  )

  return {
    open: open && (items.length > 0 || (at && refs.isFetching)),
    sections,
    index,
    setIndex,
    select,
    onKeyDown,
    sync, // gắn vào onSelect / onClick của textarea
    close: () => setTrigger(null),
    isLoading: at && refs.isFetching && items.length === 0
  }
}

export const COMMAND_LABEL: Record<PickerCommand, { label: string; hint: string }> = {
  new: { label: 'Cuộc trò chuyện mới', hint: '/new' },
  reset: { label: 'Chủ đề mới (quên tin phía trên)', hint: '/reset' },
  'create-skill': { label: 'Tạo skill mới…', hint: 'Lưu chỉ dẫn hay dùng thành lệnh /' }
}

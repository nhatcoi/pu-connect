'use client'

import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { MentionCandidate } from '@pu/schemas'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { N7AI_CANDIDATE, getActiveMention, insertMention, matchesCandidate, type ActiveMention } from '@/lib/mention'

const MAX_ITEMS = 8
const DEBOUNCE_MS = 150

interface Options {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  value: string
  setValue: (v: string) => void
  postId?: string
  // Người trong bài đã có sẵn ở client (hiện ngay, không chờ server)
  context?: MentionCandidate[]
  enabled?: boolean
}

// Gợi ý @mention: N7AI ghim đầu > người trong bài > kết quả server (đang theo dõi, khác)
export function useMentionPicker({ textareaRef, value, setValue, postId, context = [], enabled = true }: Options) {
  const [active, setActive] = useState<ActiveMention | null>(null)
  const [index, setIndex] = useState(0)
  const [dismissedAt, setDismissedAt] = useState<number | null>(null)
  const [debounced, setDebounced] = useState<string | null>(null)

  // Đọc lại từ đang gõ mỗi khi nội dung / con trỏ đổi
  const sync = useCallback(() => {
    const el = textareaRef.current
    if (!el || !enabled || el.selectionStart !== el.selectionEnd) return setActive(null)
    setActive(getActiveMention(el.value, el.selectionStart))
  }, [textareaRef, enabled])

  useEffect(sync, [value, sync])

  const query = active?.query ?? null
  useEffect(() => {
    if (query === null) return setDebounced(null)
    const t = setTimeout(() => setDebounced(query), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  // Esc ẩn picker cho tới khi bắt đầu một @ khác
  const open = !!active && dismissedAt !== active.start

  const remote = useQuery({
    queryKey: queryKeys.mentionSuggest(debounced ?? '', postId ?? null),
    queryFn: async () =>
      (await apiClient<{ data: MentionCandidate[] }>(`/mentions/suggest?q=${encodeURIComponent(debounced ?? '')}${postId ? `&postId=${postId}` : ''}`)).data,
    enabled: open && debounced !== null,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000
  })

  const items = useMemo(() => {
    if (!open) return []
    const q = active!.query
    const seen = new Set<string>()
    const out: MentionCandidate[] = []
    const push = (c: MentionCandidate) => {
      const key = c.username.toLowerCase()
      if (seen.has(key) || out.length >= MAX_ITEMS + 1) return
      seen.add(key)
      out.push(c)
    }
    if (matchesCandidate(N7AI_CANDIDATE, q) || 'n7 ai'.startsWith(q.toLowerCase())) push(N7AI_CANDIDATE)
    context.filter((c) => matchesCandidate(c, q)).forEach(push)
    // Kết quả cũ (keepPreviousData) vẫn lọc theo từ khoá hiện tại để không nhảy lung tung
    ;(remote.data ?? []).filter((c) => matchesCandidate(c, q)).forEach(push)
    return out
  }, [open, active, context, remote.data])

  useEffect(() => setIndex(0), [query])

  const select = useCallback(
    (c: MentionCandidate) => {
      if (!active) return
      const next = insertMention(value, active, c.username)
      setValue(next.text)
      setActive(null)
      requestAnimationFrame(() => {
        const el = textareaRef.current
        el?.focus()
        el?.setSelectionRange(next.caret, next.caret)
      })
    },
    [active, value, setValue, textareaRef]
  )

  // Trả về true nếu phím đã được picker xử lý
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!open || items.length === 0 || e.ctrlKey || e.metaKey) return false
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
        setDismissedAt(active!.start)
        return true
      }
      return false
    },
    [open, items, index, select, active]
  )

  return {
    open: open && (items.length > 0 || remote.isFetching),
    items,
    index,
    setIndex,
    select,
    onKeyDown,
    // Gắn vào onSelect / onClick của textarea để theo dõi con trỏ
    sync,
    close: () => setActive(null),
    isLoading: remote.isFetching && items.length === 0
  }
}

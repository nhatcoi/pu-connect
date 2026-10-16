'use client'

import { useEffect, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AiConnectorId, AiSkill, AiSkillDetail, AiSkillInput, ChatRefType } from '@pu/schemas'
import { queryKeys } from '@/lib/query-keys'
import { chatApi } from './api'

// Công cụ ô soạn tin: skill (menu "/"), connector (menu "+"), gợi ý ngữ cảnh ("@")

// Skill của mình: đổi hiếm ⇒ cache 10 phút, lọc tại client khi gõ "/"
export function useAiSkills(enabled = true) {
  return useQuery({ queryKey: queryKeys.aiSkills, queryFn: chatApi.skills, staleTime: 10 * 60 * 1000, enabled })
}

// Chi tiết (có chỉ dẫn) chỉ tải khi mở form sửa
export function useAiSkill(id: string | null) {
  return useQuery({ queryKey: queryKeys.aiSkill(id ?? ''), queryFn: () => chatApi.skill(id!), enabled: !!id, staleTime: 60 * 1000 })
}

export function useAiSkillActions() {
  const qc = useQueryClient()
  const onError = (err: Error) => toast.error(err.message || 'Không lưu được skill')
  // Server trả bản mới nhất ⇒ ghi thẳng cache danh sách + chi tiết
  const store = (s: AiSkillDetail) => {
    const { instructions: _omit, ...light } = s
    qc.setQueryData<AiSkill[]>(queryKeys.aiSkills, (old) => (old ? [light, ...old.filter((x) => x.id !== s.id)] : [light]))
    qc.setQueryData(queryKeys.aiSkill(s.id), s)
  }
  const create = useMutation({ mutationFn: (body: AiSkillInput) => chatApi.createSkill(body), onSuccess: store, onError })
  const update = useMutation({ mutationFn: ({ id, body }: { id: string; body: AiSkillInput }) => chatApi.updateSkill(id, body), onSuccess: store, onError })
  const remove = useMutation({
    mutationFn: (id: string) => chatApi.deleteSkill(id),
    onSuccess: (_, id) => qc.setQueryData<AiSkill[]>(queryKeys.aiSkills, (old) => old?.filter((s) => s.id !== id)),
    onError
  })
  return { create, update, remove }
}

// Registry connector (tĩnh phía server) ⇒ cache cả phiên
export function useAiConnectors(enabled = true) {
  return useQuery({ queryKey: queryKeys.aiConnectors, queryFn: chatApi.aiConnectors, staleTime: Infinity, enabled })
}

const REF_DEBOUNCE_MS = 150

// Gợi ý ngữ cảnh: debounce, hủy request cũ (signal), giữ kết quả trước trong lúc tải; cùng từ khóa ⇒ dùng cache 60s
export function useRefSuggestions(q: string | null, types: ChatRefType[]) {
  const [debounced, setDebounced] = useState<string | null>(null)
  useEffect(() => {
    if (q === null) return setDebounced(null)
    const t = setTimeout(() => setDebounced(q), REF_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [q])
  const typeKey = types.join(',')
  return useQuery({
    queryKey: queryKeys.chatRefs(debounced ?? '', typeKey),
    queryFn: ({ signal }) => chatApi.refs(debounced ?? '', types, signal),
    enabled: debounced !== null && types.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000
  })
}

// Connector đã bật: tiện ích riêng từng người xem ⇒ localStorage (lỗi / chế độ riêng tư ⇒ mặc định)
const CONNECTORS_KEY = 'pu.ai.connectors'
const DEFAULT_CONNECTORS: AiConnectorId[] = ['library']
export const isDefaultConnectors = (list: AiConnectorId[]) => list.length === 1 && list[0] === DEFAULT_CONNECTORS[0]

export function useConnectorPrefs() {
  const [connectors, setConnectors] = useState<AiConnectorId[]>(DEFAULT_CONNECTORS)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CONNECTORS_KEY) || 'null')
      if (Array.isArray(saved) && saved.length) setConnectors(saved)
    } catch {
      // giữ mặc định
    }
  }, [])
  // Luôn giữ ≥ 1 nguồn (tắt hết = PU AI không có gì để tra)
  const toggle = (id: AiConnectorId) => {
    const next = connectors.includes(id) ? connectors.filter((c) => c !== id) : [...connectors, id]
    if (!next.length) return
    setConnectors(next)
    try {
      localStorage.setItem(CONNECTORS_KEY, JSON.stringify(next))
    } catch {
      // không lưu được vẫn dùng trong phiên
    }
  }
  return { connectors, toggle }
}

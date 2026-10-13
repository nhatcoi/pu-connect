'use client'

import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ConversationSummary, MemberSettingsInput } from '@pu/schemas'
import { uploadFileToR2 } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { useAppStore } from '@/store'
import { chatApi } from './api'
import { patchConversation } from './cache'

export function useConversations() {
  return useQuery({ queryKey: queryKeys.conversations, queryFn: chatApi.list, staleTime: 30 * 1000 })
}

export function useUnreadMessages(): number {
  const userId = useAppStore((s) => s.user?.id)
  const { data } = useQuery({ queryKey: [...queryKeys.conversations, 'unread'], queryFn: chatApi.unread, staleTime: 60 * 1000, enabled: !!userId })
  return data ?? 0
}

export function useConversation(id: string) {
  const qc = useQueryClient()
  return useQuery({
    queryKey: queryKeys.conversation(id),
    queryFn: () => chatApi.get(id),
    // Có sẵn trong danh sách ⇒ hiện ngay
    initialData: () => qc.getQueryData<ConversationSummary[]>(queryKeys.conversations)?.find((c) => c.id === id),
    initialDataUpdatedAt: 0,
    staleTime: 30 * 1000,
    retry: false
  })
}

export function useMembers(id: string, enabled = true) {
  return useQuery({ queryKey: queryKeys.chatMembers(id), queryFn: () => chatApi.members(id), enabled, staleTime: 60 * 1000 })
}

// Thao tác trên hội thoại: cài đặt riêng, đổi tên/ảnh, thêm/xóa thành viên, rời nhóm
export function useConversationActions(id: string) {
  const qc = useQueryClient()
  const onError = (err: Error) => toast.error(err.message || 'Thao tác thất bại')
  const store = (c: ConversationSummary) => {
    qc.setQueryData(queryKeys.conversation(id), c)
    patchConversation(qc, id, () => c)
    void qc.invalidateQueries({ queryKey: queryKeys.conversations, exact: true })
  }

  const settings = useMutation({
    mutationFn: (body: MemberSettingsInput) => chatApi.settings(id, body),
    onSuccess: store,
    onError
  })
  const rename = useMutation({
    mutationFn: (title: string) => chatApi.updateGroup(id, { title }),
    onSuccess: store,
    onError
  })
  // file = ảnh mới (tải lên avatars/ rồi gửi key); null = xóa ảnh nhóm
  const changeAvatar = useMutation({
    mutationFn: async (file: File | null) => {
      const avatarKey = file ? (await uploadFileToR2(file, 'avatars')).key : null
      return chatApi.updateGroup(id, { avatarKey })
    },
    onSuccess: store,
    onError
  })
  const addMembers = useMutation({
    mutationFn: (userIds: string[]) => chatApi.addMembers(id, userIds),
    onSuccess: (members) => qc.setQueryData(queryKeys.chatMembers(id), members),
    onError
  })
  const removeMember = useMutation({
    mutationFn: (userId: string) => chatApi.removeMember(id, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.chatMembers(id) }),
    onError
  })
  const transferOwner = useMutation({
    mutationFn: (userId: string) => chatApi.transferOwner(id, userId),
    onSuccess: (members) => {
      qc.setQueryData(queryKeys.chatMembers(id), members)
      void qc.invalidateQueries({ queryKey: queryKeys.conversation(id) })
    },
    onError
  })
  const leave = useMutation({
    mutationFn: () => chatApi.leave(id),
    onSuccess: () => {
      qc.removeQueries({ queryKey: queryKeys.conversation(id) })
      void qc.invalidateQueries({ queryKey: queryKeys.conversations })
    },
    onError
  })
  return { settings, rename, changeAvatar, addMembers, removeMember, transferOwner, leave }
}

// Mở nhóm chat của nhóm học (server tạo lười) rồi chuyển tới hội thoại
export function useOpenStudyGroupChat() {
  const router = useRouter()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (groupId: string) => chatApi.openStudyGroup(groupId),
    onSuccess: (c) => {
      qc.setQueryData(queryKeys.conversation(c.id), c)
      void qc.invalidateQueries({ queryKey: queryKeys.conversations, exact: true })
      router.push(`/messages/${c.id}`)
    },
    onError: (err: Error) => toast.error(err.message || 'Không mở được nhóm chat')
  })
}

// Tên hiển thị hội thoại
export function conversationTitle(c: ConversationSummary): string {
  if (c.type === 'ai') return 'PU AI'
  if (c.title) return c.title
  return c.members.map((m) => m.displayName).join(', ') || 'Hội thoại'
}

'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/api-client'
import {
  addCommunityDocument,
  askCommunity,
  getCommunityNotify,
  listCommunityDocumentCandidates,
  listCommunityDocuments,
  listCommunityPins,
  openCommunityChat,
  pinCommunityPost,
  removeCommunityDocument,
  setCommunityNotify,
  unpinCommunityPost
} from '@/lib/community-api'
import { queryKeys } from '@/lib/query-keys'
import { refreshConversationLists } from '@/hooks/chat/cache'

export function useCommunityPins(slug: string, enabled = true) {
  return useQuery({ queryKey: queryKeys.communityPins(slug), queryFn: () => listCommunityPins(slug), enabled: enabled && !!slug, staleTime: 60_000 })
}

export function useCommunityPinActions(slug: string) {
  const qc = useQueryClient()
  const done = () => void qc.invalidateQueries({ queryKey: queryKeys.communityPins(slug) })
  const pin = useMutation({
    mutationFn: (postId: string) => pinCommunityPost(slug, postId),
    onSuccess: () => {
      done()
      toast.success('Đã ghim bài')
    },
    onError: (err) => toast.error(errorMessage(err, 'Không ghim được bài'))
  })
  const unpin = useMutation({
    mutationFn: (postId: string) => unpinCommunityPost(slug, postId),
    onSuccess: () => {
      done()
      toast.success('Đã bỏ ghim')
    },
    onError: (err) => toast.error(errorMessage(err, 'Không bỏ ghim được'))
  })
  return { pin, unpin }
}

export function useCommunityDocuments(slug: string, enabled = true) {
  return useQuery({ queryKey: queryKeys.communityDocuments(slug), queryFn: () => listCommunityDocuments(slug), enabled: enabled && !!slug, staleTime: 60_000 })
}

export function useCommunityDocumentCandidates(slug: string, enabled: boolean) {
  return useQuery({ queryKey: [...queryKeys.communityDocuments(slug), 'candidates'], queryFn: () => listCommunityDocumentCandidates(slug), enabled })
}

export function useCommunityDocumentActions(slug: string) {
  const qc = useQueryClient()
  const done = () => void qc.invalidateQueries({ queryKey: queryKeys.communityDocuments(slug) })
  const add = useMutation({
    mutationFn: (documentId: string) => addCommunityDocument(slug, documentId),
    onSuccess: () => {
      done()
      toast.success('Đã chia sẻ tài liệu vào cộng đồng')
    },
    onError: (err) => toast.error(errorMessage(err, 'Không chia sẻ được tài liệu'))
  })
  const remove = useMutation({
    mutationFn: (documentId: string) => removeCommunityDocument(slug, documentId),
    onSuccess: () => {
      done()
      toast.success('Đã gỡ tài liệu khỏi cộng đồng')
    },
    onError: (err) => toast.error(errorMessage(err, 'Không gỡ được tài liệu'))
  })
  return { add, remove }
}

// Chuông thông báo bài mới của cộng đồng (chỉ thành viên)
export function useCommunityNotify(slug: string, isMember: boolean) {
  const qc = useQueryClient()
  const query = useQuery({ queryKey: queryKeys.communityNotify(slug), queryFn: () => getCommunityNotify(slug), enabled: isMember && !!slug, staleTime: 5 * 60_000 })
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => setCommunityNotify(slug, enabled),
    onSuccess: (res) => {
      qc.setQueryData(queryKeys.communityNotify(slug), res)
      toast.success(res.enabled ? 'Đã bật thông báo bài mới' : 'Đã tắt thông báo bài mới')
    },
    onError: (err) => toast.error(errorMessage(err, 'Không đổi được cài đặt thông báo'))
  })
  return { enabled: query.data?.enabled ?? true, toggle }
}

export function useCommunityAsk(slug: string) {
  return useMutation({ mutationFn: (question: string) => askCommunity(slug, question) })
}

// Mở nhóm chat của cộng đồng (server tạo lười) rồi chuyển tới hội thoại
export function useOpenCommunityChat(slug: string) {
  const router = useRouter()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => openCommunityChat(slug),
    onSuccess: (c) => {
      refreshConversationLists(qc)
      router.push(`/messages/${c.id}`)
    },
    onError: (err) => toast.error(errorMessage(err, 'Không mở được nhóm chat'))
  })
}

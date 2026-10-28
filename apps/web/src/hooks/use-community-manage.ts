'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { CommunityRole, UpdateCommunityInput } from '@pu/schemas'
import { errorMessage } from '@/lib/api-client'
import {
  createCommunity,
  hideCommunityPost,
  listCommunityMembers,
  listHiddenPosts,
  removeCommunityMember,
  setCommunityMemberRole,
  unhideCommunityPost,
  updateCommunity,
  type CreateCommunityInput
} from '@/lib/community-api'
import { queryKeys } from '@/lib/query-keys'

// Tạo cộng đồng: làm mới danh sách (cộng đồng mới ở trạng thái chờ duyệt, chỉ chủ thấy)
export function useCreateCommunity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateCommunityInput) => createCommunity(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.communities })
  })
}

export function useUpdateCommunity(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateCommunityInput) => updateCommunity(slug, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.communityAll(slug) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.communities })
      toast.success('Đã lưu thay đổi')
    },
    onError: (err) => toast.error(errorMessage(err, 'Không lưu được thay đổi'))
  })
}

export function useCommunityMembers(slug: string, q: string, enabled: boolean) {
  return useQuery({ queryKey: queryKeys.communityMembers(slug, q), queryFn: () => listCommunityMembers(slug, q), enabled, staleTime: 15_000 })
}

export function useMemberActions(slug: string) {
  const queryClient = useQueryClient()
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['community-members', slug] })
    void queryClient.invalidateQueries({ queryKey: queryKeys.communityAll(slug) })
  }
  const onError = (err: unknown) => toast.error(errorMessage(err, 'Thao tác không thành công'))
  return {
    setRole: useMutation({
      mutationFn: (v: { userId: string; role: Exclude<CommunityRole, 'owner'> }) => setCommunityMemberRole(slug, v.userId, v.role),
      onSuccess: refresh,
      onError
    }),
    remove: useMutation({
      mutationFn: (userId: string) => removeCommunityMember(slug, userId),
      onSuccess: () => {
        refresh()
        toast.success('Đã xóa thành viên')
      },
      onError
    })
  }
}

export function useHiddenPosts(slug: string, enabled: boolean) {
  return useQuery({ queryKey: queryKeys.communityHidden(slug), queryFn: () => listHiddenPosts(slug), enabled, staleTime: 15_000 })
}

// Ẩn / khôi phục bài: làm mới bảng tin cộng đồng và danh sách bài đã ẩn
export function useHidePostActions(slug: string) {
  const queryClient = useQueryClient()
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.communityAll(slug) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.communityHidden(slug) })
  }
  const onError = (err: unknown) => toast.error(errorMessage(err, 'Thao tác không thành công'))
  return {
    hide: useMutation({
      mutationFn: (v: { postId: string; reason?: string }) => hideCommunityPost(slug, v.postId, v.reason),
      onSuccess: () => {
        refresh()
        toast.success('Đã ẩn bài viết')
      },
      onError
    }),
    unhide: useMutation({
      mutationFn: (postId: string) => unhideCommunityPost(slug, postId),
      onSuccess: () => {
        refresh()
        toast.success('Đã khôi phục bài viết')
      },
      onError
    })
  }
}

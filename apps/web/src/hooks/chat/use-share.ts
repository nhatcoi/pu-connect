'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { SharePostInput } from '@pu/schemas'
import { chatApi } from './api'
import { refreshConversationLists } from './cache'

// Chia sẻ bài viết vào chat; xong ⇒ làm mới danh sách hội thoại (tin cuối, DM mới mở)
// Share a post into chats, then refresh conversation lists
export function useSharePost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SharePostInput) => chatApi.sharePost(body),
    onSuccess: () => refreshConversationLists(qc)
  })
}

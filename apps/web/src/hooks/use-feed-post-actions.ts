'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { PostItem } from '@pu/schemas'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { patchPostEverywhere } from '@/lib/post-cache'

export function useFeedPostActions(post: PostItem) {
  const qc = useQueryClient()
  const [pending, setPending] = useState(false)
  const toggle = async (kind: 'like' | 'bookmark') => {
    if (pending) return
    setPending(true)
    const field = kind === 'like' ? 'isLikedByMe' : 'isBookmarkedByMe'
    const before = post[field]
    const delta = before ? -1 : 1
    patchPostEverywhere(qc, post.id, (p) => ({ ...p, [field]: !before, ...(kind === 'like' ? { likesCount: Math.max(0, p.likesCount + delta) } : {}) }))
    try {
      await apiClient(`/posts/${post.id}/${kind}`, { method: 'POST' })
      if (kind === 'bookmark') void qc.invalidateQueries({ queryKey: ['feed', 'bookmarks'] })
    } catch {
      patchPostEverywhere(qc, post.id, (p) => ({ ...p, [field]: before, ...(kind === 'like' ? { likesCount: Math.max(0, p.likesCount - delta) } : {}) }))
      toast.error('Không thể cập nhật bài viết, vui lòng thử lại')
    } finally {
      setPending(false)
    }
  }
  const share = async () => {
    const url = `${window.location.origin}/post/${post.id}`
    try {
      if (navigator.share) await navigator.share({ title: post.title || 'Bài viết PU Connector', url })
      else {
        await navigator.clipboard.writeText(url)
        toast.success('Đã sao chép liên kết')
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) toast.error('Không thể chia sẻ liên kết')
    }
  }
  return { toggle, share, pending }
}

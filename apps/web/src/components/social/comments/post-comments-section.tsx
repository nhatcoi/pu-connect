'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useComments } from '@/hooks/use-comments'
import { useAppStore } from '@/store'
import { CommentListSkeleton } from '@/components/skeletons/comment-skeleton'
import { CommentComposer } from './comment-composer'
import { CommentItemCard } from './comment-item-card'
import { Button } from '@/components/ui/button'
import { Loader2, MessageSquare, ChevronDown } from 'lucide-react'
import type { MentionCandidate, PostItem } from '@pu/schemas'
import { N7AI_USERNAME } from '@/lib/mention'

interface PostCommentsSectionProps {
  post: PostItem
  isOpen: boolean
  highlightCommentId?: string | null
  // Báo tổng số bình luận thực tế cho bộ đếm trên PostCard
  onCountChange?: (count: number) => void
}

export function PostCommentsSection({ post, isOpen, highlightCommentId, onCountChange }: PostCommentsSectionProps) {
  const user = useAppStore((state) => state.user)
  const {
    comments,
    isLoading,
    isLoadingMore,
    hasMore,
    remainingCount,
    totalCount,
    isLoaded,
    fetchMoreComments,
    addComment,
    toggleLike,
    acceptSolution,
    editComment,
    deleteComment
  } = useComments(post.id, isOpen)

  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({})
  // Bình luận gốc vừa gửi trong phiên này: nổi lên đầu để người gửi thấy ngay (thứ tự lưu trên server không đổi)
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const [freshIds, setFreshIds] = useState<string[]>([])

  // Hiển thị 2 cấp: mọi phản hồi gom về bình luận gốc (dữ liệu cũ có thể sâu hơn)
  const { topLevelComments, repliesByRoot, rootOf } = useMemo(() => {
    const byId = new Map(comments.map((c) => [c.id, c]))
    const rootOf = (id: string) => {
      let cur = byId.get(id)
      for (let i = 0; cur?.parentId && byId.has(cur.parentId) && i < 50; i++) cur = byId.get(cur.parentId)
      return cur?.id ?? id
    }
    const repliesByRoot = new Map<string, typeof comments>()
    for (const c of comments) {
      if (!c.parentId) continue
      const root = rootOf(c.id)
      repliesByRoot.set(root, [...(repliesByRoot.get(root) ?? []), c])
    }
    for (const list of repliesByRoot.values()) list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const roots = comments.filter((c) => !c.parentId)
    const fresh = freshIds.map((id) => roots.find((c) => c.id === id)).filter((c): c is (typeof roots)[number] => !!c)
    const rest = roots.filter((c) => !freshIds.includes(c.id))
    return { topLevelComments: [...fresh, ...rest], repliesByRoot, rootOf }
  }, [comments, freshIds])

  // Người trong bài cho gợi ý @mention: tác giả trước, rồi người bình luận (mới nhất trước)
  const mentionContext = useMemo<MentionCandidate[]>(() => {
    const out = new Map<string, MentionCandidate>()
    const add = (
      a: { id: string; username: string; displayName?: string | null; avatarUrl?: string | null } | undefined,
      reason: MentionCandidate['reason']
    ) => {
      if (!a?.username || a.id === user?.id || a.username === N7AI_USERNAME || out.has(a.username)) return
      out.set(a.username, { id: a.id, username: a.username, displayName: a.displayName || a.username, avatarUrl: a.avatarUrl, reason })
    }
    add(post.author, 'author')
    for (let i = comments.length - 1; i >= 0; i--) add(comments[i].author, 'participant')
    return [...out.values()]
  }, [post.author, comments, user?.id])

  useEffect(() => {
    if (isOpen && isLoaded) onCountChange?.(totalCount)
  }, [isOpen, isLoaded, totalCount, onCountChange])

  // Gửi bình luận gốc ⇒ đưa lên đầu, nháy viền ngắn và giữ khung nhìn ở form
  const submitRoot = async (text: string, media?: string[], anonymous?: boolean) => {
    const created = await addComment(text, undefined, media, anonymous)
    if (created) {
      setFreshIds((prev) => [created.id, ...prev])
      setHighlighted(created.id)
      setTimeout(() => setHighlighted((cur) => (cur === created.id ? null : cur)), 2000)
    }
    return created
  }

  // Gửi phản hồi ⇒ mở luồng của bình luận gốc để thấy ngay
  const submitReply = async (text: string, parentId: string, media?: string[], anonymous?: boolean) => {
    const created = await addComment(text, parentId, media, anonymous)
    if (created) setExpandedReplies((prev) => ({ ...prev, [rootOf(parentId)]: true }))
    return created
  }
  const handledHighlight = useRef<string | null>(null)

  // Mở từ thông báo: mở phản hồi chứa bình luận đích, cuộn tới và nháy viền 3s
  useEffect(() => {
    if (!isOpen || !highlightCommentId || handledHighlight.current === highlightCommentId) return
    const target = comments.find((c) => c.id === highlightCommentId)
    if (!target) {
      // Bình luận đích chưa có trong trang đã tải ⇒ tải thêm (dừng khi hết)
      if (hasMore && !isLoading && !isLoadingMore) fetchMoreComments()
      return
    }
    handledHighlight.current = target.id
    if (target.parentId) setExpandedReplies((prev) => ({ ...prev, [rootOf(target.id)]: true }))
    setHighlighted(target.id)
    // Chạy một lần cho mỗi bình luận đích (không hủy khi deps đổi sau đó)
    setTimeout(() => {
      document.getElementById(`comment-${target.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
    setTimeout(() => setHighlighted(null), 3000)
  }, [isOpen, highlightCommentId, comments, hasMore, isLoading, isLoadingMore, fetchMoreComments, rootOf])

  if (!isOpen) return null

  const isPostAuthor = !!post.isMine || user?.id === post.authorId || user?.id === post.author?.id
  const isQaPost = post.postType === 'qa'

  const toggleReplies = (commentId: string) => {
    setExpandedReplies((prev) => ({
      ...prev,
      [commentId]: !prev[commentId]
    }))
  }

  return (
    <div className="border-t border-border/40 bg-muted/[0.03] pt-3 pb-2 space-y-3">
      {/* Top Comment Input Box */}
      <CommentComposer
        onSubmit={submitRoot}
        postId={post.id}
        mentionContext={mentionContext}
        draftKey={`comment:${post.id}`}
        placeholder={isQaPost ? 'Nhập lời giải hoặc gợi ý giải bài tập...' : 'Viết câu trả lời hoặc thảo luận của bạn...'}
      />

      {/* Comments List */}
      <div className="space-y-3 pt-2">
        {isLoading ? (
          <CommentListSkeleton />
        ) : topLevelComments.length > 0 ? (
          <>
            {topLevelComments.map((comment) => {
              const replies = repliesByRoot.get(comment.id) ?? []
              const areRepliesExpanded = !!expandedReplies[comment.id]

              return (
                <div key={comment.id} className="space-y-2">
                  <CommentItemCard
                    comment={comment}
                    isHighlighted={highlighted === comment.id}
                    isPostAuthor={isPostAuthor}
                    isQaPost={isQaPost}
                    currentUserId={user?.id}
                    onLikeToggle={toggleLike}
                    onAcceptSolution={acceptSolution}
                    onDeleteComment={deleteComment}
                    onEditComment={editComment}
                    onReplySubmit={submitReply}
                    mentionContext={mentionContext}
                  />

                  {/* Toggle nested replies */}
                  {replies.length > 0 && (
                    <div className="pl-9 ml-2">
                      <button
                        type="button"
                        onClick={() => toggleReplies(comment.id)}
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-1"
                      >
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${areRepliesExpanded ? 'rotate-180' : ''}`} />
                        <span>{areRepliesExpanded ? 'Thu gọn phản hồi' : `Xem ${replies.length} phản hồi`}</span>
                      </button>

                      {/* Render nested replies if expanded */}
                      {areRepliesExpanded && (
                        <div className="pl-3 border-l-2 border-border/60 space-y-2 mt-1">
                          {replies.map((reply) => (
                            <CommentItemCard
                              key={reply.id}
                              comment={reply}
                              isHighlighted={highlighted === reply.id}
                              isPostAuthor={isPostAuthor}
                              isQaPost={isQaPost}
                              currentUserId={user?.id}
                              onLikeToggle={toggleLike}
                              onAcceptSolution={acceptSolution}
                              onDeleteComment={deleteComment}
                              onEditComment={editComment}
                              onReplySubmit={submitReply}
                              mentionContext={mentionContext}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Load more comments button */}
            {hasMore && (
              <div className="pt-2 text-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={fetchMoreComments}
                  disabled={isLoadingMore}
                  className="h-8 rounded-full px-4 text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted cursor-pointer"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      <span>Đang nạp thêm bình luận...</span>
                    </>
                  ) : (
                    <span>Xem thêm {remainingCount > 0 ? `${remainingCount} ` : ''}bình luận khác</span>
                  )}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-xl">
            <MessageSquare className="h-6 w-6 mx-auto mb-1.5 opacity-40" />
            <span>Chưa có câu trả lời nào. Hãy là người đầu tiên tham gia thảo luận!</span>
          </div>
        )}
      </div>
    </div>
  )
}

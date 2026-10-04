'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useComments } from '@/hooks/use-comments'
import { useAppStore } from '@/store'
import { CommentComposer } from './comment-composer'
import { CommentItemCard } from './comment-item-card'
import { Button } from '@/components/ui/button'
import { Loader2, MessageSquare, ChevronDown } from 'lucide-react'
import type { PostItem } from '@pu/schemas'

interface PostCommentsSectionProps {
  post: PostItem
  isOpen: boolean
  highlightCommentId?: string | null
}

export function PostCommentsSection({ post, isOpen, highlightCommentId }: PostCommentsSectionProps) {
  const user = useAppStore((state) => state.user)
  const {
    comments,
    isLoading,
    isLoadingMore,
    hasMore,
    remainingCount,
    fetchMoreComments,
    addComment,
    toggleLike,
    acceptSolution,
    deleteComment
  } = useComments(post.id, isOpen)

  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({})
  const [highlighted, setHighlighted] = useState<string | null>(null)
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
    if (target.parentId) setExpandedReplies((prev) => ({ ...prev, [target.parentId as string]: true }))
    setHighlighted(target.id)
    // Chạy một lần cho mỗi bình luận đích (không hủy khi deps đổi sau đó)
    setTimeout(() => {
      document.getElementById(`comment-${target.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
    setTimeout(() => setHighlighted(null), 3000)
  }, [isOpen, highlightCommentId, comments, hasMore, isLoading, isLoadingMore, fetchMoreComments])

  if (!isOpen) return null

  const isPostAuthor = user?.id === post.authorId || user?.id === post.author?.id
  const isQaPost = post.postType === 'qa'

  // Separate top-level comments and child replies
  const topLevelComments = comments.filter((c) => !c.parentId)
  const getChildReplies = (parentId: string) => comments.filter((c) => c.parentId === parentId)

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
        onSubmit={(text, media) => addComment(text, undefined, media)}
        placeholder={
          isQaPost
            ? 'Nhập lời giải hoặc gợi ý giải bài tập...'
            : 'Viết câu trả lời hoặc thảo luận của bạn...'
        }
      />

      {/* Comments List */}
      <div className="space-y-3 pt-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-6 gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-foreground" />
            <span>Đang tải các thảo luận...</span>
          </div>
        ) : topLevelComments.length > 0 ? (
          <>
            {topLevelComments.map((comment) => {
              const replies = getChildReplies(comment.id)
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
                    onReplySubmit={(text, parentId, media) => addComment(text, parentId, media)}
                  />

                  {/* Toggle nested replies */}
                  {replies.length > 0 && (
                    <div className="pl-9 ml-2">
                      <button
                        type="button"
                        onClick={() => toggleReplies(comment.id)}
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-1"
                      >
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${areRepliesExpanded ? 'rotate-180' : ''}`}
                        />
                        <span>
                          {areRepliesExpanded
                            ? 'Thu gọn phản hồi'
                            : `Xem ${replies.length} phản hồi`}
                        </span>
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
                              onReplySubmit={(text, parentId, media) => addComment(text, parentId, media)}
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

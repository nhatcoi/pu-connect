'use client'

import React, { useState } from 'react'
import { CheckCircle2, BarChart2, Loader2 } from 'lucide-react'
import type { PollData } from '@pu/schemas'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface PostPollCardProps {
  postId: string
  poll: PollData
  onPollUpdated?: (updatedPoll: PollData) => void
}

export function PostPollCard({ postId, poll: initialPoll, onPollUpdated }: PostPollCardProps) {
  const [poll, setPoll] = useState<PollData>(initialPoll)
  const [isVoting, setIsVoting] = useState(false)

  const hasVoted = Boolean(poll.myVotedOptionId)
  const totalVotes = poll.totalVotes || 0

  const handleVote = async (optionId: string) => {
    if (isVoting) return
    setIsVoting(true)
    try {
      const res = await apiClient<{ success: boolean; data: PollData }>(`/posts/${postId}/vote-poll`, {
        method: 'POST',
        body: JSON.stringify({ optionId })
      })

      if (res && res.data) {
        setPoll(res.data)
        onPollUpdated?.(res.data)
      }
    } catch {
      toast.error('Không thể thực hiện bình chọn')
    } finally {
      setIsVoting(false)
    }
  }

  return (
    <div className="my-3.5 rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <BarChart2 className="h-4 w-4 text-primary" />
          <span>{poll.question}</span>
        </div>
        <span className="text-[11px] text-muted-foreground font-medium">{totalVotes} lượt bình chọn</span>
      </div>

      <div className="space-y-2">
        {poll.options.map((option) => {
          const isSelected = poll.myVotedOptionId === option.id
          const percentage = totalVotes > 0 ? Math.round((option.votesCount / totalVotes) * 100) : 0

          return (
            <button
              key={option.id}
              onClick={() => handleVote(option.id)}
              disabled={isVoting}
              className={cn(
                'group relative w-full overflow-hidden rounded-lg border p-2.5 text-left transition-all duration-200 cursor-pointer',
                isSelected
                  ? 'border-primary/60 bg-primary/5 text-primary font-medium'
                  : 'border-border/60 bg-background/50 hover:border-border hover:bg-muted/40 text-foreground'
              )}
            >
              {/* Progress bar fill if voted or someone voted */}
              {hasVoted && (
                <div
                  className={cn('absolute top-0 bottom-0 left-0 transition-all duration-500', isSelected ? 'bg-primary/20' : 'bg-muted/80')}
                  style={{ width: `${percentage}%` }}
                />
              )}

              <div className="relative z-10 flex items-center justify-between text-xs sm:text-sm">
                <div className="flex items-center gap-2 pr-4">
                  {isSelected ? (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border border-muted-foreground/40 shrink-0 group-hover:border-primary" />
                  )}
                  <span className="truncate">{option.optionText}</span>
                </div>

                {hasVoted && (
                  <div className="flex items-center gap-1.5 shrink-0 text-xs font-semibold">
                    <span className="text-muted-foreground font-normal">({option.votesCount})</span>
                    <span>{percentage}%</span>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
        <span>{hasVoted ? '✓ Bạn đã tham gia bình chọn' : 'Nhấp vào phương án để bỏ phiếu'}</span>
        {isVoting && (
          <span className="inline-flex items-center gap-1 text-primary">
            <Loader2 className="h-3 w-3 animate-spin" /> Đang ghi nhận...
          </span>
        )}
      </div>
    </div>
  )
}

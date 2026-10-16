'use client'

import React from 'react'
import { Loader2 } from 'lucide-react'
import type { ConversationSummary } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import { useBlockActions } from '@/hooks/use-blocks'

// DM có quan hệ chặn: thay ô soạn tin bằng lời giải thích (+ bỏ chặn nếu mình chặn)
export function BlockedComposer({ conversation }: { conversation: ConversationSummary }) {
  const { unblock } = useBlockActions()
  const other = conversation.members[0]
  const blocking = conversation.blockState === 'blocking'

  return (
    <div className="sticky bottom-14 md:bottom-0 z-20 bg-surface/95 backdrop-blur-md px-3 sm:px-1 pt-2 pb-2.5">
      <div className="flex flex-col items-center gap-2 rounded-xl bg-card px-4 py-3 text-center">
        <p className="text-xs text-muted-foreground">
          {blocking ? `Bạn đã chặn ${other?.displayName ?? 'người này'}. Hai bạn không thể nhắn tin cho nhau.` : 'Bạn không thể trả lời cuộc trò chuyện này.'}
        </p>
        {blocking && other && (
          <Button size="sm" variant="outline" className="h-7 rounded-full text-xs" disabled={unblock.isPending} onClick={() => unblock.mutate(other.id)}>
            {unblock.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Bỏ chặn'}
          </Button>
        )}
      </div>
    </div>
  )
}

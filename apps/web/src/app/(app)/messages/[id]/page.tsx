'use client'

import React, { useCallback, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { PageAside } from '@/components/layout/page-aside'
import { AiWelcome } from '@/components/chat/ai/ai-welcome'
import { Composer, type ComposerHandle } from '@/components/chat/composer/composer'
import { ConversationInfo } from '@/components/chat/info/conversation-info'
import type { MessageHandlers } from '@/components/chat/thread/message-actions'
import { MessageList } from '@/components/chat/thread/message-list'
import { PinnedBanner } from '@/components/chat/thread/pinned-banner'
import { ThreadHeader } from '@/components/chat/thread/thread-header'
import { chatApi, useConversation, useMarkRead, useMessages, useTypingLabel, type UiMessage } from '@/hooks/chat'
import { useAppStore } from '@/store'

// Màn hội thoại: đầu trang + tin ghim + dòng tin + ô soạn; thông tin ở cột phải (desktop) / hộp thoại (mobile)
export default function ConversationPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const me = useAppStore((s) => s.user)
  const { data: conv, isError } = useConversation(id)
  const chat = useMessages(id)
  const typingLabel = useTypingLabel(id, conv?.members ?? [], me?.id)
  const latest = chat.messages[chat.messages.length - 1]
  useMarkRead(id, latest, me?.id)

  const [replyTo, setReplyTo] = useState<UiMessage | null>(null)
  const [editing, setEditing] = useState<UiMessage | null>(null)
  const [jumpTo, setJumpTo] = useState<string | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const composer = useRef<ComposerHandle>(null)

  const jump = useCallback((messageId: string) => {
    setInfoOpen(false)
    setJumpTo(messageId)
  }, [])
  const clearJump = useCallback(() => setJumpTo(null), [])

  const handlers: MessageHandlers = {
    onReply: (m) => {
      setEditing(null)
      setReplyTo(m)
    },
    onEdit: (m) => {
      setReplyTo(null)
      setEditing(m)
    },
    onReact: chat.react,
    onPin: (m) => chat.pin(m.id),
    onDelete: (m) => {
      if (window.confirm('Thu hồi tin nhắn này với mọi người?')) chat.remove(m.id)
    }
  }

  if (isError) {
    return (
      <div className="py-24 text-center space-y-3 text-muted-foreground">
        <MessageSquare className="h-10 w-10 mx-auto opacity-30" />
        <p className="text-sm font-medium">Không mở được hội thoại này.</p>
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => router.push('/messages')}>
          Về tin nhắn
        </Button>
      </div>
    )
  }

  const isAi = conv?.type === 'ai'
  const resetAi = () => chatApi.aiReset(id).catch((err) => toast.error(err?.message || 'Không làm mới được'))

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      <ThreadHeader conversation={conv} typingLabel={typingLabel} onInfo={() => setInfoOpen(true)} onAiReset={resetAi} />
      <PinnedBanner conversationId={id} onJump={jump} />

      {chat.isLoading ? (
        <div className="flex-1 py-24 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : chat.messages.length === 0 ? (
        <div className="flex-1">
          {isAi ? (
            <AiWelcome onPick={(mode, text) => composer.current?.prefill(text, mode)} />
          ) : (
            <div className="py-16 text-center text-muted-foreground space-y-2">
              <MessageSquare className="h-9 w-9 mx-auto opacity-30" />
              <p className="text-sm">Gửi lời chào đầu tiên 👋</p>
              {conv?.type === 'group' && <p className="text-xs">Gõ @puai trong tin để hỏi PU AI cùng cả nhóm.</p>}
            </div>
          )}
        </div>
      ) : (
        <MessageList
          conversation={conv}
          messages={chat.messages}
          myId={me?.id}
          hasOlder={chat.hasOlder}
          isLoadingOlder={chat.isLoadingOlder}
          loadOlder={chat.loadOlder}
          jumpTo={jumpTo}
          onJumpHandled={clearJump}
          onJump={jump}
          onRetry={chat.retry}
          handlers={handlers}
        />
      )}

      <Composer
        handleRef={composer}
        conversationId={id}
        isAi={isAi}
        disabled={!conv}
        placeholder={conv?.type === 'group' ? 'Nhắn tin… (gõ @puai để hỏi AI)' : 'Nhắn tin…'}
        replyTo={replyTo}
        editing={editing}
        onCancelContext={() => {
          setReplyTo(null)
          setEditing(null)
        }}
        onSend={chat.send}
        onEdit={chat.edit}
      />

      {conv && (
        <>
          <PageAside>
            <ConversationInfo conversation={conv} onJump={jump} />
          </PageAside>
          <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
            <DialogContent className="max-w-md p-0 gap-0 max-h-[90vh] overflow-y-auto">
              <DialogTitle className="sr-only">Thông tin hội thoại</DialogTitle>
              <ConversationInfo conversation={conv} onJump={jump} />
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}

'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import type { AiMode, AiSuggestion } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { PageAside } from '@/components/layout/page-aside'
import { MessageThreadSkeleton } from '@/components/skeletons/chat-skeleton'
import { chatApi, setActiveConversation, trackSuggestionClick, useConversation, useMarkRead, useMessages, useTypingLabel, type UiMessage } from '@/hooks/chat'
import { N7AI_HOME } from '@/lib/n7ai-routes'
import { useAppStore } from '@/store'
import { AiWelcome } from './ai/ai-welcome'
import { BlockedComposer } from './composer/blocked-composer'
import { Composer, type ComposerCommand, type ComposerHandle } from './composer/composer'
import { ConversationInfo } from './info/conversation-info'
import type { MessageHandlers } from './thread/message-actions'
import { MentionJump } from './thread/mention-jump'
import { MessageList } from './thread/message-list'
import { PinnedBanner } from './thread/pinned-banner'
import { ThreadHeader } from './thread/thread-header'

interface ConversationViewProps {
  id: string
  // Không mở được ⇒ nút quay về
  backHref: string
  // Tin cần cuộn tới khi mở (vd. từ Thư viện N7AI)
  initialJump?: string | null
  // Mobile (không gian N7AI): mở ngăn lịch sử
  onOpenNav?: () => void
  // Thread rỗng vừa có tin đầu tiên (trang /n7ai ⇒ đổi URL sang /n7ai/[id])
  onStarted?: () => void
  // Thread N7AI chat nhanh trong Tin nhắn ⇒ nút mở ở không gian /n7ai
  spaceHref?: string
}

// Màn hội thoại: đầu trang + tin ghim + dòng tin + ô soạn; DM / nhóm có thông tin ở cột phải (desktop) / hộp thoại (mobile)
export function ConversationView({ id, backHref, initialJump = null, onOpenNav, onStarted, spaceHref }: ConversationViewProps) {
  const router = useRouter()
  const me = useAppStore((s) => s.user)
  const { data: conv, isError } = useConversation(id)
  const chat = useMessages(id)
  const typingLabel = useTypingLabel(id, conv?.members ?? [], me?.id)
  const latest = chat.messages[chat.messages.length - 1]
  useMarkRead(id, latest, me?.id)
  // Tin đến hội thoại đang mở không tính "chưa đọc"
  useEffect(() => {
    setActiveConversation(id)
    return () => setActiveConversation(null)
  }, [id])

  const started = chat.messages.length > 0
  useEffect(() => {
    if (started) onStarted?.()
  }, [started, onStarted])

  const [replyTo, setReplyTo] = useState<UiMessage | null>(null)
  const [editing, setEditing] = useState<UiMessage | null>(null)
  const [jumpTo, setJumpTo] = useState<string | null>(initialJump)
  const [infoOpen, setInfoOpen] = useState(false)
  const [aiMode, setAiMode] = useState<AiMode>('ask')
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
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => router.push(backHref)}>
          Quay lại
        </Button>
      </div>
    )
  }

  const isAi = conv?.type === 'ai'
  const resetAi = () => chatApi.aiReset(id).catch((err) => toast.error(err?.message || 'Không làm mới được'))
  const runCommand = (command: ComposerCommand) => (command === 'new' ? router.push(N7AI_HOME) : resetAi())
  // Gợi ý mở đầu ⇒ điền sẵn để sửa; câu hỏi tiếp theo ⇒ gửi ngay
  const pickStarter = (s: AiSuggestion) => {
    trackSuggestionClick('starter', s)
    setAiMode(s.mode)
    composer.current?.prefill(s.text)
  }
  const sendFollowUp = (text: string) => {
    trackSuggestionClick('followup')
    chat.send({ content: text, aiMode: 'ask' })
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <ThreadHeader
        conversation={conv}
        typingLabel={typingLabel}
        backHref={backHref}
        onInfo={() => setInfoOpen(true)}
        onOpenNav={onOpenNav}
        spaceHref={spaceHref}
        onAiReset={resetAi}
      />
      <PinnedBanner conversationId={id} onJump={jump} />

      {chat.isLoading ? (
        <MessageThreadSkeleton />
      ) : !started ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isAi ? (
            <AiWelcome mode={aiMode} onPick={pickStarter} />
          ) : (
            <div className="py-16 text-center text-muted-foreground space-y-2">
              <MessageSquare className="h-9 w-9 mx-auto opacity-30" />
              <p className="text-sm">Gửi lời chào đầu tiên 👋</p>
              {conv?.type === 'group' && <p className="text-xs">Gõ @n7ai trong tin để hỏi N7AI cùng cả nhóm.</p>}
              {conv?.type === 'direct' && <p className="text-xs">Gõ @n7ai trong tin để hỏi N7AI ngay trong cuộc trò chuyện này.</p>}
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
          onFollowUp={isAi ? sendFollowUp : undefined}
        />
      )}

      {conv && (conv.blockState ?? 'none') !== 'none' ? (
        <BlockedComposer conversation={conv} />
      ) : (
        <Composer
          key={id} // đổi hội thoại ⇒ chip / nháp không mang sang
          handleRef={composer}
          conversationId={id}
          conversation={conv}
          onCommand={runCommand}
          disabled={!conv}
          placeholder={
            isAi ? 'Hỏi N7AI… (/ lệnh · @ gắn ngữ cảnh)' : conv?.type === 'group' ? 'Nhắn tin… (@ nhắc tên · / hỏi N7AI)' : 'Nhắn tin… (@n7ai hỏi N7AI · @ gắn ngữ cảnh)'
          }
          replyTo={replyTo}
          editing={editing}
          onCancelContext={() => {
            setReplyTo(null)
            setEditing(null)
          }}
          onSend={chat.send}
          onEdit={chat.edit}
          aiMode={aiMode}
          onAiModeChange={setAiMode}
          suggestOnModeChange={started}
        />
      )}

      <MentionJump key={id} conversation={conv} onJump={jump} />

      {/* Thread N7AI trong /n7ai: lịch sử & thư viện ở thanh bên riêng; chat nhanh (Tin nhắn) có cột thông tin như DM */}
      {conv && (!isAi || spaceHref) && (
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

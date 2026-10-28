'use client'

import React from 'react'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Code, Loader2, MessageCircle, UserPlus } from 'lucide-react'
import type { StudyGroup } from '@pu/schemas'
import { toast } from 'sonner'
import { useOpenStudyGroupChat } from '@/hooks/chat'
import { useAppStore } from '@/store'
import { errorMessage } from '@/lib/api-client'

interface StudyGroupCardProps {
  group: StudyGroup
  // Không truyền ⇒ nút tham gia bị vô hiệu (chỉ xem)
  onJoin?: (groupId: string) => Promise<unknown>
}

export function StudyGroupCard({ group, onJoin }: StudyGroupCardProps) {
  const isFull = group.currentMembersCount >= group.maxMembers
  const userId = useAppStore((state) => state.user?.id)
  const isMember = !!userId && (group.members ?? []).some((m) => m.userId === userId)
  const [isJoining, setIsJoining] = React.useState(false)
  const openChat = useOpenStudyGroupChat()

  const handleJoin = async () => {
    if (!onJoin || isJoining) return
    setIsJoining(true)
    try {
      await onJoin(group.id)
      toast.success(`Đã tham gia ${group.name}`)
    } catch (err) {
      toast.error(errorMessage(err, 'Không thể tham gia nhóm'))
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <Card className="hover:border-primary/50 transition-all hover:shadow-md flex flex-col justify-between">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              {group.courseName && <span className="rounded bg-primary/10 px-1.5 py-0.5 font-bold text-[11px] text-primary">{group.courseName}</span>}
              <span className="text-xs font-semibold text-accent">{group.topic}</span>
            </div>
            <h3 className="font-bold text-sm mt-1 text-foreground leading-snug">{group.name}</h3>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              isFull ? 'bg-muted text-muted-foreground' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {isFull ? 'Đã đủ người' : 'Đang tuyển'}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-1 pb-3 text-xs text-muted-foreground space-y-2.5">
        <p className="line-clamp-2">{group.description}</p>

        {group.techStack && group.techStack.length > 0 && (
          <div className="flex flex-wrap gap-1 items-center">
            <Code className="h-3.5 w-3.5 text-muted-foreground mr-0.5" />
            {group.techStack.map((tech) => (
              <span key={tech} className="rounded border bg-muted/30 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                {tech}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] pt-2 border-t text-muted-foreground">
          <span>
            Trưởng nhóm: <strong className="text-foreground">{group.leaderName}</strong>
          </span>
          <span className="flex items-center gap-1 font-semibold text-foreground">
            <Users className="h-3.5 w-3.5 text-primary" />
            {group.currentMembersCount}/{group.maxMembers} thành viên
          </span>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        {isMember ? (
          // Thành viên ⇒ vào nhóm chat của nhóm học
          <Button size="sm" variant="secondary" disabled={openChat.isPending} onClick={() => openChat.mutate(group.id)} className="w-full text-xs gap-1.5">
            {openChat.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
            <span>Mở nhóm chat</span>
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={isFull || !onJoin || isJoining}
            onClick={handleJoin}
            className="w-full text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>{isFull ? 'Nhóm đã đủ thành viên' : 'Tham gia nhóm'}</span>
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

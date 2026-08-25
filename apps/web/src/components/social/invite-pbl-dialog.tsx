'use client'

import React, { useState } from 'react'
import type { PostItem } from '@pu/schemas'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Users, Send, CheckCircle2, Sparkles, GraduationCap } from 'lucide-react'
import { toast } from 'sonner'

interface InvitePblDialogProps {
  post: PostItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InvitePblDialog({ post, open, onOpenChange }: InvitePblDialogProps) {
  const [selectedGroup, setSelectedGroup] = useState('pbl_default')
  const [inviteMessage, setInviteMessage] = useState(
    `Chào bạn @${post.author?.username || 'user'}, mình thấy bài viết và chuyên môn của bạn rất phù hợp với đồ án PBL của nhóm mình. Mời bạn cùng hợp tác nhé!`
  )
  const [isSending, setIsSending] = useState(false)

  const authorName = post.author?.displayName || post.author?.username || 'Sinh viên'
  const authorInitials = (authorName || 'PU').slice(0, 2).toUpperCase()

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSending(true)

    // Simulate invite sending to PBL team
    await new Promise((resolve) => setTimeout(resolve, 500))

    setIsSending(false)
    toast.success(`Đã gửi lời mời tham gia nhóm đồ án PBL tới @${post.author?.username || 'user'}`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border border-border/80 bg-card rounded-2xl shadow-2xl">
        <div className="p-5 border-b border-border/60 bg-muted/20">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
              <Users className="h-5 w-5" />
              <DialogTitle className="text-base font-bold text-foreground">
                Mời vào nhóm đồ án PBL
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Kết nối và mời sinh viên Phenikaa cùng thực hiện đồ án môn học hoặc nghiên cứu khoa học.
            </DialogDescription>
          </DialogHeader>

          {/* Target Student Preview */}
          <div className="mt-3 flex items-center gap-3 p-2.5 rounded-xl bg-background/80 border border-border/60 text-xs">
            <Avatar className="h-8 w-8 shrink-0 border border-border/50">
              <AvatarImage src={post.author?.avatarUrl || ''} alt={authorName} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px]">
                {authorInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 font-semibold text-foreground truncate">
                <span>{authorName}</span>
                <span className="text-muted-foreground font-normal text-[11px]">
                  @{post.author?.username || 'user'}
                </span>
              </div>
              <p className="text-muted-foreground truncate text-[11px]">
                {post.facultyCode || post.author?.faculty || 'Khoa CNTT'} · {post.courseCode ? `Môn ${post.courseCode}` : 'Sinh viên Đại học Phenikaa'}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSendInvite} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <GraduationCap className="h-3.5 w-3.5 text-primary" />
              <span>Chọn nhóm đồ án / Học phần</span>
            </label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full h-9 rounded-xl border border-border bg-background px-3 text-xs font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
            >
              <option value="pbl_default">
                {post.courseCode ? `Nhóm Đồ án PBL - ${post.courseCode}` : 'Nhóm Đồ án PBL - Phát triển phần mềm'}
              </option>
              <option value="capstone">Đồ án Tốt nghiệp / Khóa luận Capstone</option>
              <option value="research">Nhóm Nghiên cứu Khoa học Sinh viên (NCS)</option>
              <option value="exam_prep">Nhóm Ôn thi học kỳ & Giải đề</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Lời nhắn mời hợp tác</span>
            </label>
            <Textarea
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              rows={3}
              className="text-xs resize-none"
              placeholder="Nhập lời nhắn gửi tới sinh viên..."
            />
          </div>

          <DialogFooter className="pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-full text-xs"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSending}
              className="rounded-full font-bold text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{isSending ? 'Đang gửi...' : 'Gửi lời mời'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

import { z } from 'zod'
import type { AttachedDocument } from './document.schema'

export const CreateCommentSchema = z.object({
  postId: z.string(),
  parentId: z.string().optional(),
  content: z.string().min(1, { message: 'Nội dung bình luận không được để trống' }),
  mediaUrls: z.array(z.string().url()).default([]),
  // Tài liệu đính kèm (bản nháp từ POST /documents/upload hoặc tài liệu công khai có sẵn), tối đa 3
  documentIds: z.array(z.string()).max(3).optional(),
  // Bình luận ẩn danh: người khác thấy "Ẩn danh"
  isAnonymous: z.boolean().default(false)
})

export const CommentItemSchema = z.object({
  id: z.string(),
  postId: z.string(),
  authorId: z.string(),
  parentId: z.string().nullable().optional(),
  content: z.string(),
  mediaUrls: z.array(z.string()).default([]),
  documents: z.array(z.custom<AttachedDocument>()).optional(),
  likesCount: z.number().default(0),
  isSolution: z.boolean().default(false),
  isLikedByMe: z.boolean().default(false),
  // Ẩn danh: author bị che; isMine cho chủ bình luận tự nhận ra
  isAnonymous: z.boolean().default(false),
  isMine: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  // Lần sửa gần nhất (null = chưa sửa)
  editedAt: z.string().nullable().optional(),
  author: z.object({
    id: z.string(),
    username: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable().optional(),
    role: z.string().optional(),
    faculty: z.string().nullable().optional(),
    reputationPoints: z.number().optional()
  })
})

export const UpdateCommentSchema = z.object({
  content: z.string().trim().min(1, { message: 'Nội dung bình luận không được để trống' }).max(10000)
})

// Gợi ý @mention: người trong bài > đang theo dõi > khác
export const MentionCandidateSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable().optional(),
  isVerified: z.boolean().optional(),
  // Lý do gợi ý (hiện dòng phụ)
  reason: z.enum(['author', 'participant', 'following', 'other'])
})

export type CreateCommentInput = z.infer<typeof CreateCommentSchema>
export type CommentItem = z.infer<typeof CommentItemSchema>
export type UpdateCommentInput = z.infer<typeof UpdateCommentSchema>
export type MentionCandidate = z.infer<typeof MentionCandidateSchema>

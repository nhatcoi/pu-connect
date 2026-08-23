import { z } from 'zod'

export const CreateCommentSchema = z.object({
  postId: z.string(),
  parentId: z.string().optional(),
  content: z.string().min(1, { message: 'Nội dung bình luận không được để trống' }),
  mediaUrls: z.array(z.string().url()).default([])
})

export const CommentItemSchema = z.object({
  id: z.string(),
  postId: z.string(),
  authorId: z.string(),
  parentId: z.string().nullable().optional(),
  content: z.string(),
  mediaUrls: z.array(z.string()).default([]),
  likesCount: z.number().default(0),
  isSolution: z.boolean().default(false),
  isLikedByMe: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
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

export type CreateCommentInput = z.infer<typeof CreateCommentSchema>
export type CommentItem = z.infer<typeof CommentItemSchema>

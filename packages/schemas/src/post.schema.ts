import { z } from 'zod'

export const CreatePostSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().min(1, { message: 'Nội dung bài viết không được để trống' }),
  tags: z.array(z.string()).default([]),
  attachedDocumentIds: z.array(z.string()).default([]),
  mediaUrls: z.array(z.string().url()).default([]),
  visibility: z.enum(['public', 'followers', 'private']).default('public')
})

export const PostItemSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  author: z.object({
    id: z.string(),
    username: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable().optional()
  }),
  title: z.string().optional(),
  content: z.string(),
  tags: z.array(z.string()),
  mediaUrls: z.array(z.string()),
  attachedDocumentIds: z.array(z.string()),
  likesCount: z.number().default(0),
  commentsCount: z.number().default(0),
  sharesCount: z.number().default(0),
  isLikedByMe: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string()
})

export type CreatePostInput = z.infer<typeof CreatePostSchema>
export type PostItem = z.infer<typeof PostItemSchema>

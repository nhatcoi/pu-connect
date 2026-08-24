import { z } from 'zod'

export const PostTypeEnum = z.enum(['general', 'qa', 'document', 'group_recruit', 'review'])
export type PostType = z.infer<typeof PostTypeEnum>

export const TargetAudienceEnum = z.enum(['everyone', 'faculty', 'course_members', 'followers'])
export type TargetAudience = z.infer<typeof TargetAudienceEnum>

export const CreatePostSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().min(1, { message: 'Nội dung bài viết không được để trống' }),
  postType: PostTypeEnum.default('general'),
  courseId: z.string().optional(),
  facultyCode: z.string().optional(),
  targetAudience: TargetAudienceEnum.default('everyone'),
  tags: z.array(z.string()).default([]),
  attachedDocumentIds: z.array(z.string()).default([]),
  mediaUrls: z.array(z.string().url()).default([]),
  visibility: z.enum(['public', 'followers', 'private']).default('public'),
  recruitSlotsTotal: z.number().int().nonnegative().optional(),
  recruitSlotsFilled: z.number().int().nonnegative().optional()
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
  postType: PostTypeEnum.default('general'),
  courseId: z.string().nullable().optional(),
  courseCode: z.string().nullable().optional(),
  courseName: z.string().nullable().optional(),
  facultyCode: z.string().nullable().optional(),
  targetAudience: TargetAudienceEnum.default('everyone'),
  isResolved: z.boolean().default(false),
  acceptedCommentId: z.string().nullable().optional(),
  recruitSlotsTotal: z.number().optional(),
  recruitSlotsFilled: z.number().optional(),
  tags: z.array(z.string()),
  mediaUrls: z.array(z.string()),
  attachedDocumentIds: z.array(z.string()),
  likesCount: z.number().default(0),
  commentsCount: z.number().default(0),
  sharesCount: z.number().default(0),
  isLikedByMe: z.boolean().default(false),
  isBookmarkedByMe: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string()
})

export type CreatePostInput = z.infer<typeof CreatePostSchema>
export type PostItem = z.infer<typeof PostItemSchema>


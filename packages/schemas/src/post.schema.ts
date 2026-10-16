import { z } from 'zod'

export const PostTypeEnum = z.enum(['general', 'qa', 'document', 'group_recruit', 'review'])
export type PostType = z.infer<typeof PostTypeEnum>

export const TargetAudienceEnum = z.enum(['everyone', 'faculty', 'course_members', 'followers'])
export type TargetAudience = z.infer<typeof TargetAudienceEnum>

export const PollOptionSchema = z.object({
  id: z.string(),
  pollId: z.string(),
  optionText: z.string(),
  votesCount: z.number().default(0),
  displayOrder: z.number().default(0)
})
export type PollOption = z.infer<typeof PollOptionSchema>

export const PollDataSchema = z.object({
  id: z.string(),
  postId: z.string(),
  question: z.string(),
  totalVotes: z.number().default(0),
  options: z.array(PollOptionSchema),
  myVotedOptionId: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  createdAt: z.string().optional()
})
export type PollData = z.infer<typeof PollDataSchema>

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
  recruitSlotsFilled: z.number().int().nonnegative().optional(),
  pollQuestion: z.string().optional(),
  pollOptions: z.array(z.string()).optional(),
  communityId: z.string().optional(),
  communitySlug: z.string().optional()
})

export const UpdatePostSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().min(1).optional(),
  tags: z.array(z.string()).optional()
})
export type UpdatePostInput = z.infer<typeof UpdatePostSchema>

export const VotePollSchema = z.object({
  optionId: z.string()
})
export type VotePollInput = z.infer<typeof VotePollSchema>

export const ReportPostSchema = z.object({
  reason: z.string().min(1, { message: 'Vui lòng chọn lý do báo cáo' }),
  details: z.string().max(500).optional()
})
export type ReportPostInput = z.infer<typeof ReportPostSchema>

// Bình luận nổi bật hiện ngay dưới bài trên bảng tin (Featured comment preview)
export const FeaturedCommentSchema = z.object({
  id: z.string(),
  content: z.string(),
  likesCount: z.number().default(0),
  repliesCount: z.number().default(0),
  // solution: lời giải Q&A · top: nhiều tương tác nhất · earliest: bài chưa có tương tác
  reason: z.enum(['solution', 'top', 'earliest']),
  createdAt: z.string(),
  author: z.object({
    id: z.string(),
    username: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable().optional()
  })
})
export type FeaturedComment = z.infer<typeof FeaturedCommentSchema>

export const PostItemSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  author: z.object({
    id: z.string(),
    username: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable().optional(),
    role: z.string().optional(),
    faculty: z.string().nullable().optional(),
    reputationPoints: z.number().optional()
  }),
  title: z.string().optional(),
  content: z.string(),
  postType: PostTypeEnum.default('general'),
  courseId: z.string().nullable().optional(),
  courseCode: z.string().nullable().optional(),
  courseName: z.string().nullable().optional(),
  communityId: z.string().nullable().optional(),
  communitySlug: z.string().nullable().optional(),
  communityName: z.string().nullable().optional(),
  facultyCode: z.string().nullable().optional(),
  targetAudience: TargetAudienceEnum.default('everyone'),
  isPinned: z.boolean().default(false),
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
  isAuthorFollowedByMe: z.boolean().default(false),
  poll: PollDataSchema.nullable().optional(),
  featuredComment: FeaturedCommentSchema.nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export type CreatePostInput = z.infer<typeof CreatePostSchema>
export type PostItem = z.infer<typeof PostItemSchema>

// Tóm tắt bài bằng PU AI (POST /posts/:id/summary); cached ⇒ không tốn lượt
export interface PostSummary {
  summary: string
  cached: boolean
}

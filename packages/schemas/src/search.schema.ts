import { z } from 'zod'
import { CourseSchema, type Course } from './course.schema'
import { DocumentItemSchema, type DocumentItem } from './document.schema'
import { PostItemSchema, type PostItem } from './post.schema'
import { StudyGroupSchema, type StudyGroup } from './study-group.schema'

export const SearchTypeSchema = z.enum([
  'all',
  'courses',
  'documents',
  'posts',
  'users',
  'groups'
])

export type SearchType = z.infer<typeof SearchTypeSchema>

export const SearchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Từ khóa tìm kiếm không được để trống'),
  type: SearchTypeSchema.default('all'),
  faculty: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0)
})

export type SearchQueryInput = z.infer<typeof SearchQuerySchema>

export const UserSummarySchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable().optional(),
  faculty: z.string().nullable().optional(),
  role: z.string().default('student'),
  reputationPoints: z.number().default(100),
  academicYear: z.string().nullable().optional(),
  isFollowedByMe: z.boolean().default(false)
})

export type UserSummary = z.infer<typeof UserSummarySchema>

export const SearchResultCountsSchema = z.object({
  courses: z.number().default(0),
  documents: z.number().default(0),
  posts: z.number().default(0),
  users: z.number().default(0),
  groups: z.number().default(0),
  total: z.number().default(0)
})

export type SearchResultCounts = z.infer<typeof SearchResultCountsSchema>

export const SearchResultSchema = z.object({
  query: z.string(),
  type: SearchTypeSchema,
  counts: SearchResultCountsSchema,
  courses: z.array(CourseSchema).default([]),
  documents: z.array(DocumentItemSchema).default([]),
  posts: z.array(PostItemSchema).default([]),
  users: z.array(UserSummarySchema).default([]),
  groups: z.array(StudyGroupSchema).default([])
})

export type SearchResult = z.infer<typeof SearchResultSchema>

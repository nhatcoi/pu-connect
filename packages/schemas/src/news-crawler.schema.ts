import { z } from 'zod'

export const NEWS_CATEGORIES = ['ai', 'security', 'robotics', 'tech', 'general'] as const
export type NewsCategory = (typeof NEWS_CATEGORIES)[number]

export const NEWS_STATUSES = ['pending', 'approved', 'posted', 'rejected'] as const
export type NewsStatus = (typeof NEWS_STATUSES)[number]

export interface NewsSource {
  id: number
  name: string
  url: string
  category: NewsCategory
  enabled: boolean
  lastRunAt: string | null
  itemsCount: number
  createdAt: string
}

export interface NewsArticle {
  id: string
  sourceId: number | null
  sourceName: string
  sourceUrl: string
  title: string
  summary: string
  impact: string
  category: NewsCategory
  status: NewsStatus
  publishedAt: string
  createdAt: string
  postId?: string | null
  postedBy?: string | null
  postedAt?: string | null
}

export interface NewsCrawlerConfig {
  autoPost: boolean
  telegramEnabled: boolean
  telegramBotToken?: string | null
  telegramChatId?: string | null
  defaultBot: string
  aiModel: string
  updatedAt: string
}

export interface NewsOverview {
  stats: {
    totalArticles: number
    pendingArticles: number
    postedArticles: number
    totalSources: number
  }
  sources: NewsSource[]
  articles: NewsArticle[]
  config: NewsCrawlerConfig
  availableBots: { username: string; displayName: string }[]
}

export const NewsSourceInputSchema = z.object({
  name: z.string().trim().min(1, 'Tên nguồn không được để trống').max(100),
  url: z.string().trim().url('URL không hợp lệ'),
  category: z.enum(NEWS_CATEGORIES),
  enabled: z.boolean().default(true)
})
export type NewsSourceInput = z.infer<typeof NewsSourceInputSchema>

export const NewsConfigInputSchema = z.object({
  autoPost: z.boolean().optional(),
  telegramEnabled: z.boolean().optional(),
  telegramBotToken: z.string().trim().optional().nullable(),
  telegramChatId: z.string().trim().optional().nullable(),
  defaultBot: z.string().trim().optional(),
  aiModel: z.string().trim().optional()
})
export type NewsConfigInput = z.infer<typeof NewsConfigInputSchema>

export const NewsArticlePublishSchema = z.object({
  bot: z.string().trim().optional(),
  communitySlug: z.string().trim().optional()
})
export type NewsArticlePublishInput = z.infer<typeof NewsArticlePublishSchema>

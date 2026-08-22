import { z } from 'zod'

export const DocumentTypeSchema = z.enum([
  'pdf',
  'markdown',
  'code',
  'doc',
  'sheet',
  'slides',
  'other'
])

export const CreateDocumentSchema = z.object({
  title: z.string().min(1, { message: 'Tiêu đề tài liệu không được để trống' }).max(200),
  description: z.string().max(1000).optional(),
  type: DocumentTypeSchema,
  fileUrl: z.string().url({ message: 'URL tệp không hợp lệ' }),
  fileSize: z.number().nonnegative(),
  mimeType: z.string(),
  tags: z.array(z.string()).default([]),
  folderId: z.string().optional(),
  visibility: z.enum(['public', 'shared', 'private']).default('public'),
  metadata: z.record(z.any()).optional()
})

export const DocumentItemSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  owner: z.object({
    id: z.string(),
    username: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable().optional()
  }),
  title: z.string(),
  description: z.string().nullable().optional(),
  type: DocumentTypeSchema,
  fileUrl: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
  tags: z.array(z.string()),
  downloadCount: z.number().default(0),
  viewCount: z.number().default(0),
  visibility: z.enum(['public', 'shared', 'private']),
  createdAt: z.string(),
  updatedAt: z.string()
})

export type DocumentType = z.infer<typeof DocumentTypeSchema>
export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>
export type DocumentItem = z.infer<typeof DocumentItemSchema>

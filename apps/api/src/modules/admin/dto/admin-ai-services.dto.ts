import { z } from 'zod'

export const AiServicePatchSchema = z.object({
  enabled: z.boolean().optional(),
  baseUrl: z.string().trim().url().optional(),
  apiKey: z.string().trim().optional(),
  model: z.string().trim().min(1).max(120).optional(),
  maxPages: z.coerce.number().min(1).max(100).optional()
})
export type AiServicePatchDto = z.infer<typeof AiServicePatchSchema>

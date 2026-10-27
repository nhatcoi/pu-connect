import { z } from 'zod'

export const TermBodySchema = z
  .object({
    term: z.string().trim().min(2, 'Từ tối thiểu 2 ký tự').max(80),
    severity: z.enum(['heavy', 'medium', 'light']).default('medium'),
    note: z.string().trim().max(255).optional().nullable()
  })
  .strict()

export const TermImportSchema = z
  .object({
    terms: z.array(z.string().trim().min(2).max(80)).min(1).max(500),
    severity: z.enum(['heavy', 'medium', 'light']).default('medium')
  })
  .strict()

export const TermListSchema = z.object({ q: z.string().trim().max(80).optional() })

export type TermBody = z.infer<typeof TermBodySchema>
export type TermImport = z.infer<typeof TermImportSchema>

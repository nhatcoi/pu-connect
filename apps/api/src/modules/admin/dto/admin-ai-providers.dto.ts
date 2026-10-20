import { z } from 'zod'

// Chỉ type từ @pu/schemas (API không import runtime từ schemas)
const name = z.string().trim().min(1, 'Nhập tên provider').max(60)
// http(s) thôi, không nhúng user:pass vào URL (key đi riêng); bỏ dấu / cuối
const baseUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => {
    try {
      const u = new URL(v)
      return (u.protocol === 'https:' || u.protocol === 'http:') && !u.username && !u.password
    } catch {
      return false
    }
  }, 'URL phải bắt đầu bằng http:// hoặc https:// và không chứa tài khoản')
  .transform((v) => v.replace(/\/+$/, ''))
const apiKey = z.string().trim().min(8, 'API key quá ngắn').max(400)
const modelOverride = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,59}$/, 'Tên model chỉ gồm chữ, số và . _ : / -')
  .nullable()

export const AiProviderCreateBodySchema = z.object({ name, baseUrl, apiKey, modelOverride: modelOverride.optional() })

export const AiProviderPatchBodySchema = z
  .object({ name: name.optional(), baseUrl: baseUrl.optional(), apiKey: apiKey.optional(), modelOverride: modelOverride.optional(), enabled: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, { message: 'Không có gì để cập nhật' })

export const AiProviderMoveBodySchema = z.object({ direction: z.enum(['up', 'down']) })

import type { JsonRecord } from '../native/types'
import { record } from '../native/types'
import type { CapabilityTool } from './types'

export const ok = (data: unknown) => JSON.stringify({ ok: true, ...(data as object) })
export const fail = (error: string) => JSON.stringify({ error })
export const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
export const wordCount = (v: string) => v.split(/\s+/).filter(Boolean).length

/** Model đôi khi gửi mảng dưới dạng chuỗi JSON: chấp nhận cả hai */
export function asList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

/** Các khối ```lang … ``` trong câu trả lời */
export function fences(answer: string): { lang: string; body: string }[] {
  return [...answer.matchAll(/```([\w-]*)[^\n]*\n([\s\S]*?)```/g)].map((m) => ({ lang: m[1].toLowerCase(), body: m[2].trim() }))
}

export function tool(name: string, description: string, properties: Record<string, unknown>, required: string[], run: (args: JsonRecord) => string): CapabilityTool {
  return { schema: { type: 'function', function: { name, description, parameters: { type: 'object', properties, required } } } as CapabilityTool['schema'], run }
}

export { record }

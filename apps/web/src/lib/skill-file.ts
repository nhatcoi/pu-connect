import type { AiSkillInput } from '@pu/schemas'

export const SKILL_FILE_ACCEPT = '.md,.markdown,.txt'
export const SKILL_FILE_MAX_BYTES = 64 * 1024

// Tên → lệnh gợi ý: bỏ dấu, chữ thường, gạch ngang
export const toSlug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

// Đọc tệp skill kiểu SKILL.md: frontmatter (name, description, command|slug, input_hint) + thân = chỉ dẫn
// Không có frontmatter ⇒ tên lấy từ "# tiêu đề" đầu tiên hoặc tên tệp
export function parseSkillFile(text: string, fileName: string): AiSkillInput {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const meta: Record<string, string> = {}
  let body = src
  const fm = /^---\n([\s\S]*?)\n---\n?/.exec(src)
  if (fm) {
    body = src.slice(fm[0].length)
    for (const line of fm[1].split('\n')) {
      const m = /^([\w-]+)\s*:\s*(.*)$/.exec(line)
      if (m) meta[m[1].toLowerCase().replace(/-/g, '_')] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2')
    }
  }
  const heading = /^#\s+(.+)$/m.exec(body)?.[1]?.trim()
  const name = (meta.name || heading || fileName.replace(/\.[^.]+$/, '')).slice(0, 60)
  return {
    name,
    slug: toSlug(meta.command || meta.slug || name),
    description: (meta.description ?? '').slice(0, 200),
    instructions: body.trim(),
    inputHint: (meta.input_hint ?? '').slice(0, 150),
    isPublic: false
  }
}

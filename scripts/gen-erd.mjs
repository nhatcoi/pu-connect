#!/usr/bin/env node
// Sinh ERD Mermaid từ database thật (information_schema) → docs/diagrams/04-erd.md
// Generate Mermaid ERD from the live DB; run after every migration: pnpm docs:erd
import { createRequire } from 'module'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(root, 'apps/api/package.json'))
const { Client } = require('pg')

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://pu_user:pu_password@localhost:5432/pu_connector_db'
const OUT = path.join(root, 'docs/diagrams/04-erd.md')

// Nhóm bảng theo domain để vẽ sơ đồ con dễ đọc
const DOMAINS = {
  'Identity & Social graph': ['users', 'user_follows', 'user_sessions', 'mentions', 'notifications'],
  'Feed & Q&A': ['posts', 'comments', 'post_reactions', 'saved_posts', 'post_reports', 'post_polls', 'post_poll_options', 'post_poll_votes'],
  Communities: ['communities', 'community_members'],
  Academic: ['faculties', 'academic_units', 'courses', 'documents', 'document_chunks', 'post_documents', 'comment_documents', 'library_items', 'library_folders', 'study_groups', 'study_group_members', 'campus_events'],
  Personalization: ['user_events', 'user_interests']
}

function shortType(col) {
  const map = {
    'character varying': 'varchar',
    'timestamp with time zone': 'timestamptz',
    'timestamp without time zone': 'timestamp',
    'double precision': 'float8',
    'USER-DEFINED': col.udt_name,
    ARRAY: `${col.udt_name.replace(/^_/, '')}_array`
  }
  return (map[col.data_type] || col.data_type).replace(/\s+/g, '_')
}

async function main() {
  const db = new Client({ connectionString: DATABASE_URL })
  await db.connect()

  const tables = (
    await db.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`
    )
  ).rows.map((r) => r.table_name)

  const columns = (
    await db.query(
      `SELECT table_name, column_name, data_type, udt_name, is_nullable
       FROM information_schema.columns WHERE table_schema = 'public'
       ORDER BY table_name, ordinal_position`
    )
  ).rows

  const keys = (
    await db.query(
      `SELECT tc.table_name, kcu.column_name, tc.constraint_type
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       WHERE tc.table_schema = 'public' AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY')`
    )
  ).rows

  const fks = (
    await db.query(
      `SELECT con.conrelid::regclass::text AS child, att.attname AS col,
              con.confrelid::regclass::text AS parent, att.attnotnull AS not_null
       FROM pg_constraint con
       JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
       WHERE con.contype = 'f' AND con.connamespace = 'public'::regnamespace
       ORDER BY child, col`
    )
  ).rows
  await db.end()

  const keyOf = (t, c) => {
    const k = new Set(keys.filter((x) => x.table_name === t && x.column_name === c).map((x) => x.constraint_type))
    return [k.has('PRIMARY KEY') && 'PK', k.has('FOREIGN KEY') && 'FK', k.has('UNIQUE') && 'UK'].filter(Boolean).join(',')
  }

  const entity = (t) =>
    `  ${t} {\n` +
    columns
      .filter((c) => c.table_name === t)
      .map((c) => `    ${shortType(c)} ${c.column_name}${keyOf(t, c.column_name) ? ' ' + keyOf(t, c.column_name) : ''}`)
      .join('\n') +
    `\n  }`

  const rel = (f) => `  ${f.parent} ||--o{ ${f.child} : "${f.col}"`
  const relOverview = (f) => `  ${f.parent} ${f.not_null ? '||' : '|o'}--o{ ${f.child} : "${f.col}"`

  const known = new Set(Object.values(DOMAINS).flat())
  const others = tables.filter((t) => !known.has(t))
  const domains = others.length ? { ...DOMAINS, 'Chưa phân nhóm (cập nhật DOMAINS trong scripts/gen-erd.mjs)': others } : DOMAINS

  const lines = []
  lines.push('# 🗄️ ERD — Cơ sở dữ liệu (tự sinh)')
  lines.push('')
  lines.push('> ⚙️ **File tự sinh** bởi `pnpm docs:erd` (`scripts/gen-erd.mjs`) từ database thật. **Không sửa tay.**')
  lines.push('> Chạy lại sau mỗi migration. Nguồn: `information_schema` + `pg_constraint`.')
  lines.push('')
  lines.push(
    `Tổng: **${tables.length} bảng**, **${fks.length} khóa ngoại**. Ký hiệu: \`PK\` khóa chính · \`FK\` khóa ngoại · \`UK\` unique · \`||\` bắt buộc · \`|o\` có thể NULL.`
  )
  lines.push('')
  lines.push('## 1. Tổng quan quan hệ')
  lines.push('')
  lines.push('```mermaid')
  lines.push('erDiagram')
  for (const t of tables) if (!fks.some((f) => f.child === t || f.parent === t)) lines.push(`  ${t} {\n    string no_fk\n  }`)
  for (const f of fks) lines.push(relOverview(f))
  lines.push('```')

  let i = 2
  for (const [name, list] of Object.entries(domains)) {
    const present = list.filter((t) => tables.includes(t))
    if (!present.length) continue
    lines.push('')
    lines.push(`## ${i++}. ${name}`)
    lines.push('')
    lines.push('```mermaid')
    lines.push('erDiagram')
    for (const t of present) lines.push(entity(t))
    for (const f of fks.filter((f) => present.includes(f.child) && present.includes(f.parent))) lines.push(rel(f))
    lines.push('```')
    const cross = fks.filter((f) => present.includes(f.child) !== present.includes(f.parent) && (present.includes(f.child) || present.includes(f.parent)))
    if (cross.length) {
      lines.push('')
      lines.push('Liên kết ra ngoài nhóm: ' + cross.map((f) => `\`${f.child}.${f.col} → ${f.parent}\``).join(', '))
    }
  }

  writeFileSync(OUT, lines.join('\n') + '\n')
  console.log(`ERD: ${tables.length} tables, ${fks.length} FKs → ${path.relative(root, OUT)}`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})

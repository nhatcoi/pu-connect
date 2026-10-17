import type { AdminPage } from '@pu/schemas'
import type { DatabaseService } from '../../database/database.service'
import { parseQuery } from '../search/search-query'

// Gom tham số SQL ($1, $2…) — không bao giờ nối chuỗi giá trị từ client
export class SqlParams {
  readonly values: unknown[] = []
  add(v: unknown): string {
    this.values.push(v)
    return `$${this.values.length}`
  }
}

// Escape ký tự đặc biệt của LIKE
export const likeEscape = (s: string) => s.replace(/[\\%_]/g, '\\$&')

/**
 * Điều kiện tìm kiếm:
 *  - "@abc"  ⇒ username bắt đầu bằng abc (cột `username`)
 *  - còn lại ⇒ full-text `search_tsv` (GIN, không dấu, khớp tiền tố) nếu có,
 *              ngược lại LIKE không dấu trên các cột `like` (index trigram)
 */
export function searchCondition(
  p: SqlParams,
  q: string | undefined,
  cols: { username?: string; tsv?: string; like?: string[] }
): string | null {
  const raw = q?.trim()
  if (!raw) return null
  if (raw.startsWith('@') && cols.username) {
    return `lower(${cols.username}) LIKE ${p.add(`${likeEscape(raw.slice(1).toLowerCase())}%`)}`
  }
  const parts: string[] = []
  const parsed = parseQuery(raw)
  if (cols.tsv && parsed.tsquery) parts.push(`${cols.tsv} @@ to_tsquery('simple', ${p.add(parsed.tsquery)})`)
  if (cols.like?.length) {
    const pat = p.add(`%${likeEscape(raw.toLowerCase())}%`)
    for (const c of cols.like) parts.push(`immutable_unaccent(lower(${c})) LIKE immutable_unaccent(${pat})`)
  }
  return parts.length ? `(${parts.join(' OR ')})` : null
}

export const whereOf = (conds: (string | null | undefined | false)[]) => {
  const list = conds.filter(Boolean) as string[]
  return list.length ? `WHERE ${list.join(' AND ')}` : ''
}

/**
 * Phân trang offset: đếm & lấy trang chạy song song.
 * Cột tính toán nặng đặt trong `select` ⇒ khi ORDER BY khớp index + LIMIT,
 * Postgres chỉ tính cho các dòng của trang.
 */
export async function pagedQuery<T>(
  db: DatabaseService,
  opts: {
    select: string
    from: string
    params: SqlParams
    order: string
    page: number
    pageSize: number
    map: (row: Record<string, any>) => T
    // Bỏ trống ⇒ SELECT COUNT(*) FROM <from>
    countSql?: string
  }
): Promise<AdminPage<T>> {
  const v = opts.params.values
  const offset = (opts.page - 1) * opts.pageSize
  const [rows, count] = await Promise.all([
    db.query(`SELECT ${opts.select} FROM ${opts.from} ORDER BY ${opts.order} LIMIT $${v.length + 1} OFFSET $${v.length + 2}`, [
      ...v,
      opts.pageSize,
      offset
    ]),
    db.query(opts.countSql ?? `SELECT COUNT(*)::int AS n FROM ${opts.from}`, v)
  ])
  return { items: rows.rows.map(opts.map), total: count.rows[0]?.n ?? 0, page: opts.page, pageSize: opts.pageSize }
}

// ORDER BY an toàn từ whitelist + khóa phụ ổn định
export const orderBy = (expr: string, dir: 'asc' | 'desc', tiebreak: string) => {
  const d = dir === 'asc' ? 'ASC' : 'DESC'
  return `${expr} ${d} NULLS LAST, ${tiebreak} ${d}`
}

export const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null)

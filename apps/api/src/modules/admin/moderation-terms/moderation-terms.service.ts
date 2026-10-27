import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { AdminModerationTerm } from '@pu/schemas'
import { DatabaseService } from '../../../database/database.service'
import { writeAudit } from '../admin-audit'
import type { TermBody, TermImport } from './moderation-terms.dto'

const map = (r: { id: string; term: string; severity: string; note: string | null; creator: string | null; created_at: Date }): AdminModerationTerm => ({
  id: r.id,
  term: r.term,
  severity: r.severity as AdminModerationTerm['severity'],
  note: r.note,
  createdBy: r.creator,
  createdAt: new Date(r.created_at).toISOString()
})

@Injectable()
export class ModerationTermsService {
  constructor(private readonly db: DatabaseService) {}

  async list(q?: string): Promise<AdminModerationTerm[]> {
    const res = await this.db.query(
      `SELECT t.id, t.term, t.severity, t.note, t.created_at, u.username AS creator FROM moderation_terms t
       LEFT JOIN users u ON u.id = t.created_by WHERE ($1::text IS NULL OR t.term ILIKE '%' || $1 || '%')
       ORDER BY CASE t.severity WHEN 'heavy' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, lower(t.term) LIMIT 1000`,
      [q || null]
    )
    return res.rows.map(map)
  }

  async create(adminId: string, body: TermBody): Promise<{ id: string }> {
    return this.db.transaction(async (client) => {
      const dup = await client.query(`SELECT 1 FROM moderation_terms WHERE lower(term) = lower($1)`, [body.term])
      if (dup.rows[0]) throw new ConflictException('Từ này đã có trong danh sách')
      const res = await client.query(`INSERT INTO moderation_terms (term, severity, note, created_by) VALUES ($1, $2, $3, $4) RETURNING id`, [body.term, body.severity, body.note || null, adminId])
      await writeAudit(client, adminId, { action: 'moderation_term.create', targetType: 'system', targetId: res.rows[0].id, details: { term: body.term, severity: body.severity } })
      return { id: res.rows[0].id as string }
    })
  }

  async update(adminId: string, id: string, body: TermBody): Promise<{ id: string }> {
    await this.db.transaction(async (client) => {
      const dup = await client.query(`SELECT 1 FROM moderation_terms WHERE lower(term) = lower($1) AND id <> $2`, [body.term, id])
      if (dup.rows[0]) throw new ConflictException('Từ này đã có trong danh sách')
      const res = await client.query(`UPDATE moderation_terms SET term = $2, severity = $3, note = $4 WHERE id = $1 RETURNING id`, [id, body.term, body.severity, body.note || null])
      if (!res.rows[0]) throw new NotFoundException('Không tìm thấy từ')
      await writeAudit(client, adminId, { action: 'moderation_term.update', targetType: 'system', targetId: id, details: { term: body.term, severity: body.severity } })
    })
    return { id }
  }

  async remove(adminId: string, id: string): Promise<{ deleted: true }> {
    await this.db.transaction(async (client) => {
      const res = await client.query(`DELETE FROM moderation_terms WHERE id = $1 RETURNING term`, [id])
      if (!res.rows[0]) throw new NotFoundException('Không tìm thấy từ')
      await writeAudit(client, adminId, { action: 'moderation_term.delete', targetType: 'system', targetId: id, details: { term: res.rows[0].term } })
    })
    return { deleted: true }
  }

  // Dán nhiều từ một lần; từ đã có thì bỏ qua
  async importTerms(adminId: string, input: TermImport): Promise<{ added: number; skipped: number }> {
    const terms = [...new Map(input.terms.map((t) => [t.toLowerCase(), t])).values()]
    return this.db.transaction(async (client) => {
      const res = await client.query(
        `INSERT INTO moderation_terms (term, severity, created_by) SELECT t, $2, $3 FROM unnest($1::text[]) t ON CONFLICT DO NOTHING RETURNING id`,
        [terms, input.severity, adminId]
      )
      const added = res.rowCount ?? 0
      await writeAudit(client, adminId, { action: 'moderation_term.import', targetType: 'system', targetId: 'bulk', details: { added, severity: input.severity } })
      return { added, skipped: input.terms.length - added }
    })
  }
}

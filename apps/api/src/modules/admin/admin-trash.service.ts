import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import { TRASH_RETENTION_DAYS } from '../../database/trash'
import { writeAudit } from './admin-audit'

const RESTORABLE = ['posts', 'comments', 'documents', 'study_sets'] as const
const TITLE_COL: Record<string, string> = { posts: 'title', comments: 'content', documents: 'title', study_sets: 'title' }

// Thùng rác: khôi phục dữ liệu bị xóa (bản sao do trigger trash_row lưu), giữ TRASH_RETENTION_DAYS ngày
@Injectable()
export class AdminTrashService {
  constructor(private readonly db: DatabaseService) {}

  // Mỗi batch = 1 lần xóa; đại diện là dòng đầu (cha) của batch
  async list(table?: string, limit = 50) {
    const res = await this.db.query(
      `SELECT DISTINCT ON (d.batch) d.batch::text, d.table_name, d.row_id, d.deleted_at, d.deleted_by, u.username AS deleted_by_name,
              left(COALESCE(d.data->>'title', d.data->>'content', d.data->>'name'), 120) AS label,
              (SELECT COUNT(*)::int FROM deleted_records x WHERE x.batch = d.batch) AS rows
       FROM deleted_records d LEFT JOIN users u ON u.id = d.deleted_by
       WHERE ($1::text IS NULL OR d.table_name = $1)
       ORDER BY d.batch, d.id
       LIMIT 5000`,
      [table ?? null]
    )
    return res.rows
      .sort((a, b) => +new Date(b.deleted_at) - +new Date(a.deleted_at))
      .slice(0, limit)
      .map((r) => ({ batch: r.batch, table: r.table_name, rowId: r.row_id, label: r.label, rows: r.rows, deletedAt: r.deleted_at, deletedBy: r.deleted_by_name ?? null }))
  }

  // Khôi phục cả batch (cha trước con); dòng đã tồn tại thì bỏ qua
  async restore(adminId: string, batch: string): Promise<{ restored: number }> {
    return this.db.transaction(async (client) => {
      const rows = await client.query(`SELECT id, table_name, data FROM deleted_records WHERE batch = $1 ORDER BY id`, [batch])
      if (!rows.rowCount) throw new NotFoundException('Không có dữ liệu trong thùng rác')
      let restored = 0
      for (const r of rows.rows) {
        if (!(RESTORABLE as readonly string[]).includes(r.table_name)) continue
        await client.query('SAVEPOINT r')
        try {
          // Bỏ cột sinh tự động (vd. search_tsv); table_name đã whitelist ở trên
          const cols = (
            await client.query(`SELECT attname FROM pg_attribute WHERE attrelid = $1::regclass AND attnum > 0 AND NOT attisdropped AND attgenerated = ''`, [r.table_name])
          ).rows
            .map((c) => `"${c.attname}"`)
            .join(', ')
          const ins = await client.query(
            `INSERT INTO ${r.table_name} (${cols}) SELECT ${cols} FROM jsonb_populate_record(NULL::${r.table_name}, $1::jsonb) ON CONFLICT DO NOTHING`,
            [JSON.stringify(r.data)]
          )
          restored += ins.rowCount ?? 0
        } catch {
          await client.query('ROLLBACK TO SAVEPOINT r')
          throw new UnprocessableEntityException(`Không khôi phục được ${r.table_name}: dữ liệu liên quan (tác giả, bài gốc…) không còn`)
        }
      }
      // Khôi phục bài/bình luận ⇒ tính lại bộ đếm
      await client.query(
        `UPDATE posts p SET comments_count = (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id)
         WHERE p.id IN (SELECT (data->>'id')::uuid FROM deleted_records WHERE batch = $1 AND table_name = 'posts'
                        UNION SELECT (data->>'post_id')::uuid FROM deleted_records WHERE batch = $1 AND table_name = 'comments')`,
        [batch]
      )
      await client.query(`DELETE FROM deleted_records WHERE batch = $1`, [batch])
      const head = rows.rows[0]
      await writeAudit(client, adminId, { action: 'trash.restore', targetType: head.table_name === 'comments' ? 'comment' : head.table_name === 'posts' ? 'post' : 'system', targetId: String(head.data?.id ?? batch), details: { batch, table: head.table_name, restored, label: String(head.data?.[TITLE_COL[head.table_name]] ?? '').slice(0, 80) } })
      return { restored }
    })
  }

  // Dọn hẳn bản ghi quá hạn (gọi từ job định kỳ)
  async purgeExpired(): Promise<number> {
    const res = await this.db.query(`DELETE FROM deleted_records WHERE deleted_at < NOW() - make_interval(days => $1)`, [TRASH_RETENTION_DAYS])
    return res.rowCount ?? 0
  }
}

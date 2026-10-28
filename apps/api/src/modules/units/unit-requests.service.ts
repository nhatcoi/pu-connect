import { BadRequestException, Injectable } from '@nestjs/common'
import type { PoolClient } from 'pg'
import type { UnitChoiceInput, UnitKind } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { foldSql, UNIT_TABLE } from './unit-sql'

type Queryable = Pick<PoolClient, 'query'>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const clean = (v: string | null | undefined) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '')

// Lựa chọn trường / lĩnh vực của người dùng: chọn từ danh mục, hoặc "Khác" + tên tự nhập chờ admin duyệt
@Injectable()
export class UnitRequestsService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Áp lựa chọn vào hồ sơ — gọi trong transaction của thao tác sửa hồ sơ / onboarding.
   * Mỗi loại: có *Id ⇒ chọn đơn vị đó; có *Other ⇒ trùng tên đơn vị đã có thì chọn luôn, không thì để trống + tạo yêu cầu chờ duyệt;
   * cả hai trống (null / chuỗi rỗng) ⇒ bỏ chọn. Trường không có mặt trong input ⇒ giữ nguyên.
   */
  async applyChoice(client: Queryable, userId: string, input: UnitChoiceInput): Promise<void> {
    await this.applyKind(client, userId, 'university', input.universityId, input.universityOther)
    await this.applyKind(client, userId, 'field', input.interestFieldId, input.interestFieldOther)
  }

  private async applyKind(client: Queryable, userId: string, kind: UnitKind, id: string | null | undefined, other: string | null | undefined) {
    if (id === undefined && other === undefined) return
    const { table, userColumn } = UNIT_TABLE[kind]
    const label = kind === 'university' ? 'Trường' : 'Lĩnh vực'
    // Body chưa qua zod ở controller hồ sơ ⇒ tự kiểm tra kiểu
    if ((id != null && (typeof id !== 'string' || !UUID.test(id))) || (other != null && typeof other !== 'string')) throw new BadRequestException(`${label} không hợp lệ`)
    const name = clean(other)

    let chosen: string | null = null
    if (id) {
      const res = await client.query(`SELECT id FROM ${table} WHERE id = $1 AND is_active`, [id])
      if (!res.rows[0]) throw new BadRequestException(`${label} không hợp lệ`)
      chosen = res.rows[0].id
    } else if (name) {
      // Tên đã có trong danh mục (người dùng gõ lại) ⇒ chọn luôn, không cần duyệt
      const res = await client.query(`SELECT id FROM ${table} WHERE is_active AND ${foldSql('name')} = ${foldSql('$1::text')}`, [name])
      chosen = res.rows[0]?.id ?? null
    }

    await client.query(`UPDATE users SET ${userColumn} = $2, updated_at = NOW() WHERE id = $1`, [userId, chosen])
    if (chosen || !name) {
      // Đã chọn từ danh mục / bỏ chọn ⇒ hủy yêu cầu đang chờ
      await client.query(`DELETE FROM unit_requests WHERE user_id = $1 AND kind = $2 AND status = 'pending'`, [userId, kind])
      return
    }
    await client.query(
      `INSERT INTO unit_requests (user_id, kind, name) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, kind) WHERE status = 'pending' DO UPDATE SET name = EXCLUDED.name, created_at = NOW()`,
      [userId, kind, name.slice(0, 200)]
    )
  }

  // Tên đã gửi chờ duyệt của một người (điền lại form)
  async pendingNames(userId: string): Promise<{ university: string | null; field: string | null }> {
    const res = await this.db.query(`SELECT kind, name FROM unit_requests WHERE user_id = $1 AND status = 'pending'`, [userId])
    const byKind = new Map<string, string>(res.rows.map((r) => [r.kind, r.name]))
    return { university: byKind.get('university') ?? null, field: byKind.get('field') ?? null }
  }
}

import { BadRequestException, Injectable } from '@nestjs/common'
import type { PoolClient } from 'pg'
import type { UnitChoiceInput, UnitKind } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { foldSql, MAX_INTEREST_FIELDS, UNIT_TABLE } from './unit-sql'

type Queryable = Pick<PoolClient, 'query'>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const clean = (v: string | null | undefined) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '')
const LABEL: Record<UnitKind, string> = { university: 'Trường', field: 'Lĩnh vực' }

// Lựa chọn trường / lĩnh vực của người dùng: chọn từ danh mục, hoặc "Khác" + tên tự nhập chờ admin duyệt.
// Trường: 1 mục. Lĩnh vực quan tâm: tối đa MAX_INTEREST_FIELDS mục (gồm cả "Khác" đang chờ / bị từ chối).
@Injectable()
export class UnitRequestsService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Áp lựa chọn vào hồ sơ — gọi trong transaction của thao tác sửa hồ sơ / onboarding.
   * Mỗi loại: có id(s) ⇒ chọn các đơn vị đó; có *Other ⇒ trùng tên đơn vị đã có thì chọn luôn, không thì tạo yêu cầu chờ duyệt;
   * cả hai trống ⇒ bỏ chọn. Trường không có mặt trong input ⇒ giữ nguyên.
   */
  async applyChoice(client: Queryable, userId: string, input: UnitChoiceInput): Promise<void> {
    await this.applyKind(client, userId, 'university', input.universityId === undefined ? undefined : input.universityId ? [input.universityId] : [], input.universityOther)
    // interestFieldIds (nhiều) ưu tiên; interestFieldId (một) giữ cho client cũ / onboarding
    const fieldIds = input.interestFieldIds !== undefined ? input.interestFieldIds : input.interestFieldId === undefined ? undefined : input.interestFieldId ? [input.interestFieldId] : []
    await this.applyKind(client, userId, 'field', fieldIds, input.interestFieldOther)
  }

  /** Đặt danh sách lĩnh vực quan tâm (id đã hợp lệ) và đồng bộ lĩnh vực chính users.interest_field_id = phần tử đầu */
  async setFieldIds(client: Queryable, userId: string, ids: string[]): Promise<void> {
    await client.query(`DELETE FROM user_interest_fields WHERE user_id = $1 AND NOT (field_id = ANY($2::uuid[]))`, [userId, ids])
    for (const [position, fieldId] of ids.entries()) {
      await client.query(
        `INSERT INTO user_interest_fields (user_id, field_id, position) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, field_id) DO UPDATE SET position = EXCLUDED.position`,
        [userId, fieldId, position]
      )
    }
    await client.query(`UPDATE users SET interest_field_id = $2, updated_at = NOW() WHERE id = $1`, [userId, ids[0] ?? null])
  }

  private async applyKind(client: Queryable, userId: string, kind: UnitKind, rawIds: unknown, other: string | null | undefined) {
    if (rawIds === undefined && other === undefined) return
    const { table, userColumn } = UNIT_TABLE[kind]
    const label = LABEL[kind]
    const max = kind === 'field' ? MAX_INTEREST_FIELDS : 1
    // Body chưa qua zod ở controller hồ sơ ⇒ tự kiểm tra kiểu
    if ((rawIds != null && (!Array.isArray(rawIds) || rawIds.some((v) => typeof v !== 'string' || !UUID.test(v)))) || (other != null && typeof other !== 'string')) {
      throw new BadRequestException(`${label} không hợp lệ`)
    }
    let name = clean(other)

    // Chưa gửi danh sách (chỉ gửi "Khác") ⇒ giữ các lĩnh vực đang chọn
    const ids: string[] =
      rawIds != null
        ? [...new Set(rawIds as string[])]
        : kind === 'field'
          ? (await client.query(`SELECT field_id FROM user_interest_fields WHERE user_id = $1 ORDER BY position`, [userId])).rows.map((r) => r.field_id)
          : []

    if (ids.length) {
      const res = await client.query(`SELECT id FROM ${table} WHERE id = ANY($1::uuid[]) AND is_active`, [ids])
      if (res.rows.length !== ids.length) throw new BadRequestException(`${label} không hợp lệ`)
    }
    if (name) {
      // Tên đã có trong danh mục (người dùng gõ lại) ⇒ chọn luôn, không cần duyệt
      const res = await client.query(`SELECT id FROM ${table} WHERE is_active AND ${foldSql('name')} = ${foldSql('$1::text')}`, [name])
      const existing: string | undefined = res.rows[0]?.id
      if (existing) {
        if (!ids.includes(existing)) ids.push(existing)
        name = ''
      }
    }
    if (ids.length + (name ? 1 : 0) > max) {
      throw new BadRequestException(kind === 'field' ? `Chọn tối đa ${max} lĩnh vực (mục "Khác" cũng tính một chỗ)` : `${label} chỉ chọn được một`)
    }

    if (kind === 'field') await this.setFieldIds(client, userId, ids)
    else await client.query(`UPDATE users SET ${userColumn} = $2, updated_at = NOW() WHERE id = $1`, [userId, ids[0] ?? null])

    if (!name) {
      // Không còn "Khác" ⇒ bỏ yêu cầu hiện hành (đang chờ hoặc đã bị từ chối)
      await client.query(`DELETE FROM unit_requests WHERE user_id = $1 AND kind = $2 AND status <> 'approved'`, [userId, kind])
      return
    }
    // Lưu lại hồ sơ mà vẫn giữ đúng tên đã bị từ chối ⇒ không gửi lại (tránh vòng lặp duyệt / từ chối)
    const rejected = await client.query(
      `SELECT 1 FROM unit_requests WHERE user_id = $1 AND kind = $2 AND status = 'rejected' AND ${foldSql('name')} = ${foldSql('$3::text')}`,
      [userId, kind, name]
    )
    if (rejected.rowCount) return
    await client.query(`DELETE FROM unit_requests WHERE user_id = $1 AND kind = $2 AND status = 'rejected'`, [userId, kind])
    await client.query(
      `INSERT INTO unit_requests (user_id, kind, name) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, kind) WHERE status = 'pending' DO UPDATE SET name = EXCLUDED.name, created_at = NOW()`,
      [userId, kind, name.slice(0, 200)]
    )
  }

  // Tên "Khác" hiện hành (chờ duyệt) của một người (điền lại form)
  async pendingNames(userId: string): Promise<{ university: string | null; field: string | null }> {
    const res = await this.db.query(`SELECT kind, name FROM unit_requests WHERE user_id = $1 AND status = 'pending'`, [userId])
    const byKind = new Map<string, string>(res.rows.map((r) => [r.kind, r.name]))
    return { university: byKind.get('university') ?? null, field: byKind.get('field') ?? null }
  }
}

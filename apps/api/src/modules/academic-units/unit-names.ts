import type { DatabaseService } from '../../database/database.service'

export interface UnitNames {
  school: string | null
  faculty: string | null // tên viết tắt (CNTT, KHMT…)
  major: string | null
}

// Tên trường / khoa / ngành suy ra từ cây đơn vị (view academic_unit_paths); null nếu đơn vị không tồn tại hoặc đã tắt
// Derive display names from the unit tree; null when the unit is missing or inactive
export async function findUnitNames(db: Pick<DatabaseService, 'query'>, unitId: string): Promise<UnitNames | null> {
  const res = await db.query(
    `SELECT p.school, p.faculty, p.major FROM academic_unit_paths p JOIN academic_units a ON a.id = p.id WHERE p.id = $1 AND a.is_active`,
    [unitId]
  )
  return res.rows[0] ? { school: res.rows[0].school, faculty: res.rows[0].faculty, major: res.rows[0].major } : null
}

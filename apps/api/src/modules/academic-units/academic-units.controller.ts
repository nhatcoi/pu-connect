import { Controller, Get, Header } from '@nestjs/common'
import type { AcademicUnit } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'

@Controller('academic-units')
export class AcademicUnitsController {
  constructor(private readonly db: DatabaseService) {}

  // Danh sách phẳng các đơn vị đang dùng (~100 dòng) — client dựng cây và tìm kiếm cục bộ
  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  async list(): Promise<AcademicUnit[]> {
    const res = await this.db.query(
      `SELECT id, parent_id, type, name, short_name FROM academic_units WHERE is_active ORDER BY sort_order, name`
    )
    return res.rows.map((r) => ({ id: r.id, parentId: r.parent_id, type: r.type, name: r.name, shortName: r.short_name }))
  }
}

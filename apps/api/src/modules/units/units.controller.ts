import { Controller, Get, Header } from '@nestjs/common'
import type { UnitCatalog } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'

@Controller('units')
export class UnitsController {
  constructor(private readonly db: DatabaseService) {}

  // Danh mục trường + lĩnh vực đang dùng (vài chục dòng) — form hồ sơ / onboarding / bộ lọc dùng chung
  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  async catalog(): Promise<UnitCatalog> {
    const [universities, fields] = await Promise.all([
      this.db.query(`SELECT id, name FROM universities WHERE is_active ORDER BY sort_order, name`),
      this.db.query(`SELECT id, name FROM interest_fields WHERE is_active ORDER BY sort_order, name`)
    ])
    return { universities: universities.rows, fields: fields.rows }
  }
}

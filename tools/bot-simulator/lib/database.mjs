import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from '../../../apps/api/node_modules/pg/lib/index.js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const DEFAULT_URL = 'postgresql://pu_user:pu_password@localhost:5432/pu_connector_db'

// Đọc DATABASE_URL: env → .env gốc → apps/api/.env → mặc định local
function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  for (const file of [path.join(ROOT, '.env'), path.join(ROOT, 'apps', 'api', '.env')]) {
    if (!fs.existsSync(file)) continue
    const match = fs.readFileSync(file, 'utf8').match(/^DATABASE_URL=(.+)$/m)
    if (match) return match[1].trim()
  }
  return DEFAULT_URL
}

export const databaseUrl = resolveDatabaseUrl()
export const createPool = (max = 3) => new pg.Pool({ connectionString: databaseUrl, max })

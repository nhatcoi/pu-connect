import { readFileSync } from 'fs'
import { join } from 'path'
import { Client } from 'pg'
import { TEST_DATABASE_URL } from './env'

// Thứ tự migration: giữ khớp với scripts/deploy.sh
export const MIGRATIONS = [
  'schema.sql',
  'domain1-upgrade.sql',
  'add-communities.sql',
  'add-indexes.sql',
  'auth-upgrade.sql',
  'messaging-upgrade.sql',
  'notifications-upgrade.sql',
  'push-upgrade.sql',
  'search-upgrade.sql',
  'admin-upgrade.sql',
  'chat-upgrade.sql',
  'ai-upgrade.sql',
  'chat-v2-upgrade.sql',
  'chat-study-group-upgrade.sql'
]

// Tạo lại DB test sạch + chạy toàn bộ migration (1 lần cho cả lượt test)
export default async function globalSetup() {
  const url = new URL(TEST_DATABASE_URL)
  const dbName = url.pathname.slice(1)
  if (!/^[a-z0-9_]+_test$/.test(dbName)) throw new Error(`Từ chối reset DB không phải *_test: ${dbName}`)

  const adminUrl = new URL(TEST_DATABASE_URL)
  adminUrl.pathname = '/postgres'
  const admin = new Client({ connectionString: adminUrl.toString() })
  await admin.connect()
  await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`)
  await admin.query(`CREATE DATABASE ${dbName}`)
  await admin.end()

  const db = new Client({ connectionString: TEST_DATABASE_URL })
  await db.connect()
  for (const file of MIGRATIONS) {
    await db.query(readFileSync(join(__dirname, '../src/database', file), 'utf8'))
  }
  await db.end()
}

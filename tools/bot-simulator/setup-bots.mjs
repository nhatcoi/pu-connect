// Tạo/đồng bộ tài khoản bot trong DB (is_bot = true, không bao giờ là admin).
// Mật khẩu: BOT_PASSWORD (env) nếu có, ngược lại dùng mật khẩu trong personas.json.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from '../../apps/api/node_modules/bcryptjs/index.js'
import { createPool, databaseUrl } from './lib/database.mjs'
import { logger } from './lib/logger.mjs'

const dir = path.dirname(fileURLToPath(import.meta.url))
const personas = JSON.parse(fs.readFileSync(path.join(dir, 'personas.json'), 'utf8'))
const SAFE_ROLES = new Set(['student', 'lecturer', 'ta'])

async function setup() {
  logger.info('Kết nối database để chuẩn bị tài khoản bot...', databaseUrl.replace(/:[^:@]+@/, ':***@'))
  const pool = createPool(1)

  try {
    for (const p of personas) {
      const passwordHash = await bcrypt.hash(process.env.BOT_PASSWORD || p.password, 10)
      await pool.query(
        `INSERT INTO users (id, email, username, password_hash, display_name, role, status, is_onboarded, email_verified, email_verified_at, faculty, bio, is_bot, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'active', true, true, NOW(), $6, $7, true, NOW())
         ON CONFLICT (username) DO UPDATE SET
           password_hash = EXCLUDED.password_hash,
           display_name = EXCLUDED.display_name,
           role = EXCLUDED.role,
           status = 'active',
           email_verified = true,
           is_bot = true`,
        [`${p.username}@seed.pu-connector.test`, p.username, passwordHash, p.displayName, SAFE_ROLES.has(p.role) ? p.role : 'student', p.faculty || 'FIT', p.tone || '']
      )
      logger.success(`Bot @${p.username} sẵn sàng`)
    }
  } finally {
    await pool.end()
  }
}

setup().catch((err) => {
  logger.error('Lỗi thiết lập bot:', err)
  process.exit(1)
})

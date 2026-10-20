import type { PoolClient } from 'pg'

export type AuditTargetType = 'post' | 'comment' | 'user' | 'course' | 'document' | 'ai_ticket' | 'ai_skill' | 'bot' | 'academic_unit' | 'ai_model' | 'system'
export type AuditEntry = { action: string; targetType: AuditTargetType; targetId: string; details?: Record<string, unknown> }

// Ghi nhật ký thao tác admin — luôn chạy trong transaction của thao tác (ACID)
export async function writeAudit(client: PoolClient, adminId: string, entry: AuditEntry) {
  await client.query(`INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)`, [
    adminId,
    entry.action,
    entry.targetType,
    entry.targetId,
    entry.details ? JSON.stringify(entry.details) : null
  ])
}

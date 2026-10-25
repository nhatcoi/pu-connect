import type { PoolClient } from 'pg'

export const TRASH_RETENTION_DAYS = 30

// Gắn người xóa cho trigger thùng rác trash_row (chỉ trong giao dịch hiện tại)
export async function setTrashActor(client: PoolClient, userId: string) {
  await client.query(`SELECT set_config('app.user_id', $1, true)`, [userId])
}

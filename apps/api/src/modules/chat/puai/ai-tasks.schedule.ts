// Lịch tác vụ tự động theo giờ Việt Nam (UTC+7, không đổi giờ mùa hè)
const VN_OFFSET_MS = 7 * 60 * 60 * 1000

export type TaskSchedule = { frequency: 'daily' | 'weekly'; runTime: string; weekday?: number | null }

// Lần chạy kế tiếp sau mốc `after` (mặc định: bây giờ)
export function nextRunAt(schedule: TaskSchedule, after: Date = new Date()): Date {
  const [h, m] = schedule.runTime.split(':').map(Number)
  const local = new Date(after.getTime() + VN_OFFSET_MS) // các trường UTC = giờ VN
  const candidate = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), h, m))
  let addDays = 0
  if (schedule.frequency === 'daily') {
    if (candidate <= local) addDays = 1
  } else {
    addDays = ((schedule.weekday ?? 0) - local.getUTCDay() + 7) % 7
    if (addDays === 0 && candidate <= local) addDays = 7
  }
  candidate.setUTCDate(candidate.getUTCDate() + addDays)
  return new Date(candidate.getTime() - VN_OFFSET_MS)
}

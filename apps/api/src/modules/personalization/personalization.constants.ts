// Cá nhân hóa: hằng số dùng chung (docs/core/06-messaging-and-ai.md §19)

export const PERSONALIZATION_QUEUE = 'personalization'

// Giữ sự kiện thô 90 ngày; hồ sơ quan tâm chỉ nhìn 180 ngày gần nhất
export const EVENT_RETENTION_DAYS = 90
export const SIGNAL_WINDOW_DAYS = 180

// Điểm giảm một nửa sau 14 ngày (Recency decay half-life)
export const HALF_LIFE_DAYS = 14

// Hồ sơ cũ hơn mức này ⇒ tính lại khi cần gợi ý / worker định kỳ
export const PROFILE_TTL_HOURS = 6
export const PROFILE_MAX_TOPICS = 30

// Worker: tính lại cho người hoạt động trong 24h qua, tối đa N người mỗi lượt
export const REFRESH_EVERY_MS = 60 * 60 * 1000
export const PURGE_EVERY_MS = 24 * 60 * 60 * 1000
export const REFRESH_BATCH = 500

// Cờ quyền riêng tư (mặc định bật) / Privacy flag, default on
export const personalizationOnSql = (alias: string) => `COALESCE((${alias}.privacy_settings->>'personalization')::boolean, TRUE)`

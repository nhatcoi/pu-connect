// Từ điển tầng 1: phân mức nặng/vừa/nhẹ. Khớp có dấu là mặc định; dạng không dấu chỉ bật khi khai báo `plain`.

export type ProfanitySeverity = 'heavy' | 'medium' | 'light'
export type ProfanityCategory = 'sexual' | 'abbrev' | 'curse' | 'insult'

export interface LexiconTerm {
  /** Cụm từ có dấu, cách nhau bằng khoảng trắng. */
  term: string
  severity: ProfanitySeverity
  category: ProfanityCategory
  /**
   * Khớp dạng không dấu:
   * - 'always': cụm đủ đặc trưng (dit me, vcl, dmm) — khớp khi mọi token đều không dấu
   * - 'obfuscated': từ ngắn mơ hồ (lon, dit, cac) — chỉ khớp token đã bị lách (l0n, d1t, loooon)
   */
  plain?: 'always' | 'obfuscated'
  /** Bỏ qua khi token đứng ngay trước là số (5 đm = 5 decimet). */
  skipAfterNumber?: boolean
}

export const LEXICON: LexiconTerm[] = [
  // Nặng: tục tĩu tình dục / chửi gia đình
  { term: 'địt mẹ', severity: 'heavy', category: 'sexual', plain: 'always' },
  { term: 'địt con mẹ', severity: 'heavy', category: 'sexual', plain: 'always' },
  { term: 'đụ má', severity: 'heavy', category: 'sexual', plain: 'always' },
  { term: 'đụ mẹ', severity: 'heavy', category: 'sexual', plain: 'always' },
  { term: 'con cặc', severity: 'heavy', category: 'sexual', plain: 'always' },
  { term: 'lồn', severity: 'heavy', category: 'sexual', plain: 'obfuscated' },
  { term: 'địt', severity: 'heavy', category: 'sexual', plain: 'obfuscated' },
  { term: 'đụ', severity: 'heavy', category: 'sexual', plain: 'obfuscated' },
  { term: 'cặc', severity: 'heavy', category: 'sexual', plain: 'obfuscated' },
  { term: 'buồi', severity: 'heavy', category: 'sexual', plain: 'obfuscated' },
  { term: 'đĩ', severity: 'heavy', category: 'insult' },
  { term: 'con điếm', severity: 'heavy', category: 'insult' },

  // Vừa: viết tắt tục, chửi thề
  { term: 'đm', severity: 'medium', category: 'abbrev', skipAfterNumber: true },
  { term: 'đcm', severity: 'medium', category: 'abbrev', plain: 'always' },
  { term: 'đkm', severity: 'medium', category: 'abbrev', plain: 'always' },
  { term: 'dmm', severity: 'medium', category: 'abbrev', plain: 'always' },
  { term: 'vcl', severity: 'medium', category: 'abbrev', plain: 'always' },
  { term: 'vkl', severity: 'medium', category: 'abbrev', plain: 'always' },
  { term: 'clgt', severity: 'medium', category: 'abbrev', plain: 'always' },
  { term: 'cmm', severity: 'medium', category: 'abbrev', plain: 'always' },
  { term: 'clm', severity: 'medium', category: 'abbrev', plain: 'always' },
  { term: 'đéo', severity: 'medium', category: 'curse', plain: 'obfuscated' },
  { term: 'cứt', severity: 'medium', category: 'curse' },
  { term: 'mẹ kiếp', severity: 'medium', category: 'curse' },
  { term: 'khốn nạn', severity: 'medium', category: 'insult' },
  { term: 'mất dạy', severity: 'medium', category: 'insult' },
  { term: 'vô học', severity: 'medium', category: 'insult' },
  { term: 'đồ chó', severity: 'medium', category: 'insult' },
  { term: 'thằng chó', severity: 'medium', category: 'insult' },
  { term: 'óc chó', severity: 'medium', category: 'insult' },
  { term: 'súc vật', severity: 'medium', category: 'insult' },

  // Nhẹ: xúc phạm không tục, chỉ đáng chú ý khi nhắm vào người
  { term: 'ngu', severity: 'light', category: 'insult' },
  { term: 'đần', severity: 'light', category: 'insult' },
  { term: 'ngốc', severity: 'light', category: 'insult' },
  { term: 'khùng', severity: 'light', category: 'insult' },
  { term: 'điên', severity: 'light', category: 'insult' },
  { term: 'thiểu năng', severity: 'light', category: 'insult' },
  { term: 'rác rưởi', severity: 'light', category: 'insult' },
  { term: 'vô dụng', severity: 'light', category: 'insult' }
]

/** Cụm lành chứa từ trong từ điển; match nằm trong cụm này thì bỏ qua. */
export const EXCEPTION_PHRASES: string[] = ['điên đảo', 'điên cuồng', 'ngốc nghếch', 'ngu ngơ']

/** Đại từ/danh xưng cho biết câu nhắm vào một người. */
export const TARGET_WORDS = new Set([
  'mày', 'mầy', 'mi','thằng', 'con', 'đồ', 'bọn', 'lũ', 'bạn', 'ông', 'bà', 'cậu', 'anh', 'chị', 'em', 'm', 'nó', 'hắn'
])

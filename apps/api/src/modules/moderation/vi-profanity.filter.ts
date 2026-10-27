import { LEXICON, EXCEPTION_PHRASES, TARGET_WORDS, type LexiconTerm, type ProfanitySeverity } from './vi-profanity.lexicon'
import { dedupe, normalize, stripMarks, type NormToken } from './vi-text-normalizer'

export type ProfanityVerdict = 'block' | 'review' | 'pass'

export interface ProfanityMatch {
  term: string
  severity: ProfanitySeverity
  /** Chỉ số token bắt đầu / kết thúc (đã chuẩn hóa). */
  start: number
  end: number
  /** Có đại từ/danh xưng trong 3 token quanh match. */
  targeted: boolean
}

export interface ProfanityResult {
  verdict: ProfanityVerdict
  severity: ProfanitySeverity | null
  matches: ProfanityMatch[]
}

const TARGET_WINDOW = 3

interface Compiled extends LexiconTerm {
  words: string[]
  keys: string[]
  plainKeys: string[]
}

function compile(terms: LexiconTerm[]): Compiled[] {
  return terms
    .map(t => ({ ...t, term: t.term.normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ') }))
    .filter(t => t.term)
    .map(t => {
      const words = t.term.split(' ')
      return { ...t, words: words.map(w => stripMarks(w)), keys: words.map(dedupe), plainKeys: words.map(w => dedupe(stripMarks(w))) }
    })
}

const COMPILED: Compiled[] = compile(LEXICON)
const EXCEPTIONS = EXCEPTION_PHRASES.map(p => p.split(' ').map(dedupe))

function matchesAt(tokens: NormToken[], i: number, t: Compiled): boolean {
  if (i + t.keys.length > tokens.length) return false
  // Độ dài ≥ từ gốc: "5 dm" (2 ký tự) không bị coi là "dmm" đã thu gọn
  const longEnough = t.words.every((w, j) => tokens[i + j].value.length >= w.length)
  if (!longEnough) return false
  if (t.keys.every((k, j) => tokens[i + j].key === k)) return true
  if (t.plain === 'always') return t.plainKeys.every((k, j) => !tokens[i + j].hasMarks && tokens[i + j].plainKey === k)
  // Từ ngắn mơ hồ (lon/dit/cac): chỉ khi token đã bị lách, tránh dương tính giả "lon bia"
  if (t.plain === 'obfuscated') return tokens[i].altered && tokens[i].plainKey === t.plainKeys[0]
  return false
}

function insideException(tokens: NormToken[], start: number, end: number): boolean {
  return EXCEPTIONS.some(ex => {
    for (let s = Math.max(0, end - ex.length); s <= start; s++) {
      if (s + ex.length <= tokens.length && ex.every((k, j) => tokens[s + j].key === k)) return true
    }
    return false
  })
}

function isTargeted(tokens: NormToken[], start: number, end: number): boolean {
  for (let i = Math.max(0, start - TARGET_WINDOW); i < Math.min(tokens.length, end + TARGET_WINDOW); i++) {
    if ((i < start || i >= end) && TARGET_WORDS.has(tokens[i].value)) return true
  }
  return false
}

const RANK: Record<ProfanitySeverity, number> = { light: 1, medium: 2, heavy: 3 }

/**
 * Tầng 1 kiểm duyệt: heavy → block; medium → review; light → review nếu nhắm người, ngược lại pass.
 * Tier 1: rules + VN normalization. Heavy blocks, medium escalates, light only when targeted.
 */
export function checkVietnameseProfanity(text: string): ProfanityResult {
  return run(text, COMPILED)
}

/** Từ điển gốc + từ do admin thêm (bảng moderation_terms). Biên dịch một lần, dùng lại cho nhiều câu. */
export function buildProfanityChecker(extra: LexiconTerm[]): (text: string) => ProfanityResult {
  const compiled = [...COMPILED, ...compile(extra)]
  return text => run(text, compiled)
}

function run(text: string, terms: Compiled[]): ProfanityResult {
  const tokens = normalize(text)
  const matches: ProfanityMatch[] = []

  for (let i = 0; i < tokens.length; i++) {
    for (const t of terms) {
      if (!matchesAt(tokens, i, t)) continue
      const end = i + t.keys.length
      if (insideException(tokens, i, end)) continue
      if (t.skipAfterNumber && i > 0 && /^\d+([.,]\d+)?$/u.test(tokens[i - 1].value)) continue
      matches.push({ term: t.term, severity: t.severity, start: i, end, targeted: isTargeted(tokens, i, end) })
    }
  }

  // Cụm dài che từ con (địt mẹ ⊃ địt): giữ match dài nhất tại cùng vị trí
  const kept = matches.filter(m => !matches.some(o => o !== m && o.start <= m.start && o.end >= m.end && o.end - o.start > m.end - m.start))
  const top = kept.reduce<ProfanitySeverity | null>((acc, m) => (!acc || RANK[m.severity] > RANK[acc] ? m.severity : acc), null)

  let verdict: ProfanityVerdict = 'pass'
  if (top === 'heavy') verdict = 'block'
  else if (top === 'medium') verdict = 'review'
  else if (top === 'light' && kept.some(m => m.targeted)) verdict = 'review'

  return { verdict, severity: top, matches: kept }
}

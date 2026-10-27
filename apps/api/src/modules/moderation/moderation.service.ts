import { Injectable, Logger } from '@nestjs/common'
import { join } from 'path'
import { DatabaseService } from '../../database/database.service'
import { decide, DEFAULT_POLICY, type ModerationDecision, type ModerationPolicyConfig } from './moderation.policy'
import { OnnxToxicityClassifier, type ToxicityClassifier, type ToxicityScores } from './toxicity-classifier'
import { buildProfanityChecker, type ProfanityResult } from './vi-profanity.filter'
import type { ProfanitySeverity } from './vi-profanity.lexicon'
import { normalize } from './vi-text-normalizer'

export type ModerationSurface = 'post' | 'comment'
/** off: không làm gì · shadow: chạy + ghi log nhưng luôn cho qua · enforce: áp dụng quyết định. */
export type ModerationMode = 'off' | 'shadow' | 'enforce'

export interface ModerationInput {
  text: string
  userId: string
  surface: ModerationSurface
}

const EXCERPT_MAX = 2000
// Từ điển do admin quản lý (moderation_terms) được nạp lại mỗi 60 giây
const TERMS_TTL_MS = 60_000
const SEVERITIES = new Set<string>(['heavy', 'medium', 'light'])

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name)
  private classifier: ToxicityClassifier | null = null
  private checker: { fn: (text: string) => ProfanityResult; loadedAt: number } | null = null

  constructor(private readonly db: DatabaseService) {}

  get mode(): ModerationMode {
    const m = process.env.MODERATION_MODE
    return m === 'shadow' || m === 'enforce' ? m : 'off'
  }

  private get policy(): ModerationPolicyConfig {
    const num = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d)
    return {
      hateThreshold: num(process.env.MODERATION_HATE_THRESHOLD, DEFAULT_POLICY.hateThreshold),
      offenseThreshold: num(process.env.MODERATION_OFFENSE_THRESHOLD, DEFAULT_POLICY.offenseThreshold),
      offenseAction: process.env.MODERATION_OFFENSE_ACTION === 'hold' ? 'hold' : 'flag'
    }
  }

  private getClassifier(): ToxicityClassifier {
    this.classifier ??= new OnnxToxicityClassifier(process.env.MODERATION_MODEL_DIR || join(process.cwd(), 'models', 'visobert-onnx'))
    return this.classifier
  }

  /**
   * Tầng 1 = từ điển gốc + moderation_terms (cache 60s). Bảng chưa có hoặc lỗi DB ⇒ dùng từ điển gốc.
   * Admin-managed terms are additive: built-in lexicon always applies.
   */
  private async getChecker(): Promise<(text: string) => ProfanityResult> {
    if (this.checker && Date.now() - this.checker.loadedAt < TERMS_TTL_MS) return this.checker.fn
    let extra: { term: string; severity: ProfanitySeverity; category: 'curse' }[] = []
    let loaded = false
    try {
      const res = await this.db.query(`SELECT term, severity FROM moderation_terms`)
      extra = res.rows.filter(r => SEVERITIES.has(r.severity)).map(r => ({ term: r.term, severity: r.severity, category: 'curse' as const }))
      loaded = true
    } catch (err: any) {
      if (!this.checker) this.logger.warn(`Chưa nạp được moderation_terms, dùng từ điển gốc: ${err.message}`)
    }
    // Lỗi nạp: giữ bản cũ nếu có (không mất từ admin đã thêm), vẫn đặt lại hạn để không dội DB
    const fn = loaded || !this.checker ? buildProfanityChecker(extra) : this.checker.fn
    this.checker = { fn, loadedAt: Date.now() }
    return fn
  }

  /** Văn bản đưa vào model: bản đã chuẩn hóa nếu phát hiện lách luật, ngược lại giữ nguyên. */
  private modelText(text: string): string {
    const tokens = normalize(text)
    return tokens.some(t => t.altered) ? tokens.map(t => t.value).join(' ') : text
  }

  /**
   * Chạy các tầng và ghi log. Không bao giờ throw: lỗi model ⇒ chỉ dùng tầng 1 (fail-open ở T2).
   * Trả về quyết định THỰC SỰ áp dụng (shadow/off luôn là allow).
   */
  async check(input: ModerationInput): Promise<ModerationDecision & { eventId: string | null }> {
    const allow = { action: 'allow', tier: null, reason: null, eventId: null } as const
    if (this.mode === 'off' || !input.text.trim()) return { ...allow }

    const t1 = (await this.getChecker())(input.text)
    let scores: ToxicityScores | null = null
    // Tầng 1 đã chặn thì khỏi tốn thời gian chạy model
    if (t1.verdict !== 'block') {
      try {
        scores = await this.getClassifier().classify(this.modelText(input.text))
      } catch (err: any) {
        this.logger.warn(`Model kiểm duyệt lỗi, chỉ dùng tầng 1: ${err.message}`)
      }
    }

    const decision = decide(t1, scores, this.policy)
    if (decision.action === 'allow') return { ...allow }

    const enforced = this.mode === 'enforce'
    const eventId = await this.logEvent(input, decision, scores, t1.matches.map(m => m.term), enforced)
    if (!enforced) return { ...allow }
    return { ...decision, eventId }
  }

  private async logEvent(
    input: ModerationInput,
    d: ModerationDecision,
    scores: ToxicityScores | null,
    terms: string[],
    enforced: boolean
  ): Promise<string | null> {
    try {
      const res = await this.db.query(
        `INSERT INTO moderation_events (user_id, surface, action, tier, reason, scores, matched_terms, content, enforced)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [input.userId, input.surface, d.action, d.tier, d.reason, scores ? JSON.stringify(scores) : null, terms, input.text.slice(0, EXCERPT_MAX), enforced]
      )
      return res.rows[0].id
    } catch (err: any) {
      this.logger.error(`Không ghi được moderation_events: ${err.message}`)
      return null
    }
  }

  /** Gắn bài/bình luận vừa tạo vào sự kiện (để admin nhảy từ log tới nội dung). */
  async attachTarget(eventId: string | null, targetType: ModerationSurface, targetId: string): Promise<void> {
    if (!eventId) return
    await this.db
      .query(`UPDATE moderation_events SET target_type = $2, target_id = $3 WHERE id = $1`, [eventId, targetType, targetId])
      .catch((err: any) => this.logger.error(`attachTarget: ${err.message}`))
  }
}

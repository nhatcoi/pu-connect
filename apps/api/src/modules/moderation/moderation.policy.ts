import type { ProfanityResult } from './vi-profanity.filter'
import type { ToxicityScores } from './toxicity-classifier'

export type ModerationAction = 'allow' | 'flag' | 'hold' | 'block'

export interface ModerationPolicyConfig {
  /** p(hate) từ ngưỡng này → giữ lại chờ admin. */
  hateThreshold: number
  /** p(offense) từ ngưỡng này → gắn cờ (hoặc giữ, tùy offenseAction). */
  offenseThreshold: number
  offenseAction: 'flag' | 'hold'
}

export const DEFAULT_POLICY: ModerationPolicyConfig = { hateThreshold: 0.6, offenseThreshold: 0.7, offenseAction: 'flag' }

export interface ModerationDecision {
  action: ModerationAction
  /** Tầng quyết định: 1 = luật từ cấm, 2 = model. null = cho qua. */
  tier: 1 | 2 | null
  reason: string | null
}

/**
 * Quyết định thuần hàm từ kết quả các tầng.
 * Pure decision: T1 heavy → block; T2 hate → hold for admin; offense → flag (or hold); otherwise allow.
 * `scores` là null khi model chưa chạy/lỗi ⇒ T1 vẫn có hiệu lực (fail-open ở T2).
 */
export function decide(t1: ProfanityResult, scores: ToxicityScores | null, cfg: ModerationPolicyConfig = DEFAULT_POLICY): ModerationDecision {
  if (t1.verdict === 'block') return { action: 'block', tier: 1, reason: 'profanity_heavy' }

  if (scores && scores.hate >= cfg.hateThreshold) return { action: 'hold', tier: 2, reason: 'hate' }

  const offensive = !!scores && scores.offense + scores.hate >= cfg.offenseThreshold
  if (offensive || t1.verdict === 'review') {
    const action = cfg.offenseAction === 'hold' ? 'hold' : 'flag'
    return { action, tier: offensive ? 2 : 1, reason: offensive ? 'offense' : 'profanity_mild' }
  }
  return { action: 'allow', tier: null, reason: null }
}

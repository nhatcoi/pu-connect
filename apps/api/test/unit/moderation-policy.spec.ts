import { decide, DEFAULT_POLICY } from '../../src/modules/moderation/moderation.policy'
import { checkVietnameseProfanity } from '../../src/modules/moderation/vi-profanity.filter'

const t1 = (s: string) => checkVietnameseProfanity(s)
const scores = (clean: number, offense: number, hate: number) => ({ clean, offense, hate })

describe('moderation decide', () => {
  it('từ cấm nặng → block, không cần model', () => {
    expect(decide(t1('địt mẹ mày'), null)).toMatchObject({ action: 'block', tier: 1 })
  })
  it('hate cao → hold cho admin', () => {
    expect(decide(t1('xin chào'), scores(0.1, 0.1, 0.8))).toMatchObject({ action: 'hold', tier: 2, reason: 'hate' })
  })
  it('offense → flag (đăng + ghi log) theo mặc định', () => {
    expect(decide(t1('xin chào'), scores(0.2, 0.7, 0.1))).toMatchObject({ action: 'flag', reason: 'offense' })
  })
  it('offenseAction=hold → giữ lại', () => {
    expect(decide(t1('xin chào'), scores(0.2, 0.7, 0.1), { ...DEFAULT_POLICY, offenseAction: 'hold' }).action).toBe('hold')
  })
  it('clean → allow', () => {
    expect(decide(t1('hôm nay trời đẹp'), scores(0.95, 0.04, 0.01))).toMatchObject({ action: 'allow', tier: null })
  })
  it('model lỗi (null): tầng 1 vẫn chạy, câu sạch vẫn qua', () => {
    expect(decide(t1('đm mệt quá'), null)).toMatchObject({ action: 'flag', tier: 1 })
    expect(decide(t1('hôm nay trời đẹp'), null).action).toBe('allow')
  })
  it('từ cấm nặng thắng điểm model sạch', () => {
    expect(decide(t1('l0n'), scores(0.99, 0.005, 0.005)).action).toBe('block')
  })
})

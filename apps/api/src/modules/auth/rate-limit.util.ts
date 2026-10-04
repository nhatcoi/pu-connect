import { HttpException, HttpStatus } from '@nestjs/common'

// Giới hạn tần suất theo khóa (IP) trong bộ nhớ: đủ để chặn dò email cơ bản
export class SimpleRateLimiter {
  private hits = new Map<string, number[]>()

  constructor(
    private readonly max: number,
    private readonly windowMs: number
  ) {}

  consume(key: string): void {
    const now = Date.now()
    const recent = (this.hits.get(key) || []).filter((t) => now - t < this.windowMs)
    if (recent.length >= this.max) {
      throw new HttpException('Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút', HttpStatus.TOO_MANY_REQUESTS)
    }
    recent.push(now)
    this.hits.set(key, recent)
    // Dọn bộ nhớ định kỳ
    if (this.hits.size > 5000) {
      for (const [k, v] of this.hits) if (v.every((t) => now - t >= this.windowMs)) this.hits.delete(k)
    }
  }
}

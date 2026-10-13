import { Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job, Queue } from 'bullmq'
import { InterestProfileService } from './interest-profile.service'
import { UserEventsService } from './user-events.service'
import { PERSONALIZATION_QUEUE, PURGE_EVERY_MS, REFRESH_BATCH, REFRESH_EVERY_MS } from './personalization.constants'

type JobName = 'refresh-profiles' | 'purge-events'

// Worker định kỳ: tính lại hồ sơ quan tâm cho người vừa hoạt động, xóa sự kiện quá hạn
// Scheduled worker: refresh interest profiles of active users, purge expired events
@Processor(PERSONALIZATION_QUEUE, { concurrency: 1 })
export class PersonalizationProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(PersonalizationProcessor.name)

  constructor(
    @InjectQueue(PERSONALIZATION_QUEUE) private readonly queue: Queue,
    private readonly profile: InterestProfileService,
    private readonly events: UserEventsService
  ) {
    super()
  }

  // Lịch lặp lưu trong Redis (upsert ⇒ nhiều instance / deploy lại không nhân bản)
  onApplicationBootstrap() {
    void Promise.all([
      this.queue.upsertJobScheduler('refresh-profiles', { every: REFRESH_EVERY_MS }, { name: 'refresh-profiles' }),
      this.queue.upsertJobScheduler('purge-events', { every: PURGE_EVERY_MS }, { name: 'purge-events' })
    ]).catch((err) => this.logger.warn(`Không đặt được lịch cá nhân hóa: ${err?.message}`))
  }

  async process(job: Job<unknown, string, JobName>): Promise<string> {
    if (job.name === 'purge-events') return `purged:${await this.events.purgeExpired()}`

    const userIds = await this.profile.staleActiveUsers(REFRESH_BATCH)
    let failed = 0
    for (const id of userIds) {
      // Lỗi 1 người không chặn cả lượt
      await this.profile.recompute(id).catch(() => failed++)
    }
    return `refreshed:${userIds.length - failed}/${userIds.length}`
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, err: Error) {
    this.logger.warn(`Personalization job ${job?.name} failed: ${err.message}`)
  }
}

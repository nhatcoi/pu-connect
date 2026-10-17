import { Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job, Queue } from 'bullmq'
import { AiDataService } from './ai-data.service'
import { AiTasksService } from './ai-tasks.service'

export const AI_MAINTENANCE_QUEUE = 'ai-maintenance'
const RUN_TASKS_EVERY_MS = 5 * 60 * 1000
const PURGE_EVERY_MS = 24 * 60 * 60 * 1000

type JobName = 'run-tasks' | 'purge-history'

// Worker N7AI: chạy tác vụ tự động đến hạn (5 phút / lần) + xóa lịch sử quá hạn lưu (mỗi ngày)
@Processor(AI_MAINTENANCE_QUEUE, { concurrency: 1 })
export class AiMaintenanceProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(AiMaintenanceProcessor.name)

  constructor(
    @InjectQueue(AI_MAINTENANCE_QUEUE) private readonly queue: Queue,
    private readonly tasks: AiTasksService,
    private readonly data: AiDataService
  ) {
    super()
  }

  // Lịch lặp đặt idempotent (upsert) mỗi lần khởi động
  async onApplicationBootstrap() {
    await Promise.all([
      this.queue.upsertJobScheduler('run-tasks', { every: RUN_TASKS_EVERY_MS }, { name: 'run-tasks' }),
      this.queue.upsertJobScheduler('purge-history', { every: PURGE_EVERY_MS }, { name: 'purge-history' })
    ]).catch((err) => this.logger.warn(`Không đặt được lịch N7AI: ${err?.message}`))
  }

  async process(job: Job<unknown, unknown, JobName>): Promise<number> {
    return job.name === 'run-tasks' ? this.tasks.runDue() : this.data.purgeExpired()
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, err: Error) {
    this.logger.warn(`Job ${job?.name} lỗi: ${err.message}`)
  }
}

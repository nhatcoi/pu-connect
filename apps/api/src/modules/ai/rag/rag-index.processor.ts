import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job, Queue } from 'bullmq'
import { RagIndexService, type SweepResult } from './rag-index.service'

export const RAG_INDEX_QUEUE = 'rag-index'
const SWEEP_EVERY_MS = 2 * 60 * 1000

// Lịch quét RAG 2 phút / lần (bắt cả bài viết mới / sửa / lời giải đổi) + "quét ngay" khi có tài liệu mới
@Processor(RAG_INDEX_QUEUE, { concurrency: 1 })
export class RagIndexProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(RagIndexProcessor.name)

  constructor(
    @InjectQueue(RAG_INDEX_QUEUE) private readonly queue: Queue,
    private readonly index: RagIndexService
  ) {
    super()
  }

  async onApplicationBootstrap() {
    await this.queue
      .upsertJobScheduler('sweep', { every: SWEEP_EVERY_MS }, { name: 'sweep' })
      .catch((err) => this.logger.warn(`Không đặt được lịch RAG: ${err?.message}`))
  }

  async process(): Promise<SweepResult> {
    const result = await this.index.sweep()
    if (result.documents || result.chunks || result.posts) {
      this.logger.log(`RAG: ${result.documents} tài liệu, ${result.chunks} đoạn, ${result.posts} bài viết`)
    }
    return result
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, err: Error) {
    this.logger.warn(`Job RAG ${job?.name} lỗi: ${err.message}`)
  }
}

// Gọi từ nơi tạo tài liệu: xếp 1 lượt quét ngay (jobId cố định ⇒ nhiều lần gọi gộp thành 1 job đang chờ)
@Injectable()
export class RagIndexQueue {
  constructor(@InjectQueue(RAG_INDEX_QUEUE) private readonly queue: Queue) {}

  kick(): void {
    void this.queue.add('sweep', {}, { jobId: 'sweep-now', removeOnComplete: true, removeOnFail: true }).catch(() => undefined)
  }
}

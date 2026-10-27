import { Module } from '@nestjs/common'
import { NotificationsModule } from '../notifications/notifications.module'
import { ModerationService } from './moderation.service'

@Module({ imports: [NotificationsModule], providers: [ModerationService], exports: [ModerationService] })
export class ModerationModule {}

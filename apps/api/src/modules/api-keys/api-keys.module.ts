import { Module } from '@nestjs/common'
import { AdminApiKeysController } from './admin-api-keys.controller'
import { ApiKeysController } from './api-keys.controller'
import { ApiKeysService } from './api-keys.service'

@Module({ controllers: [ApiKeysController, AdminApiKeysController], providers: [ApiKeysService], exports: [ApiKeysService] })
export class ApiKeysModule {}

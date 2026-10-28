import { Global, Module } from '@nestjs/common'
import { UnitsController } from './units.controller'
import { UnitRequestsService } from './unit-requests.service'

@Global()
@Module({ controllers: [UnitsController], providers: [UnitRequestsService], exports: [UnitRequestsService] })
export class UnitsModule {}

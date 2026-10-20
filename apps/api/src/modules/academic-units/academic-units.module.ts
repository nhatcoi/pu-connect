import { Module } from '@nestjs/common'
import { AcademicUnitsController } from './academic-units.controller'

@Module({ controllers: [AcademicUnitsController] })
export class AcademicUnitsModule {}

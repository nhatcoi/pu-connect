import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { AppModule } from './app.module'
import { configureApp } from './app.setup'
import type { NestExpressApplication } from '@nestjs/platform-express'

async function bootstrap() {
  const app = configureApp(await NestFactory.create<NestExpressApplication>(AppModule))
  const logger = new Logger('Bootstrap')

  const port = process.env.PORT || 4000
  const host = process.env.HOST || '0.0.0.0'
  await app.listen(port, host)
  logger.log(`🚀 PU Connect API running with Session Auth at: http://${host}:${port}/api`)
}

bootstrap()

import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { AppModule } from './app.module'
import { AllExceptionsFilter } from './common/filters/http-exception.filter'
import { TransformInterceptor } from './common/interceptors/transform.interceptor'
import * as passport from 'passport'
import { DatabaseService } from './database/database.service'
import { createSessionMiddleware } from './common/http/session'
import { isAllowedOrigin } from './common/http/origins'
import type { NestExpressApplication } from '@nestjs/platform-express'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  const logger = new Logger('Bootstrap')

  // Trust first proxy for reverse proxy SSL termination (Nginx)
  app.set('trust proxy', 1)

  // Global prefix
  app.setGlobalPrefix('api')

  // CORS có credentials: chỉ origin của app (APP_URL / CORS_ORIGINS / localhost khi dev)
  app.enableCors({
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true
  })

  // Session lưu Postgres, dùng chung với Socket.IO handshake
  app.use(createSessionMiddleware(app.get(DatabaseService).getPool()))

  // Passport Session Initialization
  app.use(passport.initialize())
  app.use(passport.session())

  // Global Filter and Interceptor
  app.useGlobalFilters(new AllExceptionsFilter())
  app.useGlobalInterceptors(new TransformInterceptor())

  const port = process.env.PORT || 4000
  const host = process.env.HOST || '0.0.0.0'
  await app.listen(port, host)
  logger.log(`🚀 PU Connector API running with Session Auth at: http://${host}:${port}/api`)
}

bootstrap()

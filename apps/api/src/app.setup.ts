import * as passport from 'passport'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AllExceptionsFilter } from './common/filters/http-exception.filter'
import { TransformInterceptor } from './common/interceptors/transform.interceptor'
import { DatabaseService } from './database/database.service'
import { createSessionMiddleware } from './common/http/session'
import { isAllowedOrigin } from './common/http/origins'

// Cấu hình HTTP dùng chung cho main.ts và integration test
// Shared app wiring: prefix, CORS, session, passport, filters
export function configureApp(app: NestExpressApplication): NestExpressApplication {
  // Trust first proxy for reverse proxy SSL termination (Nginx)
  app.set('trust proxy', 1)

  // Global prefix
  app.setGlobalPrefix('api')

  // Mặc định body-parser chỉ nhận 100kb: job đăng bài nhập cả trăm bài từ file cần rộng hơn
  app.useBodyParser('json', { limit: '5mb' })

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
  return app
}

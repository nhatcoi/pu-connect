import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { AppModule } from './app.module'
import { AllExceptionsFilter } from './common/filters/http-exception.filter'
import { TransformInterceptor } from './common/interceptors/transform.interceptor'
import * as session from 'express-session'
import * as passport from 'passport'
import type { NestExpressApplication } from '@nestjs/platform-express'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  const logger = new Logger('Bootstrap')

  // Trust first proxy for reverse proxy SSL termination (Nginx)
  app.set('trust proxy', 1)

  // Global prefix
  app.setGlobalPrefix('api')

  // Enable CORS with Credentials for Session Cookie
  app.enableCors({
    origin: (origin, callback) => {
      // Allow local development and mobile clients
      callback(null, true)
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true
  })

  // Session Middleware
  app.use(
    session({
      name: 'pu_session',
      secret: process.env.SESSION_SECRET || 'pu-connector-secret-session-key-2026',
      resave: false,
      saveUninitialized: false,
      proxy: true,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
      }
    })
  )

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

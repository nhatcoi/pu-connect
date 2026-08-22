import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { AppModule } from './app.module'
import { AllExceptionsFilter } from './common/filters/http-exception.filter'
import { TransformInterceptor } from './common/interceptors/transform.interceptor'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const logger = new Logger('Bootstrap')

  // Global prefix
  app.setGlobalPrefix('api')

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true
  })

  // Global Filter and Interceptor
  app.useGlobalFilters(new AllExceptionsFilter())
  app.useGlobalInterceptors(new TransformInterceptor())

  const port = process.env.PORT || 4000
  const host = process.env.HOST || '0.0.0.0'
  await app.listen(port, host)
  logger.log(`🚀 PU Connector API running at: http://${host}:${port}/api`)
}

bootstrap()

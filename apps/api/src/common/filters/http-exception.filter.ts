import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common'
import { Response, Request } from 'express'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // Only handle HTTP context, let GraphQL handle its own errors
    if ((host.getType() as string) === 'graphql') {
      return exception
    }

    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    if (!response || typeof response.status !== 'function') {
      return exception
    }

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR

    const message = exception instanceof HttpException ? exception.getResponse() : { message: (exception as Error)?.message || 'Internal Server Error' }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request?.url || '',
      ...(typeof message === 'object' ? message : { message })
    })
  }
}

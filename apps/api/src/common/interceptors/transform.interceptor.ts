import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

export interface Response<T> {
  data: T
  success: boolean
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Only wrap HTTP REST responses, do not touch GraphQL
    if ((context.getType() as string) === 'graphql') {
      return next.handle()
    }

    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
          return data
        }
        return {
          success: true,
          data
        }
      })
    )
  }
}

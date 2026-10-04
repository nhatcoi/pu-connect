import { BadRequestException, PipeTransform } from '@nestjs/common'
import type { ZodSchema } from 'zod'

// Validate body bằng zod schema dùng chung (@pu/schemas)
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value)
    if (!result.success) {
      const issue = result.error.issues[0]
      throw new BadRequestException({
        message: issue?.message || 'Dữ liệu không hợp lệ',
        field: issue?.path?.[0]
      })
    }
    return result.data
  }
}

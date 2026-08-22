import { Injectable } from '@nestjs/common'
import { PassportSerializer } from '@nestjs/passport'
import { AuthService } from './auth.service'
import type { UserProfile } from '@pu/schemas'

@Injectable()
export class SessionSerializer extends PassportSerializer {
  constructor(private readonly authService: AuthService) {
    super()
  }

  serializeUser(user: UserProfile, done: (err: Error | null, user: { id: string }) => void) {
    done(null, { id: user.id })
  }

  async deserializeUser(
    payload: { id: string },
    done: (err: Error | null, user: UserProfile | null) => void
  ) {
    try {
      const user = await this.authService.findById(payload.id)
      done(null, user)
    } catch (err: any) {
      done(err, null)
    }
  }
}

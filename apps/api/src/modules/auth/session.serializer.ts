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
    done: (err: Error | null, user: UserProfile | false) => void
  ) {
    try {
      const user = await this.authService.findById(payload.id)
      // Không tồn tại hoặc bị khóa ⇒ phiên hết hiệu lực (HTTP lẫn socket handshake)
      done(null, user && user.status !== 'suspended' ? user : false)
    } catch (err: any) {
      done(err, null)
    }
  }
}

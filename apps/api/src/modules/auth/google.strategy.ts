import { Strategy, type Profile } from 'passport-google-oauth20'
import { PassportStrategy } from '@nestjs/passport'
import { Injectable, Logger } from '@nestjs/common'
import { AuthService, assertNotSuspended } from './auth.service'

export interface GoogleStrategyConfig {
  clientID: string
  clientSecret: string
  callbackURL: string
}

// Chỉ được khởi tạo khi đủ GOOGLE_CLIENT_ID / SECRET / CALLBACK_URL (xem auth.module)
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    config: GoogleStrategyConfig,
    private readonly authService: AuthService
  ) {
    super({ ...config, scope: ['openid', 'email', 'profile'], state: true })
  }

  async validate(_accessToken: string, _refreshToken: string, profile: Profile) {
    const email = profile.emails?.[0]
    if (!email?.value) {
      new Logger(GoogleStrategy.name).warn('Google profile không có email')
      return false
    }

    const user = await this.authService.findOrCreateGoogleUser({
      googleId: profile.id,
      email: email.value,
      emailVerified: email.verified === true || (profile as any)._json?.email_verified === true,
      displayName: profile.displayName || email.value.split('@')[0],
      avatarUrl: profile.photos?.[0]?.value
    })
    assertNotSuspended(user.status)
    return user
  }
}

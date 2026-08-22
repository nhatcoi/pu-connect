import { Strategy } from 'passport-local'
import { PassportStrategy } from '@nestjs/passport'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { AuthService } from './auth.service'

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'emailOrUsername',
      passwordField: 'password'
    })
  }

  async validate(emailOrUsername: string, password: string): Promise<any> {
    const user = await this.authService.validateUser(emailOrUsername, password)
    if (!user) {
      throw new UnauthorizedException('Email, Username hoặc mật khẩu không chính xác')
    }
    return user
  }
}

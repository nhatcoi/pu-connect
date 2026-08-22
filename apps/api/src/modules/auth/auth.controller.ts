import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common'
import { AuthService } from './auth.service'
import type { RegisterInput, LoginInput } from '@pu/schemas'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterInput) {
    return this.authService.register(body)
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginInput) {
    return this.authService.login(body)
  }
}

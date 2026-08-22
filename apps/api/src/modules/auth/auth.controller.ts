import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common'
import { AuthService } from './auth.service'
import { LocalAuthGuard } from './guards/local-auth.guard'
import { AuthenticatedGuard } from './guards/authenticated.guard'
import type { RegisterInput } from '@pu/schemas'
import type { Request, Response } from 'express'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterInput, @Req() req: Request) {
    const user = await this.authService.register(body)
    await new Promise<void>((resolve, reject) => {
      req.login(user, (err) => {
        if (err) return reject(err)
        resolve()
      })
    })
    return user
  }

  @Post('login')
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  async login(@Req() req: Request) {
    return req.user
  }

  @Get('me')
  @UseGuards(AuthenticatedGuard)
  async getProfile(@Req() req: Request) {
    return req.user
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return new Promise((resolve) => {
      req.logout(() => {
        req.session.destroy(() => {
          res.clearCookie('pu_session', { path: '/' })
          resolve({
            message: 'Đã đăng xuất an toàn'
          })
        })
      })
    })
  }
}

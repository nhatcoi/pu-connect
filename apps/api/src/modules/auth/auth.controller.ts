import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  Inject,
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common'
import { AuthService } from './auth.service'
import { LocalAuthGuard } from './guards/local-auth.guard'
import { AuthenticatedGuard } from './guards/authenticated.guard'
import { LoginRateLimitGuard } from './guards/login-rate-limit.guard'
import { GoogleAuthGuard } from './guards/google-auth.guard'
import { GOOGLE_AUTH_ENABLED } from './auth.constants'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { RegisterBodySchema } from './dto/register.dto'
import { SimpleRateLimiter } from './rate-limit.util'
import { z } from 'zod'
import type { RegisterInput, OnboardingInput, UserProfile } from '@pu/schemas'
import type { Request, Response } from 'express'

const CheckEmailSchema = z.object({ email: z.string().trim().toLowerCase().email({ message: 'Email không hợp lệ' }) })
const VerifyEmailSchema = z.object({ token: z.string().min(1, { message: 'Thiếu mã xác thực' }) })

@Controller('auth')
export class AuthController {
  // 20 lượt kiểm tra email / phút / IP; 10 lượt đăng ký / giờ / IP
  private readonly checkEmailLimiter = new SimpleRateLimiter(20, 60_000)
  private readonly registerLimiter = new SimpleRateLimiter(10, 3_600_000)

  constructor(
    private readonly authService: AuthService,
    @Inject(GOOGLE_AUTH_ENABLED) private readonly googleEnabled: boolean
  ) {}

  // Cho frontend biết phương thức đăng nhập nào đang bật
  @Get('providers')
  getProviders() {
    return { google: this.googleEnabled }
  }

  // Luồng "nhập email trước": email đã có tài khoản chưa
  @Post('check-email')
  @HttpCode(HttpStatus.OK)
  async checkEmail(@Body(new ZodValidationPipe(CheckEmailSchema)) body: { email: string }, @Req() req: Request) {
    this.checkEmailLimiter.consume(req.ip || 'unknown')
    return this.authService.checkEmail(body.email)
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body(new ZodValidationPipe(VerifyEmailSchema)) body: { token: string }) {
    return this.authService.verifyEmail(body.token)
  }

  @Post('resend-verification')
  @UseGuards(AuthenticatedGuard)
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Req() req: Request) {
    return this.authService.resendVerification((req.user as UserProfile).id)
  }

  // Bắt đầu OAuth: guard redirect sang Google. Chạm tới handler = Google chưa bật / cấu hình lỗi
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin(@Res() res: Response) {
    return res.redirect(`/?auth_error=${this.googleEnabled ? 'google' : 'google_unavailable'}`)
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  googleCallback(@Req() req: Request & { googleAuthFailed?: boolean }, @Res() res: Response) {
    const user = req.user as UserProfile | undefined
    if (req.googleAuthFailed || !user) return res.redirect('/?auth_error=google')
    return res.redirect('/home')
  }

  @Post('register')
  async register(@Body(new ZodValidationPipe(RegisterBodySchema)) body: RegisterInput, @Req() req: Request) {
    this.registerLimiter.consume(req.ip || 'unknown')
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
  @UseGuards(LoginRateLimitGuard, LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  async login(@Req() req: Request) {
    return req.user
  }

  @Get('me')
  @UseGuards(AuthenticatedGuard)
  async getProfile(@Req() req: Request) {
    return req.user
  }

  @Post('onboarding')
  @UseGuards(AuthenticatedGuard)
  @HttpCode(HttpStatus.OK)
  async completeOnboarding(@Req() req: Request, @Body() body: OnboardingInput) {
    const user = req.user as any
    return this.authService.completeOnboarding(user.id, body)
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

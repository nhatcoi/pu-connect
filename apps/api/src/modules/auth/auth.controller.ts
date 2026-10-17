import { Controller, Post, Get, Delete, Param, Body, Req, Res, Inject, UseGuards, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common'
import { AuthService } from './auth.service'
import { SecurityLogService } from './security-log.service'
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
const ForgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().email({ message: 'Email không hợp lệ' }) })
const ResetPasswordSchema = z.object({
  token: z.string().min(1, { message: 'Thiếu mã đặt lại mật khẩu' }),
  // bcrypt chỉ dùng 72 byte đầu
  password: z.string().min(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' }).max(72, { message: 'Mật khẩu tối đa 72 ký tự' })
})
const VerifyEmailSchema = z.object({ token: z.string().min(1, { message: 'Thiếu mã xác thực' }) })

@Controller('auth')
export class AuthController {
  // 20 lượt kiểm tra email / phút / IP; 10 lượt đăng ký / giờ / IP
  private readonly checkEmailLimiter = new SimpleRateLimiter(20, 60_000)
  private readonly registerLimiter = new SimpleRateLimiter(10, 3_600_000)
  // Quên mật khẩu: 5 yêu cầu / 15 phút / IP, 3 / giờ / email; đặt lại: 10 lần / 15 phút / IP
  private readonly forgotIpLimiter = new SimpleRateLimiter(5, 900_000)
  private readonly forgotEmailLimiter = new SimpleRateLimiter(3, 3_600_000)
  private readonly resetLimiter = new SimpleRateLimiter(10, 900_000)

  constructor(
    private readonly authService: AuthService,
    private readonly securityLog: SecurityLogService,
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
  async verifyEmail(@Body(new ZodValidationPipe(VerifyEmailSchema)) body: { token: string }, @Req() req: Request) {
    const user = await this.authService.verifyEmail(body.token)
    void this.securityLog.record(req, 'email_verified', { userId: user.id })
    return user
  }

  // Luôn trả 200 cùng nội dung: không tiết lộ email có tài khoản hay không
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body(new ZodValidationPipe(ForgotPasswordSchema)) body: { email: string }, @Req() req: Request) {
    this.forgotIpLimiter.consume(req.ip || 'unknown')
    this.forgotEmailLimiter.consume(body.email)
    const userId = await this.authService.requestPasswordReset(body.email)
    if (userId) void this.securityLog.record(req, 'password_reset_requested', { userId })
    return { sent: true }
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body(new ZodValidationPipe(ResetPasswordSchema)) body: { token: string; password: string }, @Req() req: Request) {
    this.resetLimiter.consume(req.ip || 'unknown')
    const userId = await this.authService.resetPassword(body.token, body.password)
    void this.securityLog.record(req, 'password_reset', { userId })
    return { success: true }
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
  googleCallback(@Req() req: Request & { googleAuthFailed?: boolean | 'suspended' }, @Res() res: Response) {
    const user = req.user as UserProfile | undefined
    if (req.googleAuthFailed === 'suspended') return res.redirect('/?auth_error=suspended')
    if (req.googleAuthFailed || !user) return res.redirect('/?auth_error=google')
    this.securityLog.tagSession(req, 'google')
    void this.securityLog.record(req, 'login', { userId: user.id, method: 'google' })
    return res.redirect('/')
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
    this.securityLog.tagSession(req, 'password')
    void this.securityLog.record(req, 'register', { userId: user.id, method: 'password' })
    return user
  }

  @Post('login')
  @UseGuards(LoginRateLimitGuard, LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  async login(@Req() req: Request) {
    const user = req.user as UserProfile
    this.securityLog.tagSession(req, 'password')
    void this.securityLog.record(req, 'login', { userId: user.id, method: 'password' })
    return user
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
    const userId = (req.user as UserProfile | undefined)?.id
    if (userId) void this.securityLog.record(req, 'logout', { userId })
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

  // ── Thiết bị đăng nhập & nhật ký bảo mật của chính mình ──
  @Get('sessions')
  @UseGuards(AuthenticatedGuard)
  sessions(@Req() req: Request) {
    return this.securityLog.listSessions((req.user as UserProfile).id, req.sessionID)
  }

  @Delete('sessions/:id')
  @UseGuards(AuthenticatedGuard)
  async revokeSession(@Param('id') id: string, @Req() req: Request) {
    if (!/^[a-f0-9]{16}$/.test(id)) throw new NotFoundException('Phiên không tồn tại')
    const n = await this.securityLog.revokeSessions(req, (req.user as UserProfile).id, { id })
    if (!n) throw new NotFoundException('Phiên không tồn tại hoặc là phiên hiện tại')
    return { revoked: n }
  }

  @Post('sessions/revoke-others')
  @UseGuards(AuthenticatedGuard)
  @HttpCode(HttpStatus.OK)
  async revokeOthers(@Req() req: Request) {
    return { revoked: await this.securityLog.revokeSessions(req, (req.user as UserProfile).id, { others: true }) }
  }

  @Get('security-events')
  @UseGuards(AuthenticatedGuard)
  securityEvents(@Req() req: Request) {
    return this.securityLog.listEvents((req.user as UserProfile).id)
  }
}

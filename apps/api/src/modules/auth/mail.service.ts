import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

// Gửi email qua SMTP (SMTP_HOST/PORT/USER/PASS, MAIL_FROM).
// Chưa cấu hình SMTP: chỉ log link ra console (dev), không gửi thật.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private readonly transporter: Transporter | null
  private readonly from: string

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST')
    const port = Number(config.get('SMTP_PORT') || 587)
    this.from = config.get<string>('MAIL_FROM') || 'PU Connect <no-reply@puc.vnhat.dev>'
    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: config.get('SMTP_USER') ? { user: config.get<string>('SMTP_USER'), pass: config.get<string>('SMTP_PASS') } : undefined
        })
      : null
    if (!this.transporter) {
      this.logger.warn('SMTP chưa cấu hình: email xác thực sẽ chỉ được ghi vào log')
    }
  }

  get isConfigured(): boolean {
    return !!this.transporter
  }

  async sendVerificationEmail(to: string, name: string, link: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[DEV] Link xác thực email của ${to}: ${link}`)
      return
    }
    const safeName = name.replace(/[<>&"]/g, '')
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Xác thực email PU Connect',
      text: `Chào ${safeName},\n\nBấm vào liên kết sau để xác thực email (hết hạn sau 24 giờ):\n${link}\n\nNếu bạn không đăng ký PU Connect, hãy bỏ qua email này.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#111">
  <h2 style="color:#0B3D91;margin:0 0 12px">Xác thực email</h2>
  <p>Chào ${safeName},</p>
  <p>Bấm nút bên dưới để xác thực email và hoàn tất tài khoản PU Connect. Liên kết hết hạn sau 24 giờ.</p>
  <p style="margin:24px 0"><a href="${link}" style="background:#0B3D91;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600">Xác thực email</a></p>
  <p style="font-size:12px;color:#666">Nếu nút không hoạt động, mở liên kết: <br><a href="${link}">${link}</a></p>
  <p style="font-size:12px;color:#666">Nếu bạn không đăng ký PU Connect, hãy bỏ qua email này.</p>
</div>`
    })
  }

  // Email đặt lại mật khẩu (link hết hạn sau 30 phút, dùng một lần)
  async sendPasswordResetEmail(to: string, name: string, link: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[DEV] Link đặt lại mật khẩu của ${to}: ${link}`)
      return
    }
    const safeName = name.replace(/[<>&"]/g, '')
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Đặt lại mật khẩu PU Connect',
      text: `Chào ${safeName},\n\nBấm vào liên kết sau để đặt mật khẩu mới (hết hạn sau 30 phút, chỉ dùng một lần):\n${link}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này — mật khẩu của bạn không thay đổi.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#111">
  <h2 style="color:#0B3D91;margin:0 0 12px">Đặt lại mật khẩu</h2>
  <p>Chào ${safeName},</p>
  <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản PU Connect của bạn. Liên kết hết hạn sau 30 phút và chỉ dùng được một lần.</p>
  <p style="margin:24px 0"><a href="${link}" style="background:#0B3D91;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600">Đặt mật khẩu mới</a></p>
  <p style="font-size:12px;color:#666">Nếu nút không hoạt động, mở liên kết: <br><a href="${link}">${link}</a></p>
  <p style="font-size:12px;color:#666">Nếu bạn không yêu cầu, hãy bỏ qua email này — mật khẩu của bạn không thay đổi.</p>
</div>`
    })
  }

  // Cảnh báo bảo mật: mật khẩu vừa được đổi (để chủ tài khoản phát hiện chiếm quyền)
  async sendPasswordChangedEmail(to: string, name: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[DEV] Đã gửi cảnh báo đổi mật khẩu tới ${to}`)
      return
    }
    const safeName = name.replace(/[<>&"]/g, '')
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Mật khẩu PU Connect đã được thay đổi',
      text: `Chào ${safeName},\n\nMật khẩu tài khoản PU Connect của bạn vừa được thay đổi và mọi phiên đăng nhập cũ đã bị đăng xuất.\n\nNếu không phải bạn, hãy đặt lại mật khẩu ngay tại trang đăng nhập (Quên mật khẩu).`,
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#111">
  <h2 style="color:#0B3D91;margin:0 0 12px">Mật khẩu đã được thay đổi</h2>
  <p>Chào ${safeName},</p>
  <p>Mật khẩu tài khoản PU Connect của bạn vừa được thay đổi và mọi phiên đăng nhập cũ đã bị đăng xuất.</p>
  <p style="font-size:13px;color:#b91c1c">Nếu không phải bạn, hãy dùng "Quên mật khẩu" tại trang đăng nhập để lấy lại tài khoản ngay.</p>
</div>`
    })
  }
}

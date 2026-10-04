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
    this.from = config.get<string>('MAIL_FROM') || 'PU Connector <no-reply@puc.vnhat.dev>'
    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: config.get('SMTP_USER')
            ? { user: config.get<string>('SMTP_USER'), pass: config.get<string>('SMTP_PASS') }
            : undefined
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
      subject: 'Xác thực email PU Connector',
      text: `Chào ${safeName},\n\nBấm vào liên kết sau để xác thực email (hết hạn sau 24 giờ):\n${link}\n\nNếu bạn không đăng ký PU Connector, hãy bỏ qua email này.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#111">
  <h2 style="color:#0B3D91;margin:0 0 12px">Xác thực email</h2>
  <p>Chào ${safeName},</p>
  <p>Bấm nút bên dưới để xác thực email và hoàn tất tài khoản PU Connector. Liên kết hết hạn sau 24 giờ.</p>
  <p style="margin:24px 0"><a href="${link}" style="background:#0B3D91;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600">Xác thực email</a></p>
  <p style="font-size:12px;color:#666">Nếu nút không hoạt động, mở liên kết: <br><a href="${link}">${link}</a></p>
  <p style="font-size:12px;color:#666">Nếu bạn không đăng ký PU Connector, hãy bỏ qua email này.</p>
</div>`
    })
  }
}

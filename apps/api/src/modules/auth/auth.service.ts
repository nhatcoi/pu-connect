import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import type { RegisterInput, OnboardingInput, UserProfile } from '@pu/schemas'
import { resolvePrivacySettings } from '../users/dto/privacy.dto'
import { resolveFeaturePreferences } from '../users/dto/preferences.dto'
import * as bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'crypto'
import { ConfigService } from '@nestjs/config'
import { MailService } from './mail.service'
import { inferStudentInfoFromEmail, isPhenikaaEmail } from './email-profile.util'
import { isReservedUsername } from './reserved-usernames'
import { NotificationsService } from '../notifications/notifications.service'

export const SUSPENDED_MESSAGE = 'Tài khoản của bạn đã bị khóa. Liên hệ quản trị viên nếu đây là nhầm lẫn.'

// Chặn tài khoản bị khóa (suspended) ở mọi điểm đăng nhập
export function assertNotSuspended(status: string | null | undefined): void {
  if (status === 'suspended') throw new ForbiddenException(SUSPENDED_MESSAGE)
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService
  ) {}

  async validateUser(emailOrUsername: string, password: string): Promise<UserProfile | null> {
    const res = await this.db.query(
      `SELECT id, email, username, password_hash, display_name, student_id, school, faculty, academic_year,
              major, class_name, is_verified, verified_at, privacy_settings, preferences,
              location, website, birth_date,
              avatar_url, bio, role, status, reputation_points, is_onboarded, email_verified, skills, interests, created_at
       FROM users
       WHERE (email = $1 OR username = $1) AND account_type = 'human' LIMIT 1`,
      [emailOrUsername.toLowerCase().trim()]
    )

    if (res.rows.length === 0) {
      return null
    }

    const row = res.rows[0]
    // Tài khoản đăng ký bằng Google chưa đặt mật khẩu
    if (!row.password_hash) {
      return null
    }
    const isMatch = await bcrypt.compare(password, row.password_hash)
    if (!isMatch) {
      return null
    }
    // Chỉ báo bị khóa sau khi đúng mật khẩu (không lộ trạng thái tài khoản)
    assertNotSuspended(row.status)

    return this.mapUserRowToProfile(row)
  }

  async findById(id: string): Promise<UserProfile | null> {
    const res = await this.db.query(
      `SELECT id, email, username, display_name, student_id, school, faculty, academic_year,
              major, class_name, is_verified, verified_at, privacy_settings, preferences,
              location, website, birth_date,
              avatar_url, bio, role, status, reputation_points, is_onboarded, email_verified, skills, interests, created_at
       FROM users
       WHERE id = $1 LIMIT 1`,
      [id]
    )

    if (res.rows.length === 0) {
      return null
    }

    return this.mapUserRowToProfile(res.rows[0])
  }

  async register(data: RegisterInput): Promise<UserProfile> {
    const emailLower = data.email.toLowerCase().trim()

    if (data.username && isReservedUsername(data.username)) {
      throw new ConflictException('Tên đăng nhập này đã được hệ thống sử dụng')
    }

    const existing = await this.db.query(`SELECT id FROM users WHERE email = $1 OR username = $2 LIMIT 1`, [
      emailLower,
      data.username?.toLowerCase().trim() ?? null
    ])
    if (existing.rows.length > 0) {
      throw new ConflictException('Email hoặc Tên đăng nhập đã tồn tại trong hệ thống')
    }

    const usernameLower = data.username ? data.username.toLowerCase().trim() : await this.generateUniqueUsername(emailLower.split('@')[0])

    const salt = await bcrypt.genSalt(12)
    const passwordHash = await bcrypt.hash(data.password, salt)

    // Điền sẵn mã SV / khóa từ email trường (người dùng sửa sau trong Hồ sơ)
    const inferred = inferStudentInfoFromEmail(emailLower)

    const insertRes = await this.db.query(
      `INSERT INTO users (
        email, username, password_hash, display_name, student_id, faculty, academic_year, avatar_url, role, reputation_points, is_onboarded, is_verified, verified_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, TRUE, FALSE, NULL)
       RETURNING id, email, username, display_name, student_id, faculty, academic_year,
                 major, class_name, is_verified, verified_at, privacy_settings, preferences,
                 avatar_url, bio, role, status, reputation_points, is_onboarded, email_verified, skills, interests, created_at`,
      [
        emailLower,
        usernameLower,
        passwordHash,
        data.displayName.trim(),
        data.studentId || inferred.studentId || null,
        data.faculty || null,
        data.academicYear || inferred.academicYear || null,
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(usernameLower)}`,
        'student'
      ]
    )

    const user = this.mapUserRowToProfile(insertRes.rows[0])
    // Gửi email xác thực; lỗi gửi mail không làm hỏng việc đăng ký (người dùng có thể gửi lại)
    await this.sendVerification(user.id, user.email, user.displayName).catch((err) =>
      this.logger.error(`Gửi email xác thực thất bại (${user.email}): ${err?.message}`)
    )
    return user
  }

  // Kiểm tra email đã có tài khoản chưa (dùng cho luồng nhập email trước)
  async checkEmail(email: string): Promise<{ exists: boolean; hasPassword: boolean }> {
    const res = await this.db.query(`SELECT password_hash FROM users WHERE email = $1 LIMIT 1`, [email.toLowerCase().trim()])
    if (res.rows.length === 0) return { exists: false, hasPassword: false }
    return { exists: true, hasPassword: !!res.rows[0].password_hash }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  // Tạo token xác thực (lưu hash, hết hạn 24h) và gửi email
  async sendVerification(userId: string, email: string, displayName: string): Promise<void> {
    const token = randomBytes(32).toString('hex')
    await this.db.query(
      `UPDATE users SET verify_token_hash = $1, verify_token_expires = NOW() + INTERVAL '24 hours', verify_sent_at = NOW()
       WHERE id = $2`,
      [this.hashToken(token), userId]
    )
    const base = (this.config.get<string>('APP_URL') || 'http://localhost:3000').replace(/\/$/, '')
    await this.mail.sendVerificationEmail(email, displayName, `${base}/verify-email?token=${token}`)
  }

  // Gửi lại email xác thực (giới hạn 1 lần / 60 giây)
  async resendVerification(userId: string): Promise<{ sent: boolean }> {
    const res = await this.db.query(`SELECT email, display_name, email_verified, verify_sent_at FROM users WHERE id = $1 LIMIT 1`, [userId])
    const row = res.rows[0]
    if (!row) throw new NotFoundException('Người dùng không tồn tại')
    if (row.email_verified) return { sent: false }
    if (row.verify_sent_at && Date.now() - new Date(row.verify_sent_at).getTime() < 60_000) {
      throw new HttpException('Vui lòng đợi 1 phút trước khi gửi lại email', HttpStatus.TOO_MANY_REQUESTS)
    }
    await this.sendVerification(userId, row.email, row.display_name)
    return { sent: true }
  }

  // Quên mật khẩu: luôn trả cùng kết quả dù email có tồn tại hay không (chống dò tài khoản)
  async requestPasswordReset(email: string): Promise<void> {
    const res = await this.db.query(
      `SELECT id, email, display_name, reset_sent_at FROM users
       WHERE email = $1 AND account_type = 'human' LIMIT 1`,
      [email.toLowerCase().trim()]
    )
    const row = res.rows[0]
    if (!row) return
    // Tối đa 1 email / 60 giây / tài khoản (im lặng bỏ qua, không lộ trạng thái)
    if (row.reset_sent_at && Date.now() - new Date(row.reset_sent_at).getTime() < 60_000) return

    const token = randomBytes(32).toString('hex')
    await this.db.query(
      `UPDATE users SET reset_token_hash = $1, reset_token_expires = NOW() + INTERVAL '30 minutes', reset_sent_at = NOW()
       WHERE id = $2`,
      [this.hashToken(token), row.id]
    )
    const base = (this.config.get<string>('APP_URL') || 'http://localhost:3000').replace(/\/$/, '')
    // Gửi nền: thời gian phản hồi không phụ thuộc email có tồn tại
    void this.mail
      .sendPasswordResetEmail(row.email, row.display_name, `${base}/reset-password?token=${token}`)
      .catch((err) => this.logger.error(`Gửi email đặt lại mật khẩu thất bại (${row.email}): ${err?.message}`))
  }

  // Đặt mật khẩu mới bằng token (dùng một lần) và đăng xuất mọi phiên cũ
  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      throw new BadRequestException('Liên kết đặt lại mật khẩu không hợp lệ')
    }
    const passwordHash = await bcrypt.hash(newPassword, await bcrypt.genSalt(12))
    // UPDATE nguyên tử: token chỉ khớp một lần, nên hai yêu cầu song song không cùng thành công
    const res = await this.db.query(
      `UPDATE users
       SET password_hash = $1, reset_token_hash = NULL, reset_token_expires = NULL,
           password_changed_at = NOW(), updated_at = NOW()
       WHERE reset_token_hash = $2 AND reset_token_expires > NOW() AND account_type = 'human'
       RETURNING id, email, display_name`,
      [passwordHash, this.hashToken(token)]
    )
    const user = res.rows[0]
    if (!user) throw new BadRequestException('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn')

    // Hủy mọi phiên đăng nhập của tài khoản (session lưu Postgres, passport.user.id)
    await this.db.query(`DELETE FROM user_sessions WHERE sess::jsonb #>> '{passport,user,id}' = $1`, [user.id])

    void this.mail
      .sendPasswordChangedEmail(user.email, user.display_name)
      .catch((err) => this.logger.error(`Gửi cảnh báo đổi mật khẩu thất bại (${user.email}): ${err?.message}`))
  }

  // Xác thực email bằng token; email trường được cấp tích xanh
  async verifyEmail(token: string): Promise<UserProfile> {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      throw new BadRequestException('Liên kết xác thực không hợp lệ')
    }
    const res = await this.db.query(`SELECT id, email FROM users WHERE verify_token_hash = $1 AND verify_token_expires > NOW() LIMIT 1`, [
      this.hashToken(token)
    ])
    if (res.rows.length === 0) {
      throw new BadRequestException('Liên kết xác thực không hợp lệ hoặc đã hết hạn')
    }
    const { id, email } = res.rows[0]
    const isPhenikaa = isPhenikaaEmail(email)
    const upd = await this.db.query(
      `UPDATE users u
       SET email_verified = TRUE, email_verified_at = NOW(),
           verify_token_hash = NULL, verify_token_expires = NULL,
           is_verified = u.is_verified OR $2,
           verified_at = CASE WHEN $2 AND u.verified_at IS NULL THEN NOW() ELSE u.verified_at END,
           updated_at = NOW()
       FROM (SELECT is_verified AS was_verified FROM users WHERE id = $1) prev
       WHERE u.id = $1
       RETURNING prev.was_verified, u.is_verified, u.username`,
      [id, isPhenikaa]
    )
    // Vừa được cấp tích xanh ⇒ thông báo hệ thống
    const after = upd.rows[0]
    if (after && !after.was_verified && after.is_verified) {
      void this.notifications.dispatch([
        {
          type: 'account_verified',
          recipientId: id,
          actorId: null,
          verb: 'tài khoản của bạn đã được xác thực sinh viên Phenikaa (tích xanh)',
          entityType: 'user',
          entityId: id,
          link: `/${after.username}`
        }
      ])
    }
    return (await this.findById(id)) as UserProfile
  }

  // Tạo username hợp lệ (a-z0-9_, 3-30 ký tự) và chưa tồn tại
  private async generateUniqueUsername(seed: string): Promise<string> {
    const base = (
      seed
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 24) || 'user'
    ).padEnd(3, '0')
    let candidate = base
    for (let i = 0; i < 10; i++) {
      const taken = await this.db.query(`SELECT 1 FROM users WHERE username = $1 LIMIT 1`, [candidate])
      if (taken.rows.length === 0 && !isReservedUsername(candidate)) return candidate
      candidate = `${base}${Math.floor(1000 + Math.random() * 9000)}`
    }
    const fallback = `${base}${Date.now().toString(36)}`.slice(0, 30)
    return isReservedUsername(fallback) ? `user${Date.now().toString(36)}` : fallback
  }

  // Đăng nhập Google: tìm theo google_id → liên kết theo email đã xác thực → tạo mới
  async findOrCreateGoogleUser(profile: {
    googleId: string
    email: string
    emailVerified: boolean
    displayName: string
    avatarUrl?: string | null
  }): Promise<UserProfile> {
    const email = profile.email.toLowerCase().trim()

    const byGoogle = await this.db.query(`SELECT id FROM users WHERE google_id = $1 AND account_type = 'human' LIMIT 1`, [profile.googleId])
    if (byGoogle.rows.length > 0) {
      return (await this.findById(byGoogle.rows[0].id)) as UserProfile
    }

    // Chỉ liên kết tài khoản cũ khi Google xác nhận email (chống chiếm tài khoản)
    if (profile.emailVerified) {
      const byEmail = await this.db.query(`SELECT id, account_type FROM users WHERE email = $1 LIMIT 1`, [email])
      if (byEmail.rows.length > 0) {
        // Không bao giờ liên kết Google vào tài khoản bot/hệ thống
        if (byEmail.rows[0].account_type !== 'human') {
          throw new UnauthorizedException('Email này không thể dùng để đăng nhập')
        }
        await this.db.query(
          // Tài khoản chưa xác thực email: xóa mật khẩu (chống kẻ xấu đăng ký trước bằng email của người khác)
          `UPDATE users SET google_id = $1, avatar_url = COALESCE(avatar_url, $2),
                          password_hash = CASE WHEN email_verified THEN password_hash ELSE NULL END,
                          email_verified = TRUE,
                          email_verified_at = COALESCE(email_verified_at, NOW()), updated_at = NOW() WHERE id = $3`,
          [profile.googleId, profile.avatarUrl || null, byEmail.rows[0].id]
        )
        return (await this.findById(byEmail.rows[0].id)) as UserProfile
      }
    } else {
      throw new UnauthorizedException('Email Google chưa được xác minh')
    }

    // Google đã xác minh email → email trường được cấp tích xanh
    const isPhenikaa = isPhenikaaEmail(email)
    const inferred = inferStudentInfoFromEmail(email)
    const username = await this.generateUniqueUsername(email.split('@')[0])

    const insertRes = await this.db.query(
      `INSERT INTO users (email, username, password_hash, display_name, avatar_url, role, reputation_points,
                          is_onboarded, is_verified, verified_at, google_id, auth_provider, student_id, academic_year,
                          email_verified, email_verified_at)
       VALUES ($1, $2, NULL, $3, $4, 'student', 0, TRUE, $5, $6, $7, 'google', $8, $9, TRUE, NOW())
       RETURNING id`,
      [
        email,
        username,
        profile.displayName.trim().slice(0, 100) || username,
        profile.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`,
        isPhenikaa,
        isPhenikaa ? new Date() : null,
        profile.googleId,
        inferred.studentId || null,
        inferred.academicYear || null
      ]
    )
    return (await this.findById(insertRes.rows[0].id)) as UserProfile
  }

  async completeOnboarding(userId: string, data: OnboardingInput): Promise<UserProfile> {
    const userRes = await this.db.query(`SELECT id FROM users WHERE id = $1 LIMIT 1`, [userId])
    if (userRes.rows.length === 0) {
      throw new NotFoundException('Người dùng không tồn tại')
    }

    // Merge courses into interests if provided
    const interests = Array.from(new Set([...(data.courses || [])]))
    const skills = Array.from(new Set([...(data.skills || [])]))

    // Update user profile (loại bỏ điểm thưởng gamification)
    const updateRes = await this.db.query(
      `UPDATE users
       SET student_id = COALESCE($1, student_id),
           school = COALESCE($2, school),
           faculty = COALESCE($3, faculty),
           major = COALESCE($4, major),
           class_name = COALESCE($5, class_name),
           academic_year = COALESCE($6, academic_year),
           bio = COALESCE($7, bio),
           skills = $8,
           interests = $9,
           is_onboarded = TRUE,
           updated_at = NOW()
       WHERE id = $10
       RETURNING id, email, username, display_name, student_id, school, faculty, academic_year,
                 major, class_name, is_verified, verified_at, privacy_settings, preferences,
                 location, website, birth_date,
                 avatar_url, bio, role, status, reputation_points, is_onboarded, email_verified, skills, interests, created_at`,
      [
        data.studentId || null,
        data.school || null,
        data.faculty || null,
        data.major || null,
        data.className || null,
        data.academicYear || null,
        data.bio || null,
        skills,
        interests,
        userId
      ]
    )

    // Insert follow relationships if provided
    if (data.followUserIds && data.followUserIds.length > 0) {
      for (const target of data.followUserIds) {
        if (!target) continue
        try {
          const targetUser = await this.db.query(`SELECT id FROM users WHERE id::text = $1 OR username = $1 LIMIT 1`, [target])
          if (targetUser.rows.length > 0 && targetUser.rows[0].id !== userId) {
            const followedId = targetUser.rows[0].id
            const existingFollow = await this.db.query(`SELECT 1 FROM user_follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1`, [userId, followedId])
            if (existingFollow.rows.length === 0) {
              await this.db.query(`INSERT INTO user_follows (follower_id, following_id) VALUES ($1, $2)`, [userId, followedId])
            }
          }
        } catch {
          // Ignore invalid target identifier gracefully
        }
      }
    }

    this.logger.log(`User ${userId} completed onboarding successfully`)
    return this.mapUserRowToProfile(updateRes.rows[0])
  }

  private mapUserRowToProfile(row: any): UserProfile {
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      displayName: row.display_name,
      studentId: row.student_id,
      school: row.school || null,
      faculty: row.faculty,
      academicYear: row.academic_year,
      major: row.major || null,
      className: row.class_name || null,
      isVerified: !!row.is_verified,
      verifiedAt: row.verified_at ? new Date(row.verified_at).toISOString() : null,
      privacySettings: resolvePrivacySettings(row.privacy_settings),
      preferences: resolveFeaturePreferences(row.preferences),
      location: row.location || null,
      website: row.website || null,
      birthDate: row.birth_date || null,
      avatarUrl: row.avatar_url,
      bio: row.bio,
      role: row.role,
      status: row.status || 'active',
      reputationPoints: row.reputation_points || 0,
      isOnboarded: !!row.is_onboarded,
      isEmailVerified: !!row.email_verified,
      skills: row.skills || [],
      interests: row.interests || [],
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
    }
  }
}

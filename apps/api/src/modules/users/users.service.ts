import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import type { UserProfile, UpdateProfileInput, UpdatePrivacySettingsInput, PrivacySettings, FeaturePreferences } from '@pu/schemas'
import { UnitRequestsService } from '../units/unit-requests.service'
import { mapUserUnits, USER_UNIT_COLUMNS } from '../units/unit-sql'
import { UserEventsService } from '../personalization/user-events.service'
import { resolvePrivacySettings } from './dto/privacy.dto'
import { resolveFeaturePreferences, type UpdatePreferencesInput } from './dto/preferences.dto'

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly userEvents: UserEventsService,
    private readonly unitRequests: UnitRequestsService
  ) {}

  // Báo cáo người dùng: không tự báo cáo, không trùng khi báo cáo cũ còn chờ
  async report(reportedId: string, reporterId: string, data: { reason?: string; details?: string }): Promise<{ success: boolean }> {
    if (reportedId === reporterId) throw new ForbiddenException('Không thể báo cáo chính bạn')
    const target = await this.db.query(`SELECT 1 FROM users WHERE id = $1 AND account_type = 'human'`, [reportedId])
    if (!target.rows[0]) throw new NotFoundException('Không tìm thấy người dùng')
    await this.db.query(
      `INSERT INTO user_reports (reported_id, reporter_id, reason, details) VALUES ($1, $2, $3, $4)
       ON CONFLICT (reported_id, reporter_id) WHERE status = 'pending' DO NOTHING`,
      [reportedId, reporterId, data.reason ?? 'other', data.details || null]
    )
    return { success: true }
  }

  /**
   * Lấy thông tin hồ sơ sinh viên, tự động lọc theo privacy_settings
   */
  async getProfileByUsername(username: string, viewerId?: string): Promise<UserProfile> {
    const res = await this.db.query(
      `SELECT u.id, u.email, u.username, u.display_name, u.student_id, u.is_verified, u.verified_at, u.privacy_settings,
              u.location, u.website, u.birth_date,
              u.avatar_url, u.banner_url, u.bio, u.role, u.status, u.reputation_points, u.is_onboarded, u.skills, u.interests, u.created_at,
              ${USER_UNIT_COLUMNS('u')}
       FROM users u
       WHERE u.username = $1 LIMIT 1`,
      [username.toLowerCase().trim()]
    )

    if (res.rows.length === 0) {
      throw new NotFoundException(`Không tìm thấy người dùng @${username}`)
    }

    const row = res.rows[0]
    const isOwner = viewerId && viewerId === row.id
    const privacy = resolvePrivacySettings(row.privacy_settings)

    return {
      id: row.id,
      email: isOwner || privacy.showEmail ? row.email : '',
      username: row.username,
      displayName: row.display_name,
      studentId: isOwner || privacy.showStudentId ? row.student_id : null,
      ...mapUserUnits(row, !!isOwner),
      location: row.location || null,
      website: row.website || null,
      birthDate: row.birth_date || null,
      isVerified: !!row.is_verified,
      verifiedAt: row.verified_at ? new Date(row.verified_at).toISOString() : null,
      privacySettings: privacy,
      avatarUrl: row.avatar_url,
      bannerUrl: row.banner_url || null,
      bio: row.bio,
      role: row.role,
      reputationPoints: row.reputation_points || 0,
      isOnboarded: !!row.is_onboarded,
      skills: row.skills || [],
      interests: row.interests || [],
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
    }
  }

  /**
   * Cập nhật hồ sơ (tên, tiểu sử, trường, lĩnh vực quan tâm, kỹ năng, sở thích, ảnh)
   */
  async updateProfile(userId: string, data: UpdateProfileInput): Promise<UserProfile> {
    // Chỉ nhận ảnh https hoặc đường dẫn nội bộ (chặn blob:/data:/javascript:)
    for (const [field, url] of [
      ['avatarUrl', data.avatarUrl],
      ['bannerUrl', data.bannerUrl]
    ] as const) {
      if (url && !/^(https:\/\/|\/(?!\/))/i.test(url)) {
        throw new BadRequestException(`${field} phải là URL https đã tải lên`)
      }
    }

    const setClauses: string[] = []
    const values: any[] = []

    if (data.displayName !== undefined) {
      values.push(data.displayName.trim())
      setClauses.push(`display_name = $${values.length}`)
    }
    if (data.bio !== undefined) {
      values.push(data.bio ? data.bio.trim() : null)
      setClauses.push(`bio = $${values.length}`)
    }
    if (data.avatarUrl !== undefined) {
      values.push(data.avatarUrl)
      setClauses.push(`avatar_url = $${values.length}`)
    }
    if (data.bannerUrl !== undefined) {
      values.push(data.bannerUrl)
      setClauses.push(`banner_url = $${values.length}`)
    }
    if (data.location !== undefined) {
      values.push(data.location ? data.location.trim() : null)
      setClauses.push(`location = $${values.length}`)
    }
    if (data.website !== undefined) {
      values.push(data.website ? data.website.trim() : null)
      setClauses.push(`website = $${values.length}`)
    }
    if (data.birthDate !== undefined) {
      values.push(data.birthDate ? data.birthDate.trim() : null)
      setClauses.push(`birth_date = $${values.length}`)
    }
    if (data.skills !== undefined) {
      values.push(data.skills)
      setClauses.push(`skills = $${values.length}`)
    }
    if (data.interests !== undefined) {
      values.push(data.interests)
      setClauses.push(`interests = $${values.length}`)
    }

    const hasUnitChoice = [data.universityId, data.universityOther, data.interestFieldId, data.interestFieldIds, data.interestFieldOther].some((v) => v !== undefined)
    if (setClauses.length === 0 && !hasUnitChoice) {
      throw new BadRequestException('Không có trường nào để cập nhật')
    }

    // Hồ sơ + lựa chọn trường / lĩnh vực ("Khác" ⇒ yêu cầu chờ duyệt) lưu cùng một transaction
    const username = await this.db.transaction(async (client) => {
      if (hasUnitChoice) await this.unitRequests.applyChoice(client, userId, data)
      setClauses.push(`updated_at = NOW()`)
      values.push(userId)
      const res = await client.query(`UPDATE users SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING username`, values)
      if (res.rows.length === 0) throw new NotFoundException('Người dùng không tồn tại')
      return res.rows[0].username as string
    })
    this.logger.log(`User ${userId} updated profile successfully`)
    return this.getProfileByUsername(username, userId)
  }

  /**
   * Cập nhật cấu hình bảo mật quyền riêng tư
   */
  async updatePrivacySettings(userId: string, data: UpdatePrivacySettingsInput): Promise<PrivacySettings> {
    const existing = await this.db.query(`SELECT privacy_settings FROM users WHERE id = $1 LIMIT 1`, [userId])
    if (existing.rows.length === 0) {
      throw new NotFoundException('Người dùng không tồn tại')
    }

    // Chỉ ghi đè trường được gửi lên (Patch semantics)
    const changes = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
    const updatedPrivacy = resolvePrivacySettings({ ...resolvePrivacySettings(existing.rows[0].privacy_settings), ...changes })

    await this.db.query(`UPDATE users SET privacy_settings = $1::jsonb, updated_at = NOW() WHERE id = $2`, [JSON.stringify(updatedPrivacy), userId])

    // Tắt cá nhân hóa ⇒ xóa hành vi đã ghi & hồ sơ quan tâm
    if (changes.personalization === false) await this.userEvents.forget(userId)

    this.logger.log(`User ${userId} updated privacy settings: ${JSON.stringify(updatedPrivacy)}`)
    return updatedPrivacy
  }

  // Gộp cờ tính năng vào preferences (jsonb ||, 1 câu lệnh) rồi trả bản đầy đủ
  // Merge feature flags atomically; returns resolved preferences
  async updatePreferences(userId: string, data: UpdatePreferencesInput): Promise<FeaturePreferences> {
    const changes = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
    const res = await this.db.query(
      `UPDATE users SET preferences = COALESCE(preferences, '{}'::jsonb) || $1::jsonb, updated_at = NOW()
       WHERE id = $2 RETURNING preferences`,
      [JSON.stringify(changes), userId]
    )
    if (res.rows.length === 0) throw new NotFoundException('Người dùng không tồn tại')
    return resolveFeaturePreferences(res.rows[0].preferences)
  }

  /**
   * Xác thực tài khoản sinh viên chính quy Phenikaa
   */
  async verifyUniversityAccount(userId: string): Promise<{ isVerified: boolean; message: string }> {
    const userRes = await this.db.query(`SELECT email, is_verified FROM users WHERE id = $1 LIMIT 1`, [userId])
    if (userRes.rows.length === 0) {
      throw new NotFoundException('Người dùng không tồn tại')
    }

    const { email, is_verified } = userRes.rows[0]
    if (is_verified) {
      return { isVerified: true, message: 'Tài khoản của bạn đã được cấp Tích Xanh chính quy' }
    }

    const emailLower = (email || '').toLowerCase()
    const isPhenikaa = emailLower.endsWith('@phenikaa-uni.edu.vn') || emailLower.endsWith('@st.phenikaa-uni.edu.vn')

    if (isPhenikaa) {
      await this.db.query(`UPDATE users SET is_verified = TRUE, verified_at = NOW(), updated_at = NOW() WHERE id = $1`, [userId])
      return { isVerified: true, message: 'Xác thực thành công! Tài khoản của bạn đã nhận Huy hiệu Tích Xanh sinh viên Phenikaa' }
    }

    return {
      isVerified: false,
      message:
        'Email đăng ký không thuộc tên miền chính quy (@phenikaa-uni.edu.vn / @st.phenikaa-uni.edu.vn). Vui lòng cập nhật email trường để nhận Tích Xanh.'
    }
  }
}

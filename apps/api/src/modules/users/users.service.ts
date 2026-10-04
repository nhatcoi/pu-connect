import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import type { UserProfile, UpdateProfileInput, UpdatePrivacySettingsInput, PrivacySettings } from '@pu/schemas'

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)

  constructor(private readonly db: DatabaseService) {}

  /**
   * Lấy thông tin hồ sơ sinh viên, tự động lọc theo privacy_settings
   */
  async getProfileByUsername(username: string, viewerId?: string): Promise<UserProfile> {
    const res = await this.db.query(
      `SELECT id, email, username, display_name, student_id, school, faculty, academic_year,
              major, class_name, is_verified, verified_at, privacy_settings,
              location, website, birth_date,
              avatar_url, banner_url, bio, role, status, reputation_points, is_onboarded, skills, interests, created_at
       FROM users
       WHERE username = $1 LIMIT 1`,
      [username.toLowerCase().trim()]
    )

    if (res.rows.length === 0) {
      throw new NotFoundException(`Không tìm thấy người dùng @${username}`)
    }

    const row = res.rows[0]
    const isOwner = viewerId && viewerId === row.id
    const privacy: PrivacySettings = row.privacy_settings || {
      showEmail: false,
      showStudentId: true,
      showClass: true,
      isPrivateProfile: false
    }

    return {
      id: row.id,
      email: isOwner || privacy.showEmail ? row.email : '',
      username: row.username,
      displayName: row.display_name,
      studentId: isOwner || privacy.showStudentId ? row.student_id : null,
      school: row.school || null,
      faculty: row.faculty || null,
      academicYear: row.academic_year || null,
      major: row.major || null,
      className: isOwner || privacy.showClass ? row.class_name : null,
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
   * Cập nhật hồ sơ sinh viên (Display Name, Bio, Major, Class, Skills, Interests, Avatar)
   */
  async updateProfile(userId: string, data: UpdateProfileInput): Promise<UserProfile> {
    // Chỉ nhận ảnh https hoặc đường dẫn nội bộ (chặn blob:/data:/javascript:)
    for (const [field, url] of [['avatarUrl', data.avatarUrl], ['bannerUrl', data.bannerUrl]] as const) {
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
    if (data.school !== undefined) {
      values.push(data.school ? data.school.trim() : null)
      setClauses.push(`school = $${values.length}`)
    }
    if (data.faculty !== undefined) {
      values.push(data.faculty ? data.faculty.trim() : null)
      setClauses.push(`faculty = $${values.length}`)
    }
    if (data.academicYear !== undefined) {
      values.push(data.academicYear ? data.academicYear.trim() : null)
      setClauses.push(`academic_year = $${values.length}`)
    }
    if (data.major !== undefined) {
      values.push(data.major ? data.major.trim() : null)
      setClauses.push(`major = $${values.length}`)
    }
    if (data.className !== undefined) {
      values.push(data.className ? data.className.trim() : null)
      setClauses.push(`class_name = $${values.length}`)
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

    if (setClauses.length === 0) {
      throw new BadRequestException('Không có trường nào để cập nhật')
    }

    setClauses.push(`updated_at = NOW()`)
    values.push(userId)

    const sql = `
      UPDATE users
      SET ${setClauses.join(', ')}
      WHERE id = $${values.length}
      RETURNING id, email, username, display_name, student_id, school, faculty, academic_year,
                major, class_name, is_verified, verified_at, privacy_settings,
                location, website, birth_date,
                avatar_url, banner_url, bio, role, status, reputation_points, is_onboarded, skills, interests, created_at
    `

    const res = await this.db.query(sql, values)
    if (res.rows.length === 0) {
      throw new NotFoundException('Người dùng không tồn tại')
    }

    const row = res.rows[0]
    this.logger.log(`User ${userId} updated profile successfully`)

    return {
      id: row.id,
      email: row.email,
      username: row.username,
      displayName: row.display_name,
      studentId: row.student_id,
      school: row.school || null,
      faculty: row.faculty || null,
      academicYear: row.academic_year || null,
      major: row.major || null,
      className: row.class_name || null,
      location: row.location || null,
      website: row.website || null,
      birthDate: row.birth_date || null,
      isVerified: !!row.is_verified,
      verifiedAt: row.verified_at ? new Date(row.verified_at).toISOString() : null,
      privacySettings: row.privacy_settings || {
        showEmail: false,
        showStudentId: true,
        showClass: true,
        isPrivateProfile: false
      },
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
   * Cập nhật cấu hình bảo mật quyền riêng tư
   */
  async updatePrivacySettings(userId: string, data: UpdatePrivacySettingsInput): Promise<PrivacySettings> {
    const existing = await this.db.query(`SELECT privacy_settings FROM users WHERE id = $1 LIMIT 1`, [userId])
    if (existing.rows.length === 0) {
      throw new NotFoundException('Người dùng không tồn tại')
    }

    const currentPrivacy: PrivacySettings = existing.rows[0].privacy_settings || {
      showEmail: false,
      showStudentId: true,
      showClass: true,
      isPrivateProfile: false
    }

    const updatedPrivacy: PrivacySettings = {
      showEmail: data.showEmail !== undefined ? data.showEmail : currentPrivacy.showEmail,
      showStudentId: data.showStudentId !== undefined ? data.showStudentId : currentPrivacy.showStudentId,
      showClass: data.showClass !== undefined ? data.showClass : currentPrivacy.showClass,
      isPrivateProfile: data.isPrivateProfile !== undefined ? data.isPrivateProfile : currentPrivacy.isPrivateProfile
    }

    await this.db.query(
      `UPDATE users SET privacy_settings = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(updatedPrivacy), userId]
    )

    this.logger.log(`User ${userId} updated privacy settings: ${JSON.stringify(updatedPrivacy)}`)
    return updatedPrivacy
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
      await this.db.query(
        `UPDATE users SET is_verified = TRUE, verified_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [userId]
      )
      return { isVerified: true, message: 'Xác thực thành công! Tài khoản của bạn đã nhận Huy hiệu Tích Xanh sinh viên Phenikaa' }
    }

    return {
      isVerified: false,
      message: 'Email đăng ký không thuộc tên miền chính quy (@phenikaa-uni.edu.vn / @st.phenikaa-uni.edu.vn). Vui lòng cập nhật email trường để nhận Tích Xanh.'
    }
  }
}

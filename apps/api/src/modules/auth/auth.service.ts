import { Injectable, UnauthorizedException, ConflictException, NotFoundException, Logger } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import type { RegisterInput, OnboardingInput, UserProfile } from '@pu/schemas'
import * as bcrypt from 'bcryptjs'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(private readonly db: DatabaseService) {}

  async validateUser(emailOrUsername: string, password: string): Promise<UserProfile | null> {
    const res = await this.db.query(
      `SELECT id, email, username, password_hash, display_name, student_id, school, faculty, academic_year,
              major, class_name, is_verified, verified_at, privacy_settings,
              location, website, birth_date,
              avatar_url, bio, role, status, reputation_points, is_onboarded, skills, interests, created_at
       FROM users
       WHERE email = $1 OR username = $1 LIMIT 1`,
      [emailOrUsername.toLowerCase().trim()]
    )

    if (res.rows.length === 0) {
      return null
    }

    const row = res.rows[0]
    const isMatch = await bcrypt.compare(password, row.password_hash)
    if (!isMatch) {
      return null
    }

    return this.mapUserRowToProfile(row)
  }

  async findById(id: string): Promise<UserProfile | null> {
    const res = await this.db.query(
      `SELECT id, email, username, display_name, student_id, school, faculty, academic_year,
              major, class_name, is_verified, verified_at, privacy_settings,
              location, website, birth_date,
              avatar_url, bio, role, status, reputation_points, is_onboarded, skills, interests, created_at
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
    const usernameLower = data.username.toLowerCase().trim()

    const existing = await this.db.query(
      `SELECT id FROM users WHERE email = $1 OR username = $2 LIMIT 1`,
      [emailLower, usernameLower]
    )

    if (existing.rows.length > 0) {
      throw new ConflictException('Email hoặc Tên đăng nhập đã tồn tại trong hệ thống')
    }

    const salt = await bcrypt.genSalt(10)
    const passwordHash = await bcrypt.hash(data.password, salt)

    // Tự động cấp tích xanh cho email chính quy của trường Phenikaa
    const isPhenikaa = emailLower.endsWith('@phenikaa-uni.edu.vn') || emailLower.endsWith('@st.phenikaa-uni.edu.vn')

    const insertRes = await this.db.query(
      `INSERT INTO users (
        email, username, password_hash, display_name, student_id, faculty, academic_year, avatar_url, role, reputation_points, is_onboarded, is_verified, verified_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, FALSE, $10, $11)
       RETURNING id, email, username, display_name, student_id, faculty, academic_year,
                 major, class_name, is_verified, verified_at, privacy_settings,
                 avatar_url, bio, role, status, reputation_points, is_onboarded, skills, interests, created_at`,
      [
        emailLower,
        usernameLower,
        passwordHash,
        data.displayName.trim(),
        data.studentId || null,
        data.faculty || null,
        data.academicYear || null,
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(data.username)}`,
        'student',
        isPhenikaa,
        isPhenikaa ? new Date() : null
      ]
    )

    return this.mapUserRowToProfile(insertRes.rows[0])
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
                 major, class_name, is_verified, verified_at, privacy_settings,
                 location, website, birth_date,
                 avatar_url, bio, role, status, reputation_points, is_onboarded, skills, interests, created_at`,
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
          const targetUser = await this.db.query(
            `SELECT id FROM users WHERE id::text = $1 OR username = $1 LIMIT 1`,
            [target]
          )
          if (targetUser.rows.length > 0 && targetUser.rows[0].id !== userId) {
            const followedId = targetUser.rows[0].id
            const existingFollow = await this.db.query(
              `SELECT 1 FROM user_follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1`,
              [userId, followedId]
            )
            if (existingFollow.rows.length === 0) {
              await this.db.query(
                `INSERT INTO user_follows (follower_id, following_id) VALUES ($1, $2)`,
                [userId, followedId]
              )
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
      privacySettings: row.privacy_settings || {
        showEmail: false,
        showStudentId: true,
        showClass: true,
        isPrivateProfile: false
      },
      location: row.location || null,
      website: row.website || null,
      birthDate: row.birth_date || null,
      avatarUrl: row.avatar_url,
      bio: row.bio,
      role: row.role,
      reputationPoints: row.reputation_points || 0,
      isOnboarded: !!row.is_onboarded,
      skills: row.skills || [],
      interests: row.interests || [],
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
    }
  }
}

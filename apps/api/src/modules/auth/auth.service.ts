import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger
} from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { DatabaseService } from '../../database/database.service'
import type { RegisterInput, OnboardingInput, UserProfile } from '@pu/schemas'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(private readonly db: DatabaseService) {}

  async validateUser(emailOrUsername: string, password: string): Promise<UserProfile | null> {
    const res = await this.db.query(
      `SELECT id, email, username, password_hash, display_name, student_id, faculty, academic_year, avatar_url, bio, role, status, reputation_points, is_onboarded, skills, interests, created_at
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
      `SELECT id, email, username, display_name, student_id, faculty, academic_year, avatar_url, bio, role, status, reputation_points, is_onboarded, skills, interests, created_at
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
    const existing = await this.db.query(
      `SELECT id FROM users WHERE email = $1 OR username = $2 LIMIT 1`,
      [data.email.toLowerCase().trim(), data.username.toLowerCase().trim()]
    )

    if (existing.rows.length > 0) {
      throw new ConflictException('Email hoặc Tên đăng nhập đã tồn tại trong hệ thống')
    }

    const salt = await bcrypt.genSalt(10)
    const passwordHash = await bcrypt.hash(data.password, salt)

    const insertRes = await this.db.query(
      `INSERT INTO users (
        email, username, password_hash, display_name, student_id, faculty, academic_year, avatar_url, role, reputation_points, is_onboarded
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE)
       RETURNING id, email, username, display_name, student_id, faculty, academic_year, avatar_url, bio, role, status, reputation_points, is_onboarded, skills, interests, created_at`,
      [
        data.email.toLowerCase().trim(),
        data.username.toLowerCase().trim(),
        passwordHash,
        data.displayName.trim(),
        data.studentId || null,
        data.faculty || null,
        data.academicYear || null,
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(data.username)}`,
        'student',
        100
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

    // Update user profile and award 100 bonus reputation points
    const updateRes = await this.db.query(
      `UPDATE users
       SET student_id = COALESCE($1, student_id),
           faculty = COALESCE($2, faculty),
           academic_year = COALESCE($3, academic_year),
           bio = COALESCE($4, bio),
           skills = $5,
           interests = $6,
           is_onboarded = TRUE,
           reputation_points = reputation_points + 100,
           updated_at = NOW()
       WHERE id = $7
       RETURNING id, email, username, display_name, student_id, faculty, academic_year, avatar_url, bio, role, status, reputation_points, is_onboarded, skills, interests, created_at`,
      [
        data.studentId || null,
        data.faculty || null,
        data.academicYear || null,
        data.bio || null,
        skills,
        interests,
        userId
      ]
    )

    // Insert follow relationships if provided
    if (data.followUserIds && data.followUserIds.length > 0) {
      for (const targetId of data.followUserIds) {
        if (targetId && targetId !== userId) {
          await this.db.query(
            `INSERT INTO user_follows (follower_id, following_id)
             VALUES ($1, $2)
             ON CONFLICT (follower_id, following_id) DO NOTHING`,
            [userId, targetId]
          )
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
      faculty: row.faculty,
      academicYear: row.academic_year,
      avatarUrl: row.avatar_url,
      bio: row.bio,
      role: row.role,
      reputationPoints: row.reputation_points,
      isOnboarded: !!row.is_onboarded,
      skills: row.skills || [],
      interests: row.interests || [],
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
    }
  }
}

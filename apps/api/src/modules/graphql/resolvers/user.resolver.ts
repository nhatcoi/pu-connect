import { Resolver, Query, Mutation, Args, Context, ResolveField, Parent, ID, Int } from '@nestjs/graphql'
import { UserType } from '../types/user.type'
import { PostType } from '../types/post.type'
import { DocumentType } from '../types/document.type'
import { StudyGroupType } from '../types/study-group.type'
import { FollowResultType } from '../types/follow-result.type'
import { DatabaseService } from '../../../database/database.service'
import { NotificationsService } from '../../notifications/notifications.service'
import { NotFoundException, BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common'
import type { BlockState } from '@pu/schemas'
import { blockExistsSql, blockStateSql } from '../../blocks/blocks.sql'
import { ProfileAccessService } from '../../users/profile-access.service'
import { postListedSql } from '../../posts/post-access.sql'

@Resolver(() => UserType)
export class UserResolver {
  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
    private readonly profileAccess: ProfileAccessService
  ) {}

  // Hồ sơ: áp privacy (email / MSSV / lớp) + hồ sơ riêng tư + tab hoạt động theo người xem
  @Query(() => UserType, { name: 'userProfile', nullable: true })
  async getUserProfile(
    @Args('username', { type: () => String }) username: string,
    @Context() context: any
  ): Promise<UserType | null> {
    const res = await this.db.query(
      `SELECT id, email, username, display_name, student_id, school, faculty, academic_year, major, class_name, is_verified, avatar_url, bio, role,
              reputation_points, created_at, banner_url, location, website, to_char(birth_date, 'YYYY-MM-DD') AS birth_date
       FROM users
       WHERE username = $1 LIMIT 1`,
      [username.toLowerCase().trim()]
    )

    if (res.rows.length === 0) {
      throw new NotFoundException(`Không tìm thấy sinh viên/giảng viên @${username}`)
    }

    const row = res.rows[0]
    const user: UserType = {
      ...this.mapRowToUser(row, true),
      school: row.school || null,
      bannerUrl: row.banner_url || null,
      location: row.location || null,
      website: row.website || null,
      birthDate: row.birth_date || null
    }
    const viewerId = this.viewerId(context)
    const access = await this.profileAccess.resolve({ id: user.id }, viewerId)
    const { privacy, isOwner } = access
    // Ghi lượt xem hồ sơ (chỉ admin xem được): gộp theo giờ, không chờ, lỗi bỏ qua
    if (viewerId && !isOwner) {
      void this.db
        .query(
          `INSERT INTO profile_views (profile_id, viewer_id, viewed_hour)
           VALUES ($1, $2, date_trunc('hour', NOW() AT TIME ZONE 'UTC'))
           ON CONFLICT (profile_id, viewer_id, viewed_hour) DO UPDATE SET views = profile_views.views + 1, last_at = NOW()`,
          [user.id, viewerId]
        )
        .catch(() => undefined)
    }
    return {
      ...user,
      email: isOwner || privacy.showEmail ? user.email : '',
      studentId: isOwner || privacy.showStudentId ? user.studentId : null,
      className: isOwner || privacy.showClass ? user.className : null,
      isContentLocked: access.locked,
      activityTabs: access.activityTabs,
      access
    }
  }

  @Query(() => UserType, { name: 'me', nullable: true })
  async getMe(@Context() context: any): Promise<UserType | null> {
    const user = context?.req?.user || context?.req?.session?.passport?.user
    if (!user) return null
    return user
  }

  @Query(() => [UserType], { name: 'suggestedUsers' })
  async getSuggestedUsers(@Args('limit', { type: () => Int, nullable: true, defaultValue: 5 }) limit: number, @Context() context: any): Promise<UserType[]> {
    const currentUserId = context?.req?.user?.id || context?.req?.session?.passport?.user?.id

    let sql = `
      SELECT u.id, u.email, u.username, u.display_name, u.student_id, u.faculty,
             u.academic_year, u.major, u.class_name, u.is_verified, u.avatar_url, u.bio, u.role, u.reputation_points, u.created_at
      FROM users u
      WHERE u.account_type = 'human'
    `
    const params: any[] = []

    if (currentUserId) {
      params.push(currentUserId)
      sql += ` AND u.id != $${params.length}
               AND u.id NOT IN (SELECT following_id FROM user_follows WHERE follower_id = $${params.length})
               AND NOT ${blockExistsSql(`$${params.length}`, 'u.id')}`
    }

    params.push(limit || 5)
    sql += ` ORDER BY CASE WHEN u.role = 'lecturer' THEN 0 ELSE 1 END, u.reputation_points DESC LIMIT $${params.length}`

    const res = await this.db.query(sql, params)
    return res.rows.map((row) => this.mapRowToUser(row))
  }

  @Query(() => [UserType], { name: 'userFollowers' })
  async getUserFollowers(@Args('userId', { type: () => ID }) userId: string): Promise<UserType[]> {
    const res = await this.db.query(
      `SELECT u.id, u.email, u.username, u.display_name, u.student_id, u.faculty,
              u.academic_year, u.major, u.class_name, u.is_verified, u.avatar_url, u.bio, u.role, u.reputation_points, u.created_at
       FROM users u
       JOIN user_follows uf ON u.id = uf.follower_id
       WHERE uf.following_id = $1
       ORDER BY uf.created_at DESC
       LIMIT 50`,
      [userId]
    )
    return res.rows.map((row) => this.mapRowToUser(row))
  }

  @Query(() => [UserType], { name: 'userFollowing' })
  async getUserFollowing(@Args('userId', { type: () => ID }) userId: string): Promise<UserType[]> {
    const res = await this.db.query(
      `SELECT u.id, u.email, u.username, u.display_name, u.student_id, u.faculty,
              u.academic_year, u.major, u.class_name, u.is_verified, u.avatar_url, u.bio, u.role, u.reputation_points, u.created_at
       FROM users u
       JOIN user_follows uf ON u.id = uf.following_id
       WHERE uf.follower_id = $1
       ORDER BY uf.created_at DESC
       LIMIT 50`,
      [userId]
    )
    return res.rows.map((row) => this.mapRowToUser(row))
  }

  @Mutation(() => FollowResultType, { name: 'toggleFollow' })
  async toggleFollow(@Args('targetUserId', { type: () => ID }) targetUserId: string, @Context() context: any): Promise<FollowResultType> {
    const currentUserId = context?.req?.user?.id || context?.req?.session?.passport?.user?.id
    if (!currentUserId) {
      throw new UnauthorizedException('Vui lòng đăng nhập để thực hiện theo dõi')
    }

    if (currentUserId === targetUserId) {
      throw new BadRequestException('Không thể tự theo dõi chính mình')
    }

    // Check if target user exists
    const targetCheck = await this.db.query(`SELECT id FROM users WHERE id = $1 LIMIT 1`, [targetUserId])
    if (targetCheck.rows.length === 0) {
      throw new NotFoundException('Không tìm thấy người dùng này')
    }

    // Check if already follows
    const existCheck = await this.db.query(`SELECT 1 FROM user_follows WHERE follower_id = $1 AND following_id = $2`, [currentUserId, targetUserId])

    let isFollowing = false
    if (existCheck.rows.length > 0) {
      await this.db.query(`DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2`, [currentUserId, targetUserId])
      isFollowing = false
    } else {
      const blocked = await this.db.query(`SELECT ${blockExistsSql('$1::uuid', '$2::uuid')} AS blocked`, [currentUserId, targetUserId])
      if (blocked.rows[0].blocked) throw new ForbiddenException('Không thể theo dõi người dùng này')
      await this.db.query(`INSERT INTO user_follows (follower_id, following_id) VALUES ($1, $2)`, [currentUserId, targetUserId])
      isFollowing = true

      // Gộp: "A và N người khác đã bắt đầu theo dõi bạn"
      const actor = await this.db.query(`SELECT username FROM users WHERE id = $1`, [currentUserId])
      void this.notifications.dispatch([
        {
          type: 'user_follow',
          recipientId: targetUserId,
          actorId: currentUserId,
          verb: 'đã bắt đầu theo dõi bạn',
          entityType: 'user',
          entityId: currentUserId,
          link: `/${actor.rows[0]?.username || ''}`,
          groupKey: 'user_follow'
        }
      ])
    }

    const followersRes = await this.db.query(`SELECT COUNT(*)::int as count FROM user_follows WHERE following_id = $1`, [targetUserId])
    const followingRes = await this.db.query(`SELECT COUNT(*)::int as count FROM user_follows WHERE follower_id = $1`, [currentUserId])

    return {
      isFollowing,
      followersCount: followersRes.rows[0]?.count || 0,
      followingCount: followingRes.rows[0]?.count || 0
    }
  }

  @ResolveField(() => Int, { name: 'followersCount' })
  async getFollowersCount(@Parent() user: UserType): Promise<number> {
    const res = await this.db.query(`SELECT COUNT(*)::int as count FROM user_follows WHERE following_id = $1`, [user.id])
    return res.rows[0]?.count || 0
  }

  @ResolveField(() => Int, { name: 'followingCount' })
  async getFollowingCount(@Parent() user: UserType): Promise<number> {
    const res = await this.db.query(`SELECT COUNT(*)::int as count FROM user_follows WHERE follower_id = $1`, [user.id])
    return res.rows[0]?.count || 0
  }

  @ResolveField(() => Boolean, { name: 'isFollowedByMe' })
  async getIsFollowedByMe(@Parent() user: UserType, @Context() context: any): Promise<boolean> {
    const currentUserId = context?.req?.user?.id || context?.req?.session?.passport?.user?.id
    if (!currentUserId || currentUserId === user.id) {
      return false
    }
    const res = await this.db.query(`SELECT 1 FROM user_follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1`, [currentUserId, user.id])
    return res.rows.length > 0
  }

  // Quan hệ chặn giữa người xem và hồ sơ này
  @ResolveField(() => String, { name: 'blockState' })
  async getBlockState(@Parent() user: UserType, @Context() context: any): Promise<BlockState> {
    const viewerId = this.viewerId(context)
    if (!viewerId || viewerId === user.id) return 'none'
    const res = await this.db.query(`SELECT ${blockStateSql('$1::uuid', '$2::uuid')} AS state`, [viewerId, user.id])
    return res.rows[0]?.state ?? 'none'
  }

  // Có quan hệ chặn / hồ sơ riêng tư chưa theo dõi ⇒ không trả bài viết / tài liệu
  @ResolveField(() => [PostType], { name: 'posts' })
  async getUserPosts(@Parent() user: UserType, @Context() context: any): Promise<PostType[]> {
    if (await this.isHiddenFromViewer(context, user)) return []
    const res = await this.db.query(
      `SELECT p.*,
              u.id as author_id, u.email as author_email, u.username as author_username,
              u.display_name as author_display_name, u.avatar_url as author_avatar_url,
              u.role as author_role, u.faculty as author_faculty, u.reputation_points as author_reputation_points,
              u.created_at as author_created_at
       FROM posts p
       JOIN users u ON p.author_id = u.id
       WHERE p.author_id = $1 AND p.hidden_at IS NULL AND NOT p.is_anonymous AND ${postListedSql('$2::uuid')}
       ORDER BY p.is_pinned DESC, p.created_at DESC
       LIMIT 50`,
      [user.id, this.viewerId(context) ?? null]
    )

    return res.rows.map((row) => ({
      id: row.id,
      authorId: row.author_id,
      courseId: row.course_id,
      postType: row.post_type,
      title: row.title,
      slug: row.slug,
      content: row.content,
      tags: row.tags || [],
      mediaUrls: row.media_urls || [],
      attachedDocumentIds: row.attached_document_ids || [],
      visibility: row.visibility || 'public',
      isPinned: !!row.is_pinned,
      isResolved: !!row.is_resolved,
      likesCount: row.likes_count || 0,
      commentsCount: row.comments_count || 0,
      sharesCount: row.shares_count || 0,
      isLikedByMe: false,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
      author: user
    }))
  }

  @ResolveField(() => [DocumentType], { name: 'documents' })
  async getUserDocuments(@Parent() user: UserType, @Context() context: any): Promise<DocumentType[]> {
    if (await this.isHiddenFromViewer(context, user)) return []
    const res = await this.db.query(
      `SELECT d.*
       FROM documents d
       WHERE d.owner_id = $1
       ORDER BY d.created_at DESC
       LIMIT 10`,
      [user.id]
    )

    return res.rows.map((row) => ({
      id: row.id,
      uploaderId: row.owner_id,
      courseId: row.course_id,
      title: row.title,
      description: row.description,
      type: row.type,
      fileUrl: row.file_url,
      fileSize: row.file_size,
      faculty: row.faculty,
      courseCode: row.course_code,
      tags: row.tags || [],
      downloadCount: row.download_count || 0,
      viewCount: row.view_count || 0,
      isVerified: !!row.is_verified,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
      uploader: user
    }))
  }

  @ResolveField(() => [StudyGroupType], { name: 'studyGroups' })
  async getUserStudyGroups(@Parent() user: UserType): Promise<StudyGroupType[]> {
    const res = await this.db.query(
      `SELECT sg.*, u.display_name as leader_name
       FROM study_groups sg
       JOIN study_group_members sgm ON sg.id = sgm.group_id
       LEFT JOIN users u ON sg.leader_id = u.id
       WHERE sgm.user_id = $1
       ORDER BY sg.created_at DESC
       LIMIT 5`,
      [user.id]
    )

    return res.rows.map((row) => ({
      id: row.id,
      name: row.name || row.topic,
      leaderId: row.leader_id,
      leaderName: row.leader_name || user.displayName,
      courseId: row.course_id,
      topic: row.topic,
      groupType: row.group_type || 'pbl_project',
      courseCode: row.course_code,
      courseName: row.course_name,
      description: row.description,
      maxMembers: row.max_members || 5,
      currentMembersCount: row.current_members || 1,
      status: row.status || 'recruiting',
      techStack: row.tech_stack || [],
      isMember: true,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : ''
    }))
  }

  private viewerId(context: any): string | undefined {
    return context?.req?.user?.id || context?.req?.session?.passport?.user?.id
  }

  // Dùng quyền đã tính ở userProfile; nơi khác (danh sách user) chỉ xét chặn
  private async isHiddenFromViewer(context: any, user: UserType): Promise<boolean> {
    if (user.access) return user.access.blocked || user.access.locked
    return this.isBlockedWithViewer(context, user.id)
  }

  private async isBlockedWithViewer(context: any, userId: string): Promise<boolean> {
    const viewerId = this.viewerId(context)
    if (!viewerId || viewerId === userId) return false
    const res = await this.db.query(`SELECT ${blockExistsSql('$1::uuid', '$2::uuid')} AS blocked`, [viewerId, userId])
    return res.rows[0].blocked
  }

  // withPrivate = false (danh sách user) ⇒ không bao giờ trả email / MSSV / lớp
  // userProfile tự lọc lại theo privacy của chủ hồ sơ
  private mapRowToUser(row: any, withPrivate = false): UserType {
    return {
      id: row.id,
      email: withPrivate ? row.email : '',
      username: row.username,
      displayName: row.display_name,
      studentId: withPrivate ? row.student_id : null,
      faculty: row.faculty,
      academicYear: row.academic_year,
      major: row.major || null,
      className: withPrivate ? row.class_name || null : null,
      isVerified: !!row.is_verified,
      avatarUrl: row.avatar_url,
      bio: row.bio,
      role: row.role,
      reputationPoints: row.reputation_points || 100,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : ''
    }
  }
}

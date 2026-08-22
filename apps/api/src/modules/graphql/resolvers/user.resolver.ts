import { Resolver, Query, Args, Context, ResolveField, Parent } from '@nestjs/graphql'
import { UserType } from '../types/user.type'
import { PostType } from '../types/post.type'
import { DocumentType } from '../types/document.type'
import { StudyGroupType } from '../types/study-group.type'
import { DatabaseService } from '../../../database/database.service'
import { NotFoundException } from '@nestjs/common'

@Resolver(() => UserType)
export class UserResolver {
  constructor(private readonly db: DatabaseService) {}

  @Query(() => UserType, { name: 'userProfile', nullable: true })
  async getUserProfile(
    @Args('username', { type: () => String }) username: string
  ): Promise<UserType | null> {
    const res = await this.db.query(
      `SELECT id, email, username, display_name, student_id, faculty, academic_year, avatar_url, bio, role, reputation_points, created_at
       FROM users
       WHERE username = $1 LIMIT 1`,
      [username.toLowerCase().trim()]
    )

    if (res.rows.length === 0) {
      throw new NotFoundException(`Không tìm thấy sinh viên/giảng viên @${username}`)
    }

    return this.mapRowToUser(res.rows[0])
  }

  @Query(() => UserType, { name: 'me', nullable: true })
  async getMe(@Context() context: any): Promise<UserType | null> {
    const user = context?.req?.user
    if (!user) return null
    return user
  }

  @ResolveField(() => [PostType], { name: 'posts' })
  async getUserPosts(@Parent() user: UserType): Promise<PostType[]> {
    const res = await this.db.query(
      `SELECT p.*,
              u.id as author_id, u.email as author_email, u.username as author_username,
              u.display_name as author_display_name, u.avatar_url as author_avatar_url,
              u.role as author_role, u.faculty as author_faculty, u.reputation_points as author_reputation_points,
              u.created_at as author_created_at
       FROM posts p
       JOIN users u ON p.author_id = u.id
       WHERE p.author_id = $1
       ORDER BY p.created_at DESC
       LIMIT 20`,
      [user.id]
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
  async getUserDocuments(@Parent() user: UserType): Promise<DocumentType[]> {
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
      `SELECT sg.*
       FROM study_groups sg
       JOIN study_group_members sgm ON sg.id = sgm.group_id
       WHERE sgm.user_id = $1
       ORDER BY sg.created_at DESC
       LIMIT 5`,
      [user.id]
    )

    return res.rows.map((row) => ({
      id: row.id,
      leaderId: row.leader_id,
      courseId: row.course_id,
      topic: row.topic,
      groupType: row.group_type,
      courseCode: row.course_code,
      description: row.description,
      requiredMembers: row.required_members,
      currentMembersCount: row.current_members_count,
      status: row.status,
      skillsNeeded: row.skills_needed || [],
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : ''
    }))
  }

  private mapRowToUser(row: any): UserType {
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
      reputationPoints: row.reputation_points || 100,
      followersCount: 142,
      followingCount: 86,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : ''
    }
  }
}

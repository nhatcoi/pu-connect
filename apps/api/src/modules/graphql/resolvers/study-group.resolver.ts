import { Resolver, Query, Mutation, Args, ID, Context } from '@nestjs/graphql'
import { StudyGroupType } from '../types/study-group.type'
import { DatabaseService } from '../../../database/database.service'
import { UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common'

@Resolver(() => StudyGroupType)
export class StudyGroupResolver {
  constructor(private readonly db: DatabaseService) {}

  @Query(() => [StudyGroupType], { name: 'studyGroups' })
  async getStudyGroups(
    @Args('status', { type: () => String, nullable: true }) status?: string,
    @Args('groupType', { type: () => String, nullable: true }) groupType?: string,
    @Args('courseCode', { type: () => String, nullable: true }) courseCode?: string,
    @Context() context?: any
  ): Promise<StudyGroupType[]> {
    const currentUserId = context?.req?.user?.id || null

    let sql = `
      SELECT sg.*,
             u.id as leader_id, u.email as leader_email, u.username as leader_username,
             u.display_name as leader_display_name, u.avatar_url as leader_avatar_url,
             u.role as leader_role, u.faculty as leader_faculty, u.reputation_points as leader_reputation_points,
             u.created_at as leader_created_at
    `
    const params: any[] = []

    if (currentUserId) {
      params.push(currentUserId)
      sql += `, (
        sg.leader_id = $1 OR EXISTS(SELECT 1 FROM study_group_members sgm WHERE sgm.group_id = sg.id AND sgm.user_id = $1)
      ) as is_member`
    } else {
      sql += `, FALSE as is_member`
    }

    sql += `
      FROM study_groups sg
      JOIN users u ON sg.leader_id = u.id
      WHERE 1=1
    `

    if (status) {
      params.push(status)
      sql += ` AND sg.status = $${params.length}`
    }
    if (groupType) {
      params.push(groupType)
      sql += ` AND sg.group_type = $${params.length}`
    }
    if (courseCode) {
      params.push(courseCode)
      sql += ` AND sg.course_code = $${params.length}`
    }

    sql += ` ORDER BY sg.created_at DESC LIMIT 50`

    const res = await this.db.query(sql, params)

    return res.rows.map((row) => ({
      id: row.id,
      leaderId: row.leader_id,
      courseId: row.course_id,
      name: row.name || row.topic,
      topic: row.topic,
      groupType: row.group_type || 'pbl_project',
      courseCode: row.course_code,
      courseName: row.course_name,
      description: row.description,
      maxMembers: row.max_members || 5,
      currentMembersCount: row.current_members || 1,
      status: row.status || 'recruiting',
      techStack: row.tech_stack || [],
      isMember: !!row.is_member,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
      leader: {
        id: row.leader_id,
        email: row.leader_email || '',
        username: row.leader_username || '',
        displayName: row.leader_display_name || '',
        avatarUrl: row.leader_avatar_url || null,
        role: row.leader_role || 'student',
        faculty: row.leader_faculty || null,
        reputationPoints: row.leader_reputation_points || 100,
        createdAt: row.leader_created_at ? new Date(row.leader_created_at).toISOString() : ''
      }
    }))
  }

  @Mutation(() => Boolean)
  async joinStudyGroup(
    @Args('groupId', { type: () => ID }) groupId: string,
    @Context() context: any
  ): Promise<boolean> {
    const user = context?.req?.user
    if (!user) {
      throw new UnauthorizedException('Vui lòng đăng nhập để tham gia nhóm')
    }

    const groupRes = await this.db.query(
      `SELECT * FROM study_groups WHERE id = $1`,
      [groupId]
    )
    if (groupRes.rows.length === 0) {
      throw new NotFoundException('Không tìm thấy nhóm học tập')
    }

    const group = groupRes.rows[0]
    if (group.leader_id === user.id) {
      throw new BadRequestException('Bạn là trưởng nhóm này')
    }

    if (group.current_members >= group.max_members) {
      throw new BadRequestException('Nhóm đã đủ thành viên')
    }

    const memberCheck = await this.db.query(
      `SELECT * FROM study_group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, user.id]
    )

    if (memberCheck.rows.length > 0) {
      return true // Already a member
    }

    await this.db.query(
      `INSERT INTO study_group_members (group_id, user_id, role) VALUES ($1, $2, 'member')`,
      [groupId, user.id]
    )

    await this.db.query(
      `UPDATE study_groups 
       SET current_members = current_members + 1,
           status = CASE WHEN current_members + 1 >= max_members THEN 'active'::group_status_enum ELSE status END
       WHERE id = $1`,
      [groupId]
    )

    return true
  }

  @Mutation(() => Boolean)
  async leaveStudyGroup(
    @Args('groupId', { type: () => ID }) groupId: string,
    @Context() context: any
  ): Promise<boolean> {
    const user = context?.req?.user
    if (!user) {
      throw new UnauthorizedException('Vui lòng đăng nhập')
    }

    const groupRes = await this.db.query(
      `SELECT * FROM study_groups WHERE id = $1`,
      [groupId]
    )
    if (groupRes.rows.length === 0) {
      throw new NotFoundException('Không tìm thấy nhóm học tập')
    }

    const group = groupRes.rows[0]
    if (group.leader_id === user.id) {
      throw new BadRequestException('Trưởng nhóm không thể rời nhóm (có thể giải tán nhóm)')
    }

    const deleteRes = await this.db.query(
      `DELETE FROM study_group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, user.id]
    )

    if (deleteRes.rowCount && deleteRes.rowCount > 0) {
      await this.db.query(
        `UPDATE study_groups 
         SET current_members = GREATEST(1, current_members - 1),
             status = 'recruiting'
         WHERE id = $1`,
        [groupId]
      )
    }

    return true
  }
}

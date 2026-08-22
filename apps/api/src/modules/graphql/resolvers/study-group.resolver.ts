import { Resolver, Query, Args } from '@nestjs/graphql'
import { StudyGroupType } from '../types/study-group.type'
import { DatabaseService } from '../../../database/database.service'

@Resolver(() => StudyGroupType)
export class StudyGroupResolver {
  constructor(private readonly db: DatabaseService) {}

  @Query(() => [StudyGroupType], { name: 'studyGroups' })
  async getStudyGroups(
    @Args('status', { type: () => String, nullable: true }) status?: string,
    @Args('courseCode', { type: () => String, nullable: true }) courseCode?: string
  ): Promise<StudyGroupType[]> {
    let sql = `
      SELECT sg.*,
             u.id as leader_id, u.email as leader_email, u.username as leader_username,
             u.display_name as leader_display_name, u.avatar_url as leader_avatar_url,
             u.role as leader_role, u.faculty as leader_faculty, u.reputation_points as leader_reputation_points,
             u.created_at as leader_created_at
      FROM study_groups sg
      JOIN users u ON sg.leader_id = u.id
      WHERE 1=1
    `
    const params: any[] = []

    if (status) {
      params.push(status)
      sql += ` AND sg.status = $${params.length}`
    }
    if (courseCode) {
      params.push(courseCode)
      sql += ` AND sg.course_code = $${params.length}`
    }

    sql += ` ORDER BY sg.created_at DESC LIMIT 30`

    const res = await this.db.query(sql, params)

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
}

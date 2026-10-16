import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import type { StudyGroup, CreateStudyGroupInput } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { StudyGroupChatService } from '../chat/conversations/study-group-chat.service'

const GROUP_SELECT = `
  SELECT g.*, u.display_name AS leader_name,
         COALESCE(
           (SELECT json_agg(json_build_object(
                     'userId', m.user_id, 'displayName', mu.display_name, 'avatarUrl', mu.avatar_url,
                     'role', CASE WHEN m.role = 'leader' THEN 'leader' ELSE 'member' END,
                     'joinedAt', m.joined_at) ORDER BY m.joined_at)
            FROM study_group_members m JOIN users mu ON mu.id = m.user_id
            WHERE m.group_id = g.id),
           '[]'::json) AS members
  FROM study_groups g
  JOIN users u ON u.id = g.leader_id
`

@Injectable()
export class StudyGroupsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly groupChat: StudyGroupChatService
  ) {}

  // Lọc theo mã học phần hoặc course id
  async findAll(course?: string): Promise<StudyGroup[]> {
    const params: unknown[] = []
    let where = `WHERE g.status <> 'disbanded'`
    if (course) {
      params.push(course)
      where += ` AND (g.course_id::text = $1 OR g.course_code ILIKE $1)`
    }
    const res = await this.db.query(`${GROUP_SELECT} ${where} ORDER BY (g.status = 'recruiting') DESC, g.created_at DESC LIMIT 50`, params)
    return res.rows.map((row) => this.mapRow(row))
  }

  async findOne(id: string): Promise<StudyGroup> {
    const res = await this.db.query(`${GROUP_SELECT} WHERE g.id::text = $1 LIMIT 1`, [id])
    if (res.rows.length === 0) throw new NotFoundException('Không tìm thấy nhóm học')
    return this.mapRow(res.rows[0])
  }

  // ACID: tạo nhóm + thêm trưởng nhóm
  async create(leaderId: string, _leaderName: string, data: CreateStudyGroupInput): Promise<StudyGroup> {
    const id = await this.db.transaction(async (client) => {
      let courseId: string | null = null
      let courseCode: string | null = data.courseCode?.trim().toUpperCase() || null
      let courseName: string | null = null
      const target = data.courseId || courseCode
      if (target) {
        const c = await client.query(`SELECT id, code, name FROM courses WHERE id::text = $1 OR code ILIKE $1 LIMIT 1`, [target])
        if (c.rows[0]) {
          courseId = c.rows[0].id
          courseCode = c.rows[0].code
          courseName = c.rows[0].name
        }
      }
      const ins = await client.query(
        `INSERT INTO study_groups (leader_id, course_id, course_code, course_name, name, topic, description, tech_stack, max_members, current_members)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1) RETURNING id`,
        [leaderId, courseId, courseCode, courseName, data.name.trim(), data.topic.trim(), data.description.trim(), data.techStack || [], data.maxMembers || 5]
      )
      await client.query(`INSERT INTO study_group_members (group_id, user_id, role) VALUES ($1, $2, 'leader')`, [ins.rows[0].id, leaderId])
      return ins.rows[0].id as string
    })
    return this.findOne(id)
  }

  // ACID: khóa hàng nhóm ⇒ không vượt quá số thành viên khi nhiều người cùng tham gia
  async join(groupId: string, userId: string, _displayName: string): Promise<StudyGroup> {
    await this.db.transaction(async (client) => {
      const g = await client.query(`SELECT id, max_members, current_members, status FROM study_groups WHERE id::text = $1 FOR UPDATE`, [groupId])
      const group = g.rows[0]
      if (!group) throw new NotFoundException('Không tìm thấy nhóm học')
      if (group.status !== 'recruiting' || group.current_members >= group.max_members) {
        throw new BadRequestException('Nhóm đã đủ thành viên')
      }
      const ins = await client.query(`INSERT INTO study_group_members (group_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`, [
        group.id,
        userId
      ])
      if (ins.rowCount === 0) throw new BadRequestException('Bạn đã tham gia nhóm này rồi')
      await client.query(
        `UPDATE study_groups SET current_members = current_members + 1,
                status = CASE WHEN current_members + 1 >= max_members THEN 'active'::group_status_enum ELSE status END,
                updated_at = NOW()
         WHERE id = $1`,
        [group.id]
      )
    })
    // Sau khi commit: đưa người mới vào nhóm chat của nhóm học (nếu đã có)
    await this.groupChat.onStudyGroupJoined(groupId, userId)
    return this.findOne(groupId)
  }

  private mapRow(row: any): StudyGroup {
    const full = row.current_members >= row.max_members
    return {
      id: row.id,
      name: row.name,
      courseId: row.course_id,
      courseCode: row.course_code,
      courseName: row.course_name,
      description: row.description,
      topic: row.topic,
      techStack: row.tech_stack || [],
      maxMembers: row.max_members,
      currentMembersCount: row.current_members,
      members: (row.members || []).map((m: any) => ({ ...m, joinedAt: new Date(m.joinedAt).toISOString() })),
      // DB: recruiting | active (đủ người) | completed | disbanded
      status: row.status === 'completed' ? 'completed' : full || row.status === 'active' ? 'full' : 'recruiting',
      leaderId: row.leader_id,
      leaderName: row.leader_name,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    }
  }
}

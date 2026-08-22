import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import type { StudyGroup, CreateStudyGroupInput } from '@pu/schemas'

@Injectable()
export class StudyGroupsService {
  private groups: StudyGroup[] = []

  async findAll(courseId?: string): Promise<StudyGroup[]> {
    if (courseId) {
      return this.groups.filter((g) => g.courseId === courseId || g.courseCode === courseId)
    }
    return this.groups
  }

  async findOne(id: string): Promise<StudyGroup> {
    const group = this.groups.find((g) => g.id === id)
    if (!group) {
      throw new NotFoundException(`Study group with ID ${id} not found`)
    }
    return group
  }

  async create(leaderId: string, leaderName: string, data: CreateStudyGroupInput): Promise<StudyGroup> {
    const newGroup: StudyGroup = {
      id: `group_${Date.now()}`,
      name: data.name,
      courseId: data.courseId || null,
      courseCode: data.courseCode || null,
      courseName: data.courseCode || null,
      description: data.description,
      topic: data.topic,
      techStack: data.techStack || [],
      maxMembers: data.maxMembers || 5,
      currentMembersCount: 1,
      members: [
        {
          userId: leaderId,
          displayName: leaderName,
          avatarUrl: null,
          role: 'leader',
          joinedAt: new Date().toISOString()
        }
      ],
      status: 'recruiting',
      leaderId,
      leaderName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    this.groups.unshift(newGroup)
    return newGroup
  }

  async join(groupId: string, userId: string, displayName: string): Promise<StudyGroup> {
    const group = await this.findOne(groupId)
    if (group.currentMembersCount >= group.maxMembers) {
      throw new BadRequestException('Nhóm đã đủ thành viên')
    }

    const alreadyJoined = group.members.some((m) => m.userId === userId)
    if (alreadyJoined) {
      throw new BadRequestException('Bạn đã tham gia nhóm này rồi')
    }

    group.members.push({
      userId,
      displayName,
      avatarUrl: null,
      role: 'member',
      joinedAt: new Date().toISOString()
    })
    group.currentMembersCount += 1
    if (group.currentMembersCount >= group.maxMembers) {
      group.status = 'full'
    }

    return group
  }
}

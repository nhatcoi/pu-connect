import { z } from 'zod'

export const StudyGroupMemberSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable().optional(),
  role: z.enum(['leader', 'member']).default('member'),
  joinedAt: z.string()
})

export const StudyGroupSchema = z.object({
  id: z.string(),
  name: z.string().min(3).max(100),
  courseId: z.string().optional().nullable(),
  courseCode: z.string().optional().nullable(), // e.g. "IT101"
  courseName: z.string().optional().nullable(),
  description: z.string(),
  topic: z.string(), // e.g. "Đồ án PBL3: Xây dựng App IoT", "Ôn thi Giải tích 2"
  techStack: z.array(z.string()).default([]), // e.g. ["React Native", "NestJS", "PostgreSQL"]
  maxMembers: z.number().min(2).max(10).default(5),
  currentMembersCount: z.number().default(1),
  members: z.array(StudyGroupMemberSchema).default([]),
  status: z.enum(['recruiting', 'full', 'completed']).default('recruiting'),
  leaderId: z.string(),
  leaderName: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const CreateStudyGroupSchema = z.object({
  name: z.string().min(3, { message: 'Tên nhóm phải từ 3 ký tự trở lên' }).max(100),
  courseId: z.string().optional(),
  courseCode: z.string().optional(),
  description: z.string().min(10, { message: 'Vui lòng mô tả chi tiết mục tiêu nhóm' }),
  topic: z.string().min(3, { message: 'Chủ đề nhóm không được để trống' }),
  techStack: z.array(z.string()).default([]),
  maxMembers: z.number().min(2).max(10).default(5)
})

export type StudyGroupMember = z.infer<typeof StudyGroupMemberSchema>
export type StudyGroup = z.infer<typeof StudyGroupSchema>
export type CreateStudyGroupInput = z.infer<typeof CreateStudyGroupSchema>

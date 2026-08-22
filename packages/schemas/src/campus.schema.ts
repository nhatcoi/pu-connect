import { z } from 'zod'

export const CampusEventSchema = z.object({
  id: z.string(),
  title: z.string().min(5).max(150),
  organizer: z.string(), // e.g. "Đoàn Thanh niên", "CLB Tin học Phenikaa"
  organizerType: z.enum(['university', 'faculty', 'club', 'student']),
  description: z.string(),
  location: z.string(), // e.g. "Hội trường A2", "Giảng đường B3-201", "Sân bóng Phenikaa"
  startTime: z.string(),
  endTime: z.string().optional(),
  bannerUrl: z.string().url().optional().nullable(),
  registrationUrl: z.string().url().optional().nullable(),
  attendeesCount: z.number().default(0),
  tags: z.array(z.string()).default([])
})

export const CampusAnnouncementSchema = z.object({
  id: z.string(),
  title: z.string(),
  source: z.string(), // e.g. "Phòng Đào tạo", "Phòng CTSV"
  category: z.enum(['academic', 'scholarship', 'tuition', 'activity', 'hostel_bus']),
  summary: z.string(),
  content: z.string(),
  publishedAt: z.string(),
  isUrgent: z.boolean().default(false),
  link: z.string().optional()
})

export type CampusEvent = z.infer<typeof CampusEventSchema>
export type CampusAnnouncement = z.infer<typeof CampusAnnouncementSchema>

// Kiểu dữ liệu seed mạng xã hội (persona + bài + bình luận) / Social seed data shapes

export type Role = 'student' | 'lecturer' | 'ta' | 'admin'
export type PostType = 'general' | 'question' | 'resource_share' | 'pbl_recruitment' | 'announcement'
export type Reaction = 'like' | 'helpful' | 'insightful' | 'celebrate'
export type Topic = 'tech' | 'business' | 'life' | 'study' | 'fun' | 'random' | 'official'

export interface Persona {
  username: string
  displayName: string
  role: Role
  faculty: string // mã khoa (FIT, FBA…)
  major: string
  className?: string
  academicYear?: string // "2023-2027"
  studentId?: string
  bio: string
  skills: string[]
  interests: string[]
  location?: string
  avatar: string // tệp trong R2 seed/avatars/
  banner: number // id ảnh Picsum (đã tải lên R2 seed/banners/)
  verified: boolean
  joinedDaysAgo: number
  topics: Topic[] // dùng để chọn người thả tim / theo dõi
}

export interface SeedComment {
  by: string // username
  text: string
  after?: number // phút sau bài / bình luận cha
  solution?: boolean
  likes?: number
  replies?: SeedComment[]
}

export interface SeedPoll {
  question: string
  options: string[]
  votes: number[] // số phiếu mỗi lựa chọn (≤ số persona)
  closesInDays?: number
}

export interface SeedPost {
  key: string // định danh ổn định ⇒ slug, chạy lại không trùng
  by: string
  daysAgo: number
  at: string // "HH:MM" giờ Việt Nam
  type?: PostType
  title?: string
  content: string
  tags?: string[]
  course?: string // mã học phần
  community?: string // slug cộng đồng
  images?: number[] // id ảnh Picsum (R2 seed/posts/<id>.jpg)
  poll?: SeedPoll
  resolved?: boolean
  pinned?: boolean
  likes: number
  saves?: number
  comments?: SeedComment[]
}

import { ObjectType, Field, ID, Int } from '@nestjs/graphql'
import type { ProfileAccess } from '../../users/profile-access.service'

@ObjectType('User')
export class UserType {
  @Field(() => ID)
  id: string

  @Field()
  email: string

  @Field()
  username: string

  @Field()
  displayName: string

  @Field(() => String, { nullable: true })
  studentId?: string | null

  @Field(() => String, { nullable: true, description: '"Khác" khi đang chờ admin duyệt' })
  university?: string | null

  @Field(() => String, { nullable: true, description: 'Lĩnh vực quan tâm; "Khác" khi đang chờ admin duyệt' })
  interestField?: string | null

  @Field(() => String, { nullable: true })
  universityId?: string | null

  @Field(() => String, { nullable: true })
  interestFieldId?: string | null

  @Field(() => [String], { nullable: true, description: 'Toàn bộ lĩnh vực quan tâm (tối đa 3)' })
  interestFieldIds?: string[]

  @Field(() => String, { nullable: true, description: 'Tên trường đã gửi chờ duyệt (chỉ chủ hồ sơ)' })
  universityRequest?: string | null

  @Field(() => String, { nullable: true, description: 'Tên lĩnh vực đã gửi chờ duyệt (chỉ chủ hồ sơ)' })
  interestFieldRequest?: string | null

  @Field(() => String, { nullable: true, description: 'pending | rejected (chỉ chủ hồ sơ)' })
  universityRequestStatus?: string | null

  @Field(() => String, { nullable: true, description: 'pending | rejected (chỉ chủ hồ sơ)' })
  interestFieldRequestStatus?: string | null

  @Field(() => String, { nullable: true })
  avatarUrl?: string | null

  @Field(() => String, { nullable: true })
  bio?: string | null

  // Chỉ userProfile trả các trường hồ sơ mở rộng (form Sửa hồ sơ đọc lại từ đây)
  @Field(() => String, { nullable: true })
  bannerUrl?: string | null

  @Field(() => String, { nullable: true })
  location?: string | null

  @Field(() => String, { nullable: true })
  website?: string | null

  @Field(() => String, { nullable: true, description: 'YYYY-MM-DD' })
  birthDate?: string | null

  @Field()
  role: string

  @Field(() => Boolean, { defaultValue: false, nullable: true })
  isVerified?: boolean

  @Field(() => Int)
  reputationPoints: number

  @Field(() => Int, { defaultValue: 0, nullable: true })
  followersCount?: number

  @Field(() => Int, { defaultValue: 0, nullable: true })
  followingCount?: number

  @Field(() => Boolean, { defaultValue: false, nullable: true })
  isFollowedByMe?: boolean

  // none | blocking | blocked_by (xem BlockState)
  @Field(() => String, { defaultValue: 'none', nullable: true })
  blockState?: string

  @Field()
  createdAt: string

  // Hồ sơ riêng tư & người xem chưa theo dõi ⇒ ẩn bài, tài liệu, hoạt động
  @Field(() => Boolean, { defaultValue: false, nullable: true })
  isContentLocked?: boolean

  // Tab hoạt động người xem được mở: liked | saved | commented
  @Field(() => [String], { nullable: true })
  activityTabs?: string[]

  // Nội bộ (không phải field GraphQL): quyền xem đã tính cho request này
  access?: ProfileAccess
}

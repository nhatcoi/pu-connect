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

  @Field(() => String, { nullable: true })
  faculty?: string | null

  @Field(() => String, { nullable: true })
  academicYear?: string | null

  @Field(() => String, { nullable: true })
  avatarUrl?: string | null

  @Field(() => String, { nullable: true })
  bio?: string | null

  @Field()
  role: string

  @Field(() => String, { nullable: true })
  major?: string | null

  @Field(() => String, { nullable: true })
  className?: string | null

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

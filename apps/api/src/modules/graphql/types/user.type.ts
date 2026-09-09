import { ObjectType, Field, ID, Int } from '@nestjs/graphql'

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

  @Field()
  createdAt: string
}

import { ObjectType, Field, ID, Int } from '@nestjs/graphql'
import { UserType } from './user.type'

@ObjectType('StudyGroup')
export class StudyGroupType {
  @Field(() => ID)
  id: string

  @Field(() => ID)
  leaderId: string

  @Field(() => ID, { nullable: true })
  courseId?: string | null

  @Field()
  topic: string

  @Field()
  groupType: string

  @Field({ nullable: true })
  courseCode?: string

  @Field()
  description: string

  @Field(() => Int)
  requiredMembers: number

  @Field(() => Int)
  currentMembersCount: number

  @Field()
  status: string

  @Field(() => [String])
  skillsNeeded: string[]

  @Field()
  createdAt: string

  @Field(() => UserType, { nullable: true })
  leader?: UserType
}

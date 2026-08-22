import { ObjectType, Field, Int } from '@nestjs/graphql'

@ObjectType('FollowResult')
export class FollowResultType {
  @Field()
  isFollowing: boolean

  @Field(() => Int)
  followersCount: number

  @Field(() => Int)
  followingCount: number
}

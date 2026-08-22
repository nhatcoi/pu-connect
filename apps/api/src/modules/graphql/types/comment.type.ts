import { ObjectType, Field, ID, Int } from '@nestjs/graphql'
import { UserType } from './user.type'

@ObjectType('Comment')
export class CommentType {
  @Field(() => ID)
  id: string

  @Field(() => ID)
  postId: string

  @Field(() => ID)
  authorId: string

  @Field(() => ID, { nullable: true })
  parentId?: string

  @Field()
  content: string

  @Field(() => Int)
  likesCount: number

  @Field()
  isSolution: boolean

  @Field()
  createdAt: string

  @Field(() => UserType, { nullable: true })
  author?: UserType

  @Field(() => Boolean)
  isLikedByMe: boolean
}

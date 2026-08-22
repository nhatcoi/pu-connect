import { ObjectType, Field, ID, Int } from '@nestjs/graphql'
import { UserType } from './user.type'

@ObjectType('Post')
export class PostType {
  @Field(() => ID)
  id: string

  @Field(() => ID)
  authorId: string

  @Field(() => ID, { nullable: true })
  courseId?: string | null

  @Field()
  postType: string

  @Field()
  title: string

  @Field({ nullable: true })
  slug?: string

  @Field()
  content: string

  @Field(() => [String])
  tags: string[]

  @Field(() => [String])
  mediaUrls: string[]

  @Field(() => [String])
  attachedDocumentIds: string[]

  @Field()
  visibility: string

  @Field()
  isPinned: boolean

  @Field()
  isResolved: boolean

  @Field(() => Int)
  likesCount: number

  @Field(() => Int)
  commentsCount: number

  @Field(() => Int)
  sharesCount: number

  @Field()
  isLikedByMe: boolean

  @Field()
  createdAt: string

  @Field(() => UserType)
  author: UserType
}

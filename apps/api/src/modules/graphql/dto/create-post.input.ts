import { InputType, Field, ID } from '@nestjs/graphql'

@InputType()
export class CreatePostInput {
  @Field()
  title: string

  @Field()
  content: string

  @Field({ defaultValue: 'general' })
  postType: string

  @Field(() => ID, { nullable: true })
  courseId?: string

  @Field(() => [String], { defaultValue: [] })
  tags: string[]

  @Field(() => [String], { defaultValue: [] })
  mediaUrls: string[]

  @Field(() => [String], { defaultValue: [] })
  attachedDocumentIds: string[]
}

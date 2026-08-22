import { ObjectType, Field, ID, Int } from '@nestjs/graphql'
import { UserType } from './user.type'

@ObjectType('Document')
export class DocumentType {
  @Field(() => ID)
  id: string

  @Field(() => ID)
  uploaderId: string

  @Field(() => ID, { nullable: true })
  courseId?: string | null

  @Field()
  title: string

  @Field({ nullable: true })
  description?: string

  @Field()
  type: string

  @Field()
  fileUrl: string

  @Field({ nullable: true })
  fileSize?: string

  @Field({ nullable: true })
  faculty?: string

  @Field({ nullable: true })
  courseCode?: string

  @Field(() => Int)
  downloadCount: number

  @Field(() => Int)
  viewCount: number

  @Field()
  isVerified: boolean

  @Field()
  createdAt: string

  @Field(() => [String], { nullable: true })
  tags?: string[]

  @Field(() => UserType, { nullable: true })
  uploader?: UserType
}

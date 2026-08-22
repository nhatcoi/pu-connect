import { InputType, Field, ID } from '@nestjs/graphql'
import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

@InputType()
export class CreateCommentInput {
  @Field(() => ID)
  @IsNotEmpty()
  postId: string

  @Field()
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  content: string

  @Field(() => ID, { nullable: true })
  parentId?: string
}

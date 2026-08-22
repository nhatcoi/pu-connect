import { Injectable, NotFoundException } from '@nestjs/common'
import type { CreatePostInput, PostItem } from '@pu/schemas'

@Injectable()
export class PostsService {
  private posts: PostItem[] = []

  async findAll(tag?: string): Promise<PostItem[]> {
    if (tag) {
      return this.posts.filter((p) => p.tags.includes(tag))
    }
    return this.posts
  }

  async findOne(id: string): Promise<PostItem> {
    const post = this.posts.find((p) => p.id === id)
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`)
    }
    return post
  }

  async create(authorId: string, data: CreatePostInput): Promise<PostItem> {
    const newPost: PostItem = {
      id: `post_${Date.now()}`,
      authorId,
      author: {
        id: authorId,
        username: 'student',
        displayName: 'Sinh viên Phenikaa',
        avatarUrl: null
      },
      title: data.title,
      content: data.content,
      tags: data.tags || [],
      mediaUrls: data.mediaUrls || [],
      attachedDocumentIds: data.attachedDocumentIds || [],
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      isLikedByMe: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    this.posts.unshift(newPost)
    return newPost
  }

  async toggleLike(postId: string): Promise<PostItem> {
    const post = await this.findOne(postId)
    post.isLikedByMe = !post.isLikedByMe
    post.likesCount = post.isLikedByMe ? post.likesCount + 1 : Math.max(0, post.likesCount - 1)
    return post
  }
}

import { Injectable, NotFoundException } from '@nestjs/common'
import type { CreatePostInput, PostItem } from '@pu/schemas'

@Injectable()
export class PostsService {
  private posts: PostItem[] = [
    {
      id: 'post_1',
      authorId: 'user_1',
      author: {
        id: 'user_1',
        username: 'techlead',
        displayName: 'Alex Nguyễn',
        avatarUrl: null
      },
      title: 'Kiến trúc Monorepo hiệu năng cao với Turborepo + Next.js + NestJS',
      content: 'Nội dung chia sẻ kiến trúc chuẩn monorepo...',
      tags: ['monorepo', 'nextjs', 'nestjs'],
      mediaUrls: [],
      attachedDocumentIds: ['doc_1'],
      likesCount: 42,
      commentsCount: 9,
      sharesCount: 15,
      isLikedByMe: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]

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
        username: 'vietnhat',
        displayName: 'Việt Nhật',
        avatarUrl: null
      },
      title: data.title,
      content: data.content,
      tags: data.tags,
      mediaUrls: data.mediaUrls,
      attachedDocumentIds: data.attachedDocumentIds,
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

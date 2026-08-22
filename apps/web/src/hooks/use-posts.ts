import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/store'
import { graphqlClient } from '@/lib/graphql-client'
import type { PostItem } from '@pu/schemas'
import { toast } from 'sonner'

const GET_FEED_QUERY = `
  query GetFeed($limit: Int, $offset: Int, $tag: String) {
    feed(limit: $limit, offset: $offset, tag: $tag) {
      id
      authorId
      courseId
      postType
      title
      slug
      content
      tags
      mediaUrls
      attachedDocumentIds
      visibility
      isPinned
      isResolved
      likesCount
      commentsCount
      sharesCount
      isLikedByMe
      createdAt
      author {
        id
        displayName
        username
        avatarUrl
        faculty
        role
        reputationPoints
      }
    }
  }
`

const TOGGLE_LIKE_MUTATION = `
  mutation ToggleLike($postId: String!) {
    toggleLikePost(postId: $postId)
  }
`

export function usePosts(selectedTag?: string | null) {
  const posts = useAppStore((state) => state.posts)
  const setPosts = useAppStore((state) => state.setPosts)
  const toggleLikePost = useAppStore((state) => state.toggleLikePost)
  const [isLoading, setIsLoading] = useState(false)

  const fetchPosts = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await graphqlClient<{ feed: PostItem[] }>(GET_FEED_QUERY, {
        limit: 30,
        offset: 0,
        tag: selectedTag || undefined
      })
      if (data && Array.isArray(data.feed)) {
        setPosts(data.feed)
      }
    } catch (err: any) {
      // Fallback
    } finally {
      setIsLoading(false)
    }
  }, [setPosts, selectedTag])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const toggleLike = useCallback(
    async (postId: string) => {
      toggleLikePost(postId)
      try {
        await graphqlClient<{ toggleLikePost: boolean }>(TOGGLE_LIKE_MUTATION, {
          postId
        })
      } catch (err: any) {
        toggleLikePost(postId)
        toast.error('Không thể thực hiện tương tác')
      }
    },
    [toggleLikePost]
  )

  return {
    posts,
    isLoading,
    refetch: fetchPosts,
    toggleLike
  }
}

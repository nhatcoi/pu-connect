import { useState, useEffect, useCallback } from 'react'
import { graphqlClient } from '@/lib/graphql-client'
import type { PostItem, DocumentItem, StudyGroup } from '@pu/schemas'

export interface UserProfileData {
  id: string
  displayName: string
  username: string
  email: string
  studentId?: string | null
  faculty?: string | null
  academicYear?: string | null
  avatarUrl?: string | null
  bio?: string | null
  role: string
  reputationPoints: number
  followersCount: number
  followingCount: number
  isFollowedByMe?: boolean
  createdAt: string
  posts: PostItem[]
  documents: DocumentItem[]
  studyGroups: StudyGroup[]
}

const GET_USER_PROFILE_QUERY = `
  query GetUserProfile($username: String!) {
    userProfile(username: $username) {
      id
      displayName
      username
      email
      studentId
      faculty
      academicYear
      avatarUrl
      bio
      role
      reputationPoints
      followersCount
      followingCount
      isFollowedByMe
      createdAt
      posts {
        id
        title
        content
        postType
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
      documents {
        id
        uploaderId
        courseId
        title
        description
        type
        fileUrl
        fileSize
        faculty
        courseCode
        tags
        downloadCount
        viewCount
        isVerified
        createdAt
        uploader {
          id
          displayName
          username
          avatarUrl
          faculty
          role
          reputationPoints
        }
      }
      studyGroups {
        id
        leaderId
        courseId
        topic
        groupType
        courseCode
        description
        requiredMembers
        currentMembersCount
        status
        skillsNeeded
        createdAt
      }
    }
  }
`

export function useProfile(username: string) {
  const [profile, setProfile] = useState<UserProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = useCallback(async () => {
    if (!username) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await graphqlClient<{ userProfile: UserProfileData }>(
        GET_USER_PROFILE_QUERY,
        { username }
      )
      if (data && data.userProfile) {
        setProfile(data.userProfile)
      } else {
        setError('Không tìm thấy người dùng')
      }
    } catch (err: any) {
      setError(err?.message || 'Lỗi khi tải thông tin hồ sơ')
    } finally {
      setIsLoading(false)
    }
  }, [username])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  return {
    profile,
    isLoading,
    error,
    refetch: fetchProfile
  }
}

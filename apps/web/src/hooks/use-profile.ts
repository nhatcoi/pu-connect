import { useQuery, type QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { graphqlClient } from '@/lib/graphql-client'
import type { PostItem, DocumentItem, StudyGroup } from '@pu/schemas'

export interface UserProfileData {
  id: string
  displayName: string
  username: string
  email: string
  studentId?: string | null
  school?: string | null
  faculty?: string | null
  academicYear?: string | null
  avatarUrl?: string | null
  bannerUrl?: string | null
  bio?: string | null
  role: string
  major?: string | null
  className?: string | null
  location?: string | null
  website?: string | null
  birthDate?: string | null
  isVerified?: boolean
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
      major
      className
      isVerified
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
        name
        leaderId
        leaderName
        courseId
        topic
        groupType
        courseCode
        courseName
        description
        maxMembers
        currentMembersCount
        status
        techStack
        createdAt
      }
    }
  }
`

async function fetchProfile(username: string): Promise<UserProfileData> {
  const data = await graphqlClient<{ userProfile: UserProfileData }>(GET_USER_PROFILE_QUERY, { username })
  if (!data?.userProfile) throw new Error('Không tìm thấy người dùng')
  return data.userProfile
}

const PROFILE_STALE_MS = 5 * 60 * 1000

// Hồ sơ (kèm bài viết, tài liệu, nhóm) cache 5 phút theo username
export function profileQueryOptions(username: string) {
  return {
    queryKey: queryKeys.profile(username),
    queryFn: () => fetchProfile(username),
    staleTime: PROFILE_STALE_MS
  }
}

// Tải trước khi rê chuột vào link hồ sơ ⇒ mở trang là có dữ liệu ngay
export function prefetchProfile(queryClient: QueryClient, username: string) {
  if (!username) return
  void queryClient.prefetchQuery(profileQueryOptions(username))
}

export function useProfile(username: string) {
  const query = useQuery({ ...profileQueryOptions(username), enabled: !!username })
  return {
    profile: query.data ?? null,
    isLoading: query.isPending,
    error: query.error ? query.error.message || 'Lỗi khi tải thông tin hồ sơ' : null,
    refetch: query.refetch
  }
}

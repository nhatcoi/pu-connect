import type {
  CommunityAskResult,
  CommunityDocumentCandidate,
  CommunityDocumentItem,
  CommunityPinnedPost,
  Community,
  CommunityHiddenPost, CommunityMemberItem, CommunityRole, CommunityType, CommunityRule, UpdateCommunityInput } from '@pu/schemas'
import { apiClient } from './api-client'

type Envelope<T> = { success: boolean; data: T }
const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) })
const unwrap = async <T>(p: Promise<Envelope<T>>) => (await p).data

export interface CreateCommunityInput {
  slug: string
  name: string
  description: string
  communityType: Exclude<CommunityType, 'campus' | 'faculty'>
  rules?: CommunityRule[]
}

export const createCommunity = (input: CreateCommunityInput) => unwrap(apiClient<Envelope<Community>>('/communities', json('POST', input)))
export const updateCommunity = (slug: string, input: UpdateCommunityInput) =>
  unwrap(apiClient<Envelope<Community>>(`/communities/${slug}`, json('PATCH', input)))

export const listCommunityMembers = (slug: string, q: string) =>
  unwrap(
    apiClient<Envelope<{ items: CommunityMemberItem[]; total: number }>>(`/communities/${slug}/members?limit=100${q ? `&q=${encodeURIComponent(q)}` : ''}`)
  )
export const setCommunityMemberRole = (slug: string, userId: string, role: Exclude<CommunityRole, 'owner'>) =>
  unwrap(apiClient<Envelope<{ role: CommunityRole }>>(`/communities/${slug}/members/${userId}/role`, json('PUT', { role })))
export const removeCommunityMember = (slug: string, userId: string) =>
  unwrap(apiClient<Envelope<{ membersCount: number }>>(`/communities/${slug}/members/${userId}`, json('DELETE')))

export const listHiddenPosts = (slug: string) => unwrap(apiClient<Envelope<CommunityHiddenPost[]>>(`/communities/${slug}/hidden-posts`))
export const hideCommunityPost = (slug: string, postId: string, reason?: string) =>
  apiClient(`/communities/${slug}/posts/${postId}/hide`, json('POST', { reason }))
export const unhideCommunityPost = (slug: string, postId: string) => apiClient(`/communities/${slug}/posts/${postId}/hide`, json('DELETE'))

// Tham gia / rời cộng đồng (API bọc kết quả trong { success, data })
export const toggleCommunityJoin = (slug: string) =>
  unwrap(apiClient<Envelope<{ isMember: boolean; membersCount: number; message: string }>>(`/communities/${slug}/join`, json('POST')))

// ── Bài ghim · tài liệu · thông báo · hỏi N7AI ──
export const listCommunityPins = (slug: string) => unwrap(apiClient<Envelope<CommunityPinnedPost[]>>(`/communities/${slug}/pins`))
export const pinCommunityPost = (slug: string, postId: string) => apiClient(`/communities/${slug}/pins/${postId}`, json('PUT'))
export const unpinCommunityPost = (slug: string, postId: string) => apiClient(`/communities/${slug}/pins/${postId}`, json('DELETE'))

export const listCommunityDocuments = (slug: string) => unwrap(apiClient<Envelope<CommunityDocumentItem[]>>(`/communities/${slug}/documents`))
export const listCommunityDocumentCandidates = (slug: string) =>
  unwrap(apiClient<Envelope<CommunityDocumentCandidate[]>>(`/communities/${slug}/documents/candidates`))
export const addCommunityDocument = (slug: string, documentId: string) => apiClient(`/communities/${slug}/documents`, json('POST', { documentId }))
export const removeCommunityDocument = (slug: string, documentId: string) => apiClient(`/communities/${slug}/documents/${documentId}`, json('DELETE'))

export const getCommunityNotify = (slug: string) => unwrap(apiClient<Envelope<{ enabled: boolean }>>(`/communities/${slug}/notify`))
export const setCommunityNotify = (slug: string, enabled: boolean) =>
  unwrap(apiClient<Envelope<{ enabled: boolean }>>(`/communities/${slug}/notify`, json('PUT', { enabled })))

export const askCommunity = (slug: string, question: string) => unwrap(apiClient<Envelope<CommunityAskResult>>(`/communities/${slug}/ask`, json('POST', { question })))
export const openCommunityChat = (slug: string) => unwrap(apiClient<Envelope<{ id: string }>>(`/communities/${slug}/chat`, json('POST')))

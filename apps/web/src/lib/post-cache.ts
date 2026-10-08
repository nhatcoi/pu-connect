import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { PostItem } from '@pu/schemas'
import { POST_BEARING_ROOTS } from './query-keys'

// Một trang của danh sách phân trang offset (feed, cộng đồng)
export interface OffsetPage<T, M = undefined> {
  items: T[]
  hasMore: boolean
  nextOffset: number
  meta?: M
}

// Bài viết nhận diện bằng id + authorId (tránh nhầm với object khác cùng id)
function isPost(value: any): value is PostItem {
  return !!value && typeof value === 'object' && typeof value.id === 'string' && 'authorId' in value && 'content' in value
}

/**
 * Duyệt sâu dữ liệu cache, thay bài viết có id khớp. Giữ nguyên tham chiếu nếu không đổi
 * (React Query + React.memo không render lại phần không liên quan).
 * updater trả về null ⇒ xóa bài khỏi mọi danh sách.
 */
function mapPosts(data: unknown, postId: string, updater: (post: PostItem) => PostItem | null): unknown {
  if (Array.isArray(data)) {
    let changed = false
    const out: unknown[] = []
    for (const item of data) {
      if (isPost(item) && item.id === postId) {
        const next = updater(item)
        changed = changed || next !== item
        if (next) out.push(next)
        continue
      }
      const next = mapPosts(item, postId, updater)
      changed = changed || next !== item
      out.push(next)
    }
    return changed ? out : data
  }
  if (data && typeof data === 'object') {
    if (isPost(data) && (data as PostItem).id === postId) return updater(data as PostItem) ?? data
    let changed = false
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(data)) {
      const next = mapPosts(v, postId, updater)
      changed = changed || next !== v
      out[k] = next
    }
    return changed ? out : data
  }
  return data
}

// Cập nhật một bài ở MỌI nơi đang cache: feed (mọi tab), cộng đồng, hồ sơ, search, trang chi tiết
export function patchPostEverywhere(qc: QueryClient, postId: string, updater: (post: PostItem) => PostItem) {
  for (const root of POST_BEARING_ROOTS) {
    qc.setQueriesData({ queryKey: [root] }, (old: unknown) => (old === undefined ? old : mapPosts(old, postId, updater)))
  }
}

export function removePostEverywhere(qc: QueryClient, postId: string) {
  for (const root of POST_BEARING_ROOTS) {
    if (root === 'post') continue
    qc.setQueriesData({ queryKey: [root] }, (old: unknown) => (old === undefined ? old : mapPosts(old, postId, () => null)))
  }
  qc.removeQueries({ queryKey: ['post', postId] })
}

// Cập nhật cờ "đang theo dõi tác giả" cho mọi bài của tác giả đó
export function patchAuthorFollowed(qc: QueryClient, authorId: string, isFollowed: boolean) {
  const walk = (data: unknown): unknown => {
    if (Array.isArray(data)) {
      let changed = false
      const out = data.map((item) => {
        const next = walk(item)
        changed = changed || next !== item
        return next
      })
      return changed ? out : data
    }
    if (data && typeof data === 'object') {
      if (isPost(data)) {
        const p = data as PostItem
        const isAuthor = p.authorId === authorId || p.author?.id === authorId
        return isAuthor && p.isAuthorFollowedByMe !== isFollowed ? { ...p, isAuthorFollowedByMe: isFollowed } : data
      }
      let changed = false
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(data)) {
        const next = walk(v)
        changed = changed || next !== v
        out[k] = next
      }
      return changed ? out : data
    }
    return data
  }
  for (const root of POST_BEARING_ROOTS) {
    qc.setQueriesData({ queryKey: [root] }, (old: unknown) => (old === undefined ? old : walk(old)))
  }
}

// Thêm bài mới lên đầu trang đầu tiên của các danh sách phân trang khớp khóa
export function prependPost<M>(qc: QueryClient, queryKey: readonly unknown[], post: PostItem) {
  qc.setQueriesData<InfiniteData<OffsetPage<PostItem, M>>>({ queryKey }, (old) => {
    if (!old?.pages?.length) return old
    const [first, ...rest] = old.pages
    if (first.items.some((p) => p.id === post.id)) return old
    return { ...old, pages: [{ ...first, items: [post, ...first.items] }, ...rest] }
  })
}

// Gộp các trang thành một danh sách, bỏ trùng (offset có thể lệch khi có bài mới)
export function flattenPages<T extends { id: string }, M>(data: InfiniteData<OffsetPage<T, M>> | undefined): T[] {
  if (!data) return []
  const seen = new Set<string>()
  const out: T[] = []
  for (const page of data.pages) {
    for (const item of page.items) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      out.push(item)
    }
  }
  return out
}

// Tìm bài trong các danh sách đã cache (mở trang chi tiết hiện ngay, rồi làm mới ngầm)
export function findCachedPost(qc: QueryClient, postId: string): PostItem | undefined {
  let found: PostItem | undefined
  const visit = (data: unknown) => {
    if (found || !data || typeof data !== 'object') return
    if (Array.isArray(data)) return data.forEach(visit)
    if (isPost(data) && (data as PostItem).id === postId) {
      found = data as PostItem
      return
    }
    Object.values(data).forEach(visit)
  }
  for (const root of POST_BEARING_ROOTS) {
    if (root === 'post') continue
    for (const [, data] of qc.getQueriesData({ queryKey: [root] })) visit(data)
    if (found) break
  }
  return found
}

// Bài mới của chính mình: hiện ngay ở feed "Dành cho bạn" (và "Hỏi đáp" nếu là câu hỏi),
// cộng đồng chứa bài, hồ sơ của mình; các danh sách khác làm mới khi mở lại
export function onPostCreated(qc: QueryClient, post: PostItem, myUsername?: string | null) {
  prependPost(qc, ['feed', 'for_you'], post)
  if (post.postType === 'qa') prependPost(qc, ['feed', 'qa'], post)
  qc.invalidateQueries({ queryKey: ['feed'], refetchType: 'none' })
  if (post.communitySlug) {
    prependPost(qc, ['community', post.communitySlug], post)
  }
  if (myUsername) qc.invalidateQueries({ queryKey: ['profile', myUsername.toLowerCase()] })
}

// Theo dõi / bỏ theo dõi: hồ sơ người đó và danh sách gợi ý cần làm mới
export function invalidateFollowRelated(qc: QueryClient, username?: string | null) {
  if (username) qc.invalidateQueries({ queryKey: ['profile', username.toLowerCase()] })
  qc.invalidateQueries({ queryKey: ['suggested-users'] })
  qc.invalidateQueries({ queryKey: ['feed', 'following'], refetchType: 'none' })
}

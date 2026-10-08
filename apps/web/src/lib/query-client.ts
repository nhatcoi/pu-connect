import { QueryClient, isServer } from '@tanstack/react-query'
import { ApiError } from './api-client'

// Mặc định cache: dữ liệu "mới" 60s, giữ trong bộ nhớ 10 phút sau khi rời trang
// ⇒ quay lại trang hiện ngay từ cache, tự làm mới ngầm nếu đã cũ (stale-while-revalidate)
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
        // Không thử lại lỗi 4xx (thiếu quyền, không tồn tại); lỗi mạng/5xx thử lại 1 lần
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 1
      },
      mutations: { retry: false }
    }
  })
}

let browserQueryClient: QueryClient | undefined

// Server: mỗi request một client (tránh rò dữ liệu giữa người dùng). Trình duyệt: dùng chung 1 client
export function getQueryClient() {
  if (isServer) return makeQueryClient()
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}

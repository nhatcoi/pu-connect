import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type {
  AdminBulkResult,
  AdminBulkUserAction,
  AdminUserDetail,
  AdminUserNote,
  AdminUserPage,
  AdminUserRole,
  AdminUserSummary,
  AdminUserSecurity,
  AdminActivityItem,
  AdminActivityType,
  AdminPage,
  LoginSession
} from '@pu/schemas'
import { adminApi, ROLE_SHORT } from '@/lib/api'

// Khóa bộ lọc gửi lên API (khớp AdminUserQuerySchema)
export const FILTER_KEYS = ['q', 'role', 'status', 'verified', 'auth', 'activity', 'joined', 'university', 'field', 'reported', 'risk'] as const
export const QUERY_KEYS = [...FILTER_KEYS, 'sort', 'dir', 'page', 'pageSize'] as const
export type FilterKey = (typeof FILTER_KEYS)[number]
export type Params = Record<string, string>

export function toQueryString(params: Params, keys: readonly string[] = QUERY_KEYS) {
  const qs = new URLSearchParams()
  for (const k of keys) if (params[k]) qs.set(k, params[k])
  return qs.toString()
}

export const ONLINE_MS = 5 * 60_000
export const isOnline = (lastSeenAt: string | null) => !!lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() < ONLINE_MS

export function useUsersList(params: Params) {
  const qs = toQueryString(params)
  return useQuery({
    queryKey: ['admin', 'users', 'list', qs],
    queryFn: () => adminApi.get<AdminUserPage>(`/admin/users?${qs}`),
    placeholderData: keepPreviousData
  })
}

export function useUsersSummary() {
  return useQuery({
    queryKey: ['admin', 'users', 'summary'],
    queryFn: () => adminApi.get<AdminUserSummary>('/admin/users/summary'),
    staleTime: 60_000
  })
}

export function useUserDetail(id: string | null) {
  return useQuery({
    queryKey: ['admin', 'users', 'detail', id],
    queryFn: () => adminApi.get<AdminUserDetail>(`/admin/users/${id}`),
    enabled: !!id
  })
}

export interface BulkVars {
  ids: string[]
  action: AdminBulkUserAction
  role?: AdminUserRole
  reason?: string
  durationDays?: number | null
}

const BULK_MSG: Record<AdminBulkUserAction, (n: number, v: BulkVars) => string> = {
  verify: (n) => `Đã cấp tích xanh cho ${n} người`,
  unverify: (n) => `Đã gỡ tích xanh của ${n} người`,
  warn: (n) => `Đã cảnh cáo ${n} người`,
  restrict: (n, v) => `Đã hạn chế ${n} tài khoản${v.durationDays ? ` trong ${v.durationDays} ngày` : ''}`,
  unrestrict: (n) => `Đã gỡ hạn chế ${n} tài khoản`,
  suspend: (n, v) => `Đã khóa ${n} tài khoản${v.durationDays ? ` trong ${v.durationDays} ngày` : ' vĩnh viễn'}`,
  unsuspend: (n) => `Đã mở khóa ${n} tài khoản`,
  revoke_sessions: (n) => `Đã đăng xuất ${n} tài khoản khỏi mọi thiết bị`,
  send_reset: (n) => `Đã gửi link đặt lại mật khẩu cho ${n} người`,
  force_reset: (n) => `Đã đăng xuất và bắt ${n} người đổi mật khẩu`,
  set_role: (n, v) => `Đã đổi ${n} người thành ${ROLE_SHORT[v.role ?? ''] ?? v.role}`
}

// Mọi thao tác (1 người hoặc nhiều người) đi qua 1 endpoint hàng loạt
export function useUserActions(onDone?: () => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: BulkVars) => adminApi.post<AdminBulkResult>('/admin/users/bulk', v),
    onSuccess: (res, v) => {
      if (res.affected === 0) toast.info('Không có thay đổi')
      else toast.success(BULK_MSG[v.action](res.affected, v) + (res.skipped ? ` · bỏ qua ${res.skipped}` : ''))
      onDone?.()
      void qc.invalidateQueries({ queryKey: ['admin'] })
    },
    onError: (err: Error) => toast.error(err.message)
  })
}

export function useUserNotes(userId: string) {
  const qc = useQueryClient()
  const setNotes = (notes: AdminUserNote[]) =>
    qc.setQueryData<AdminUserDetail>(['admin', 'users', 'detail', userId], (d) => (d ? { ...d, notes } : d))

  const add = useMutation({
    mutationFn: (body: string) => adminApi.post<AdminUserNote[]>(`/admin/users/${userId}/notes`, { body }),
    onSuccess: setNotes,
    onError: (err: Error) => toast.error(err.message)
  })
  const remove = useMutation({
    mutationFn: (noteId: string) => adminApi.delete<AdminUserNote[]>(`/admin/users/${userId}/notes/${noteId}`),
    onSuccess: setNotes,
    onError: (err: Error) => toast.error(err.message)
  })
  return { add, remove }
}

// Hủy 1 chế tài (nhầm lẫn) — không tính là vi phạm
export function useRevokeSanction(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sanctionId: string) => adminApi.delete(`/admin/users/${userId}/sanctions/${sanctionId}`),
    onSuccess: () => {
      toast.success('Đã hủy chế tài')
      void qc.invalidateQueries({ queryKey: ['admin'] })
    },
    onError: (err: Error) => toast.error(err.message)
  })
}

// Tab Bảo mật: chỉ tải khi mở (mỗi lần xem được ghi audit)
export function useUserSecurity(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'users', 'security', id],
    queryFn: () => adminApi.get<AdminUserSecurity>(`/admin/users/${id}/security`),
    enabled: !!id && enabled,
    staleTime: 60_000
  })
}

// Dữ liệu chi tiết theo loại (bài viết, bình luận, theo dõi, lượt xem hồ sơ…)
export function useUserActivity(id: string, type: AdminActivityType, page: number) {
  return useQuery({
    queryKey: ['admin', 'users', 'activity', id, type, page],
    queryFn: () => adminApi.get<AdminPage<AdminActivityItem>>(`/admin/users/${id}/activity?type=${type}&page=${page}&pageSize=20`),
    placeholderData: keepPreviousData,
    staleTime: 30_000
  })
}

// Phiên đăng nhập đang mở + ép đăng xuất từng phiên
export function useUserSessions(id: string) {
  return useQuery({
    queryKey: ['admin', 'users', 'sessions', id],
    queryFn: () => adminApi.get<LoginSession[]>(`/admin/users/${id}/sessions`)
  })
}

export function useRevokeUserSession(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => adminApi.delete<LoginSession[]>(`/admin/users/${id}/sessions/${sessionId}`),
    onSuccess: (list) => {
      qc.setQueryData(['admin', 'users', 'sessions', id], list)
      toast.success('Đã đăng xuất phiên này')
      void qc.invalidateQueries({ queryKey: ['admin', 'users', 'detail', id] })
    },
    onError: (err: Error) => toast.error(err.message)
  })
}

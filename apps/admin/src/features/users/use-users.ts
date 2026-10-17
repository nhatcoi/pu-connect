import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type {
  AdminBulkResult,
  AdminBulkUserAction,
  AdminUserDetail,
  AdminUserNote,
  AdminUserPage,
  AdminUserRole,
  AdminUserSummary
} from '@pu/schemas'
import { adminApi, ROLE_SHORT } from '@/lib/api'

// Khóa bộ lọc gửi lên API (khớp AdminUserQuerySchema)
export const FILTER_KEYS = ['q', 'role', 'status', 'verified', 'auth', 'activity', 'joined', 'faculty', 'reported'] as const
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
}

const BULK_MSG: Record<AdminBulkUserAction, (n: number, v: BulkVars) => string> = {
  verify: (n) => `Đã cấp tích xanh cho ${n} người`,
  unverify: (n) => `Đã gỡ tích xanh của ${n} người`,
  suspend: (n) => `Đã khóa ${n} tài khoản`,
  unsuspend: (n) => `Đã mở khóa ${n} tài khoản`,
  revoke_sessions: (n) => `Đã đăng xuất ${n} tài khoản khỏi mọi thiết bị`,
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

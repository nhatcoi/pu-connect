import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AdminUnitCatalog, AdminUnitInput, AdminUnitPatch, AdminUnitRequest, AdminUnitRequestApprove, UnitKind, UnitRequestStatus } from '@pu/schemas'
import { adminApi } from '@/lib/api'

export const KIND_LABEL: Record<UnitKind, string> = { university: 'Trường đại học', field: 'Lĩnh vực quan tâm' }

export function useAdminUnits() {
  return useQuery({
    queryKey: ['admin', 'units'],
    queryFn: () => adminApi.get<AdminUnitCatalog>('/admin/units'),
    staleTime: 30_000
  })
}

export function useUnitRequests(status: UnitRequestStatus = 'pending') {
  return useQuery({
    queryKey: ['admin', 'unit-requests', status],
    queryFn: () => adminApi.get<AdminUnitRequest[]>(`/admin/unit-requests?status=${status}`),
    staleTime: 15_000
  })
}

export function useUnitActions(onDone?: () => void) {
  const qc = useQueryClient()
  const done = (msg: string) => () => {
    toast.success(msg)
    onDone?.()
    // Thống kê (badge hàng chờ) và danh sách người dùng cũng đổi theo
    void qc.invalidateQueries({ queryKey: ['admin'] })
  }
  const onError = (err: Error) => toast.error(err.message)
  return {
    create: useMutation({
      mutationFn: (b: AdminUnitInput) => adminApi.post('/admin/units', b),
      onSuccess: done('Đã thêm'),
      onError
    }),
    update: useMutation({
      mutationFn: ({ kind, id, ...b }: AdminUnitPatch & { kind: UnitKind; id: string }) => adminApi.patch(`/admin/units/${kind}/${id}`, b),
      onSuccess: done('Đã lưu'),
      onError
    }),
    merge: useMutation({
      mutationFn: ({ kind, id, targetId }: { kind: UnitKind; id: string; targetId: string }) =>
        adminApi.post<{ movedUsers: number }>(`/admin/units/${kind}/${id}/merge`, { targetId }),
      onSuccess: (res) => done(`Đã gộp, chuyển ${res.movedUsers} người dùng`)(),
      onError
    }),
    remove: useMutation({
      mutationFn: ({ kind, id }: { kind: UnitKind; id: string }) => adminApi.delete(`/admin/units/${kind}/${id}`),
      onSuccess: done('Đã xóa'),
      onError
    }),
    approve: useMutation({
      mutationFn: ({ id, ...b }: AdminUnitRequestApprove & { id: string }) => adminApi.post<{ users: number }>(`/admin/unit-requests/${id}/approve`, b),
      onSuccess: (res) => done(`Đã duyệt, cập nhật ${res.users} người dùng`)(),
      onError
    }),
    reject: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason?: string }) => adminApi.post(`/admin/unit-requests/${id}/reject`, { reason }),
      onSuccess: done('Đã từ chối'),
      onError
    })
  }
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AdminAcademicUnit, AdminAcademicUnitInput, AdminAcademicUnitPatch } from '@pu/schemas'
import { adminApi } from '@/lib/api'

export const UNIT_TYPE_LABEL: Record<string, string> = { school: 'Trường', faculty: 'Khoa', major: 'Ngành', institute: 'Viện', center: 'Trung tâm' }

// Đơn vị cha hợp lệ theo loại (khớp quy tắc ở API)
export const PARENT_TYPES: Record<string, string[]> = {
  school: [],
  faculty: ['school'],
  major: ['faculty', 'school'],
  institute: [],
  center: []
}

export function useAdminUnits() {
  return useQuery({
    queryKey: ['admin', 'academic-units'],
    queryFn: () => adminApi.get<AdminAcademicUnit[]>('/admin/academic-units'),
    staleTime: 30_000
  })
}

export interface UnitNode {
  unit: AdminAcademicUnit
  depth: number
}

// Dựng danh sách phẳng theo thứ tự cây (cha trước con) kèm độ sâu để thụt lề
export function flattenUnits(units: AdminAcademicUnit[]): UnitNode[] {
  const byParent = new Map<string | null, AdminAcademicUnit[]>()
  for (const u of units) {
    const key = u.parentId
    byParent.set(key, [...(byParent.get(key) ?? []), u])
  }
  const out: UnitNode[] = []
  const walk = (parent: string | null, depth: number) => {
    for (const u of byParent.get(parent) ?? []) {
      out.push({ unit: u, depth })
      walk(u.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

export function useUnitActions(onDone?: () => void) {
  const qc = useQueryClient()
  const done = (msg: string) => () => {
    toast.success(msg)
    onDone?.()
    void qc.invalidateQueries({ queryKey: ['admin'] })
  }
  const onError = (err: Error) => toast.error(err.message)
  return {
    create: useMutation({
      mutationFn: (b: AdminAcademicUnitInput) => adminApi.post('/admin/academic-units', b),
      onSuccess: done('Đã thêm đơn vị'),
      onError
    }),
    update: useMutation({
      mutationFn: ({ id, ...b }: AdminAcademicUnitPatch & { id: string }) => adminApi.patch(`/admin/academic-units/${id}`, b),
      onSuccess: done('Đã lưu'),
      onError
    }),
    reorder: useMutation({
      mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) => adminApi.post(`/admin/academic-units/${id}/reorder`, { direction }),
      onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'academic-units'] }),
      onError
    }),
    merge: useMutation({
      mutationFn: ({ id, targetId }: { id: string; targetId: string }) => adminApi.post<{ movedUsers: number }>(`/admin/academic-units/${id}/merge`, { targetId }),
      onSuccess: (res) => done(`Đã gộp, chuyển ${res.movedUsers} người dùng`)(),
      onError
    }),
    remove: useMutation({
      mutationFn: (id: string) => adminApi.delete(`/admin/academic-units/${id}`),
      onSuccess: done('Đã xóa đơn vị'),
      onError
    })
  }
}

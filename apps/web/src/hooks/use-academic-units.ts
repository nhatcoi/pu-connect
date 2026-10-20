'use client'

import { useQuery } from '@tanstack/react-query'
import type { AcademicUnit } from '@pu/schemas'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

type Envelope<T> = { data: T }

// Cây đơn vị học thuật (danh sách phẳng ~100 dòng, do admin quản lý) — cache lâu, ít đổi
export function useAcademicUnits() {
  return useQuery({
    queryKey: queryKeys.academicUnits,
    queryFn: async () => (await apiClient<Envelope<AcademicUnit[]>>('/academic-units')).data,
    staleTime: 5 * 60_000
  })
}

'use client'

import { useMemo } from 'react'
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

export interface FacultyOption {
  code: string // giá trị gửi lên API (?faculty=): tên viết tắt, API so theo nhánh đơn vị
  name: string
}

// Bộ lọc theo đơn vị: lấy từ cây đơn vị (hiện chỉ có trường; thêm khoa/viện sau thì tự hiện), không gồm ngành
export function useFacultyOptions(allLabel: string): FacultyOption[] {
  const { data } = useAcademicUnits()
  return useMemo(
    () => [
      { code: 'ALL', name: allLabel },
      ...(data ?? [])
        .filter((u) => u.type !== 'major')
        .map((u) => ({ code: u.shortName || u.name, name: u.name }))
    ],
    [data, allLabel]
  )
}

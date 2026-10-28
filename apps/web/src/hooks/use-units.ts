'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { UnitCatalog, UnitOption } from '@pu/schemas'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

type Envelope<T> = { data: T }

// Danh mục trường + lĩnh vực quan tâm (vài chục dòng, admin quản lý) — cache lâu, ít đổi
export function useUnits() {
  return useQuery({
    queryKey: queryKeys.units,
    queryFn: async () => (await apiClient<Envelope<UnitCatalog>>('/units')).data,
    staleTime: 5 * 60_000
  })
}

// Bộ lọc theo lĩnh vực: "ALL" + các lĩnh vực trong danh mục (giá trị gửi lên API là id)
export function useFieldOptions(allLabel: string): UnitOption[] {
  const { data } = useUnits()
  return useMemo(() => [{ id: 'ALL', name: allLabel }, ...(data?.fields ?? [])], [data, allLabel])
}

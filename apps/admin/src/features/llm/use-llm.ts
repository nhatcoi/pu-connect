import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type {
  AdminAiDiscovery,
  AdminAiModel,
  AdminAiModelInput,
  AdminAiModelPatch,
  AdminAiProvider,
  AdminAiProviderInput,
  AdminAiProviderList,
  AdminAiProviderPatch,
  AdminAiProviderTest
} from '@pu/schemas'
import { adminApi } from '@/lib/api'

const PROVIDERS = '/admin/ai/providers'
const MODELS = '/admin/ai/models'
const ROOT = ['admin', 'ai']

export const useProviders = () => useQuery({ queryKey: [...ROOT, 'providers'], queryFn: () => adminApi.get<AdminAiProviderList>(PROVIDERS), staleTime: 30_000 })
export const useModels = () => useQuery({ queryKey: [...ROOT, 'models'], queryFn: () => adminApi.get<AdminAiModel[]>(MODELS), staleTime: 30_000 })

// Dò model của provider (gọi ra ngoài) — chỉ chạy khi mở hộp thoại, không cache lâu
export const useDiscovery = (providerId: string | null) =>
  useQuery({
    queryKey: [...ROOT, 'discover', providerId],
    queryFn: () => adminApi.get<AdminAiDiscovery>(`${PROVIDERS}/${providerId}/models`),
    enabled: !!providerId,
    staleTime: 0,
    gcTime: 0
  })

export function useLlmActions() {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ROOT })
  const onError = (err: Error) => toast.error(err.message)
  const done = (msg: string) => () => {
    toast.success(msg)
    void refresh()
  }
  const enc = encodeURIComponent
  return {
    createProvider: useMutation({
      mutationFn: (b: AdminAiProviderInput) => adminApi.post<{ id: string }>(PROVIDERS, b),
      onSuccess: done('Đã thêm provider'),
      onError
    }),
    updateProvider: useMutation({
      mutationFn: ({ id, ...b }: AdminAiProviderPatch & { id: string }) => adminApi.patch(`${PROVIDERS}/${id}`, b),
      onSuccess: done('Đã lưu'),
      onError
    }),
    removeProvider: useMutation({ mutationFn: (id: string) => adminApi.delete(`${PROVIDERS}/${id}`), onSuccess: done('Đã xóa provider'), onError }),
    moveProvider: useMutation({
      mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) => adminApi.post(`${PROVIDERS}/${id}/move`, { direction }),
      onSuccess: done('Đã đổi thứ tự'),
      onError
    }),
    importEnv: useMutation({ mutationFn: () => adminApi.post(`${PROVIDERS}/import-env`, {}), onSuccess: done('Đã nhập cấu hình từ máy chủ'), onError }),
    testProvider: useMutation({
      mutationFn: (p: AdminAiProvider) => adminApi.post<AdminAiProviderTest>(`${PROVIDERS}/${p.id}/test`, {}),
      onSuccess: (r, p) =>
        r.ok
          ? toast.success(`${p.name}: OK · ${r.latencyMs}ms${r.models != null ? ` · ${r.models} model` : ''}`)
          : toast.error(`${p.name}: ${r.error ?? 'Lỗi không rõ'}`),
      onError
    }),
    createModel: useMutation({ mutationFn: (b: AdminAiModelInput) => adminApi.post(MODELS, b), onSuccess: done('Đã thêm model'), onError }),
    createModels: useMutation({
      mutationFn: (items: AdminAiModelInput[]) => adminApi.post(`${MODELS}/bulk`, { items }),
      onSuccess: done('Đã thêm model'),
      onError
    }),
    updateModel: useMutation({
      mutationFn: ({ id, ...b }: AdminAiModelPatch & { id: string }) => adminApi.patch(`${MODELS}/${enc(id)}`, b),
      onSuccess: done('Đã lưu'),
      onError
    }),
    removeModel: useMutation({ mutationFn: (id: string) => adminApi.delete(`${MODELS}/${enc(id)}`), onSuccess: done('Đã xóa model'), onError })
  }
}

export type LlmActions = ReturnType<typeof useLlmActions>

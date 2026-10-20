import React, { useState } from 'react'
import type { AdminAiProvider } from '@pu/schemas'
import { ErrorState, LoadingRows } from '@/components/ui'
import { DiscoverDialog } from './discover-dialog'
import { ModelsPanel } from './models-panel'
import { ProvidersPanel } from './providers-panel'
import { useLlmActions, useModels, useProviders } from './use-llm'

// N7AI › LLM: provider (URL + key) → dò model → đặt tên hiển thị, effort, giới hạn token — quản lý chung một chỗ
export function LlmSection({ canManage }: { canManage: boolean }) {
  const providers = useProviders()
  const models = useModels()
  const actions = useLlmActions()
  const [discover, setDiscover] = useState<AdminAiProvider | null>(null)

  if (providers.isPending || models.isPending) return <LoadingRows rows={5} />
  if (providers.isError || models.isError) return <ErrorState message={((providers.error ?? models.error) as Error).message} />

  return (
    <div className="space-y-8">
      <ProvidersPanel data={providers.data} canManage={canManage} actions={actions} onDiscover={setDiscover} />
      <ModelsPanel models={models.data} providers={providers.data.items} canManage={canManage} actions={actions} />
      <DiscoverDialog provider={discover} onClose={() => setDiscover(null)} actions={actions} />
    </div>
  )
}

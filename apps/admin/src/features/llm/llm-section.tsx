import React, { useState } from 'react'
import type { AdminAiProvider } from '@pu/schemas'
import { ErrorState, LoadingRows } from '@/components/ui'
import { AiServicesPanel } from './ai-services-panel'
import { DiscoverDialog } from './discover-dialog'
import { ModelsPanel } from './models-panel'
import { ProvidersPanel } from './providers-panel'
import { useAiServices, useLlmActions, useModels, useProviders } from './use-llm'

// N7AI › LLM & RAG: provider (URL + key) → dò model → đặt tên hiển thị, effort, giới hạn token, cùng dịch vụ bổ trợ Embedding/OCR
export function LlmSection({ canManage }: { canManage: boolean }) {
  const providers = useProviders()
  const models = useModels()
  const services = useAiServices()
  const actions = useLlmActions()
  const [discover, setDiscover] = useState<AdminAiProvider | null>(null)

  if (providers.isPending || models.isPending || services.isPending) return <LoadingRows rows={5} />
  if (providers.isError || models.isError || services.isError)
    return <ErrorState message={((providers.error ?? models.error ?? services.error) as Error).message} />

  return (
    <div className="space-y-8">
      <ProvidersPanel data={providers.data} canManage={canManage} actions={actions} onDiscover={setDiscover} />
      <ModelsPanel models={models.data} providers={providers.data.items} canManage={canManage} actions={actions} />
      <AiServicesPanel data={services.data} canManage={canManage} actions={actions} />
      <DiscoverDialog provider={discover} onClose={() => setDiscover(null)} actions={actions} />
    </div>
  )
}

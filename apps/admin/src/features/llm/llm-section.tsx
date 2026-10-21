import React, { useState } from 'react'
import type { AdminAiProvider, AdminAiServiceItem } from '@pu/schemas'
import { ErrorState, LoadingRows, Segmented } from '@/components/ui'
import { ServiceCard, ServiceDialog } from './ai-services-panel'
import { DiscoverDialog } from './discover-dialog'
import { ModelsPanel } from './models-panel'
import { ProvidersPanel } from './providers-panel'
import { useAiServices, useLlmActions, useModels, useProviders } from './use-llm'

export function LlmSection({
  canManage,
  initialSection = 'all'
}: {
  canManage: boolean
  initialSection?: 'all' | 'llm' | 'rag' | 'ocr'
}) {
  const [section, setSection] = useState<'all' | 'llm' | 'rag' | 'ocr'>(initialSection)
  const [editing, setEditing] = useState<{ item: AdminAiServiceItem; title: string } | null>(null)
  const providers = useProviders()
  const models = useModels()
  const services = useAiServices()
  const actions = useLlmActions()
  const [discover, setDiscover] = useState<AdminAiProvider | null>(null)

  if (providers.isPending || models.isPending || services.isPending) return <LoadingRows rows={5} />
  if (providers.isError || models.isError || services.isError)
    return <ErrorState message={((providers.error ?? models.error ?? services.error) as Error).message} />

  const showLlm = section === 'all' || section === 'llm'
  const showRag = section === 'all' || section === 'rag'
  const showOcr = section === 'all' || section === 'ocr'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Segmented
          value={section}
          onChange={(v) => setSection(v as typeof section)}
          items={[
            { id: 'all', label: 'Tất cả' },
            { id: 'llm', label: 'LLM' },
            { id: 'rag', label: 'RAG' },
            { id: 'ocr', label: 'OCR' }
          ]}
        />
      </div>

      {showLlm && (
        <section className="space-y-4">
          {section === 'all' && (
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <h2 className="text-sm font-semibold text-foreground">LLM</h2>
            </div>
          )}
          <div className="space-y-4">
            <ProvidersPanel data={providers.data} canManage={canManage} actions={actions} onDiscover={setDiscover} />
            <ModelsPanel models={models.data} providers={providers.data.items} canManage={canManage} actions={actions} />
          </div>
        </section>
      )}

      {(showRag || showOcr) && (
        <section className="space-y-4">
          <div
            className={
              section === 'all'
                ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
                : 'grid grid-cols-1 gap-4 max-w-xl'
            }
          >
            {showRag && services.data?.embedding && (
              <ServiceCard
                title="RAG"
                item={services.data.embedding}
                canManage={canManage}
                actions={actions}
                onEdit={() => setEditing({ item: services.data.embedding, title: 'RAG' })}
              />
            )}
            {showOcr && services.data?.ocr && (
              <ServiceCard
                title="OCR"
                item={services.data.ocr}
                canManage={canManage}
                actions={actions}
                onEdit={() => setEditing({ item: services.data.ocr, title: 'OCR' })}
              />
            )}
          </div>
        </section>
      )}

      <DiscoverDialog provider={discover} onClose={() => setDiscover(null)} actions={actions} />

      {editing && (
        <ServiceDialog
          item={editing.item}
          title={editing.title}
          onClose={() => setEditing(null)}
          actions={actions}
        />
      )}
    </div>
  )
}

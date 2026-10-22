import React, { useState } from 'react'
import { Bot, Key, Link, Save, Send, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'

export interface AppConfig {
  baseUrl: string
  model: string
  apiKey: string
  botToken: string
  chatId: string
}

export const DEFAULT_CONFIG: AppConfig = {
  baseUrl: 'https://api-ai.vnhat.dev/v1',
  model: 'n7ai-per',
  apiKey: '',
  botToken: '',
  chatId: ''
}

export function ConfigModal({
  open,
  config,
  onClose,
  onSave
}: {
  open: boolean
  config: AppConfig
  onClose: () => void
  onSave: (cfg: AppConfig) => void
}) {
  const [draft, setDraft] = useState<AppConfig>(config)

  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(draft)
    toast.success('Đã lưu cấu hình tham số!')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">Cấu hình Tham số Hệ thống</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Nhóm 1: Cấu hình LLM */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Bot className="size-3.5 text-primary" /> Cấu hình mô hình AI (LLM)
            </h3>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">API Base URL</label>
              <input
                type="text"
                value={draft.baseUrl}
                onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
                placeholder="https://api-ai.vnhat.dev/v1"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Model Map / Upstream</label>
              <input
                type="text"
                value={draft.model}
                onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                placeholder="n7ai-per hoặc gpt-4o"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">API Key (tùy chọn)</label>
              <input
                type="password"
                value={draft.apiKey}
                onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
              />
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Send className="size-3.5 text-primary" /> Cấu hình Telegram Monitor
            </h3>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Telegram Bot Token</label>
              <input
                type="password"
                value={draft.botToken}
                onChange={(e) => setDraft({ ...draft, botToken: e.target.value })}
                placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Telegram Chat ID / Kênh nhận tin</label>
              <input
                type="text"
                value={draft.chatId}
                onChange={(e) => setDraft({ ...draft, chatId: e.target.value })}
                placeholder="-1001234567890 hoặc @ten_channel"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
            >
              <Save className="size-4" /> Lưu cấu hình
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

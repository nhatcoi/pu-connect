'use client'

import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, KeyRound, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { API_KEY_SCOPE_OPTIONS, createApiKey, listApiKeys, revokeApiKey } from '@/lib/api-keys-api'
import { formatRelativeTime } from '@/lib/utils'
import { SettingsGroup } from './settings-ui'

const KEYS = ['api-keys'] as const
const EXPIRY = [
  { v: 0, label: 'Không hết hạn' },
  { v: 30, label: '30 ngày' },
  { v: 90, label: '90 ngày' },
  { v: 365, label: '1 năm' }
]

function CopyButton({ text, label = 'Sao chép' }: { text: string; label?: string }) {
  const [done, setDone] = React.useState(false)
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-8 gap-1.5 rounded-full px-3 text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } catch {
          /* clipboard bị chặn */
        }
      }}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? 'Đã chép' : label}
    </Button>
  )
}

// Kết nối AI (MCP): tạo API key có phạm vi, copy cấu hình cho Claude / Cursor…
export function McpSection() {
  const qc = useQueryClient()
  const { data: keys, isPending } = useQuery({ queryKey: KEYS, queryFn: listApiKeys })
  const [name, setName] = React.useState('')
  const [scopes, setScopes] = React.useState<string[]>(['read'])
  const [days, setDays] = React.useState(90)
  const [fresh, setFresh] = React.useState<string | null>(null)

  const create = useMutation({
    mutationFn: () => createApiKey({ name, scopes, expiresInDays: days || null }),
    onSuccess: (k) => {
      setFresh(k.key)
      setName('')
      void qc.invalidateQueries({ queryKey: KEYS })
    }
  })
  const revoke = useMutation({ mutationFn: revokeApiKey, onSuccess: () => qc.invalidateQueries({ queryKey: KEYS }) })

  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const url = `${origin}/api/mcp`
  const shown = fresh ?? 'puk_…'
  const claudeCode = `claude mcp add --transport http puc ${url} --header "Authorization: Bearer ${shown}"`
  const jsonConfig = JSON.stringify({ mcpServers: { puc: { type: 'http', url, headers: { Authorization: `Bearer ${shown}` } } } }, null, 2)

  return (
    <>
      <SettingsGroup label="Tạo key mới" hint="Key chỉ hiện một lần. Chỉ cấp quyền cần thiết; key lộ thì thu hồi ngay bên dưới.">
        <div className="space-y-3 py-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Tên key (vd: Claude Desktop)" />
          <div className="grid gap-2 sm:grid-cols-2">
            {API_KEY_SCOPE_OPTIONS.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/60 p-2.5 text-xs">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={scopes.includes(s.id)}
                  onChange={(e) => setScopes((cur) => (e.target.checked ? [...cur, s.id] : cur.filter((x) => x !== s.id)))}
                />
                <span>
                  <span className="block text-[13px] font-medium">{s.label}</span>
                  <span className="text-muted-foreground">{s.hint}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
              aria-label="Hạn dùng"
            >
              {EXPIRY.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.label}
                </option>
              ))}
            </select>
            <Button className="h-9 rounded-full px-4 text-xs" disabled={!name.trim() || !scopes.length || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Tạo key'}
            </Button>
          </div>
          {create.isError && <p className="text-xs text-destructive">{(create.error as Error).message}</p>}
        </div>
      </SettingsGroup>

      {fresh && (
        <SettingsGroup label="Key của bạn (chỉ hiện lần này)">
          <div className="space-y-3 py-3">
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-md bg-muted px-2.5 py-2 text-[11px]">{fresh}</code>
              <CopyButton text={fresh} />
            </div>
            <div>
              <p className="pb-1 text-xs font-medium">Claude Code</p>
              <div className="flex items-start gap-2">
                <code className="min-w-0 flex-1 break-all rounded-md bg-muted px-2.5 py-2 text-[11px]">{claudeCode}</code>
                <CopyButton text={claudeCode} />
              </div>
            </div>
            <div>
              <p className="pb-1 text-xs font-medium">Cursor / Claude Desktop / client khác (JSON)</p>
              <div className="flex items-start gap-2">
                <pre className="min-w-0 flex-1 overflow-x-auto rounded-md bg-muted px-2.5 py-2 text-[11px]">{jsonConfig}</pre>
                <CopyButton text={jsonConfig} />
              </div>
            </div>
          </div>
        </SettingsGroup>
      )}

      <SettingsGroup label="Key đang dùng" hint={`Endpoint MCP: ${url}`}>
        {isPending ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !keys?.length ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/70">
              <KeyRound className="h-5 w-5 text-muted-foreground" />
            </span>
            <p className="text-[13px] font-medium">Chưa có key nào</p>
          </div>
        ) : (
          keys.map((k) => (
            <div key={k.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">
                  {k.name} <span className="font-mono text-[11px] font-normal text-muted-foreground">{k.prefix}…</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {k.scopes.join(' · ')} · {k.lastUsedAt ? `dùng ${formatRelativeTime(k.lastUsedAt)}` : 'chưa dùng'}
                  {k.expiresAt ? ` · hết hạn ${new Date(k.expiresAt).toLocaleDateString('vi-VN')}` : ''}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 rounded-full px-3 text-xs text-destructive"
                disabled={revoke.isPending && revoke.variables === k.id}
                onClick={() => revoke.mutate(k.id)}
              >
                {revoke.isPending && revoke.variables === k.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Thu hồi
              </Button>
            </div>
          ))
        )}
      </SettingsGroup>
    </>
  )
}

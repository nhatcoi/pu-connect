'use client'

import React, { useState } from 'react'
import { Loader2, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { AI_TASK_LIMIT, AiTaskInputSchema, type AiConnectorId, type AiTask, type AiTaskInput } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useAiConnectors, useAiSkills, useAiTasks } from '@/hooks/chat'
import { n7aiThreadHref } from '@/lib/n7ai-routes'
import { formatRelativeTime } from '@/lib/utils'

const WEEKDAYS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
const EMPTY: AiTaskInput = { title: '', prompt: '', frequency: 'daily', runTime: '21:00', weekday: 1, connectors: ['library'], skillId: null, enabled: true }

// Mẫu dựng sẵn (điền form, sửa được trước khi lưu)
const TEMPLATES: { label: string; input: AiTaskInput }[] = [
  {
    label: 'Tóm tắt lịch mai',
    input: {
      ...EMPTY,
      title: 'Chuẩn bị ngày mai',
      prompt: 'Tóm tắt lịch ngày mai của mình và gợi ý nên ôn gì trong 1 giờ tối nay.',
      connectors: ['google_calendar', 'library']
    }
  },
  {
    label: 'Lộ trình ôn tuần',
    input: {
      ...EMPTY,
      title: 'Lộ trình tuần',
      frequency: 'weekly',
      weekday: 1,
      runTime: '07:00',
      prompt: 'Lập lộ trình ôn tập tuần này cho các môn mình đang học, chia theo ngày.'
    }
  },
  {
    label: 'Quiz mỗi ngày',
    input: { ...EMPTY, title: 'Quiz ôn tập', runTime: '20:00', prompt: 'Tạo 5 câu trắc nghiệm ôn lại kiến thức các môn mình đang học.' }
  }
]

const scheduleLabel = (t: Pick<AiTask, 'frequency' | 'runTime' | 'weekday'>) =>
  t.frequency === 'daily' ? `Hằng ngày ${t.runTime}` : `${WEEKDAYS[t.weekday ?? 0]} hằng tuần ${t.runTime}`

// Tác vụ tự động: N7AI chạy theo lịch, kết quả vào hội thoại "⏰ …" + thông báo đẩy
export function TasksPanel() {
  const { tasks, isLoading, update, remove, run } = useAiTasks()
  const [editing, setEditing] = useState<{ id: string | null; input: AiTaskInput } | null>(null)

  if (editing) return <TaskForm initial={editing.input} id={editing.id} onDone={() => setEditing(null)} />
  if (isLoading) return <Loader2 className="mx-auto my-6 h-4 w-4 animate-spin text-muted-foreground" />

  const toInput = (t: AiTask): AiTaskInput => ({
    title: t.title,
    prompt: t.prompt,
    skillId: t.skillId,
    connectors: t.connectors,
    frequency: t.frequency,
    runTime: t.runTime,
    weekday: t.weekday,
    enabled: t.enabled
  })

  return (
    <div className="space-y-3 px-4 pb-5 sm:px-5">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Giờ Việt Nam, tối đa {AI_TASK_LIMIT} tác vụ, mỗi lần chạy tính 1 lượt N7AI. Lỗi 3 lần liên tiếp ⇒ tự tạm dừng.
      </p>
      {tasks.map((t) => (
        <div key={t.id} className="rounded-xl border border-border/60 p-3">
          <div className="flex items-start gap-2">
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold">{t.title}</span>
              <span className="block text-xs text-muted-foreground">{scheduleLabel(t)}</span>
              <span className="block text-[11px] text-muted-foreground">
                {t.enabled ? `Lần tới ${formatRelativeTime(t.nextRunAt)}` : 'Đang tạm dừng'}
                {t.lastRunAt && ` · lần trước ${t.lastStatus === 'done' ? 'thành công' : t.lastStatus === 'skipped' ? 'bỏ qua (hết lượt)' : 'lỗi'}`}
              </span>
            </span>
            <Switch
              checked={t.enabled}
              onCheckedChange={(enabled) => update.mutate({ id: t.id, body: { ...toInput(t), enabled } })}
              aria-label={`Bật ${t.title}`}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" className="h-7 rounded-full gap-1 text-xs" disabled={run.isPending} onClick={() => run.mutate(t.id)}>
              {run.isPending && run.variables === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} Chạy ngay
            </Button>
            {t.conversationId && (
              <Button size="sm" variant="ghost" className="h-7 rounded-full text-xs" asChild>
                <Link href={n7aiThreadHref(t.conversationId)}>Xem kết quả</Link>
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 rounded-full gap-1 text-xs" onClick={() => setEditing({ id: t.id, input: toInput(t) })}>
              <Pencil className="h-3 w-3" /> Sửa
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 rounded-full gap-1 text-xs text-destructive"
              onClick={() => window.confirm(`Xóa tác vụ "${t.title}"?`) && remove.mutate(t.id)}
            >
              <Trash2 className="h-3 w-3" /> Xóa
            </Button>
          </div>
        </div>
      ))}
      {tasks.length < AI_TASK_LIMIT && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.label}
                type="button"
                onClick={() => setEditing({ id: null, input: tpl.input })}
                className="h-7 rounded-full bg-muted px-3 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {tpl.label}
              </button>
            ))}
          </div>
          <Button size="sm" className="w-full rounded-full gap-1.5" onClick={() => setEditing({ id: null, input: EMPTY })}>
            <Plus className="h-3.5 w-3.5" /> Tạo tác vụ
          </Button>
        </div>
      )}
    </div>
  )
}

function TaskForm({ initial, id, onDone }: { initial: AiTaskInput; id: string | null; onDone: () => void }) {
  const { create, update } = useAiTasks()
  const { data: skills } = useAiSkills()
  const { data: connectors } = useAiConnectors()
  const [form, setForm] = useState<AiTaskInput>(initial)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof AiTaskInput>(k: K, v: AiTaskInput[K]) => setForm((f) => ({ ...f, [k]: v }))
  const saving = create.isPending || update.isPending
  const usable = (connectors ?? []).filter((c) => c.available && (!c.requiresAuth || c.connected) && c.id !== 'web')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = AiTaskInputSchema.safeParse(form)
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Dữ liệu chưa hợp lệ')
    setError(null)
    if (id) update.mutate({ id, body: parsed.data }, { onSuccess: onDone })
    else create.mutate(parsed.data, { onSuccess: onDone })
  }
  const select = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm'

  return (
    <form onSubmit={submit} className="space-y-3 px-4 pb-5 sm:px-5">
      <Field label="Tên">
        <Input value={form.title} maxLength={80} onChange={(e) => set('title', e.target.value)} placeholder="Ôn tối" />
      </Field>
      <Field label="N7AI cần làm gì">
        <Textarea rows={4} value={form.prompt} maxLength={2000} onChange={(e) => set('prompt', e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Lặp lại">
          <select className={select} value={form.frequency} onChange={(e) => set('frequency', e.target.value as AiTaskInput['frequency'])}>
            <option value="daily">Hằng ngày</option>
            <option value="weekly">Hằng tuần</option>
          </select>
        </Field>
        <Field label="Giờ">
          <Input type="time" value={form.runTime} onChange={(e) => set('runTime', e.target.value)} />
        </Field>
      </div>
      {form.frequency === 'weekly' && (
        <Field label="Vào">
          <select className={select} value={form.weekday ?? 1} onChange={(e) => set('weekday', Number(e.target.value))}>
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Skill (tùy chọn)">
        <select className={select} value={form.skillId ?? ''} onChange={(e) => set('skillId', e.target.value || null)}>
          <option value="">Không dùng</option>
          {(skills ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              /{s.slug} — {s.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Nguồn">
        <div className="flex flex-wrap gap-1.5">
          {usable.map((c) => {
            const on = form.connectors.includes(c.id)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => set('connectors', on ? form.connectors.filter((x) => x !== c.id) : [...form.connectors, c.id as AiConnectorId])}
                className={`h-7 rounded-full px-3 text-xs font-medium cursor-pointer ${on ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                {c.name}
              </button>
            )
          })}
        </div>
      </Field>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="flex-1 rounded-full" onClick={onDone}>
          Hủy
        </Button>
        <Button type="submit" size="sm" className="flex-1 rounded-full" disabled={saving}>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {id ? 'Lưu' : 'Tạo tác vụ'}
        </Button>
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

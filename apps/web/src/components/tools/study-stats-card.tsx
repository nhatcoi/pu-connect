'use client'

import React, { useMemo } from 'react'
import { Flame } from 'lucide-react'
import { STUDY_HEATMAP_DAYS, type StudyStats } from '@pu/schemas'
import { Skeleton } from '@/components/ui/skeleton'
import { useStudyStats } from '@/hooks/use-study-tools'
import { cn } from '@/lib/utils'

const DAY_MS = 86_400_000
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const ms = (day: string) => Date.parse(`${day}T00:00:00Z`)
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10)
const weekday = (day: string) => WEEKDAYS[new Date(ms(day)).getUTCDay()]
const dm = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`

// Mức màu lịch nhiệt theo số lượt / ngày
const level = (n: number) => (n === 0 ? 'bg-muted' : n < 5 ? 'bg-primary/25' : n < 15 ? 'bg-primary/50' : n < 30 ? 'bg-primary/75' : 'bg-primary')

// Thống kê học ở /tools: chuỗi ngày, lịch nhiệt 16 tuần (cột = tuần, T2 → CN), thẻ đến hạn 7 ngày tới
export function StudyStatsCard() {
  const { data, isPending } = useStudyStats()
  if (isPending) return <Skeleton className="h-[212px] w-full rounded-2xl" />
  if (!data) return null
  return (
    <section className="rounded-2xl bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-2">
          <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', data.streak ? 'bg-brand-orange/15 text-brand-orange' : 'bg-muted text-muted-foreground')}>
            <Flame className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-lg font-bold leading-none tabular-nums">{data.streak} ngày</span>
            <span className="text-[11px] text-muted-foreground">{data.streak ? 'chuỗi học liên tiếp' : data.bestStreak ? 'học hôm nay để bắt đầu lại' : 'học hôm nay để bắt đầu chuỗi'}</span>
          </span>
        </div>
        <Stat value={data.today} label="lượt hôm nay" />
        <Stat value={data.bestStreak} label="ngày kỷ lục" />
        <Stat value={data.activeDays} label="ngày học / 16 tuần" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4">
        <Heatmap stats={data} />
        <Forecast stats={data} />
      </div>
    </section>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span>
      <span className="block text-sm font-semibold tabular-nums">{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </span>
  )
}

function Heatmap({ stats }: { stats: StudyStats }) {
  const { cells, weeks } = useMemo(() => {
    const today = stats.forecast[0]?.day ?? ymd(Date.now())
    const counts = new Map(stats.heatmap.map((h) => [h.day, h.count]))
    const end = ms(today)
    let start = end - (STUDY_HEATMAP_DAYS - 1) * DAY_MS
    start -= ((new Date(start).getUTCDay() + 6) % 7) * DAY_MS // lùi về thứ Hai
    const cells: { day: string; count: number }[] = []
    for (let t = start; t <= end; t += DAY_MS) cells.push({ day: ymd(t), count: counts.get(ymd(t)) ?? 0 })
    return { cells, weeks: Math.ceil(cells.length / 7) }
  }, [stats])
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">Lịch học 16 tuần</p>
      <div className="grid grid-flow-col grid-rows-7 gap-[3px]" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}>
        {cells.map((c) => (
          <span key={c.day} title={`${weekday(c.day)} ${dm(c.day)}: ${c.count} lượt`} className={cn('aspect-square w-full max-w-4 rounded-[3px]', level(c.count))} />
        ))}
      </div>
    </div>
  )
}

function Forecast({ stats }: { stats: StudyStats }) {
  const max = Math.max(1, ...stats.forecast.map((f) => f.count))
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">
        Thẻ đến hạn 7 ngày tới{stats.newCards ? ` · ${stats.newCards} thẻ mới` : ''}
      </p>
      <div className="flex h-24 items-end gap-1.5">
        {stats.forecast.map((f, i) => (
          <div key={f.day} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${dm(f.day)}: ${f.count} thẻ`}>
            <span className="text-[10px] tabular-nums text-muted-foreground">{f.count || ''}</span>
            <span className={cn('w-full rounded-t-md', i === 0 ? 'bg-brand-orange/70' : 'bg-primary/50')} style={{ height: `${(f.count / max) * 56 + 2}px` }} />
            <span className={cn('text-[10px]', i === 0 ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{i === 0 ? 'Nay' : weekday(f.day)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

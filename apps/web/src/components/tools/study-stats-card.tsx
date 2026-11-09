'use client'

import React, { useMemo } from 'react'
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

// Tiến độ học ở /tools: 3 số chính, lịch học 16 tuần (kiểu GitHub: nhãn tháng / thứ + chú giải), thẻ đến hạn 7 ngày tới
export function StudyStatsCard() {
  const { data, isPending } = useStudyStats()
  if (isPending) return <Skeleton className="h-[200px] w-full rounded-2xl" />
  if (!data) return null
  const dueSoon = data.forecast.reduce((n, f) => n + f.count, 0)
  return (
    <section className="space-y-4 rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tiến độ học</h2>
        <p className="text-[11px] text-muted-foreground">
          {data.streak ? 'Chuỗi đang chạy, giữ nhịp nhé' : data.bestStreak ? 'Học hôm nay để bắt đầu chuỗi mới' : 'Học hôm nay để bắt đầu chuỗi'}
        </p>
      </div>
      <div className="grid grid-cols-3 divide-x divide-border/60 rounded-xl bg-muted/40 py-3">
        <Stat value={data.today} label="lượt hôm nay" />
        <Stat value={data.bestStreak} label="ngày kỷ lục" />
        <Stat value={data.activeDays} label="ngày học / 16 tuần" />
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-8">
        <Heatmap stats={data} />
        <Forecast stats={data} total={dueSoon} />
      </div>
    </section>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span className="px-3 text-center">
      <span className="block text-lg font-bold leading-none tabular-nums">{value}</span>
      <span className="mt-1 block text-[11px] text-muted-foreground">{label}</span>
    </span>
  )
}

const MONTHS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12']
const LEGEND = ['bg-muted', 'bg-primary/25', 'bg-primary/50', 'bg-primary/75', 'bg-primary']
const CELL = 14 // px
const GAP = 3

function Heatmap({ stats }: { stats: StudyStats }) {
  const { cells, weeks, monthAt } = useMemo(() => {
    const today = stats.forecast[0]?.day ?? ymd(Date.now())
    const counts = new Map(stats.heatmap.map((h) => [h.day, h.count]))
    const end = ms(today)
    let start = end - (STUDY_HEATMAP_DAYS - 1) * DAY_MS
    start -= ((new Date(start).getUTCDay() + 6) % 7) * DAY_MS // lùi về thứ Hai
    const cells: { day: string; count: number }[] = []
    for (let t = start; t <= end; t += DAY_MS) cells.push({ day: ymd(t), count: counts.get(ymd(t)) ?? 0 })
    const weeks = Math.ceil(cells.length / 7)
    // Nhãn tháng ở tuần đầu tiên của mỗi tháng (cột = tuần, ô đầu cột = thứ Hai)
    const monthAt = new Map<number, string>()
    let prev = -1
    for (let w = 0; w < weeks; w++) {
      const m = Number(cells[w * 7].day.slice(5, 7)) - 1
      if (m !== prev) monthAt.set(w, MONTHS[m])
      prev = m
    }
    return { cells, weeks, monthAt }
  }, [stats])

  return (
    <div className="min-w-0 space-y-2">
      <p className="text-[11px] font-medium text-muted-foreground">Lịch học 16 tuần</p>
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-1.5" style={{ width: 'max-content' }}>
          <div className="grid grid-rows-7 pt-[18px] text-[10px] leading-none text-muted-foreground" style={{ gap: GAP }}>
            {['T2', '', 'T4', '', 'T6', '', 'CN'].map((d, i) => (
              <span key={i} className="flex items-center" style={{ height: CELL }}>
                {d}
              </span>
            ))}
          </div>
          <div>
            <div className="grid h-[18px] text-[10px] text-muted-foreground" style={{ gridTemplateColumns: `repeat(${weeks}, ${CELL}px)`, columnGap: GAP }}>
              {Array.from({ length: weeks }, (_, w) => (
                <span key={w} className="overflow-visible whitespace-nowrap">
                  {monthAt.get(w) ?? ''}
                </span>
              ))}
            </div>
            <div className="grid grid-flow-col grid-rows-7" style={{ gridTemplateColumns: `repeat(${weeks}, ${CELL}px)`, gap: GAP }}>
              {cells.map((c) => (
                <span key={c.day} title={`${weekday(c.day)} ${dm(c.day)}: ${c.count} lượt`} className={cn('rounded-[3px]', level(c.count))} style={{ width: CELL, height: CELL }} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        Ít
        {LEGEND.map((c) => (
          <span key={c} className={cn('h-2.5 w-2.5 rounded-[2px]', c)} />
        ))}
        Nhiều
      </div>
    </div>
  )
}

function Forecast({ stats, total }: { stats: StudyStats; total: number }) {
  const max = Math.max(1, ...stats.forecast.map((f) => f.count))
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-[11px] font-medium text-muted-foreground">
        Thẻ đến hạn 7 ngày tới{stats.newCards ? ` · ${stats.newCards} thẻ mới` : ''}
      </p>
      {total === 0 ? (
        <p className="rounded-xl bg-muted/40 px-3 py-6 text-center text-xs text-muted-foreground">Không có thẻ nào đến hạn trong 7 ngày tới.</p>
      ) : (
        <div className="flex h-24 items-end gap-1.5">
          {stats.forecast.map((f, i) => (
            <div key={f.day} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${dm(f.day)}: ${f.count} thẻ`}>
              <span className="text-[10px] tabular-nums text-muted-foreground">{f.count || ''}</span>
              <span className={cn('w-full rounded-t-md', i === 0 ? 'bg-brand-orange/70' : 'bg-primary/50')} style={{ height: `${(f.count / max) * 56 + 2}px` }} />
              <span className={cn('text-[10px]', i === 0 ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{i === 0 ? 'Nay' : weekday(f.day)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

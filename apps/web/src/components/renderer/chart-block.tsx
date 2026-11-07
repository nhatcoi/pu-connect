'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { color, fmt, list, niceStep, num, pretty, rec, str } from './plot-block'
import { FigureFrame, serializeSvg, useThrottledValue } from './figure-frame'
import { parsePartialJson } from './partial-json'

/**
 * Khối ```chart — biểu đồ số liệu từ JSON khai báo (cột, đường, vùng, tròn, vành khuyên, phân tán). Vẽ dần khi JSON còn đang stream.
 *
 * {"type":"bar","title":"Điểm trung bình","xlabel":"Môn","ylabel":"Điểm","unit":"đ",
 *  "labels":["Toán","Lý","Hóa"],
 *  "series":[{"name":"K15","data":[7.5,8,6.9]},{"name":"K16","data":[8,7.2,7.5],"color":"green"}],
 *  "stacked":false}
 * Gọn cho 1 chuỗi: {"type":"pie","data":[{"label":"A","value":30},{"label":"B","value":70}]}
 * Phân tán: {"type":"scatter","series":[{"name":"Mẫu","data":[[1,2],[2,3.5]]}]}
 */

const W = 640
const H = 360
const PAD = { l: 52, r: 18, t: 16, b: 44 }

interface Series {
  name: string
  color: string
  data: number[]
  points: [number, number][] // scatter
}
type Kind = 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter'
const KINDS: Kind[] = ['bar', 'line', 'area', 'pie', 'donut', 'scatter']

function parse(spec: Record<string, unknown>) {
  const raw = str(spec.type)?.toLowerCase().replace(/[-_ ]?chart$/, '')
  const kind: Kind = KINDS.find((k) => k === raw) ?? (raw === 'column' ? 'bar' : raw === 'doughnut' ? 'donut' : 'bar')
  let labels = list(spec.labels).map((l) => String(l))
  let series: Series[] = list(spec.series)
    .map((s, i) => {
      const o = rec(s)
      const arr = list(o?.data ?? s)
      const points = arr.map((p) => (Array.isArray(p) && num(p[0]) !== undefined && num(p[1]) !== undefined ? ([num(p[0])!, num(p[1])!] as [number, number]) : null)).filter((p): p is [number, number] => !!p)
      const data = arr.map((v) => num(v) ?? 0)
      return { name: str(o?.name) ?? `Chuỗi ${i + 1}`, color: color(o?.color, i), data, points }
    })
    .filter((s) => s.data.length > 0 || s.points.length > 0)
  // Rút gọn: "data":[{"label","value"}] hoặc "data":{"A":1,"B":2}
  if (series.length === 0 && spec.data) {
    const d = spec.data
    const items = Array.isArray(d)
      ? d.map((x) => {
          const o = rec(x)
          const v = num(o?.value ?? o?.y ?? x)
          return v === undefined ? null : { label: str(o?.label ?? o?.name ?? o?.x) ?? '', value: v }
        })
      : Object.entries(rec(d) ?? {}).map(([label, v]) => (num(v) === undefined ? null : { label, value: num(v)! }))
    const ok = items.filter((x): x is { label: string; value: number } => !!x)
    if (ok.length) {
      labels = ok.map((x) => x.label)
      series = [{ name: str(spec.name) ?? '', color: color(undefined, 0), data: ok.map((x) => x.value), points: [] }]
    }
  }
  return { kind, labels, series, title: str(spec.title), xlabel: str(spec.xlabel), ylabel: str(spec.ylabel), unit: str(spec.unit) ?? '', stacked: spec.stacked === true }
}

const withUnit = (s: string, unit: string) => (unit ? `${s}${/^[a-zA-Z%°]/.test(unit) && unit.length > 2 ? ' ' : ''}${unit}` : s)
const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

function build(spec: Record<string, unknown>) {
  const c = parse(spec)
  const nodes: React.ReactNode[] = []
  const { kind, series, unit } = c
  if (series.length === 0) return { nodes, legend: [] as { name: string; color: string }[], c }

  const legendItems = kind === 'pie' || kind === 'donut' ? [] : series.map((s) => ({ name: s.name, color: s.color }))

  // ── Tròn / vành khuyên ──
  if (kind === 'pie' || kind === 'donut') {
    const s = series[0]
    const labels = c.labels
    const vals = s.data.map((v) => Math.max(0, v))
    const total = vals.reduce((a, b) => a + b, 0)
    if (total <= 0) return { nodes, legend: [], c }
    const cx = W * 0.36
    const cy = H / 2 + 6
    const R = 128
    const r = kind === 'donut' ? R * 0.58 : 0
    let a0 = -Math.PI / 2
    vals.forEach((v, i) => {
      const frac = v / total
      const a1 = a0 + frac * Math.PI * 2
      const col = color(undefined, i)
      const pt = (rad: number, a: number) => `${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)}`
      const large = a1 - a0 > Math.PI ? 1 : 0
      const d =
        frac >= 0.9999
          ? `M${cx - R} ${cy}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0${r ? `M${cx - r} ${cy}a${r} ${r} 0 1 1 ${2 * r} 0a${r} ${r} 0 1 1 ${-2 * r} 0` : ''}Z`
          : `M${pt(R, a0)}A${R} ${R} 0 ${large} 1 ${pt(R, a1)}${r ? `L${pt(r, a1)}A${r} ${r} 0 ${large} 0 ${pt(r, a0)}` : `L${cx} ${cy}`}Z`
      nodes.push(
        <path key={`s${i}`} className="plot-in" d={d} fill={col} fillRule="evenodd" stroke="var(--card)" strokeWidth={2}>
          <title>{`${labels[i] ?? `#${i + 1}`}: ${withUnit(fmt(v, niceStep(total / 10)), unit)} (${(frac * 100).toFixed(1)}%)`}</title>
        </path>
      )
      if (frac >= 0.05) {
        const am = (a0 + a1) / 2
        const rr = r ? (R + r) / 2 : R * 0.65
        nodes.push(
          <text key={`p${i}`} className="plot-in" x={cx + rr * Math.cos(am)} y={cy + rr * Math.sin(am) + 4} textAnchor="middle" fontSize={12} fontWeight={600} fill="#fff" style={{ pointerEvents: 'none' }}>
            {(frac * 100).toFixed(frac < 0.1 ? 1 : 0)}%
          </text>
        )
      }
      a0 = a1
    })
    if (kind === 'donut')
      nodes.push(
        <text key="tot" x={cx} y={cy + 5} textAnchor="middle" fontSize={15} fontWeight={700} fill="currentColor">
          {withUnit(fmt(total, niceStep(total / 10)), unit)}
        </text>
      )
    const items = vals.map((v, i) => ({ name: labels[i] ?? `#${i + 1}`, color: color(undefined, i), value: v }))
    items.forEach((it, i) => {
      const y = 70 + i * 24
      if (y > H - 14) return
      nodes.push(
        <g key={`l${i}`} className="plot-in">
          <rect x={W * 0.64} y={y - 10} width={12} height={12} rx={3} fill={it.color} />
          <text x={W * 0.64 + 20} y={y} fontSize={13} fill="currentColor">
            {short(pretty(it.name), 22)}
          </text>
          <text x={W - 16} y={y} fontSize={13} textAnchor="end" fill="currentColor" fillOpacity={0.6}>
            {withUnit(fmt(it.value, niceStep(total / 10)), unit)}
          </text>
        </g>
      )
    })
    return { nodes, legend: legendItems, c }
  }

  // ── Trục cho cột / đường / vùng / phân tán ──
  const areaW = W - PAD.l - PAD.r
  const areaH = H - PAD.t - PAD.b
  const scatter = kind === 'scatter'
  const n = scatter ? 0 : Math.max(c.labels.length, ...series.map((s) => s.data.length))
  const stacked = c.stacked && kind === 'bar'

  const yVals: number[] = []
  if (scatter) series.forEach((s) => s.points.forEach((p) => yVals.push(p[1])))
  else if (stacked) {
    for (let i = 0; i < n; i++) {
      let pos = 0
      let neg = 0
      series.forEach((s) => ((s.data[i] ?? 0) >= 0 ? (pos += s.data[i] ?? 0) : (neg += s.data[i] ?? 0)))
      yVals.push(pos, neg)
    }
  } else series.forEach((s) => s.data.forEach((v) => yVals.push(v)))
  if (yVals.length === 0) return { nodes, legend: legendItems, c }
  let ymin = Math.min(...yVals)
  let ymax = Math.max(...yVals)
  if (kind === 'bar' || kind === 'area') {
    ymin = Math.min(0, ymin)
    ymax = Math.max(0, ymax)
  }
  if (ymax === ymin) ymax = ymin + 1
  const stepY = niceStep(ymax - ymin, 5)
  ymin = Math.floor(ymin / stepY) * stepY
  ymax = Math.ceil(ymax / stepY) * stepY
  const py = (v: number) => PAD.t + areaH - ((v - ymin) / (ymax - ymin)) * areaH

  let xmin = 0
  let xmax = 1
  let stepX = 1
  if (scatter) {
    const xs = series.flatMap((s) => s.points.map((p) => p[0]))
    xmin = Math.min(...xs)
    xmax = Math.max(...xs)
    if (xmax === xmin) xmax = xmin + 1
    stepX = niceStep(xmax - xmin, 6)
    xmin = Math.floor(xmin / stepX) * stepX
    xmax = Math.ceil(xmax / stepX) * stepX
  }
  const slot = scatter ? 0 : areaW / Math.max(n, 1)
  const px = (i: number) => PAD.l + slot * (i + 0.5)
  const pxs = (v: number) => PAD.l + ((v - xmin) / (xmax - xmin)) * areaW

  for (let v = ymin; v <= ymax + 1e-9; v += stepY) {
    nodes.push(<line key={`gy${v}`} x1={PAD.l} y1={py(v)} x2={PAD.l + areaW} y2={py(v)} stroke="currentColor" strokeOpacity={v === 0 ? 0.55 : 0.1} strokeWidth={v === 0 ? 1.2 : 1} />)
    nodes.push(
      <text key={`ty${v}`} x={PAD.l - 8} y={py(v) + 4} textAnchor="end" fontSize={11} fill="currentColor" fillOpacity={0.6}>
        {fmt(v, stepY)}
      </text>
    )
  }
  if (scatter) {
    for (let v = xmin; v <= xmax + 1e-9; v += stepX) {
      nodes.push(<line key={`gx${v}`} x1={pxs(v)} y1={PAD.t} x2={pxs(v)} y2={PAD.t + areaH} stroke="currentColor" strokeOpacity={0.07} />)
      nodes.push(
        <text key={`tx${v}`} x={pxs(v)} y={PAD.t + areaH + 16} textAnchor="middle" fontSize={11} fill="currentColor" fillOpacity={0.6}>
          {fmt(v, stepX)}
        </text>
      )
    }
  } else {
    const every = Math.ceil(n / Math.max(1, Math.floor(areaW / 56)))
    for (let i = 0; i < n; i += every) {
      nodes.push(
        <text key={`tx${i}`} x={px(i)} y={PAD.t + areaH + 16} textAnchor="middle" fontSize={11} fill="currentColor" fillOpacity={0.7}>
          {short(pretty(c.labels[i] ?? String(i + 1)), Math.max(6, Math.floor(slot / 6.5 * every)))}
        </text>
      )
    }
  }
  if (c.xlabel)
    nodes.push(
      <text key="xl" x={PAD.l + areaW / 2} y={H - 6} textAnchor="middle" fontSize={12} fill="currentColor" fillOpacity={0.8}>
        {pretty(c.xlabel)}
      </text>
    )
  if (c.ylabel)
    nodes.push(
      <text key="yl" x={12} y={PAD.t + areaH / 2} textAnchor="middle" fontSize={12} fill="currentColor" fillOpacity={0.8} transform={`rotate(-90 12 ${PAD.t + areaH / 2})`}>
        {pretty(c.ylabel)}
      </text>
    )

  const tip = (name: string, label: string, v: number) => `${name ? `${name} · ` : ''}${label}: ${withUnit(fmt(v, stepY / 10), unit)}`

  if (kind === 'bar') {
    const groups = stacked ? 1 : series.length
    const bw = Math.min(46, (slot * 0.72) / groups)
    for (let i = 0; i < n; i++) {
      let pos = 0
      let neg = 0
      series.forEach((s, si) => {
        const v = s.data[i]
        if (v === undefined) return
        let y0: number
        let y1: number
        if (stacked) {
          if (v >= 0) {
            y0 = pos
            y1 = pos + v
            pos = y1
          } else {
            y0 = neg
            y1 = neg + v
            neg = y1
          }
        } else {
          y0 = 0
          y1 = v
        }
        const x = stacked ? px(i) - bw / 2 : px(i) - (bw * groups) / 2 + si * bw
        const top = Math.min(py(y0), py(y1))
        nodes.push(
          <rect key={`b${i}-${si}`} className="plot-in" x={x + (stacked ? 0 : 1)} y={top} width={Math.max(2, bw - (stacked ? 0 : 2))} height={Math.max(1, Math.abs(py(y0) - py(y1)))} rx={3} fill={s.color}>
            <title>{tip(s.name, c.labels[i] ?? String(i + 1), v)}</title>
          </rect>
        )
        if (!stacked && n * groups <= 14)
          nodes.push(
            <text key={`bv${i}-${si}`} className="plot-in" x={x + bw / 2} y={v >= 0 ? top - 5 : top + Math.abs(py(y0) - py(y1)) + 13} textAnchor="middle" fontSize={11} fill="currentColor" fillOpacity={0.75}>
              {fmt(v, stepY / 10)}
            </text>
          )
      })
    }
  } else if (kind === 'line' || kind === 'area') {
    series.forEach((s, si) => {
      const pts = s.data.map((v, i) => [px(i), py(v)] as const)
      if (pts.length === 0) return
      const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('')
      if (kind === 'area') nodes.push(<path key={`a${si}`} className="plot-in" d={`${line}L${pts[pts.length - 1][0].toFixed(1)} ${py(0).toFixed(1)}L${pts[0][0].toFixed(1)} ${py(0).toFixed(1)}Z`} fill={s.color} fillOpacity={0.18} />)
      nodes.push(<path key={`l${si}`} className="plot-in" d={line} fill="none" stroke={s.color} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />)
      pts.forEach((p, i) =>
        nodes.push(
          <circle key={`d${si}-${i}`} className="plot-in" cx={p[0]} cy={p[1]} r={3.6} fill={s.color} stroke="var(--card)" strokeWidth={1.5}>
            <title>{tip(s.name, c.labels[i] ?? String(i + 1), s.data[i])}</title>
          </circle>
        )
      )
    })
  } else {
    series.forEach((s, si) =>
      s.points.forEach((p, i) =>
        nodes.push(
          <circle key={`sc${si}-${i}`} className="plot-in" cx={pxs(p[0])} cy={py(p[1])} r={4.5} fill={s.color} fillOpacity={0.75} stroke="var(--card)" strokeWidth={1}>
            <title>{`${s.name ? `${s.name} · ` : ''}(${fmt(p[0], stepX / 10)}; ${fmt(p[1], stepY / 10)})`}</title>
          </circle>
        )
      )
    )
  }
  return { nodes, legend: legendItems, c }
}

/** Biểu đồ số liệu từ JSON khai báo (không cần thư viện ngoài). */
export function ChartBlock({ content, code }: { content: string; code?: React.ReactNode }) {
  const src = useThrottledValue(content)
  const boxRef = useRef<HTMLDivElement>(null)
  const complete = useMemo(() => {
    try {
      JSON.parse(content)
      return true
    } catch {
      return false
    }
  }, [content])
  const scene = useMemo(() => {
    const spec = rec(parsePartialJson(src))
    if (!spec) return null
    try {
      return build(spec)
    } catch {
      return null
    }
  }, [src])

  const [settled, setSettled] = useState(false)
  useEffect(() => {
    setSettled(false)
    const t = setTimeout(() => setSettled(true), 1800)
    return () => clearTimeout(t)
  }, [content])

  const has = !!scene && scene.nodes.length > 0
  const view = has ? (
    <div ref={boxRef}>
      {scene.c.title && <p className="px-4 pt-3 text-sm font-semibold">{pretty(scene.c.title)}</p>}
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full max-w-[680px] p-2 text-foreground" role="img" aria-label={scene.c.title ?? 'Biểu đồ'}>
        {scene.nodes}
      </svg>
      {scene.legend.length > 1 && (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 px-4 pb-3 text-xs">
          {scene.legend.map((l) => (
            <span key={l.name} className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-sm" style={{ background: l.color }} />
              {pretty(l.name)}
            </span>
          ))}
        </div>
      )}
    </div>
  ) : settled ? (
    <p className="p-3 text-xs font-semibold text-destructive">Không vẽ được biểu đồ (JSON thiếu dữ liệu)</p>
  ) : (
    <div className="h-40 animate-pulse bg-muted/40" />
  )

  return <FigureFrame view={view} code={code ?? <code>{content}</code>} rawCode={content} fileName="bieu-do.svg" getSvg={complete && has ? () => serializeSvg(boxRef.current) : undefined} busy={!complete && !settled} />
}
